#!/usr/bin/env tsx
import { fetch } from 'undici'
import { Open } from 'unzipper'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import * as shapefile from 'shapefile'
import { TIGER_SOURCES, FEDERAL_SENATE_SOURCE, TIGER_VERSION } from './tiger-config.ts'
import { STATE_FIPS } from './tiger-state-fips.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type FeatureInsert = {
  tier: string
  state: string
  code: string
  name: string
  geometryGeoJSON: object
}

async function downloadAndUnzip(url: string, workDir: string): Promise<{ shp: string; dbf: string }> {
  console.log(`  Fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const dir = await Open.buffer(buf)
  let shpPath = '', dbfPath = ''
  for (const entry of dir.files) {
    const lower = entry.path.toLowerCase()
    if (lower.endsWith('.shp')) {
      shpPath = join(workDir, entry.path)
      await entry.buffer().then((b: Buffer) => import('node:fs/promises').then(fs => fs.writeFile(shpPath, b)))
    } else if (lower.endsWith('.dbf')) {
      dbfPath = join(workDir, entry.path)
      await entry.buffer().then((b: Buffer) => import('node:fs/promises').then(fs => fs.writeFile(dbfPath, b)))
    }
  }
  if (!shpPath || !dbfPath) throw new Error(`No .shp/.dbf in ${url}`)
  return { shp: shpPath, dbf: dbfPath }
}

async function ingestSource(client: Client, source: typeof TIGER_SOURCES[number], workDir: string) {
  const inserts: FeatureInsert[] = []
  for (const { url, stateFips } of source.urls()) {
    const { shp, dbf } = await downloadAndUnzip(url, workDir)
    const reader = await shapefile.open(shp, dbf)
    while (true) {
      const result = await reader.read()
      if (result.done) break
      const props = result.value.properties as Record<string, unknown>
      const meta = source.extract(props, stateFips)
      if (!meta) continue
      const geom = result.value.geometry
      if (geom.type !== 'MultiPolygon' && geom.type !== 'Polygon') continue
      // Normalize to MultiPolygon so the column type matches.
      const geometry = geom.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [geom.coordinates] }
        : geom
      inserts.push({ tier: source.tier, ...meta, geometryGeoJSON: geometry })
    }
  }
  console.log(`  ${source.tier}: ${inserts.length} features ingested`)
  await flushInserts(client, inserts)
}

async function ingestFederalSenate(client: Client, workDir: string) {
  const { shp, dbf } = await downloadAndUnzip(FEDERAL_SENATE_SOURCE.url, workDir)
  const reader = await shapefile.open(shp, dbf)
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
  console.log(`  federal_senate: ${inserts.length} features (synthesized)`)
  await flushInserts(client, inserts)
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

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log(`Connected. Ingesting ${TIGER_VERSION}...`)
  const workDir = await mkdtemp(join(tmpdir(), 'tiger-'))
  try {
    for (const source of TIGER_SOURCES) {
      console.log(`Tier: ${source.tier}`)
      await ingestSource(client, source, workDir)
    }
    console.log(`Tier: federal_senate (synthesized)`)
    await ingestFederalSenate(client, workDir)
  } finally {
    await rm(workDir, { recursive: true, force: true })
    await client.end()
  }
  console.log('Ingest complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
