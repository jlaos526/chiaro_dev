import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mobilize, parseMobilizeEvents } from './mobilize.ts'
import { upsertTownHall, type NormalizedTownHall } from '../shared.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'mobilize.json')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

// After C31 the adapter resolves via resolveOpenstatesPersonId, which selects
// `openstates_person_id` — the mock must return that column (not `id`).
function mkClient(personId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: personId ? [{ openstates_person_id: personId }] : [],
      rowCount: personId ? 1 : 0,
    }),
  }
}

describe('mobilize adapter', () => {
  it('reports correct slug + component + covered_states', () => {
    expect(mobilize.slug).toBe('mobilize')
    expect(mobilize.component).toBe('halls')
    expect(mobilize.covered_states.length).toBe(50)
  })

  it('happy path: fixture injection returns parsed NormalizedTownHall[]', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('ocd-person/mock') as never // every name resolves
    const events = await parseMobilizeEvents(fixture.data, client)
    // 5 fixture events: 3 state-legislator (CO/CA/MD) + 1 federal (skip) + 1 vague (skip) = 3 emitted
    expect(events).toHaveLength(3)
    expect(events[0]!.state).toBe('CO')
    expect(events[0]!.source).toBe('mobilize')
    expect(events[0]!.external_id).toBe('mobilize-100001')
    // C31: the row MUST carry official_openstates_person_id or upsertTownHall drops it.
    expect(events[0]!.official_openstates_person_id).toBe('ocd-person/mock')
  })

  it('classifies CA hybrid event correctly (zoom URL + venue → hybrid)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const ca = events.find((e) => e.state === 'CA')
    expect(ca).toBeDefined()
    expect(ca!.format).toBe('hybrid')
  })

  it('classifies MD virtual event correctly (is_virtual=true → virtual)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const md = events.find((e) => e.state === 'MD')
    expect(md).toBeDefined()
    expect(md!.format).toBe('virtual')
  })

  it('drops federal event (Senator without State prefix)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const ma = events.find((e) => e.state === 'MA')
    expect(ma).toBeUndefined()
  })

  it('drops events with unresolved legislator names', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never // no name resolves → unmatched
    const events = await parseMobilizeEvents(fixture.data, client)
    expect(events).toHaveLength(0)
  })

  it('production stub gracefully fails-empty when fetcher absent + API not reachable', async () => {
    // Bypass the network fetcher by spying-mocking global fetch to return empty
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as never
    try {
      const events = await mobilize.fetchEvents({
        client: mkClient(null) as never,
      } as never)
      expect(events).toEqual([])
    } finally {
      globalThis.fetch = origFetch
    }
  })
})

