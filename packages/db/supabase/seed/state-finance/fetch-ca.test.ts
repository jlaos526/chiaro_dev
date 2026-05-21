import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchCalifornia } from './fetch-ca.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'ca-sample.json')

let client: Client
let asmId: string
let senId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',  'CA', 'CA-FIN-AD', 'CA FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-fin-ca'),
      ('state_senate', 'CA', 'CA-FIN-SD', 'CA FIN SD',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-fin-ca')
    on conflict (tier, code) do nothing
  `)
  const a = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-ca-asm', 'Test CA Asm', 'Test', 'CA Asm', 'state_house', 'D', 'CA',
      d.id, true, 'FX-fin-ca'
    from public.districts d where d.code = 'CA-FIN-AD'
    returning id
  `)
  asmId = a.rows[0]!.id
  const s = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-ca-sen', 'Test CA Sen', 'Test', 'CA Sen', 'state_senate', 'R', 'CA',
      d.id, true, 'FX-fin-ca'
    from public.districts d where d.code = 'CA-FIN-SD'
    returning id
  `)
  senId = s.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id in ($1, $2))',
    [asmId, senId],
  )
  await client.query('delete from public.state_finance_summaries where official_id in ($1, $2)', [asmId, senId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-ca'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-ca'])
  await client.end()
})

describe('fetchCalifornia', () => {
  it('happy path: 2 filings → 2 summaries + 5 total donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(2)
    expect(stats.donorsUpserted).toBe(5)
    expect(stats.officialsMatched).toBe(2)
    expect(stats.officialsUnmatched).toEqual([])
    const s = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_finance_summaries where source = 'ca-cal-access'",
    )
    expect(s.rows[0]!.c).toBe(2)
  })

  it('summary fields populated with derived percentages', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{
      total_raised: string; small_donor_pct: string; in_state_pct: string
    }>(`
      select total_raised, small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `, [asmId])
    expect(Number(row.rows[0]!.total_raised)).toBe(250000)
    expect(Number(row.rows[0]!.small_donor_pct)).toBe(22.5)
    expect(Number(row.rows[0]!.in_state_pct)).toBe(78.0)
  })

  it('donors written in rank order with NULL field handling', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const donors = await client.query<{ rank: number; donor_name: string; employer: string | null }>(`
      select svp.rank, svp.donor_name, svp.employer
        from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1
        order by svp.rank
    `, [asmId])
    expect(donors.rows).toHaveLength(3)
    expect(donors.rows[0]!.donor_name).toBe('Acme PAC')
    expect(donors.rows[0]!.employer).toBeNull()
    expect(donors.rows[1]!.donor_name).toBe('Jane Donor')
    expect(donors.rows[1]!.employer).toBe('BigCo')
  })

  it('unmatched legislator surfaces to officialsUnmatched (no crash)', async () => {
    const stats = await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => [{
        full_name: 'Unknown Legislator', chamber: 'state_house',
        total_raised: 1000, total_disbursed: 800,
        small_donor_pct: null, in_state_pct: null,
        source_url: 'https://x',
        donors: [],
      }],
    } as never)
    expect(stats.summariesUpserted).toBe(0)
    expect(stats.officialsUnmatched).toContain('Unknown Legislator')
    expect(stats.errors).toEqual([])
  })

  it('idempotent: same fixture twice → same row counts', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture.filings
    await fetchCalifornia.fetch({ client, cycle: '2023-2024', fetcher } as never)
    const stats2 = await fetchCalifornia.fetch({ client, cycle: '2023-2024', fetcher } as never)
    expect(stats2.summariesUpserted).toBe(2)
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_finance_summaries where source = 'ca-cal-access'",
    )
    expect(c.rows[0]!.c).toBe(2)
  })
})
