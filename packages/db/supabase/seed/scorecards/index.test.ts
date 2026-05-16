import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestScorecards, ADAPTERS } from './index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURES  = join(__dirname, '..', 'fixtures', 'scorecards')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  // Ensure 1 known official exists so we know at least one rating row sticks.
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_senate','CA','CA-S1-scrcrd','CA Senate scrcrd',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-sc')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-S1-scrcrd'")
  await client.query(`
    insert into public.officials (bioguide_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('P000197','N','P','Nancy P.','house','D','CA',$1::uuid,null,'119')
    on conflict (bioguide_id) do nothing
  `, [d.rows[0].id])
})

afterEach(async () => {
  await client.query("delete from public.scorecard_ratings where official_id in (select id from public.officials where bioguide_id = 'P000197')")
  await client.end()
})

describe('ingestScorecards', () => {
  it('upserts 5 scorecard_orgs and rates known officials from fixture CSVs', async () => {
    const stats = await ingestScorecards({ fixturesDir: FIXTURES })

    expect(Object.keys(stats)).toHaveLength(ADAPTERS.length)
    for (const slug of ADAPTERS.map(a => a.slug)) {
      expect(stats[slug].error).toBeUndefined()
      // Each fixture has 3 rows, only P000197 is a known official, so each adapter inserts 1.
      expect(stats[slug].ratings).toBe(1)
    }

    const orgs = await client.query("select slug from public.scorecard_orgs order by slug")
    expect(orgs.rows.map((r: any) => r.slug).sort()).toEqual(
      ['aclu', 'lcv', 'naacp', 'planned-parenthood', 'sierra-club']
    )

    const ratings = await client.query(`
      select sc.slug, sr.score
      from public.scorecard_ratings sr
      join public.scorecard_orgs sc on sc.id = sr.scorecard_id
      join public.officials o on o.id = sr.official_id
      where o.bioguide_id = 'P000197'
      order by sc.slug
    `)
    expect(ratings.rows.map((r: any) => r.slug)).toEqual(
      ['aclu', 'lcv', 'naacp', 'planned-parenthood', 'sierra-club']
    )
  })

  it('isolates per-adapter failures (bad fixture path)', async () => {
    const stats = await ingestScorecards({ fixturesDir: '/nonexistent/path' })
    for (const slug of ADAPTERS.map(a => a.slug)) {
      expect(stats[slug].error).toBeDefined()
      expect(stats[slug].ratings).toBe(0)
    }
  })
})
