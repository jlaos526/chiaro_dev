import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import {
  upsertStateScorecardOrg,
  upsertStateScorecardRating,
  type StateScorecardAdapter,
} from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

const TEST_ADAPTER: StateScorecardAdapter = {
  slug: 'aclu',
  name_template: (s) => `ACLU of ${s}`,
  issue_area: 'civil-liberties',
  lean: 'progressive',
  methodology_url_template: (s) => `https://aclu.${s.toLowerCase()}.org/scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  covered_states: ['CA'],
  async fetchRatings() {
    return []
  },
}

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-SCS', 'CA SCS test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-scs')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-scs', 'Test SCS', 'Test', 'SCS', 'state_house', 'D', 'CA',
      d.id, true, 'FX-scs'
    from public.districts d where d.code = 'CA-SCS'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_scorecard_ratings where official_id = $1', [
    officialId,
  ])
  await client.query("delete from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'")
  await client.query("delete from public.officials where source_version = 'FX-scs'")
  await client.query("delete from public.districts where source_version = 'FX-scs'")
  await client.end()
})

describe('upsertStateScorecardOrg', () => {
  it('inserts a new org and returns its id', async () => {
    const id = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    expect(typeof id).toBe('string')
    const row = await client.query<{ name: string; methodology_url: string }>(
      "select name, methodology_url from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'",
    )
    expect(row.rows[0]!.name).toBe('ACLU of CA')
    expect(row.rows[0]!.methodology_url).toBe('https://aclu.ca.org/scorecard')
  })

  it('idempotent: second call updates the existing org', async () => {
    const id1 = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    const id2 = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    expect(id1).toBe(id2)
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'",
    )
    expect(c.rows[0]!.c).toBe(1)
  })
})

describe('upsertStateScorecardRating', () => {
  it('returns true and inserts rating for known official', async () => {
    const scorecardId = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    const ok = await upsertStateScorecardRating(
      client,
      scorecardId,
      'ocd-person/fx-scs',
      '20252026',
      85.5,
      'https://x',
    )
    expect(ok).toBe(true)
    const row = await client.query<{ score: string }>(
      'select score from public.state_scorecard_ratings where official_id = $1',
      [officialId],
    )
    expect(Number(row.rows[0]!.score)).toBe(85.5)
  })

  it('returns false for unknown openstates_person_id (does not insert)', async () => {
    const scorecardId = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    const ok = await upsertStateScorecardRating(
      client,
      scorecardId,
      'ocd-person/UNKNOWN',
      '20252026',
      50,
      'https://x',
    )
    expect(ok).toBe(false)
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_scorecard_ratings where scorecard_id = $1',
      [scorecardId],
    )
    expect(c.rows[0]!.c).toBe(0)
  })

  it('idempotent: second call updates score', async () => {
    const scorecardId = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    await upsertStateScorecardRating(
      client,
      scorecardId,
      'ocd-person/fx-scs',
      '20252026',
      50,
      'https://x',
    )
    await upsertStateScorecardRating(
      client,
      scorecardId,
      'ocd-person/fx-scs',
      '20252026',
      75,
      'https://y',
    )
    const row = await client.query<{ score: string; source_url: string }>(
      'select score, source_url from public.state_scorecard_ratings where official_id = $1',
      [officialId],
    )
    expect(Number(row.rows[0]!.score)).toBe(75)
    expect(row.rows[0]!.source_url).toBe('https://y')
  })
})
