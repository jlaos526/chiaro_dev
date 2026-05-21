import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMichigan } from './fetch-mi.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'mi-sample.json')

let client: Client
let repId: string
let senId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',  'MI', 'MI-FIN-AD', 'MI FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-84 42,-83 42,-83 43,-84 43,-84 42)))'),
        'FX-fin-mi'),
      ('state_senate', 'MI', 'MI-FIN-SD', 'MI FIN SD',
        st_geogfromtext('MULTIPOLYGON(((-84 42,-83 42,-83 43,-84 43,-84 42)))'),
        'FX-fin-mi')
    on conflict (tier, code) do nothing
  `)
  const r = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-mi-rep', 'Test MI Rep', 'Test', 'MI Rep', 'state_house', 'D', 'MI',
      d.id, true, 'FX-fin-mi'
    from public.districts d where d.code = 'MI-FIN-AD'
    returning id
  `)
  repId = r.rows[0]!.id
  const s = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-mi-sen', 'Test MI Sen', 'Test', 'MI Sen', 'state_senate', 'R', 'MI',
      d.id, true, 'FX-fin-mi'
    from public.districts d where d.code = 'MI-FIN-SD'
    returning id
  `)
  senId = s.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id in ($1, $2))',
    [repId, senId],
  )
  await client.query('delete from public.state_finance_summaries where official_id in ($1, $2)', [repId, senId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-mi'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-mi'])
  await client.end()
})

describe('fetchMichigan', () => {
  it('happy path: 2 filings → 2 summaries + 3 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchMichigan.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(2)
    expect(stats.donorsUpserted).toBe(3)
    expect(stats.officialsMatched).toBe(2)
  })

  it('source slug is mi-boe', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchMichigan.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const sources = await client.query<{ source: string }>(`
      select source from public.state_finance_summaries where official_id in ($1, $2)
    `, [repId, senId])
    for (const r of sources.rows) expect(r.source).toBe('mi-boe')
  })

  it('both pct fields preserved (small_donor_pct + in_state_pct)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchMichigan.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ small_donor_pct: string | null; in_state_pct: string | null }>(`
      select small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `, [repId])
    expect(Number(row.rows[0]!.small_donor_pct)).toBe(28.0)
    expect(Number(row.rows[0]!.in_state_pct)).toBe(92.0)
  })

  it("biennial cycle string '2023-2024' preserved verbatim", async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchMichigan.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ cycle: string }>(
      'select cycle from public.state_finance_summaries where official_id = $1',
      [repId],
    )
    expect(row.rows[0]!.cycle).toBe('2023-2024')
  })

  it('reports state MI', async () => {
    const stats = await fetchMichigan.fetch({
      client, cycle: '2023-2024', fetcher: async () => [],
    } as never)
    expect(stats.state).toBe('MI')
  })
})
