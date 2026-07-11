import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestOfficials } from './officials-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIX_DIR = join(__dirname, 'fixtures')
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Final entry is at-large.
const TEST_STATES = ['CA', 'TX', 'NY', 'FL', 'WY'] as const

// Five-square MULTIPOLYGON used as filler geometry for every fixture
// district. The CHECK constraint on `districts.geometry` requires
// `geography(MultiPolygon, 4326)`.
const FIXTURE_GEOM = `MULTIPOLYGON(((-120 35, -119 35, -119 36, -120 36, -120 35)))`

// ---- fixture generation ----------------------------------------------------

// bioguideId schema requires min length 5; pad short identifiers.
function senatorRecord(
  bioguideId: string,
  stateCode: string,
  senateClass: 1 | 2 | 3,
  partyName: string,
) {
  return {
    bioguideId,
    firstName: 'F' + bioguideId,
    lastName: 'L' + bioguideId,
    directOrderName: 'F' + bioguideId + ' L' + bioguideId,
    partyName,
    state: stateCode,
    stateCode,
    chamber: 'Senate',
    district: null,
    senateClass,
    terms: { item: [{ chamber: 'Senate', startYear: 2023 }] },
    officialWebsiteUrl: 'https://example.gov',
    nextElection: '2026-11-03',
  }
}

function houseRecord(bioguideId: string, stateCode: string, district: number, partyName: string) {
  return {
    bioguideId,
    firstName: 'F' + bioguideId,
    lastName: 'L' + bioguideId,
    directOrderName: 'F' + bioguideId + ' L' + bioguideId,
    partyName,
    state: stateCode,
    stateCode,
    chamber: 'House of Representatives',
    district,
    senateClass: null,
    terms: { item: [{ chamber: 'House of Representatives', startYear: 2023 }] },
    officialWebsiteUrl: 'https://example.gov',
    nextElection: '2026-11-03',
  }
}

function pageOf(members: unknown[]) {
  return { members, pagination: { next: null } }
}

async function writeJson(name: string, body: unknown) {
  await writeFile(join(FIX_DIR, name), JSON.stringify(body, null, 2))
}

async function loadFixture(name: string): Promise<any> {
  return JSON.parse(await readFile(join(FIX_DIR, name), 'utf8'))
}

async function ensureFixtures() {
  await mkdir(FIX_DIR, { recursive: true })

  // Senate: 2 senators per TEST_STATE with classes 1 & 2, then pad to 100
  // with CA class-3 senators (all collapse to CA's senate district).
  const senateFull: ReturnType<typeof senatorRecord>[] = []
  for (const state of TEST_STATES) {
    senateFull.push(senatorRecord(`S${state}001`, state, 1, 'Democratic'))
    senateFull.push(senatorRecord(`S${state}002`, state, 2, 'Republican'))
  }
  for (let i = 0; i < 90; i++) {
    const idx = i.toString().padStart(3, '0')
    senateFull.push(senatorRecord(`SPAD${idx}`, 'CA', 3, 'Democratic'))
  }

  // House: CA/TX/NY/FL each 1..15 + WY at-large (district=0), then pad to 440
  // with extra CA-1 seats (all collapse to the same district_id).
  const houseFull: ReturnType<typeof houseRecord>[] = []
  for (const state of ['CA', 'TX', 'NY', 'FL'] as const) {
    for (let n = 1; n <= 15; n++) {
      const idx = n.toString().padStart(2, '0')
      houseFull.push(houseRecord(`H${state}${idx}`, state, n, n % 2 ? 'Democratic' : 'Republican'))
    }
  }
  houseFull.push(houseRecord('HWY0AL', 'WY', 0, 'Republican'))
  // Pad to 460 — the threshold-guard tests drop 50 from the head and the
  // result must still clear MIN_HOUSE_COUNT (400) so the second run reaches
  // the deactivation guard rather than pre-flight aborting.
  for (let i = houseFull.length; i < 460; i++) {
    const idx = i.toString().padStart(3, '0')
    houseFull.push(houseRecord(`HPAD${idx}`, 'CA', 1, 'Democratic'))
  }

  await writeJson('congress-gov-house-119-full.json', pageOf(houseFull))
  await writeJson('congress-gov-senate-119-full.json', pageOf(senateFull))

  // 350 < MIN_HOUSE_COUNT (400) — should trigger pre-flight abort.
  await writeJson('congress-gov-house-partial.json', pageOf(houseFull.slice(0, 350)))

  // 50 members removed from the head → 50 deactivations expected on a re-run.
  await writeJson('congress-gov-house-missing-50.json', pageOf(houseFull.slice(50)))

  // 99 instead of 100 — still ≥ MIN_SENATE_COUNT (95) but drops SCA001.
  await writeJson('congress-gov-senate-without-one.json', pageOf(senateFull.slice(1)))
}

// ---- fetcher dispatch ------------------------------------------------------

