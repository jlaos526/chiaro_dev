import { Client } from 'pg'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface RecomputeStateMetricsOpts {
  session: string
  client?: Client
}

export interface RecomputeStateMetricsStats {
  officialsProcessed: number
}

const PARTY_UNITY_MIN_VOTES = 3

export async function recomputeStateMetrics(
  opts: RecomputeStateMetricsOpts,
): Promise<RecomputeStateMetricsStats> {
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  let officialsProcessed = 0
  try {
    const stateOfficials = await client.query<{ id: string; party: string; state: string }>(`
      select id, party, state from public.officials
      where chamber in ('state_house', 'state_senate', 'state_legislature')
        and in_office = true
    `)

    for (const off of stateOfficials.rows) {
      // bills_sponsored_count + bills_cosponsored_count + fiscal_impact_total
      const billStats = await client.query<{
        sponsored: number
        cosponsored: number
        fiscal_total: string | null
      }>(`
        select
          count(*) filter (where sps.role = 'sponsor')::int   as sponsored,
          count(*) filter (where sps.role = 'cosponsor')::int as cosponsored,
          coalesce(sum(b.fiscal_impact_amount), 0)            as fiscal_total
        from public.state_bill_sponsors sps
        join public.state_bills b on b.id = sps.bill_id
        where sps.official_id = $1 and b.session = $2
      `, [off.id, opts.session])

      // vote stats
      const voteStats = await client.query<{
        voted: number
        missed: number
        total: number
      }>(`
        select
          count(*) filter (where svp.position in ('yes','no','abstain','present'))::int as voted,
          count(*) filter (where svp.position = 'not_voting')::int                       as missed,
          count(*)::int                                                                  as total
        from public.state_vote_positions svp
        join public.state_votes v on v.id = svp.vote_id
        where svp.official_id = $1 and v.session = $2
      `, [off.id, opts.session])

      const voted   = voteStats.rows[0]!.voted
      const missed  = voteStats.rows[0]!.missed
      const total   = voteStats.rows[0]!.total
      const attendance = total === 0 ? null : (voted / total) * 100

      const partyUnityState = voted >= PARTY_UNITY_MIN_VOTES ? 100 : null

      // committee_chair_count: NULL when no committee data ingested for the
      // official's state; else actual chair count (can legitimately be 0).
      const stateHasCommitteeData = await client.query<{ has_data: boolean }>(`
        select exists(
          select 1 from public.state_committee_memberships where state = $1
        ) as has_data
      `, [off.state])
      let committeeChairCount: number | null = null
      if (stateHasCommitteeData.rows[0]!.has_data) {
        const chairStats = await client.query<{ count: number }>(`
          select count(*)::int as count from public.state_committee_memberships
          where official_id = $1 and role = 'chair'
        `, [off.id])
        committeeChairCount = chairStats.rows[0]!.count
      }

      // bills_passed_count: heuristic substring match on state_bills.status.
      const passedStats = await client.query<{ count: number }>(`
        select count(*)::int as count
          from public.state_bill_sponsors sps
          join public.state_bills b on b.id = sps.bill_id
          where sps.official_id = $1 and b.session = $2
            and sps.role = 'sponsor'
            and (
              lower(b.status) like '%signed%'
              or lower(b.status) like '%enacted%'
              or lower(b.status) like '%became law%'
              or lower(b.status) like '%passed%governor%'
              or lower(b.status) like '%chaptered%'
            )
      `, [off.id, opts.session])
      const billsPassedCount = passedStats.rows[0]!.count

      // hearings_held_count
      const hearingsStats = await client.query<{ count: number }>(`
        select count(*)::int as count
          from public.state_bill_sponsors sps
          join public.state_bills b on b.id = sps.bill_id
          where sps.official_id = $1 and b.session = $2
            and sps.role = 'sponsor'
            and b.hearing_date is not null
      `, [off.id, opts.session])
      const hearingsHeldCount = hearingsStats.rows[0]!.count

      // subject_breadth
      const subjectStats = await client.query<{ count: number }>(`
        select count(distinct sbs.subject)::int as count
          from public.state_bill_sponsors sps
          join public.state_bills b on b.id = sps.bill_id
          join public.state_bill_subjects sbs on sbs.bill_id = b.id
          where sps.official_id = $1 and b.session = $2
            and sps.role = 'sponsor'
      `, [off.id, opts.session])
      const subjectBreadth = subjectStats.rows[0]!.count

      // bill_passage_rate: bills_passed / bills_sponsored * 100. NULL when 0 sponsored.
      const sponsored = billStats.rows[0]!.sponsored
      const billPassageRate = sponsored === 0
        ? null
        : (billsPassedCount / sponsored) * 100

      // fiscal_impact_per_dollar_raised: join latest state_finance_summaries.
      const financeRow = await client.query<{ total_raised: string | null }>(`
        select total_raised from public.state_finance_summaries
        where official_id = $1
        order by ingested_at desc
        limit 1
      `, [off.id])
      const totalRaised = financeRow.rows[0]?.total_raised == null
        ? null
        : Number(financeRow.rows[0]!.total_raised)
      const fiscalTotal = Number(billStats.rows[0]!.fiscal_total)
      const fiscalImpactPerDollarRaised = (totalRaised == null || totalRaised === 0)
        ? null
        : fiscalTotal / totalRaised

      await client.query(`
        insert into public.official_metrics (
          official_id, congress,
          bills_sponsored_count, bills_cosponsored_count,
          votes_voted_count, votes_missed_count, total_roll_calls,
          attendance_pct,
          fiscal_impact_total, party_unity_state, committee_chair_count,
          bills_passed_count, hearings_held_count, subject_breadth,
          bill_passage_rate, fiscal_impact_per_dollar_raised
        )
        values ($1, 'state', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        on conflict (official_id) do update set
          bills_sponsored_count            = excluded.bills_sponsored_count,
          bills_cosponsored_count          = excluded.bills_cosponsored_count,
          votes_voted_count                = excluded.votes_voted_count,
          votes_missed_count               = excluded.votes_missed_count,
          total_roll_calls                 = excluded.total_roll_calls,
          attendance_pct                   = excluded.attendance_pct,
          fiscal_impact_total              = excluded.fiscal_impact_total,
          party_unity_state                = excluded.party_unity_state,
          committee_chair_count            = excluded.committee_chair_count,
          bills_passed_count               = excluded.bills_passed_count,
          hearings_held_count              = excluded.hearings_held_count,
          subject_breadth                  = excluded.subject_breadth,
          bill_passage_rate                = excluded.bill_passage_rate,
          fiscal_impact_per_dollar_raised  = excluded.fiscal_impact_per_dollar_raised,
          computed_at                      = now()
      `, [
        off.id,
        sponsored,
        billStats.rows[0]!.cosponsored,
        voted, missed, total,
        attendance,
        fiscalTotal,
        partyUnityState,
        committeeChairCount,
        billsPassedCount,
        hearingsHeldCount,
        subjectBreadth,
        billPassageRate,
        fiscalImpactPerDollarRaised,
      ])
      officialsProcessed += 1
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return { officialsProcessed }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const sessionArg = process.argv.find(a => a.startsWith('--session='))
  const session = sessionArg ? sessionArg.split('=')[1]! : new Date().getFullYear().toString()
  recomputeStateMetrics({ session })
    .then(stats => {
      console.log('Recompute state metrics summary:')
      console.log(`  officials processed: ${stats.officialsProcessed}`)
      process.exit(0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
