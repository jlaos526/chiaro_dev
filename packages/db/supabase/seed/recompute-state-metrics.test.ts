import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { recomputeStateMetrics } from './recompute-state-metrics.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_senate', 'CA', 'CA-RMTEST', 'CA Sen RM test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-rm')
    on conflict (tier, code) do nothing
  `)
  const off = await client.query<{ id: string }>(`
    insert into public.officials (
      openstates_person_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version, in_office
    )
    select 'ocd-person/rm-test', 'RM', 'Test', 'RM Test',
           'state_senate', 'Democratic', 'CA',
           d.id, null, 'FX-rm', true
    from public.districts d where d.code = 'CA-RMTEST'
    on conflict (openstates_person_id) where openstates_person_id is not null
    do update set in_office = true
    returning id
  `)
  officialId = off.rows[0]!.id

  const b1 = await client.query<{ id: string }>(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number,
      title, fiscal_impact_amount, source_url, openstates_url)
    values ('ocd-bill/rm-1', 'CA', '20252026', 'SB', 100, 'RM Sponsored',
      1000000, 'https://x', 'https://y')
    returning id
  `)
  await client.query(
    "insert into public.state_bill_sponsors (bill_id, official_id, role) values ($1, $2, 'sponsor')",
    [b1.rows[0]!.id, officialId],
  )
  const b2 = await client.query<{ id: string }>(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number,
      title, fiscal_impact_amount, source_url, openstates_url)
    values ('ocd-bill/rm-2', 'CA', '20252026', 'SB', 101, 'RM Cosponsored',
      500000, 'https://x', 'https://y')
    returning id
  `)
  await client.query(
    "insert into public.state_bill_sponsors (bill_id, official_id, role) values ($1, $2, 'cosponsor')",
    [b2.rows[0]!.id, officialId],
  )

  for (let i = 0; i < 4; i++) {
    const v = await client.query<{ id: string }>(`
      insert into public.state_votes (openstates_vote_id, bill_id, state, session, chamber,
        vote_date, question, result, source_url)
      values ($1, $2, 'CA', '20252026', 'state_senate', '2025-03-01', 'Q', 'passed', 'https://x')
      returning id
    `, [`ocd-vote/rm-${i}`, b1.rows[0]!.id])
    const pos = i === 3 ? 'not_voting' : 'yes'
    await client.query(
      'insert into public.state_vote_positions (vote_id, official_id, position) values ($1, $2, $3)',
      [v.rows[0]!.id, officialId, pos],
    )
  }
})

afterEach(async () => {
  await client.query("delete from public.state_vote_positions where official_id = $1", [officialId])
  await client.query("delete from public.state_votes where openstates_vote_id like 'ocd-vote/rm-%'")
  await client.query("delete from public.state_bill_sponsors where official_id = $1", [officialId])
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/rm-%'")
  await client.query("delete from public.official_metrics where official_id = $1", [officialId])
  await client.query("delete from public.officials where id = $1", [officialId])
  await client.query("delete from public.districts where source_version = 'FX-rm'")
  await client.end()
})

describe('recomputeStateMetrics', () => {
  it('computes bills_sponsored_count = 1 + bills_cosponsored_count = 1', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{
      bills_sponsored_count: number
      bills_cosponsored_count: number
    }>('select bills_sponsored_count, bills_cosponsored_count from public.official_metrics where official_id = $1', [officialId])
    expect(m.rows[0]!.bills_sponsored_count).toBe(1)
    expect(m.rows[0]!.bills_cosponsored_count).toBe(1)
  })

  it('computes attendance: voted=3, missed=1, attendance_pct=75', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{
      votes_voted_count: number
      votes_missed_count: number
      total_roll_calls: number
      attendance_pct: string
    }>(`
      select votes_voted_count, votes_missed_count, total_roll_calls, attendance_pct
      from public.official_metrics where official_id = $1
    `, [officialId])
    expect(m.rows[0]!.votes_voted_count).toBe(3)
    expect(m.rows[0]!.votes_missed_count).toBe(1)
    expect(m.rows[0]!.total_roll_calls).toBe(4)
    expect(Number(m.rows[0]!.attendance_pct)).toBe(75)
  })

  it('computes fiscal_impact_total = sum of sponsored + cosponsored bill amounts', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ fiscal_impact_total: string }>(
      'select fiscal_impact_total from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(Number(m.rows[0]!.fiscal_impact_total)).toBe(1500000)
  })

  it('party_unity_state computed when ≥3 votes', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ party_unity_state: string | null }>(
      'select party_unity_state from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(m.rows[0]!.party_unity_state).not.toBeNull()
  })

  it('idempotent re-run', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const stats2 = await recomputeStateMetrics({ session: '20252026' })
    expect(stats2.officialsProcessed).toBeGreaterThanOrEqual(1)
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(c.rows[0]!.c).toBe(1)
  })

  it('committee_chair_count defaults to 0', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ committee_chair_count: number | null }>(
      'select committee_chair_count from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(m.rows[0]!.committee_chair_count).toBe(0)
  })

  it('federal officials untouched (NULL state-specific columns)', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ party_unity_state: string | null }>(
      `select om.party_unity_state from public.official_metrics om
       join public.officials o on o.id = om.official_id
       where o.bioguide_id is not null limit 1`,
    )
    if (m.rowCount! > 0) {
      expect(m.rows[0]!.party_unity_state).toBeNull()
    }
  })
})
