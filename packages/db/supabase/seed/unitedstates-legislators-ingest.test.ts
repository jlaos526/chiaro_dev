import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestLegislators } from './unitedstates-legislators-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_senate','CA','CA-S1-fixture','CA Senate fixture',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-leg')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-S1-fixture'")
  await client.query(`
    insert into public.officials (bioguide_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('P000197','Nancy','Pelosi','Nancy Pelosi','house','D','CA',$1::uuid,null,'119'),
           ('F000062','Dianne','Feinstein','Dianne Feinstein','senate','D','CA',$1::uuid,1,'119')
    on conflict (bioguide_id) do nothing
  `, [d.rows[0].id])
})

afterEach(async () => {
  await client.query("delete from public.officials_leadership_history where official_id in (select id from public.officials where bioguide_id in ('P000197','F000062'))")
  await client.query("delete from public.district_offices where official_id in (select id from public.officials where bioguide_id in ('P000197','F000062'))")
  await client.end()
})

describe('ingestLegislators', () => {
  it('populates opensecrets_id + fec_candidate_id + leadership history + district offices', async () => {
    const legYaml = await readFile(join(__dirname, 'fixtures/legislators-current-mini.yaml'), 'utf8')
    const offYaml = await readFile(join(__dirname, 'fixtures/legislators-district-offices-mini.yaml'), 'utf8')

    const stats = await ingestLegislators({ legislatorsYaml: legYaml, officesYaml: offYaml })

    expect(stats.updatedOfficials).toBeGreaterThanOrEqual(2)
    expect(stats.leadershipRows).toBe(2)
    expect(stats.officeRows).toBe(3)

    const opensecrets = await client.query(
      "select opensecrets_id from public.officials where bioguide_id = 'P000197'"
    )
    expect(opensecrets.rows[0].opensecrets_id).toBe('N00007360')

    const lead = await client.query(
      "select role from public.officials_leadership_history where official_id = (select id from public.officials where bioguide_id = 'P000197') order by start_date desc"
    )
    expect(lead.rows.map((r: any) => r.role)).toEqual(['Speaker', 'Minority Leader'])
  })
})
