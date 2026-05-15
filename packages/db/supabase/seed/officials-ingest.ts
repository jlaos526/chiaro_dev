#!/usr/bin/env tsx
// Slice 3 officials ingest — defensive Congress.gov v3 pipeline.
// See spec § Ingest pipeline. Run via `pnpm seed:officials`.

import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import type { NormalizedMember } from './normalize.ts'
import { fetchMembers } from './congress-gov.ts'
import {
  OFFICIALS_CONGRESS,
  OFFICIALS_SOURCE,
  OFFICIALS_DB_URL,
  MIN_HOUSE_COUNT,
  MIN_SENATE_COUNT,
  AT_LARGE_STATES,
  // AT_LARGE_DISTRICT_NUMBER is intentionally NOT used for district key
  // construction — TIGER encodes at-large as the string 'AL', not 0.
  // See districtKey() below.
  // DEACTIVATE_THRESHOLD_ABS / DEACTIVATE_THRESHOLD_PCT are imported by
  // Task 16 when the set-diff / threshold guard logic lands.
} from './officials-config.ts'

export interface IngestArgs {
  apiKey:               string
  allowDeactivations?:  number      // explicit ack of expected deactivation count
  congress?:            string      // override OFFICIALS_CONGRESS (for tests)
  fetcher?:             typeof fetchMembers   // injection for tests
}

export interface IngestStats {
  runId:             string
  fetched:           number
  ingested:          number
  unresolved:        Array<{ bioguideId: string; reason: string }>
  deactivated:       number
  status:            'completed' | 'failed' | 'aborted'
  error?:            string
}

type DistrictKey  = string   // 'federal_house:CA:12' or 'federal_senate:CA'
type DistrictMap  = Map<DistrictKey, string>   // → district.id

// ---- helpers ----

// Build the synthetic district lookup key for a NormalizedMember.
// House key format: 'federal_house:<STATE>:<SUFFIX>' where SUFFIX is the
// 2-digit zero-padded Congress.gov district number, or 'AL' for at-large
// states. This matches TIGER's `districts.code` column ('CA-12', 'WY-AL')
// once the state-and-dash prefix is stripped — see loadDistrictMap below.
// Senate key collapses to 'federal_senate:<STATE>'; TIGER stores two senate
// rows per state ('<STATE>-S1' and '<STATE>-S2') but the active-officials
// flow only needs ANY senate-tier district_id for the state's two seats.
function districtKey(member: NormalizedMember): DistrictKey | null {
  if (member.chamber === 'senate') {
    return `federal_senate:${member.state}`
  }
  if (AT_LARGE_STATES.has(member.state)) {
    return `federal_house:${member.state}:AL`
  }
  if (member.districtNumber === null) return null
  // TIGER (tiger-config.ts) preserves the Census 2-digit zero-padded CD119FP
  // value (e.g. '01', '12'). Congress.gov returns a bare integer. Pad here
  // so the lookup key matches.
  const suffix = String(member.districtNumber).padStart(2, '0')
  return `federal_house:${member.state}:${suffix}`
}

async function loadDistrictMap(client: Client): Promise<DistrictMap> {
  const rows = await client.query<{
    id: string; tier: string; state: string; code: string;
  }>(`select id, tier, state, code from public.districts
      where tier in ('federal_house','federal_senate')`)
  const map = new Map<DistrictKey, string>()
  for (const r of rows.rows) {
    if (r.tier === 'federal_senate') {
      // TIGER stores '<STATE>-S1' and '<STATE>-S2'. Collapse both onto a
      // single per-state senate key — either seat's district_id is valid
      // as an fk target. The second iteration overwrites the first; this
      // is intentional (the rows share geometry; the choice is arbitrary).
      map.set(`federal_senate:${r.state}`, r.id)
    } else if (r.tier === 'federal_house') {
      // r.code is e.g. 'CA-12' or 'WY-AL'. Translate to the synthetic
      // key namespace that districtKey() emits.
      const dash = r.code.indexOf('-')
      const suffix = dash >= 0 ? r.code.slice(dash + 1) : r.code
      map.set(`federal_house:${r.state}:${suffix}`, r.id)
    }
  }
  return map
}

async function upsertOfficial(
  client: Client,
  member: NormalizedMember,
  districtId: string,
  congress: string,
): Promise<void> {
  await client.query(`
    insert into public.officials (
      bioguide_id, first_name, last_name, full_name, chamber, party, state,
      district_id, senate_class, portrait_url, official_url, twitter_handle,
      next_election, in_office, source_version
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14)
    on conflict (bioguide_id) do update set
      first_name     = excluded.first_name,
      last_name      = excluded.last_name,
      full_name      = excluded.full_name,
      chamber        = excluded.chamber,
      party          = excluded.party,
      state          = excluded.state,
      district_id    = excluded.district_id,
      senate_class   = excluded.senate_class,
      portrait_url   = excluded.portrait_url,
      official_url   = excluded.official_url,
      twitter_handle = excluded.twitter_handle,
      next_election  = excluded.next_election,
      in_office      = true,
      source_version = excluded.source_version
  `, [
    member.bioguideId, member.firstName, member.lastName, member.fullName,
    member.chamber, member.party, member.state, districtId, member.senateClass,
    member.portraitUrl, member.officialUrl, null, member.nextElection,
    congress,
  ])
}

