import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestBillsAndVotes } from './bills-votes-ingest.ts'
import type { NormalizedBill } from './congress-gov-bills.ts'
import type { NormalizedVote } from './congress-gov-votes.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_senate','CA','CA-S1-bvfix','CA Senate BV fixture',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-bv')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-S1-bvfix'")
  await client.query(`
    insert into public.officials (bioguide_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version)
    values ('BVTEST1','BV','One','BV One','senate','D','CA',$1::uuid,1,'119')
    on conflict (bioguide_id) do nothing
  `, [d.rows[0].id])
})

afterEach(async () => {
  // Clean up everything we inserted (and that the orchestrator inserted via FKs).
  await client.query("delete from public.vote_positions where vote_id in (select id from public.votes where congress = '119' and roll_call in (101))")
  await client.query("delete from public.votes where congress = '119' and roll_call = 101")
  await client.query("delete from public.bill_subjects where bill_id in (select id from public.bills where congress = '119' and number in (9001))")
  await client.query("delete from public.bill_sponsors where bill_id in (select id from public.bills where congress = '119' and number in (9001))")
  await client.query("delete from public.bills where congress = '119' and number in (9001)")
  await client.query("delete from public.officials where bioguide_id = 'BVTEST1'")
  await client.query("delete from public.districts where code = 'CA-S1-bvfix'")
  await client.end()
})

describe('ingestBillsAndVotes', () => {
  it('upserts bills + subjects + sponsors + votes + positions from injected fetchers', async () => {
    const fakeBills: NormalizedBill[] = [{
      congress: '119', bill_type: 's', number: 9001, title: 'Test Bill',
      short_title: null, policy_area: 'Environment', status: 'introduced',
      introduced_date: '2026-01-15', latest_action: 'Referred to committee',
      source_url: 'https://congress.gov/bill/9001', congress_gov_url: 'https://api/x',
      sponsors: [{ bioguide_id: 'BVTEST1', role: 'sponsor', added_date: '2026-01-15' }],
      subjects: ['Environmental protection', 'Air quality'],
    }]
    const fakeHouseVotes: NormalizedVote[] = []
    const fakeSenateVotes: NormalizedVote[] = [{
      congress: '119', chamber: 'senate', session: 1, roll_call: 101,
      vote_date: '2026-01-20', question: 'On Passage', result: 'Passed',
      bill_ref: { type: 's', number: 9001 },
      source_url: 'https://congress.gov/vote/101',
      positions: [{ bioguide_id: 'BVTEST1', position: 'yes' }],
    }]

    const stats = await ingestBillsAndVotes({
      apiKey: 'unused',
      billsFetcher: async () => fakeBills,
      votesFetcher: async (chamber) => chamber === 'house' ? fakeHouseVotes : fakeSenateVotes,
    })

    expect(stats.status).toBe('completed')
    expect(stats.billsIngested).toBe(1)
    expect(stats.billSubjectsIngested).toBe(2)
    expect(stats.billSponsorsIngested).toBe(1)
    expect(stats.votesIngested).toBe(1)
    expect(stats.votePositionsIngested).toBe(1)

    // Verify bill upsert and FK from votes
    const bill = await client.query(
      "select id, status from public.bills where congress='119' and bill_type='s' and number=9001",
    )
    expect(bill.rows.length).toBe(1)
    expect(bill.rows[0].status).toBe('introduced')

    const vote = await client.query(
      "select id, bill_id, result from public.votes where congress='119' and chamber='senate' and roll_call=101",
    )
    expect(vote.rows.length).toBe(1)
    expect(vote.rows[0].bill_id).toBe(bill.rows[0].id)

    const positions = await client.query(
      "select position from public.vote_positions where vote_id = $1",
      [vote.rows[0].id],
    )
    expect(positions.rows.length).toBe(1)
    expect(positions.rows[0].position).toBe('yes')

    // Verify idempotent re-run: same input should produce same counts (no duplicates).
    const stats2 = await ingestBillsAndVotes({
      apiKey: 'unused',
      billsFetcher: async () => fakeBills,
      votesFetcher: async (chamber) => chamber === 'house' ? fakeHouseVotes : fakeSenateVotes,
    })
    expect(stats2.status).toBe('completed')

    const billsAfter = await client.query(
      "select count(*)::int as c from public.bills where congress='119' and number=9001",
    )
    expect(billsAfter.rows[0].c).toBe(1)
    const positionsAfter = await client.query(
      "select count(*)::int as c from public.vote_positions where vote_id = $1",
      [vote.rows[0].id],
    )
    expect(positionsAfter.rows[0].c).toBe(1)
  })
})
