#!/usr/bin/env tsx
import { Open } from 'unzipper'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { Client } from 'pg'
import * as shapefile from 'shapefile'
import { TIGER_SOURCES, FEDERAL_SENATE_SOURCE, TIGER_VERSION } from './tiger-config.ts'
import { STATE_FIPS } from './tiger-state-fips.ts'
import { loadTigerZip, evictTigerCache, tigerCacheDir } from './tiger-cache.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type FeatureInsert = {
  tier: string
  state: string
  code: string
  name: string
  geometryGeoJSON: object
}

type IngestStats = {
  ingestedByTier: Map<string, number>
  gaps: Array<{ url: string; status: number }>
  errors: Array<{ url: string; message: string }>
  skipped: number
}

type IngestCtx = {
  client: Client
  workDir: string
  cacheDir: string
  skip: { tierStates: Set<string>; tiers: Set<string> }
  stats: IngestStats
}

async function loadSkipSet(client: Client): Promise<IngestCtx['skip']> {
  const result = await client.query<{ tier: string; state: string }>(
    `select distinct tier, state from public.districts where source_version = $1`,
    [TIGER_VERSION]
  )
  const tierStates = new Set<string>()
  const tiers = new Set<string>()
  for (const row of result.rows) {
    tierStates.add(`${row.tier}:${row.state}`)
    tiers.add(row.tier)
  }
  return { tierStates, tiers }
}

async function downloadAndUnzip(
  url: string,
  ctx: IngestCtx,
): Promise<{ shp: string; dbf: string } | null> {
  let loaded = await loadTigerZip(url, ctx.cacheDir)
  if (loaded.kind === 'gap') {
    console.warn(`  GAP ${url} — ${loaded.message} (Census may not have published yet)`)
    ctx.stats.gaps.push({ url, status: loaded.status })
    return null
  }
  if (loaded.kind === 'error') {
    console.error(`  ERROR ${url} failed after ${loaded.attempts} attempts: ${loaded.message}`)
    ctx.stats.errors.push({ url, message: loaded.message })
    return null
  }
  console.log(loaded.fromCache ? `  Cached ${basename(new URL(url).pathname)}` : `  Fetched ${url}`)

  let dir
  try {
    dir = await Open.buffer(Buffer.from(loaded.body))
  } catch (e) {
    if (loaded.fromCache) {
      // Corrupt cache entry — evict and re-fetch once.
      console.warn(`  Corrupt cache for ${url} — re-fetching`)
      await evictTigerCache(url, ctx.cacheDir)
      loaded = await loadTigerZip(url, ctx.cacheDir)
      if (loaded.kind !== 'ok') {
        const msg = loaded.kind === 'error' ? loaded.message : 'gap on re-fetch'
        console.error(`  ERROR ${url} on re-fetch: ${msg}`)
        ctx.stats.errors.push({ url, message: msg })
        return null
      }
      try {
        dir = await Open.buffer(Buffer.from(loaded.body))
      } catch (e2) {
        console.error(`  ERROR ${url}: corrupt zip after re-fetch`)
        ctx.stats.errors.push({ url, message: `corrupt zip after re-fetch: ${String(e2)}` })
        return null
      }
    } else {
      console.error(`  ERROR ${url}: unzip failed`)
      ctx.stats.errors.push({ url, message: `unzip failed: ${String(e)}` })
      return null
    }
  }

  let shpPath = '', dbfPath = ''
  for (const entry of dir.files) {
    const lower = entry.path.toLowerCase()
    if (lower.endsWith('.shp')) {
      shpPath = join(ctx.workDir, entry.path)
      await writeFile(shpPath, await entry.buffer())
    } else if (lower.endsWith('.dbf')) {
      dbfPath = join(ctx.workDir, entry.path)
      await writeFile(dbfPath, await entry.buffer())
    }
  }
  if (!shpPath || !dbfPath) {
    console.error(`  ERROR ${url}: no .shp/.dbf in archive`)
    ctx.stats.errors.push({ url, message: 'no .shp/.dbf in archive' })
    return null
  }
  return { shp: shpPath, dbf: dbfPath }
}

async function ingestSource(ctx: IngestCtx, source: typeof TIGER_SOURCES[number]) {
  let tierTotal = 0
  for (const { url, stateFips } of source.urls()) {
    // Per-URL skip key: per-state URLs use "tier:state"; nationwide URLs
    // (no stateFips) use just the tier name (any-row-present heuristic).
    let skipKey: string
    let isStateKeyed: boolean
    if (stateFips) {
      const stateInfo = STATE_FIPS.find(s => s.fips === stateFips)
      skipKey = `${source.tier}:${stateInfo?.state ?? '??'}`
      isStateKeyed = true
    } else {
      skipKey = source.tier
      isStateKeyed = false
    }

    const alreadyIngested = isStateKeyed
      ? ctx.skip.tierStates.has(skipKey)
      : ctx.skip.tiers.has(skipKey)

    if (alreadyIngested) {
      console.log(`  Skipping ${url} (already ingested at ${TIGER_VERSION})`)
      ctx.stats.skipped++
      continue
    }

    const downloaded = await downloadAndUnzip(url, ctx)
    if (!downloaded) continue

    const inserts: FeatureInsert[] = []
    const reader = await shapefile.open(downloaded.shp, downloaded.dbf)
    while (true) {
      const result = await reader.read()
      if (result.done) break
      const props = result.value.properties as Record<string, unknown>
      const meta = source.extract(props, stateFips)
      if (!meta) continue
      const geom = result.value.geometry
      if (geom.type !== 'MultiPolygon' && geom.type !== 'Polygon') continue
      const geometry = geom.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [geom.coordinates] }
        : geom
      inserts.push({ tier: source.tier, ...meta, geometryGeoJSON: geometry })
    }

    // Flush per-URL so partial progress survives a later crash.
    await flushInserts(ctx.client, inserts)
    tierTotal += inserts.length
  }
  ctx.stats.ingestedByTier.set(
    source.tier,
    (ctx.stats.ingestedByTier.get(source.tier) ?? 0) + tierTotal
  )
  console.log(`  ${source.tier}: ${tierTotal} features ingested`)
}