function fetcherFor(houseFile: string, senateFile: string) {
  return async (chamber: 'federal_house' | 'federal_senate', _c: string, _k: string) => {
    const j = await loadFixture(chamber === 'federal_house' ? houseFile : senateFile)
    const { normalizeMember } = await import('./normalize.ts')
    return j.members.map(normalizeMember)
  }
}

// ---- district seed ---------------------------------------------------------
//
// IMPORTANT: codes here must match the TIGER 2024 convention used by
// `loadDistrictMap` in officials-ingest.ts:
//   - Senate (two rows per state): `${STATE}-S1`, `${STATE}-S2`
//   - House numbered:               `${STATE}-NN` (zero-padded)
//   - House at-large:               `${STATE}-AL`
//
// `districts.geometry` is `geography(MultiPolygon, 4326)`, so every literal
// must be a MULTIPOLYGON.
async function seedDistricts(client: Client) {
  // TRUNCATE ... CASCADE wipes every FK-restrict child (bill_sponsors,
  // vote_positions, scorecard_ratings, finance_summaries, etc.) in one go.
  // A plain `delete from public.officials` would choke on FK violations if
  // the local DB has been populated by `pnpm seed:officials` or by prior
  // ingest tests. This test is designed to start from a clean slate.
  await client.query(`truncate table public.officials restart identity cascade`)
  await client.query(`delete from public.districts where source_version='FIX'`)

  for (const state of TEST_STATES) {
    // Two senate rows per state — same geometry, codes ${STATE}-S1 / -S2.
    for (const seat of ['S1', 'S2'] as const) {
      await client.query(
        `insert into public.districts (tier,state,code,name,geometry,source_version)
         values ('federal_senate',$1,$2,$3,
           st_geogfromtext($4),
           'FIX')
         on conflict (tier,code) do nothing`,
        [state, `${state}-${seat}`, `${state} Senate ${seat}`, FIXTURE_GEOM],
      )
    }
  }

  // House numbered seats for CA/TX/NY/FL — 15 districts each.
  for (const state of ['CA', 'TX', 'NY', 'FL'] as const) {
    for (let n = 1; n <= 15; n++) {
      const code = `${state}-${n.toString().padStart(2, '0')}`
      await client.query(
        `insert into public.districts (tier,state,code,name,geometry,source_version)
         values ('federal_house',$1,$2,$3,
           st_geogfromtext($4),
           'FIX')
         on conflict (tier,code) do nothing`,
        [state, code, `${state} Congressional District ${n}`, FIXTURE_GEOM],
      )
    }
  }

  // Wyoming at-large.
  await client.query(
    `insert into public.districts (tier,state,code,name,geometry,source_version)
     values ('federal_house','WY','WY-AL','Wyoming At-Large',
       st_geogfromtext($1),
       'FIX')
     on conflict (tier,code) do nothing`,
    [FIXTURE_GEOM],
  )
}

// ---- lifecycle -------------------------------------------------------------

beforeAll(async () => {
  await ensureFixtures()
})

let client: Client
beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await seedDistricts(client)
})
afterEach(async () => {
  // Drop any leftover audit rows so each describe block sees a clean ledger.
  await client.query(`delete from public.officials_ingest_runs`)
  await client.end()
})

afterAll(async () => {
  // Hygiene cleanup so subsequent suites (e.g. @chiaro/officials integration
  // tests, when run sequentially under turbo) see a clean officials table.
  // Does NOT protect against parallel execution against a shared DB —
  // turbo.json's `^test` dependency serializes turbo-managed runs.
  const cleanup = new Client({ connectionString: DB_URL })
  await cleanup.connect()
  await cleanup.query(`truncate table public.officials restart identity cascade`)
  await cleanup.query(`delete from public.officials_ingest_runs`)
  await cleanup.query(`delete from public.districts where source_version='FIX'`)
  await cleanup.end()
})

// ---- scenarios -------------------------------------------------------------

describe('officials-ingest — happy path', () => {
  it('ingests full set and writes a completed audit row', async () => {
    const stats = await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json', 'congress-gov-senate-119-full.json'),
    })
    expect(stats.status).toBe('completed')
    expect(stats.ingested).toBeGreaterThan(500)
    expect(stats.deactivated).toBe(0)

    const audit = await client.query(
      `select status, ingested_count from public.officials_ingest_runs where id=$1`,
      [stats.runId],
    )
    expect(audit.rows[0].status).toBe('completed')
    expect(Number(audit.rows[0].ingested_count)).toBeGreaterThan(500)
  })
})

describe('officials-ingest — pre-flight abort (Improvement 2)', () => {
  it('aborts when house count < MIN_HOUSE_COUNT and does not touch officials', async () => {
    const before = await client.query(`select count(*)::text from public.officials`)
    await expect(
      ingestOfficials({
        apiKey: 'FX',
        fetcher: fetcherFor('congress-gov-house-partial.json', 'congress-gov-senate-119-full.json'),
      }),
    ).rejects.toThrow(/Pre-flight/)
    const after = await client.query(`select count(*)::text from public.officials`)
    expect(after.rows[0].count).toBe(before.rows[0].count)

    const audit = await client.query(
      `select status from public.officials_ingest_runs
         where source='congress.gov.v3' order by started_at desc limit 1`,
    )
    expect(audit.rows[0].status).toBe('aborted')
  })
})

