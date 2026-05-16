import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestFinance } from './finance-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURES = join(__dirname, 'fixtures')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_house','CA','CA-11-fixfin','CA-11 fixture',
      st_geogfromtext('MULTIPOLYGON(((-122.5 37.7,-122.4 37.7,-122.4 37.8,-122.5 37.8,-122.5 37.7)))'),
      'FX-fin')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-11-fixfin'")
  await client.query(`
    insert into public.officials (bioguide_id, opensecrets_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('FINTEST1','N00007360','Nancy','Pelosi','Nancy Pelosi','house','D','CA',$1::uuid,null,'119')
    on conflict (bioguide_id) do update set opensecrets_id = excluded.opensecrets_id
  `, [d.rows[0].id])
})

afterEach(async () => {
  await client.query("delete from public.finance_summaries where official_id in (select id from public.officials where bioguide_id = 'FINTEST1')")
  await client.query("delete from public.officials where bioguide_id = 'FINTEST1'")
  await client.end()
})

describe('ingestFinance', () => {
  it('upserts finance_summaries + industries + pacs from fixture file', async () => {
    const stats = await ingestFinance({
      apiKey: 'unused',
      cycle: '2024',
      fixturesDir: FIXTURES,
    })

    expect(stats.officialsProcessed).toBe(1)
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.industriesUpserted).toBe(3)
    expect(stats.pacsUpserted).toBe(2)
    expect(stats.errors).toEqual([])

    const summary = await client.query(`
      select fs.total_raised, fs.in_state_pct
      from public.finance_summaries fs
      join public.officials o on o.id = fs.official_id
      where o.bioguide_id = 'FINTEST1' and fs.cycle = '2024'
    `)
    expect(summary.rows.length).toBe(1)
    expect(Number(summary.rows[0].total_raised)).toBe(5234189)

    const ind = await client.query(`
      select rank, industry from public.finance_industry_top
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
      order by rank
    `)
    expect(ind.rows.length).toBe(3)
    expect(ind.rows[0].industry).toBe('Securities & Investment')

    // Idempotent re-run
    const stats2 = await ingestFinance({ apiKey: 'unused', cycle: '2024', fixturesDir: FIXTURES })
    expect(stats2.summariesUpserted).toBe(1)
    expect(stats2.industriesUpserted).toBe(3)
    const ind2 = await client.query(`
      select count(*)::int as c from public.finance_industry_top
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
    `)
    expect(ind2.rows[0].c).toBe(3)  // not 6 — delete-then-insert is idempotent
  })
})
