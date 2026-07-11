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
    const v = await client.query<{ id: string }>(
      `
      insert into public.state_votes (openstates_vote_id, bill_id, state, session, chamber,
        vote_date, question, result, source_url)
      values ($1, $2, 'CA', '20252026', 'state_senate', '2025-03-01', 'Q', 'passed', 'https://x')
      returning id
    `,
      [`ocd-vote/rm-${i}`, b1.rows[0]!.id],
    )
    const pos = i === 3 ? 'not_voting' : 'yes'
    await client.query(
      'insert into public.state_vote_positions (vote_id, official_id, position) values ($1, $2, $3)',
      [v.rows[0]!.id, officialId, pos],
    )
  }

  // Slice 5F: committee membership (chair) for committee_chair_count
  await client.query(
    `
    insert into public.state_committee_memberships (
      official_id, openstates_committee_id, committee_name,
      state, chamber, role, source_url
    )
    values ($1, 'ocd-committee/rm-test-1', 'RM Test Chair Cmt',
            'CA', 'state_senate', 'chair', 'https://x')
  `,
    [officialId],
  )

  // Slice 5F: mark first sponsored bill as 'Chaptered' (CA passage convention)
  // and add a hearing date + subject tags
  await client.query(`
    update public.state_bills
    set status = 'Chaptered',
        hearing_date = '2025-02-15'
    where openstates_bill_id = 'ocd-bill/rm-1'
  `)
  await client.query(`
    insert into public.state_bill_subjects (bill_id, subject)
    select id, 'Health' from public.state_bills where openstates_bill_id = 'ocd-bill/rm-1'
  `)
  await client.query(`
    insert into public.state_bill_subjects (bill_id, subject)
    select id, 'Education' from public.state_bills where openstates_bill_id = 'ocd-bill/rm-2'
  `)

  // Slice 5F: state finance summary so fiscal_impact_per_dollar_raised is computed
  await client.query(
    `
    insert into public.state_finance_summaries (
      official_id, cycle, total_raised, total_disbursed, source, source_url
    )
    values ($1, '2024', 50000, 35000, 'ca-cal-access', 'https://x')
  `,
    [officialId],
  )
})

afterEach(async () => {
  await client.query('delete from public.state_vote_positions where official_id = $1', [officialId])
  await client.query("delete from public.state_votes where openstates_vote_id like 'ocd-vote/rm-%'")
  await client.query('delete from public.state_committee_memberships where official_id = $1', [
    officialId,
  ])
  await client.query('delete from public.state_bill_sponsors where official_id = $1', [officialId])
  await client.query(
    "delete from public.state_bill_subjects where bill_id in (select id from public.state_bills where openstates_bill_id like 'ocd-bill/rm-%')",
  )
  await client.query('delete from public.state_finance_summaries where official_id = $1', [
    officialId,
  ])
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/rm-%'")
  await client.query('delete from public.official_metrics where official_id = $1', [officialId])
  await client.query('delete from public.officials where id = $1', [officialId])
  await client.query("delete from public.districts where source_version = 'FX-rm'")
  await client.end()
})

describe('recomputeStateMetrics', () => {
  it('computes bills_sponsored_count = 1 + bills_cosponsored_count = 1', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{
      bills_sponsored_count: number
      bills_cosponsored_count: number
    }>(
      'select bills_sponsored_count, bills_cosponsored_count from public.official_metrics where official_id = $1',
      [officialId],
    )
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
    }>(
      `
      select votes_voted_count, votes_missed_count, total_roll_calls, attendance_pct
      from public.official_metrics where official_id = $1
    `,
      [officialId],
    )
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

  it('committee_chair_count: real value from state_committee_memberships', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ committee_chair_count: number | null }>(
      'select committee_chair_count from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(m.rows[0]!.committee_chair_count).toBe(1)
  })

  it('committee_chair_count: NULL when no memberships exist for the state', async () => {
    // Delete the seeded membership; no other CA memberships exist in test scope.
    await client.query('delete from public.state_committee_memberships where official_id = $1', [
      officialId,
    ])
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ committee_chair_count: number | null }>(
      'select committee_chair_count from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(m.rows[0]!.committee_chair_count).toBeNull()
  })

  it('bills_passed_count: matches Chaptered status', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ bills_passed_count: number }>(
      'select bills_passed_count from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(m.rows[0]!.bills_passed_count).toBe(1)
  })

  it('hearings_held_count: counts bills with hearing_date populated', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ hearings_held_count: number }>(
      'select hearings_held_count from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(m.rows[0]!.hearings_held_count).toBe(1)
  })

  it('subject_breadth: counts distinct subjects across sponsored bills', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ subject_breadth: number }>(
      'select subject_breadth from public.official_metrics where official_id = $1',
      [officialId],
    )
    // rm-1 is sponsor (counts), rm-2 is cosponsor (excluded by sponsor-only SQL filter).
    // 'Health' from rm-1 = 1 distinct.
    expect(m.rows[0]!.subject_breadth).toBe(1)
  })

  it('bill_passage_rate: bills_passed / bills_sponsored * 100', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ bill_passage_rate: string | null }>(
      'select bill_passage_rate from public.official_metrics where official_id = $1',
      [officialId],
    )
    // 1 passed / 1 sponsored (sponsor role; cosponsor excluded) = 100%
    expect(Number(m.rows[0]!.bill_passage_rate)).toBe(100)
  })

  it('fiscal_impact_per_dollar_raised: fiscal_total / total_raised', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ fiscal_impact_per_dollar_raised: string | null }>(
      'select fiscal_impact_per_dollar_raised from public.official_metrics where official_id = $1',
      [officialId],
    )
    // fiscal_impact_total = 1000000 (from rm-1) + 500000 (from rm-2) = 1500000
    // (existing SQL sums across sponsor + cosponsor roles)
    // total_raised = 50000
    // ratio = 1500000 / 50000 = 30
    expect(Number(m.rows[0]!.fiscal_impact_per_dollar_raised)).toBe(30)
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
