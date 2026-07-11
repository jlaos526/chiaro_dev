import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { upsertFinancialDisclosure, upsertEthicsComplaint, upsertOfficialEvent } from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-SES', 'CA SES test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-ses')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-ses', 'Test SES', 'Test', 'SES', 'state_house', 'D', 'CA',
      d.id, true, 'FX-ses'
    from public.districts d where d.code = 'CA-SES'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_financial_disclosures where official_id = $1', [
    officialId,
  ])
  await client.query('delete from public.state_ethics_complaints     where official_id = $1', [
    officialId,
  ])
  await client.query('delete from public.state_official_events       where official_id = $1', [
    officialId,
  ])
  await client.query("delete from public.officials where source_version = 'FX-ses'")
  await client.query("delete from public.districts where source_version = 'FX-ses'")
  await client.end()
})

describe('upsertFinancialDisclosure', () => {
  it('inserts row', async () => {
    const ok = await upsertFinancialDisclosure(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      filing_year: 2025,
      income_kind: 'salary',
      state: 'CA',
      source_url: 'https://x',
      source: 'ca-fppc',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown', async () => {
    const ok = await upsertFinancialDisclosure(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      filing_year: 2025,
      income_kind: 'salary',
      state: 'CA',
      source_url: 'https://x',
      source: 'ca-fppc',
    })
    expect(ok).toBe(false)
  })
})

describe('upsertEthicsComplaint', () => {
  it('inserts row', async () => {
    const ok = await upsertEthicsComplaint(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      complaint_date: '2026-01-01',
      status: 'open',
      summary: 'Test complaint',
      state: 'CA',
      source_url: 'https://x',
      source: 'ca-fppc',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown', async () => {
    const ok = await upsertEthicsComplaint(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      complaint_date: '2026-01-01',
      status: 'open',
      summary: 'Test',
      state: 'CA',
      source_url: 'https://x',
      source: 'ca-fppc',
    })
    expect(ok).toBe(false)
  })
})

describe('upsertOfficialEvent', () => {
  it('inserts row', async () => {
    const ok = await upsertOfficialEvent(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      event_date: '2026-01-01',
      event_type: 'resignation',
      summary: 'Resigned for personal reasons',
      state: 'CA',
      source_url: 'https://x',
      source: 'openstates-end-reason',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown', async () => {
    const ok = await upsertOfficialEvent(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      event_date: '2026-01-01',
      event_type: 'resignation',
      summary: 'Test',
      state: 'CA',
      source_url: 'https://x',
      source: 'openstates-end-reason',
    })
    expect(ok).toBe(false)
  })
})