async function ingestFederalSenate(ctx: IngestCtx) {
  if (ctx.skip.tiers.has('federal_senate')) {
    console.log(`  Skipping federal_senate (already ingested at ${TIGER_VERSION})`)
    ctx.stats.skipped++
    return
  }

  const downloaded = await downloadAndUnzip(FEDERAL_SENATE_SOURCE.url, ctx)
  if (!downloaded) return

  const reader = await shapefile.open(downloaded.shp, downloaded.dbf)
  const inserts: FeatureInsert[] = []
  // DC has no senators — exclude it from the synthesis.
  const fipsToState = new Map(
    STATE_FIPS.filter(s => s.state !== 'DC').map(s => [s.fips, s])
  )
  while (true) {
    const r = await reader.read()
    if (r.done) break
    const props = r.value.properties as Record<string, unknown>
    const stateFp = String(props.STATEFP)
    const stateInfo = fipsToState.get(stateFp)
    if (!stateInfo) continue
    if (r.value.geometry.type !== 'MultiPolygon' && r.value.geometry.type !== 'Polygon') continue
    const geometry = r.value.geometry.type === 'Polygon'
      ? { type: 'MultiPolygon', coordinates: [r.value.geometry.coordinates] }
      : r.value.geometry
    for (const seat of ['S1', 'S2']) {
      inserts.push({
        tier: 'federal_senate',
        state: stateInfo.state,
        code: `${stateInfo.state}-${seat}`,
        name: `${stateInfo.name} (Class ${seat === 'S1' ? '1' : '2'} U.S. Senate seat)`,
        geometryGeoJSON: geometry,
      })
    }
  }
  await flushInserts(ctx.client, inserts)
  ctx.stats.ingestedByTier.set('federal_senate', inserts.length)
  console.log(`  federal_senate: ${inserts.length} features (synthesized)`)
}

async function flushInserts(client: Client, rows: FeatureInsert[]) {
  if (rows.length === 0) return
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const placeholders: string[] = []
    slice.forEach((r, idx) => {
      const o = idx * 6
      placeholders.push(
        `($${o+1}, $${o+2}, $${o+3}, $${o+4}, ST_GeomFromGeoJSON($${o+5})::geography, $${o+6})`
      )
      values.push(r.tier, r.state, r.code, r.name, JSON.stringify(r.geometryGeoJSON), TIGER_VERSION)
    })
    await client.query(
      `insert into public.districts (tier, state, code, name, geometry, source_version)
       values ${placeholders.join(',')}
       on conflict (tier, code) do update
         set state = excluded.state,
             name = excluded.name,
             geometry = excluded.geometry,
             source_version = excluded.source_version`,
      values
    )
  }
}

function printSummary(stats: IngestStats) {
  console.log('')
  console.log(`Ingest summary (${TIGER_VERSION}):`)
  for (const tier of [...stats.ingestedByTier.keys()].sort()) {
    console.log(`  ${tier}: ${stats.ingestedByTier.get(tier)} features ingested`)
  }
  if (stats.skipped > 0) {
    console.log(`  Skipped: ${stats.skipped} URL(s) already ingested at ${TIGER_VERSION}`)
  }
  if (stats.gaps.length > 0) {
    console.log(`  Gaps: ${stats.gaps.length} (Census hasn't published yet — re-run later):`)
    for (const gap of stats.gaps) {
      console.log(`    - HTTP ${gap.status}: ${gap.url}`)
    }
  }
  if (stats.errors.length > 0) {
    console.log(`  Errors: ${stats.errors.length} (pipeline failures — investigate):`)
    for (const err of stats.errors) {
      console.log(`    - ${err.message}: ${err.url}`)
    }
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log(`Connected. Ingesting ${TIGER_VERSION}...`)

  const stats: IngestStats = {
    ingestedByTier: new Map(),
    gaps: [],
    errors: [],
    skipped: 0,
  }
  const skip = await loadSkipSet(client)
  if (skip.tierStates.size > 0 || skip.tiers.size > 0) {
    console.log(`Resume: ${skip.tierStates.size} (tier, state) tuples already present at ${TIGER_VERSION}`)
  }
  const workDir = await mkdtemp(join(tmpdir(), 'tiger-'))
  const cacheDir = tigerCacheDir()
  console.log(`TIGER zip cache: ${cacheDir}`)
  const ctx: IngestCtx = { client, workDir, cacheDir, skip, stats }
  try {
    for (const source of TIGER_SOURCES) {
      console.log(`Tier: ${source.tier}`)
      await ingestSource(ctx, source)
    }
    console.log(`Tier: federal_senate (synthesized)`)
    await ingestFederalSenate(ctx)
  } finally {
    await rm(workDir, { recursive: true, force: true })
    await client.end()
  }

  printSummary(stats)

  // Exit semantics: errors fail CI; gaps don't (Census publishing cadence
  // is not a pipeline problem — operator re-runs when files land).
  if (stats.errors.length > 0) {
    console.log('Ingest completed with errors.')
    process.exit(1)
  }
  if (stats.gaps.length > 0) {
    console.log('Ingest completed with gaps (re-run when Census publishes).')
  } else {
    console.log('Ingest complete.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