// ---- main flow ----

export async function ingestOfficials(args: IngestArgs): Promise<IngestStats> {
  const congress = args.congress ?? OFFICIALS_CONGRESS
  const fetcher  = args.fetcher  ?? fetchMembers

  const client = new Client({ connectionString: OFFICIALS_DB_URL })
  let runId: string | null = null

  const stats: IngestStats = {
    runId: '', fetched: 0, ingested: 0, unresolved: [], deactivated: 0,
    status: 'completed',
  }

  try {
    await client.connect()

    // Step 1: open audit run (outside transaction so it persists on failure).
    // Inside try/finally so a failure here still hits client.end().
    const flags = args.allowDeactivations !== undefined
      ? [`--allow-deactivations=${args.allowDeactivations}`]
      : []
    const openRes = await client.query<{ id: string }>(`
      insert into public.officials_ingest_runs (congress, source, status, flags)
      values ($1,$2,'in_progress',$3) returning id
    `, [congress, OFFICIALS_SOURCE, flags])
    runId = openRes.rows[0].id
    stats.runId = runId

    // Step 2: fetch both chambers in parallel
    const [house, senate] = await Promise.all([
      fetcher('house',  congress, args.apiKey),
      fetcher('senate', congress, args.apiKey),
    ])
    stats.fetched = house.length + senate.length

    // Step 3: pre-flight sanity check (Improvement 2)
    if (house.length < MIN_HOUSE_COUNT) {
      throw new Error(`Pre-flight failed: house count ${house.length} < ${MIN_HOUSE_COUNT}`)
    }
    if (senate.length < MIN_SENATE_COUNT) {
      throw new Error(`Pre-flight failed: senate count ${senate.length} < ${MIN_SENATE_COUNT}`)
    }

    // Step 4: load district lookup
    const districts = await loadDistrictMap(client)

    // Step 5: BEGIN transaction
    await client.query('BEGIN')

    // Step 6: resolve + upsert
    const ingestedBioguideIds: string[] = []
    for (const member of [...house, ...senate]) {
      const key = districtKey(member)
      const districtId = key ? districts.get(key) : undefined
      if (!districtId) {
        stats.unresolved.push({
          bioguideId: member.bioguideId,
          reason: `district not found for key=${key ?? '<none>'}`,
        })
        continue
      }
      await upsertOfficial(client, member, districtId, congress)
      ingestedBioguideIds.push(member.bioguideId)
      stats.ingested++
    }

    // (Steps 7-11 in Task 16: deactivation set-diff + threshold guard.)
    // Task 16 will use `ingestedBioguideIds` to identify previously-active
    // officials that did not appear in this ingest and either:
    //   • flip `in_office=false` (deactivate) if under threshold, or
    //   • abort the transaction if over threshold and --allow-deactivations
    //     was not supplied / does not match.
    // Until then, the transaction commits with deactivated=0.
    void ingestedBioguideIds

    await closeRun(client, runId, stats, 'completed')
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    stats.status = 'failed'
    stats.error = err instanceof Error ? err.message : String(err)
    if (runId) {
      await failRun(client, runId, stats.error).catch(() => {})
    }
    throw err
  } finally {
    await client.end().catch(() => {})
  }

  return stats
}

// ---- audit-row writers ----

async function closeRun(
  client: Client, runId: string, stats: IngestStats,
  status: 'completed' | 'aborted',
): Promise<void> {
  await client.query(`
    update public.officials_ingest_runs
      set status = $1, completed_at = now(),
          fetched_count = $2, ingested_count = $3, deactivated_count = $4
      where id = $5
  `, [status, stats.fetched, stats.ingested, stats.deactivated, runId])
}

async function failRun(
  client: Client, runId: string, error: string,
): Promise<void> {
  // Separate transaction — failRun must persist even after ROLLBACK.
  await client.query(`
    update public.officials_ingest_runs
      set status = 'failed', completed_at = now(), error = $1
      where id = $2
  `, [error.slice(0, 4000), runId])
}

// ---- CLI entry ----

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const apiKey = process.env.CONGRESS_GOV_API_KEY
  if (!apiKey) {
    console.error('CONGRESS_GOV_API_KEY env var is required')
    process.exit(1)
  }
  const allowFlag = process.argv.find((a) => a.startsWith('--allow-deactivations='))
  const allowDeactivations = allowFlag
    ? Number(allowFlag.split('=')[1])
    : undefined

  ingestOfficials({ apiKey, allowDeactivations })
    .then((stats) => {
      console.log(JSON.stringify(stats, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('Ingest failed:', err)
      process.exit(2)
    })
}
