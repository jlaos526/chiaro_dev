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
  await client.query(
    `
    insert into public.officials (bioguide_id, opensecrets_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('FINTEST1','N00007360','Nancy','Pelosi','Nancy Pelosi','federal_house','D','CA',$1::uuid,null,'119')
    on conflict (bioguide_id) do update set opensecrets_id = excluded.opensecrets_id
  `,
    [d.rows[0].id],
  )
})

afterEach(async () => {
  await client.query(
    "delete from public.finance_summaries where official_id in (select id from public.officials where bioguide_id = 'FINTEST1')",
  )
  await client.query("delete from public.officials where bioguide_id = 'FINTEST1'")
  await client.query("delete from public.districts where code = 'CA-11-fixfin'")
  await client.end()
})

describe('ingestFinance', () => {
  it('upserts finance_summaries + industries + pacs + individual donors + top organizations from fixture', async () => {
    const stats = await ingestFinance({
      apiKey: 'unused',
      cycle: '2024',
      fixturesDir: FIXTURES,
    })

    expect(stats.officialsProcessed).toBe(1)
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.industriesUpserted).toBe(3)
    expect(stats.pacsUpserted).toBe(2)
    expect(stats.individualDonorsUpserted).toBe(3)
    expect(stats.topOrganizationsUpserted).toBe(2)
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

    const donors = await client.query(`
      select rank, donor_name, amount, employer, occupation from public.finance_individual_donors
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
      order by rank
    `)
    expect(donors.rows.length).toBe(3)
    expect(donors.rows[0].donor_name).toBe('Alice Donor')
    expect(Number(donors.rows[0].amount)).toBe(25000)
    expect(donors.rows[0].employer).toBe('Acme Inc')
    expect(donors.rows[2].employer).toBeNull()

    const orgs = await client.query(`
      select rank, org_name, amount from public.finance_top_organizations
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
      order by rank
    `)
    expect(orgs.rows.length).toBe(2)
    expect(orgs.rows[0].org_name).toBe('Acme Industries')
    expect(Number(orgs.rows[0].amount)).toBe(50000)

    // Idempotent re-run — counts stay stable (delete-then-insert).
    const stats2 = await ingestFinance({ apiKey: 'unused', cycle: '2024', fixturesDir: FIXTURES })
    expect(stats2.summariesUpserted).toBe(1)
    expect(stats2.individualDonorsUpserted).toBe(3)
    expect(stats2.topOrganizationsUpserted).toBe(2)
    const donorsAgain = await client.query(`
      select count(*)::int as c from public.finance_individual_donors
      where finance_summary_id = (select id from public.finance_summaries where official_id = (select id from public.officials where bioguide_id = 'FINTEST1'))
    `)
    expect(donorsAgain.rows[0].c).toBe(3)

    // Cascade-delete: removing the summary clears both new child tables.
    await client.query(
      `delete from public.finance_summaries where official_id in (select id from public.officials where bioguide_id = 'FINTEST1')`,
    )
    const donorsAfter = await client.query(
      `select count(*)::int as c from public.finance_individual_donors`,
    )
    const orgsAfter = await client.query(
      `select count(*)::int as c from public.finance_top_organizations`,
    )
    expect(donorsAfter.rows[0].c).toBe(0)
    expect(orgsAfter.rows[0].c).toBe(0)
  })
})
