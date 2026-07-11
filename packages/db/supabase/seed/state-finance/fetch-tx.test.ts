import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTexas } from './fetch-tx.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-finance', 'tx-sample.json')

let client: Client
let repId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house', 'TX', 'TX-FIN-AD', 'TX FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-98 30,-97 30,-97 31,-98 31,-98 30)))'),
        'FX-fin-tx')
    on conflict (tier, code) do nothing
  `)
  const r = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'ocd-person/fx-fin-tx', 'Test TX Rep', 'Test', 'TX Rep', 'state_house', 'R', 'TX',
      d.id, true, 'FX-fin-tx'
    from public.districts d where d.code = 'TX-FIN-AD'
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
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-tx'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-tx'])
  await client.end()
})

describe('fetchTexas', () => {
  it('happy path: 1 filing → 1 summary + 2 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchTexas.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.donorsUpserted).toBe(2)
    expect(stats.officialsMatched).toBe(1)
  })

  it('source slug is tx-ethics', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchTexas.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ source: string }>(
      'select source from public.state_finance_summaries where official_id = $1',
      [repId],
    )
    expect(row.rows[0]!.source).toBe('tx-ethics')
  })

  it('partial pct fields: small_donor_pct=12.0, in_state_pct=null', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchTexas.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ small_donor_pct: string | null; in_state_pct: string | null }>(
      `
      select small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `,
      [repId],
    )
    expect(Number(row.rows[0]!.small_donor_pct)).toBe(12.0)
    expect(row.rows[0]!.in_state_pct).toBeNull()
  })

  it('idempotent re-run: same fixture twice → same row counts', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture.filings
    await fetchTexas.fetch({ client, cycle: '2023-2024', fetcher } as never)
    const stats2 = await fetchTexas.fetch({ client, cycle: '2023-2024', fetcher } as never)
    expect(stats2.summariesUpserted).toBe(1)
    expect(stats2.donorsUpserted).toBe(2)
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_finance_summaries where source = 'tx-ethics' and official_id = $1",
      [repId],
    )
    expect(c.rows[0]!.c).toBe(1)
    const d = await client.query<{ c: number }>(
      `
      select count(*)::int as c from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1
    `,
      [repId],
    )
    expect(d.rows[0]!.c).toBe(2)
  })

  it('reports state TX', async () => {
    const stats = await fetchTexas.fetch({
      client,
      cycle: '2023-2024',
      fetcher: async () => [],
    } as never)
    expect(stats.state).toBe('TX')
  })
})