describe('mobilize onSkip instrumentation (slice 23)', () => {
  it('emits fetch-stage skip when Mobilize API rejects', async () => {
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as never
    const skips: SkipReason[] = []
    try {
      const events = await mobilize.fetchEvents({
        client: mkClient(null) as never,
        onSkip: (r: SkipReason) => {
          skips.push(r)
        },
      } as never)
      expect(events).toEqual([])
      // At least one fetch-stage skip emitted before the pagination loop breaks.
      const fetchSkips = skips.filter((s) => s.stage === 'fetch')
      expect(fetchSkips.length).toBeGreaterThanOrEqual(1)
      expect(fetchSkips[0]).toMatchObject({
        adapter: 'mobilize',
        stage: 'fetch',
      })
      expect(fetchSkips[0]!.detail).toMatch(/network down/)
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('emits filter-stage skip when title does not match state-legislator pattern', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const skips: SkipReason[] = []
    await parseMobilizeEvents(fixture.data, client, (r: SkipReason) => {
      skips.push(r)
    })
    // Fixture has 5 events: 3 state-legislator (CO/CA/MD) + 1 federal Senator (MA) + 1 vague.
    // The federal + vague rows fire filter-stage skips.
    const filterSkips = skips.filter((s) => s.stage === 'filter' && s.adapter === 'mobilize')
    expect(filterSkips.length).toBeGreaterThanOrEqual(2)
  })

  it('emits resolve-stage skip per event whose legislator is unmatched', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never // no name resolves
    const skips: SkipReason[] = []
    const events = await parseMobilizeEvents(fixture.data, client, (r: SkipReason) => {
      skips.push(r)
    })
    expect(events).toEqual([])
    const resolveSkips = skips.filter((s) => s.stage === 'resolve' && s.adapter === 'mobilize')
    // 3 state-legislator events (CO/CA/MD); all unresolved → 3 resolve skips
    expect(resolveSkips).toHaveLength(3)
    expect(resolveSkips.every((s) => s.legislator)).toBe(true)
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never
    // No onSkip passed — must not throw.
    const events = await parseMobilizeEvents(fixture.data, client)
    expect(events).toEqual([])
  })
})

// Audit C31: the interface contract that must never silently regress.
// Pre-fix the adapter resolved the official only as a gate and DISCARDED the
// id — the pushed row carried no official_openstates_person_id, so
// upsertTownHall returned false and every mobilize row was dropped ("0 rows /
// ok"). Push a mobilize-shaped row through the REAL upsertTownHall + assert it
// lands.
describe('C31 regression: mobilize row lands via real upsertTownHall', () => {
  const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  const SV = 'FX-mob-c31'
  const PID = 'ocd-person/fx-mob-c31'
  let dbClient: Client
  let officialId: string

  beforeEach(async () => {
    dbClient = new Client({ connectionString: DB_URL })
    await dbClient.connect()
    await dbClient.query(
      `
      insert into public.districts (tier, state, code, name, geometry, source_version)
      values ('state_house', 'CA', 'CA-MOB-C31', 'CA MOB C31',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        $1)
      on conflict (tier, code) do nothing
    `,
      [SV],
    )
    const o = await dbClient.query<{ id: string }>(
      `
      insert into public.officials (openstates_person_id, full_name, first_name, last_name,
        chamber, party, state, district_id, in_office, source_version)
      select $2, 'Mobilize Test C31', 'Mobilize', 'Test', 'state_house', 'D', 'CA',
        d.id, true, $1
      from public.districts d where d.code = 'CA-MOB-C31'
      returning id
    `,
      [SV, PID],
    )
    officialId = o.rows[0]!.id
  })

  afterEach(async () => {
    await dbClient.query('delete from public.state_town_halls where official_id = $1', [officialId])
    await dbClient.query('delete from public.officials where source_version = $1', [SV])
    await dbClient.query('delete from public.districts where source_version = $1', [SV])
    await dbClient.end()
  })

  it('a mobilize row carrying official_openstates_person_id is written', async () => {
    const row: NormalizedTownHall = {
      official_openstates_person_id: PID,
      legislator_name: 'Mobilize Test C31',
      event_date: '2026-05-01',
      state: 'CA',
      format: 'in_person',
      source_url: 'https://www.mobilize.us/events/999001/',
      source: 'mobilize',
      external_id: 'mobilize-999001',
    }
    const ok = await upsertTownHall(dbClient, row)
    expect(ok).toBe(true)
    const r = await dbClient.query<{ c: number; source: string }>(
      'select count(*)::int as c, max(source) as source from public.state_town_halls where official_id = $1',
      [officialId],
    )
    expect(r.rows[0]!.c).toBe(1)
    expect(r.rows[0]!.source).toBe('mobilize')
  })

  it('the same row WITHOUT official_openstates_person_id is dropped (the pre-C31 bug)', async () => {
    const badRow = {
      legislator_name: 'Mobilize Test C31',
      event_date: '2026-05-01',
      state: 'CA',
      source_url: 'https://www.mobilize.us/events/999002/',
      source: 'mobilize',
      external_id: 'mobilize-999002',
    } as NormalizedTownHall
    const ok = await upsertTownHall(dbClient, badRow)
    expect(ok).toBe(false)
    const r = await dbClient.query<{ c: number }>(
      'select count(*)::int as c from public.state_town_halls where official_id = $1',
      [officialId],
    )
    expect(r.rows[0]!.c).toBe(0)
  })
})
