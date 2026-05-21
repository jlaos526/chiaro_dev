import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { upsertStateFinance, resolveOfficialByName } from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let districtId: string
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  const d = await client.query<{ id: string }>(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-FIN', 'CA FIN test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-fin')
    on conflict (tier, code) do update set source_version = 'FX-fin'
    returning id
  `)
  districtId = d.rows[0]!.id
  const o = await client.query<{ id: string }>(`
    insert into public.officials (
      openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version
    )
    values ('ocd-person/fx-fin', 'Test Finance Asm', 'Test', 'Finance Asm',
      'state_house', 'D', 'CA', $1, true, 'FX-fin')
    on conflict (openstates_person_id) where openstates_person_id is not null
    do update set source_version = 'FX-fin'
    returning id
  `, [districtId])
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id = $1)', [officialId])
  await client.query('delete from public.state_finance_summaries where official_id = $1', [officialId])
  await client.query('delete from public.officials where id = $1', [officialId])
  await client.query("delete from public.districts where source_version = 'FX-fin'")
  await client.end()
})

describe('upsertStateFinance', () => {
  it('inserts a summary + N donors on first call', async () => {
    const summaryId = await upsertStateFinance(client,
      { official_id: officialId, cycle: '2024' },
      { total_raised: 100000, total_disbursed: 80000,
        small_donor_pct: 25, in_state_pct: 60,
        source: 'ca-cal-access', source_url: 'https://x' },
      [
        { rank: 1, donor_name: 'Alice', amount: 5000, employer: 'Acme', occupation: 'CEO', city: 'SF', donor_state: 'CA' },
        { rank: 2, donor_name: 'Bob', amount: 3000 },
      ],
    )
    expect(typeof summaryId).toBe('string')
    const s = await client.query<{ total_raised: string }>('select total_raised from public.state_finance_summaries where id = $1', [summaryId])
    expect(Number(s.rows[0]!.total_raised)).toBe(100000)
    const d = await client.query<{ rank: number; donor_name: string }>('select rank, donor_name from public.state_finance_individual_donors where state_finance_summary_id = $1 order by rank', [summaryId])
    expect(d.rows).toHaveLength(2)
    expect(d.rows[0]!.donor_name).toBe('Alice')
  })

  it('idempotent: second call updates summary and replaces donor list', async () => {
    await upsertStateFinance(client,
      { official_id: officialId, cycle: '2024' },
      { total_raised: 100000, total_disbursed: 80000,
        small_donor_pct: 25, in_state_pct: 60,
        source: 'ca-cal-access', source_url: 'https://x' },
      [{ rank: 1, donor_name: 'Alice', amount: 5000 }],
    )
    const newId = await upsertStateFinance(client,
      { official_id: officialId, cycle: '2024' },
      { total_raised: 200000, total_disbursed: 150000,
        small_donor_pct: 30, in_state_pct: 65,
        source: 'ca-cal-access', source_url: 'https://x2' },
      [
        { rank: 1, donor_name: 'Charlie', amount: 9000 },
        { rank: 2, donor_name: 'Dana', amount: 7000 },
      ],
    )
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_finance_summaries where official_id = $1',
      [officialId],
    )
    expect(c.rows[0]!.c).toBe(1)
    const s = await client.query<{ total_raised: string; source_url: string }>(
      'select total_raised, source_url from public.state_finance_summaries where id = $1', [newId])
    expect(Number(s.rows[0]!.total_raised)).toBe(200000)
    expect(s.rows[0]!.source_url).toBe('https://x2')
    const d = await client.query<{ rank: number; donor_name: string }>(
      'select rank, donor_name from public.state_finance_individual_donors where state_finance_summary_id = $1 order by rank',
      [newId])
    expect(d.rows).toHaveLength(2)
    expect(d.rows[0]!.donor_name).toBe('Charlie')
  })
})

describe('resolveOfficialByName', () => {
  it('returns id for an exact name match', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'Test Finance Asm', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialId)
  })

  it('case-insensitive match', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'test finance asm', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialId)
  })

  it('returns null when state or chamber mismatch', async () => {
    expect(await resolveOfficialByName(client, {
      full_name: 'Test Finance Asm', state: 'NY', chamber: 'state_house',
    })).toBeNull()
    expect(await resolveOfficialByName(client, {
      full_name: 'Test Finance Asm', state: 'CA', chamber: 'state_senate',
    })).toBeNull()
  })

  it('returns null for unknown name', async () => {
    expect(await resolveOfficialByName(client, {
      full_name: 'Nobody', state: 'CA', chamber: 'state_house',
    })).toBeNull()
  })
})
