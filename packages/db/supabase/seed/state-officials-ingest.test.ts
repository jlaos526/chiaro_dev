import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestStateOfficials } from './state-officials-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-people')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',       'CA', 'CA-15', 'CA AD 15',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-stateleg'),
      ('state_senate',      'CA', 'CA-08', 'CA SD 8',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-stateleg'),
      -- NE is unicameral; district_tier enum only includes state_senate (TIGER
      -- seeds NE there). The orchestrator's tier fallback handles role.type
      -- 'legislature' → state_senate lookup. See state-officials-ingest.ts.
      ('state_senate', 'NE', 'NE-23', 'NE District 23',
        st_geogfromtext('MULTIPOLYGON(((-100 40,-99 40,-99 41,-100 41,-100 40)))'), 'FX-stateleg'),
      ('state_house',       'MD', 'MD-01', 'MD HD 01',
        st_geogfromtext('MULTIPOLYGON(((-77 39,-76 39,-76 40,-77 40,-77 39)))'), 'FX-stateleg')
    on conflict (tier, code) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.district_offices where official_id in (select id from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%')")
  await client.query("delete from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'")
  await client.query("delete from public.districts where source_version = 'FX-stateleg'")
  await client.end()
})

describe('ingestStateOfficials', () => {
  it('happy path: 6 fixture legislators → 6 officials rows', async () => {
    const stats = await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    expect(stats.errors).toEqual([])
    expect(stats.officialsUpserted).toBe(6)
    const rows = await client.query(
      "select chamber, state, district_code, title, party from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%' order by state, district_code, title"
    )
    expect(rows.rows.length).toBe(6)
  })

  it('NE unicameral: chamber=state_legislature, party=Nonpartisan', async () => {
    await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    const rows = await client.query(
      "select chamber::text as chamber, party from public.officials where openstates_person_id = 'ocd-person/00000000-0000-0000-0000-000000000003'"
    )
    expect(rows.rows[0]).toMatchObject({ chamber: 'state_legislature', party: 'Nonpartisan' })
  })

  it('MD multi-member: 3 delegates share district_id (MD-01)', async () => {
    await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    const rows = await client.query(`
      select count(distinct district_id)::int as district_count, count(*)::int as officials_count
      from public.officials
      where state = 'MD' and openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'
    `)
    expect(rows.rows[0].officials_count).toBe(3)
    expect(rows.rows[0].district_count).toBe(1)
  })

  it('title preserved verbatim (Assemblymember/Senator/Delegate)', async () => {
    await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    const rows = await client.query(`
      select title from public.officials
      where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'
      order by title
    `)
    const titles = rows.rows.map((r: { title: string }) => r.title)
    expect(titles).toContain('Assemblymember')
    expect(titles).toContain('Senator')
    expect(titles).toContain('Delegate')
  })

  it('offices upserted to public.district_offices', async () => {
    await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    const rows = await client.query(`
      select count(*)::int as office_count
      from public.district_offices dof
      join public.officials o on o.id = dof.official_id
      where o.openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'
    `)
    expect(rows.rows[0].office_count).toBe(3)
  })

  it('idempotent re-run: same fixture → same row counts, no duplicates', async () => {
    await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    const stats2 = await ingestStateOfficials({
      fixturesDir: FIXTURE_DIR,
      minStateHouseCount: 0,
      minStateSenateCount: 0,
    })
    expect(stats2.errors).toEqual([])
    const rows = await client.query(
      "select count(*)::int as c from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'"
    )
    expect(rows.rows[0].c).toBe(6)
  })

  it('legislator with unmatched district (NH-style) logged + skipped', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-people-nh-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(join(tmpDir, 'nh.yml'), [
      `id: ocd-person/00000000-0000-0000-0000-0000000000NH`,
      `name: Test NH`,
      `party: [{name: Republican}]`,
      `roles:`,
      `  - type: lower`,
      `    jurisdiction: ocd-jurisdiction/country:us/state:nh/government`,
      `    district: 'Rockingham 5'`,
      `    title: Representative`,
      `    start_date: '2024-12-04'`,
      `    end_date: '2026-12-02'`,
    ].join('\n'))
    try {
      const stats = await ingestStateOfficials({
        fixturesDir: tmpDir,
        minStateHouseCount: 0,
        minStateSenateCount: 0,
      })
      expect(stats.officialsUpserted).toBe(0)
      expect(stats.unmatchedDistricts).toContain('NH:Rockingham 5')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('pre-flight count below threshold aborts non-zero', async () => {
    await expect(
      ingestStateOfficials({
        fixturesDir: FIXTURE_DIR,
        minStateHouseCount: 1000,
        minStateSenateCount: 1000,
      })
    ).rejects.toThrow(/pre-flight count/i)
    const rows = await client.query(
      "select count(*)::int as c from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'"
    )
    expect(rows.rows[0].c).toBe(0)
  })
})
