import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestSalaryAndResidency } from './salary-residency-ingest.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  // Use a fictional state code ('ZZ') so the fixture polygon doesn't overlap
  // any real TIGER district. The state CHECK is `^[A-Z]{2}$`, no FIPS lookup.
  // Without this isolation the ingest's `select ... limit 1` is non-
  // deterministic when real TIGER CA-11 and a fixture CA-11 both contain
  // the test lat/lng — CI happens to favor the fixture, local runs against
  // a TIGER-seeded DB return the real district instead and the test fails.
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_house','ZZ','ZZ-AL-srfix','ZZ at-large sr fixture',
      st_geogfromtext('MULTIPOLYGON(((-122.51 37.70,-122.36 37.70,-122.36 37.81,-122.51 37.81,-122.51 37.70)))'),
      'FX-sr')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='ZZ-AL-srfix'")
  // Speaker-shaped fixture official with FEC id (drives the Speaker-salary path)
  await client.query(`
    insert into public.officials (bioguide_id, fec_candidate_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version, in_office)
    values ('SRTEST1','H8CA05035','Test','Speaker','Test Speaker','federal_house','D','ZZ',$1::uuid,null,'119', true)
    on conflict (bioguide_id) do update set
      fec_candidate_id = excluded.fec_candidate_id,
      district_id = excluded.district_id,
      state = excluded.state,
      in_office = true
  `, [d.rows[0].id])
  // Seed leadership: current Speaker (no end_date)
  await client.query(`
    delete from public.officials_leadership_history
    where official_id = (select id from public.officials where bioguide_id = 'SRTEST1')
  `)
  await client.query(`
    insert into public.officials_leadership_history (official_id, role, chamber, start_date, source_url)
    select id, 'Speaker', 'federal_house', '2023-01-03',
      'https://github.com/unitedstates/congress-legislators/blob/main/legislators-current.yaml'
    from public.officials where bioguide_id = 'SRTEST1'
  `)
})

afterEach(async () => {
  await client.query("delete from public.official_metrics where official_id in (select id from public.officials where bioguide_id = 'SRTEST1')")
  await client.query("delete from public.officials_leadership_history where official_id in (select id from public.officials where bioguide_id = 'SRTEST1')")
  await client.query("delete from public.officials where bioguide_id = 'SRTEST1'")
  await client.query("delete from public.districts where code = 'ZZ-AL-srfix'")
  await client.end()
})

describe('ingestSalaryAndResidency', () => {
  it('assigns Speaker salary and resolves lives_in_district = true when address geocodes inside the home polygon', async () => {
    const stats = await ingestSalaryAndResidency({
      addressFetcher: async () => ({
        address1: '90 7th Street',
        city:     'Fixture City',
        state:    'ZZ',
        zip:      '00001',
        source_url: 'https://www.fec.gov/data/candidate/H8CA05035/',
      }),
      geocoder: async () => ({ lat: 37.776, lng: -122.418 }),  // inside the seeded ZZ polygon
    })

    expect(stats.officialsProcessed).toBeGreaterThanOrEqual(1)
    expect(stats.salariesSet).toBeGreaterThanOrEqual(1)
    expect(stats.residencyResolved).toBeGreaterThanOrEqual(1)

    const m = await client.query(`
      select salary_usd, salary_role, lives_in_district, home_district_id
      from public.official_metrics
      where official_id = (select id from public.officials where bioguide_id = 'SRTEST1')
    `)
    expect(m.rows.length).toBe(1)
    expect(Number(m.rows[0].salary_usd)).toBe(223500)  // Speaker salary
    expect(m.rows[0].salary_role).toBe('Speaker')
    expect(m.rows[0].lives_in_district).toBe(true)
    expect(m.rows[0].home_district_id).toBeTruthy()
  })

  it('flips lives_in_district to false when address is outside the home district polygon', async () => {
    const stats = await ingestSalaryAndResidency({
      addressFetcher: async () => ({
        address1: '1 Far Away Ave',
        city:     'Elsewhere',
        state:    'ZZ',
        zip:      '00002',
        source_url: 'https://www.fec.gov/data/candidate/H8CA05035/',
      }),
      geocoder: async () => ({ lat: 40.706, lng: -74.011 }),  // far outside the ZZ polygon
    })

    // Address state is ZZ but the geocoded point falls outside ZZ-AL-srfix's
    // polygon. The lookup is `state = $1 AND st_contains(...)` so no rows
    // match → homeDistrictId is null → lives_in_district = (null === uuid) = false.
    expect(stats.residencyResolved).toBeGreaterThanOrEqual(1)
    const m = await client.query(`
      select lives_in_district
      from public.official_metrics
      where official_id = (select id from public.officials where bioguide_id = 'SRTEST1')
    `)
    expect(m.rows[0].lives_in_district).toBe(false)
  })

  it('privacy: official_metrics has NO column for persisted lat/lng', async () => {
    const cols = await client.query(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'official_metrics'
    `)
    const names = cols.rows.map((r: any) => r.column_name)
    expect(names).not.toContain('home_lat')
    expect(names).not.toContain('home_lng')
    expect(names).not.toContain('home_address')
    expect(names).not.toContain('home_address_geocoded')
  })
})