describe('officials-ingest — threshold guard (Improvement 3)', () => {
  it('refuses to deactivate when --allow-deactivations missing', async () => {
    // Seed with full set.
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json', 'congress-gov-senate-119-full.json'),
    })

    // Second run: 50 fewer → exceeds threshold (max(5, ceil(540*0.01))=6).
    await expect(
      ingestOfficials({
        apiKey: 'FX',
        fetcher: fetcherFor(
          'congress-gov-house-missing-50.json',
          'congress-gov-senate-119-full.json',
        ),
      }),
    ).rejects.toThrow(/Refusing to deactivate.*--allow-deactivations/)

    const stillActive = await client.query(
      `select count(*)::text from public.officials where in_office=true`,
    )
    expect(Number(stillActive.rows[0].count)).toBeGreaterThan(500)
  })

  it('proceeds when --allow-deactivations matches', async () => {
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json', 'congress-gov-senate-119-full.json'),
    })
    const stats2 = await ingestOfficials({
      apiKey: 'FX',
      allowDeactivations: 50,
      fetcher: fetcherFor(
        'congress-gov-house-missing-50.json',
        'congress-gov-senate-119-full.json',
      ),
    })
    expect(stats2.deactivated).toBe(50)
    expect(stats2.status).toBe('completed')
  })
})

describe('officials-ingest — within-congress departure (Improvement 1)', () => {
  it('deactivates a member absent from fetch, even if source_version matches', async () => {
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json', 'congress-gov-senate-119-full.json'),
    })
    const stats = await ingestOfficials({
      apiKey: 'FX',
      allowDeactivations: 1,
      fetcher: fetcherFor(
        'congress-gov-house-119-full.json',
        'congress-gov-senate-without-one.json',
      ),
    })
    expect(stats.deactivated).toBe(1)
    const inactive = await client.query(
      `select count(*)::text from public.officials where in_office=false`,
    )
    expect(Number(inactive.rows[0].count)).toBe(1)
  })
})

describe('officials-ingest — transaction atomicity (Improvement 4)', () => {
  it('rolls back upsert loop when a member violates a constraint mid-flight', async () => {
    // First, seed the table with the full set so there's something to roll
    // back against.
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json', 'congress-gov-senate-119-full.json'),
    })
    const beforeRes = await client.query(`select count(*)::text from public.officials`)
    const before = Number(beforeRes.rows[0].count)

    // Broken fetcher: returns the real house fixture (which will be upserted
    // successfully — `Promise.all` resolves both before BEGIN), but injects
    // ONE senate record with senateClass=null. That violates the
    // senate_class_matches_chamber CHECK during the upsert loop, AFTER the
    // house chamber has been written, forcing ROLLBACK.
    const broken = async (chamber: 'federal_house' | 'federal_senate', _c: string, _k: string) => {
      const { normalizeMember } = await import('./normalize.ts')
      if (chamber === 'federal_senate') {
        const j = await loadFixture('congress-gov-senate-119-full.json')
        const members = j.members.map(normalizeMember)
        // Append one normalized member that bypasses the schema but trips the
        // DB CHECK constraint. We construct it directly (no normalizeMember
        // round-trip) since the schema rejects null senateClass for senate.
        members.push({
          bioguideId: 'SVIOL001',
          firstName: 'V',
          lastName: 'V',
          fullName: 'V V',
          chamber: 'federal_senate' as const,
          party: 'D' as const,
          state: 'CA',
          districtNumber: null,
          senateClass: null,
          portraitUrl: 'https://bioguide.congress.gov/bioguide/photo/S/SVIOL001.jpg',
          officialUrl: null,
          nextElection: null,
        })
        return members
      }
      const j = await loadFixture('congress-gov-house-119-full.json')
      return j.members.map(normalizeMember)
    }

    await expect(ingestOfficials({ apiKey: 'FX', fetcher: broken })).rejects.toThrow()

    // No rows leaked from the partial transaction.
    const afterRes = await client.query(`select count(*)::text from public.officials`)
    expect(Number(afterRes.rows[0].count)).toBe(before)

    // Bad bioguide_id never landed.
    const bad = await client.query(`select 1 from public.officials where bioguide_id='SVIOL001'`)
    expect(bad.rowCount).toBe(0)

    // Audit row records the failure.
    const audit = await client.query(
      `select status, error from public.officials_ingest_runs
         where source='congress.gov.v3' order by started_at desc limit 1`,
    )
    expect(audit.rows[0].status).toBe('failed')
    expect(audit.rows[0].error).toBeTruthy()
  })
})
