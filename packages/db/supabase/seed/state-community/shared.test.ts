import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import {
  upsertTownHall,
  upsertDistrictOffice,
  upsertCommitteeHearing,
} from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-SCM', 'CA SCM test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-scm')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-scm', 'Test SCM', 'Test', 'SCM', 'state_house', 'D', 'CA',
      d.id, true, 'FX-scm'
    from public.districts d where d.code = 'CA-SCM'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_town_halls where official_id = $1', [officialId])
  await client.query('delete from public.state_district_offices where official_id = $1', [officialId])
  await client.query(`delete from public.state_committee_hearings
    where id in (select hearing_id from public.state_committee_hearing_attendance where official_id = $1)`,
    [officialId])
  await client.query("delete from public.officials where source_version = 'FX-scm'")
  await client.query("delete from public.districts where source_version = 'FX-scm'")
  await client.end()
})

describe('upsertTownHall', () => {
  it('inserts a row for a known official', async () => {
    const ok = await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://x',
      source: 'townhallproject', external_id: 'thp-1', format: 'hybrid',
    })
    expect(ok).toBe(true)
    const r = await client.query<{ format: string }>(
      'select format from public.state_town_halls where official_id = $1', [officialId])
    expect(r.rows[0]!.format).toBe('hybrid')
  })

  it('returns false for unknown openstates_person_id', async () => {
    const ok = await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://x',
      source: 'townhallproject',
    })
    expect(ok).toBe(false)
  })

  it('idempotent on (source, external_id) — second call updates', async () => {
    await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://x',
      source: 'townhallproject', external_id: 'thp-1', format: 'in_person',
    })
    await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://y',
      source: 'townhallproject', external_id: 'thp-1', format: 'hybrid',
    })
    const r = await client.query<{ c: number; format: string }>(
      'select count(*)::int as c, max(format) as format from public.state_town_halls where official_id = $1',
      [officialId])
    expect(r.rows[0]!.c).toBe(1)
    expect(r.rows[0]!.format).toBe('hybrid')
  })
})

describe('upsertDistrictOffice', () => {
  it('inserts a row for a known official', async () => {
    const ok = await upsertDistrictOffice(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      kind: 'district', street_1: '123 Main', city: 'San Jose',
      state: 'CA', source_url: 'https://x',
    })
    expect(ok).toBe(true)
    const r = await client.query<{ kind: string }>(
      'select kind from public.state_district_offices where official_id = $1', [officialId])
    expect(r.rows[0]!.kind).toBe('district')
  })

  it('returns false for unknown openstates_person_id', async () => {
    const ok = await upsertDistrictOffice(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      kind: 'district', street_1: '123', city: 'X', state: 'CA',
      source_url: 'https://x',
    })
    expect(ok).toBe(false)
  })
})

describe('upsertCommitteeHearing', () => {
  it('inserts hearing + attendance for known official', async () => {
    const result = await upsertCommitteeHearing(client, {
      openstates_committee_id: 'ocd-org/test',
      state: 'CA', session: '20252026', hearing_date: '2026-03-01',
      location: 'Capitol', agenda_topic: 'SB-91', source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm'],
    })
    expect(result.matched).toBe(1)
    expect(result.unmatched).toEqual([])
    const r = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_committee_hearing_attendance where official_id = $1',
      [officialId])
    expect(r.rows[0]!.c).toBe(1)
  })

  it('records unmatched attendees', async () => {
    const result = await upsertCommitteeHearing(client, {
      state: 'CA', session: '20252026', hearing_date: '2026-03-01',
      source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm', 'ocd-person/UNKNOWN'],
    })
    expect(result.matched).toBe(1)
    expect(result.unmatched).toEqual(['ocd-person/UNKNOWN'])
  })

  it('idempotent: re-inserting same hearing dedupes by (openstates_committee_id, hearing_date)', async () => {
    await upsertCommitteeHearing(client, {
      openstates_committee_id: 'ocd-org/dedup',
      state: 'CA', session: '20252026', hearing_date: '2026-04-01',
      source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm'],
    })
    await upsertCommitteeHearing(client, {
      openstates_committee_id: 'ocd-org/dedup',
      state: 'CA', session: '20252026', hearing_date: '2026-04-01',
      source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm'],
    })
    const r = await client.query<{ c: number }>(
      `select count(*)::int as c from public.state_committee_hearings
       where openstates_committee_id = 'ocd-org/dedup' and hearing_date = '2026-04-01'`)
    expect(r.rows[0]!.c).toBe(1)
  })
})
