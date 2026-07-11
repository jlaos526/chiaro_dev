import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNewYork } from './fetch-ny.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-finance', 'ny-sample.json')

let client: Client
let asmId: string
let senId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',  'NY', 'NY-FIN-AD', 'NY FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-74 40,-73 40,-73 41,-74 41,-74 40)))'),
        'FX-fin-ny'),
      ('state_senate', 'NY', 'NY-FIN-SD', 'NY FIN SD',
        st_geogfromtext('MULTIPOLYGON(((-74 40,-73 40,-73 41,-74 41,-74 40)))'),
        'FX-fin-ny')
    on conflict (tier, code) do nothing
  `)
  const a = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-ny-asm', 'Test NY Assembly', 'Test', 'NY Assembly', 'state_house', 'D', 'NY',
      d.id, true, 'FX-fin-ny'
    from public.districts d where d.code = 'NY-FIN-AD'
    returning id
  `)
  asmId = a.rows[0]!.id
  const s = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-ny-sen', 'Test NY Senator', 'Test', 'NY Senator', 'state_senate', 'D', 'NY',
      d.id, true, 'FX-fin-ny'
    from public.districts d where d.code = 'NY-FIN-SD'
    returning id
  `)
  senId = s.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id in ($1, $2))',
    [asmId, senId],
  )
  await client.query('delete from public.state_finance_summaries where official_id in ($1, $2)', [
    asmId,
    senId,
  ])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-ny'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-ny'])
  await client.end()
})

describe('fetchNewYork', () => {
  it('happy path: 2 filings → 2 summaries + 2 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchNewYork.fetch({
      client,
      cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(2)
    expect(stats.donorsUpserted).toBe(2)
  })

  it('summary with null small_donor_pct + null in_state_pct upserts as null', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchNewYork.fetch({
      client,
      cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ small_donor_pct: string | null; in_state_pct: string | null }>(
      `
      select small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `,
      [senId],
    )
    expect(row.rows[0]!.small_donor_pct).toBeNull()
    expect(row.rows[0]!.in_state_pct).toBeNull()
  })

  it('filing with zero donors yields a summary but no donor rows', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchNewYork.fetch({
      client,
      cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    const donors = await client.query<{ c: number }>(
      `
      select count(*)::int as c from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1
    `,
      [senId],
    )
    expect(donors.rows[0]!.c).toBe(0)
  })

  it('source slug is ny-nysboe', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchNewYork.fetch({
      client,
      cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    const sources = await client.query<{ source: string }>(
      `
      select source from public.state_finance_summaries where official_id in ($1, $2)
    `,
      [asmId, senId],
    )
    for (const r of sources.rows) expect(r.source).toBe('ny-nysboe')
  })

  it('reports state NY', async () => {
    const stats = await fetchNewYork.fetch({
      client,
      cycle: '2024',
      fetcher: async () => [],
    } as never)
    expect(stats.state).toBe('NY')
  })
})
