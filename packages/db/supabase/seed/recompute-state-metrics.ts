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
    const stateOfficials = await client.query<{ id: string; party: string }>(`
      select id, party from public.officials
      where chamber in ('state_house', 'state_senate', 'state_legislature')
        and in_office = true
    `)

    for (const off of stateOfficials.rows) {
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
      const committeeChairCount = 0

      await client.query(`
        insert into public.official_metrics (
          official_id, congress,
          bills_sponsored_count, bills_cosponsored_count,
          votes_voted_count, votes_missed_count, total_roll_calls,
          attendance_pct,
          fiscal_impact_total, party_unity_state, committee_chair_count
        )
        values ($1, 'state', $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (official_id) do update set
          bills_sponsored_count   = excluded.bills_sponsored_count,
          bills_cosponsored_count = excluded.bills_cosponsored_count,
          votes_voted_count       = excluded.votes_voted_count,
          votes_missed_count      = excluded.votes_missed_count,
          total_roll_calls        = excluded.total_roll_calls,
          attendance_pct          = excluded.attendance_pct,
          fiscal_impact_total     = excluded.fiscal_impact_total,
          party_unity_state       = excluded.party_unity_state,
          committee_chair_count   = excluded.committee_chair_count,
          computed_at             = now()
      `, [
        off.id,
        billStats.rows[0]!.sponsored,
        billStats.rows[0]!.cosponsored,
        voted, missed, total,
        attendance,
        Number(billStats.rows[0]!.fiscal_total),
        partyUnityState,
        committeeChairCount,
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
