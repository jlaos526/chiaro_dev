#!/usr/bin/env tsx
import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CONGRESS = '119'

export async function recomputeMetrics() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  let officials = 0

  try {
    await client.query('BEGIN')

    // One big upsert with computed columns
    const res = await client.query(
      `
      insert into public.official_metrics (
        official_id, congress,
        attendance_pct, votes_voted_count, votes_missed_count, total_roll_calls,
        bills_sponsored_count, bills_cosponsored_count,
        committee_assignment_count, committee_leadership_count,
        tenure_years, party_unity_pct, bipartisan_vote_pct,
        district_offices_count, town_halls_count,
        stock_act_disclosures_total, stock_act_disclosures_late, stock_act_compliance_pct
      )
      select
        o.id, $1::text,
        -- Attendance
        case when count(distinct v.id) = 0 then null
          else round(100.0 * count(*) filter (where vp.position != 'not_voting')::numeric
                     / count(distinct v.id), 2)
        end,
        count(*) filter (where vp.position != 'not_voting'),
        count(*) filter (where vp.position = 'not_voting'),
        count(distinct v.id),

        -- Bills sponsored / cosponsored (current Congress)
        (select count(*) from public.bill_sponsors bs
           join public.bills b on b.id = bs.bill_id
           where bs.official_id = o.id and bs.role = 'sponsor' and b.congress = $1),
        (select count(*) from public.bill_sponsors bs
           join public.bills b on b.id = bs.bill_id
           where bs.official_id = o.id and bs.role = 'cosponsor' and b.congress = $1),

        -- Committee counts (placeholder; slice 5+ — TIGER/legislators data lacks committee assignments
        -- in this slice. Slice 4 sets to NULL; the UI displays "—" with a "data coming in slice 5" tooltip.)
        null::int,
        null::int,

        -- Tenure: difference between earliest start_date in leadership_history and today,
        -- OR fall back to "years since first committee assignment". Slice 4 uses leadership_history
        -- (correct for long-tenure leaders; conservative undercount for backbenchers — slice 5 refines
        -- with terms[] data when committee data ingests).
        coalesce(
          extract(year from age(now(), (select min(start_date) from public.officials_leadership_history lh where lh.official_id = o.id)))::numeric,
          null
        ),

        -- Party unity (placeholder; slice 5 refines with cross-rep vote correlation)
        null::numeric,
        null::numeric,

        -- District offices
        (select count(*) from public.district_offices do2 where do2.official_id = o.id),
        -- Town halls
        (select count(*) from public.town_halls th where th.official_id = o.id and th.event_date >= '2025-01-03'),

        -- STOCK Act
        (select count(*) from public.stock_transactions st where st.official_id = o.id),
        (select count(*) from public.stock_transactions st where st.official_id = o.id and st.days_late > 0),
        case when (select count(*) from public.stock_transactions st where st.official_id = o.id) = 0
          then null
          else round(100.0 * (select count(*) from public.stock_transactions st where st.official_id = o.id and st.days_late = 0)::numeric
                     / (select count(*) from public.stock_transactions st where st.official_id = o.id), 2)
        end

      from public.officials o
      left join public.vote_positions vp on vp.official_id = o.id
      left join public.votes v on v.id = vp.vote_id and v.congress = $1 and v.chamber = o.chamber
      where o.in_office = true
      group by o.id

      on conflict (official_id) do update set
        congress = excluded.congress,
        attendance_pct                = excluded.attendance_pct,
        votes_voted_count             = excluded.votes_voted_count,
        votes_missed_count            = excluded.votes_missed_count,
        total_roll_calls              = excluded.total_roll_calls,
        bills_sponsored_count         = excluded.bills_sponsored_count,
        bills_cosponsored_count       = excluded.bills_cosponsored_count,
        committee_assignment_count    = excluded.committee_assignment_count,
        committee_leadership_count    = excluded.committee_leadership_count,
        tenure_years                  = coalesce(excluded.tenure_years, official_metrics.tenure_years),
        party_unity_pct               = excluded.party_unity_pct,
        bipartisan_vote_pct           = excluded.bipartisan_vote_pct,
        district_offices_count        = excluded.district_offices_count,
        town_halls_count              = excluded.town_halls_count,
        stock_act_disclosures_total   = excluded.stock_act_disclosures_total,
        stock_act_disclosures_late    = excluded.stock_act_disclosures_late,
        stock_act_compliance_pct      = excluded.stock_act_compliance_pct,
        computed_at = now()
    `,
      [CONGRESS],
    )

    officials = res.rowCount ?? 0

    // Also propagate in_state / out_of_state donor % from latest finance_summaries
    await client.query(`
      update public.official_metrics m
      set in_state_donations_pct     = fs.in_state_pct,
          out_of_state_donations_pct = fs.out_of_state_pct
      from public.finance_summaries fs
      where fs.official_id = m.official_id
        and fs.cycle = '2024'
    `)

    // And career bill counts (across all congresses ingested)
    await client.query(`
      update public.official_metrics m
      set career_bills_sponsored_count = (
        select count(*) from public.bill_sponsors bs
        where bs.official_id = m.official_id and bs.role = 'sponsor'
      )
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }

  return { officialsRecomputed: officials }
}

if (isCliEntry(import.meta.url)) {
  recomputeMetrics()
    .then((s) => {
      console.log(JSON.stringify(s, null, 2))
      process.exit(0)
    })
    .catch((e) => {
      console.error(e)
      process.exit(2)
    })
}
