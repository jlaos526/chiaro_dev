import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestTownHalls } from './town-halls-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE = join(__dirname, 'fixtures', 'town-hall-project-mini.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_house','CA','CA-11-thfix','CA-11 th fixture',
      st_geogfromtext('MULTIPOLYGON(((-122.5 37.7,-122.4 37.7,-122.4 37.8,-122.5 37.8,-122.5 37.7)))'),
      'FX-th')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-11-thfix'")
  await client.query(`
    insert into public.officials (bioguide_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('THTEST1','TH','One','TH One','federal_house','D','CA',$1::uuid,null,'119')
    on conflict (bioguide_id) do nothing
  `, [d.rows[0].id])
})

afterEach(async () => {
  await client.query("delete from public.town_halls where official_id in (select id from public.officials where bioguide_id = 'THTEST1')")
  await client.query("delete from public.officials where bioguide_id = 'THTEST1'")
  await client.query("delete from public.districts where code = 'CA-11-thfix'")
  await client.end()
})

describe('ingestTownHalls', () => {
  it('inserts events for known officials and skips unknown bioguides', async () => {
    const raw = await readFile(FIXTURE, 'utf8')
    const events = JSON.parse(raw)

    const stats = await ingestTownHalls({
      fetcher: async () => events,
    })

    expect(stats.eventsIngested).toBe(2)  // UNKNOWN1 skipped

    const rows = await client.query(`
      select event_date, format, city from public.town_halls
      where official_id = (select id from public.officials where bioguide_id = 'THTEST1')
      order by event_date asc
    `)
    expect(rows.rows.length).toBe(2)
    expect(rows.rows[0].format).toBe('in_person')
    expect(rows.rows[0].city).toBe('San Francisco')
    expect(rows.rows[1].format).toBe('virtual')
  })

  it('idempotent: re-running with same fixture replaces (does not duplicate)', async () => {
    const raw = await readFile(FIXTURE, 'utf8')
    const events = JSON.parse(raw)

    await ingestTownHalls({ fetcher: async () => events })
    await ingestTownHalls({ fetcher: async () => events })

    const c = await client.query("select count(*)::int as c from public.town_halls where official_id = (select id from public.officials where bioguide_id = 'THTEST1')")
    expect(c.rows[0].c).toBe(2)  // not 4
  })
})
