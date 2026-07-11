import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchFlorida } from './fetch-fl.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-finance', 'fl-sample.json')

let client: Client
let repId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house', 'FL', 'FL-FIN-AD', 'FL FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-82 28,-81 28,-81 29,-82 29,-82 28)))'),
        'FX-fin-fl')
    on conflict (tier, code) do nothing
  `)
  const r = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-fl', 'Test FL Rep', 'Test', 'FL Rep', 'state_house', 'R', 'FL',
      d.id, true, 'FX-fin-fl'
    from public.districts d where d.code = 'FL-FIN-AD'
    returning id
  `)
  repId = r.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id = $1)',
    [repId],
  )
  await client.query('delete from public.state_finance_summaries where official_id = $1', [repId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-fl'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-fl'])
  await client.end()
})

describe('fetchFlorida', () => {
  it('happy path: 1 filing → 1 summary + 3 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchFlorida.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.donorsUpserted).toBe(3)
    expect(stats.officialsMatched).toBe(1)
    expect(stats.officialsUnmatched).toEqual([])
  })

  it('empty payload graceful: no summaries, no errors', async () => {
    const stats = await fetchFlorida.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => [],
    } as never)
    expect(stats.summariesUpserted).toBe(0)
    expect(stats.donorsUpserted).toBe(0)
    expect(stats.errors).toEqual([])
  })

  it('fetcher rejection surfaces to errors', async () => {
    const stats = await fetchFlorida.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => {
        throw new Error('FL DOE markup changed')
      },
    } as never)
    expect(stats.summariesUpserted).toBe(0)
    expect(stats.errors[0]).toMatch(/FL DOE markup changed/)
  })

  it('source slug is fl-doe', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchFlorida.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ source: string }>(
      'select source from public.state_finance_summaries where official_id = $1',
      [repId],
    )
    expect(row.rows[0]!.source).toBe('fl-doe')
  })

  it('out-of-state donor preserved (rank 3 GA)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchFlorida.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const donor = await client.query<{ donor_state: string | null }>(
      `
      select svp.donor_state
        from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1 and svp.rank = 3
    `,
      [repId],
    )
    expect(donor.rows[0]!.donor_state).toBe('GA')
  })
})
