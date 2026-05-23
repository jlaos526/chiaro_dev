#!/usr/bin/env tsx
// Audit-fixture-attach: attaches slice-4 fixture data to a real official from
// seed:officials, so the manual drill-down audit (docs/superpowers/slice-4-
// drill-down-audit.md) has live click-through targets without needing OpenSecrets,
// openFEC, or Town Hall Project API keys.
//
// Usage:
//   AUDIT_TARGET_BIOGUIDE=P000197 pnpm --filter @chiaro/db exec \
//     tsx supabase/seed/audit-fixture-attach.ts
//
// Default target: P000197 (Pelosi). Fallback: first house official by bioguide_id.
// Idempotent — re-running replaces all attached rows for the target.

import { Client } from 'pg'
import { fileURLToPath } from 'node:url'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TARGET_BIOGUIDE = process.env.AUDIT_TARGET_BIOGUIDE ?? 'P000197'

interface Target {
  id:           string
  bioguide_id:  string
  full_name:    string
  state:        string
  district_id:  string | null
  chamber:      string
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  // 1. Pick target official
  let target: Target | undefined
  const byBioguide = await client.query<Target>(
    `select id, bioguide_id, full_name, state, district_id, chamber::text
       from public.officials where bioguide_id = $1 and in_office = true`,
    [TARGET_BIOGUIDE],
  )
  if (byBioguide.rows[0]) {
    target = byBioguide.rows[0]
  } else {
    const fallback = await client.query<Target>(
      `select id, bioguide_id, full_name, state, district_id, chamber::text
         from public.officials where chamber = 'federal_house' and in_office = true
         order by bioguide_id asc limit 1`,
    )
    target = fallback.rows[0]
    if (!target) throw new Error('No house officials in DB — run pnpm seed:officials first.')
    console.error(`Target ${TARGET_BIOGUIDE} not found; falling back to ${target.bioguide_id} (${target.full_name}).`)
  }
  console.log(`Attaching slice-4 fixture data to ${target.full_name} (${target.bioguide_id}, ${target.chamber}, ${target.state}).`)

  await client.query('BEGIN')
  try {
    // 2. SCORECARDS — ensure 10 orgs exist, then upsert ratings for the target
    const orgsSeed: Array<{
      slug: string; name: string; issue_area: string; lean: string;
      methodology_url: string; min: number; max: number; score: number;
    }> = [
      { slug: 'lcv',              name: 'League of Conservation Voters',     issue_area: 'environment',        lean: 'progressive',  methodology_url: 'https://scorecard.lcv.org/methodology',                                  min: 0, max: 100, score: 92 },
      { slug: 'sierra-club',      name: 'Sierra Club',                       issue_area: 'environment',        lean: 'progressive',  methodology_url: 'https://www.sierraclub.org/political/scorecard/methodology',            min: 0, max: 100, score: 95 },
      { slug: 'aclu',             name: 'American Civil Liberties Union',    issue_area: 'civil-liberties',    lean: 'progressive',  methodology_url: 'https://www.aclu.org/legislative-scorecard/methodology',                min: 0, max: 100, score: 85 },
      { slug: 'naacp',            name: 'NAACP',                             issue_area: 'civil-rights',       lean: 'progressive',  methodology_url: 'https://naacp.org/legislative-report-card/methodology',                 min: 0, max: 100, score: 90 },
      { slug: 'planned-parenthood', name: 'Planned Parenthood Action Fund',  issue_area: 'reproductive-rights',lean: 'progressive',  methodology_url: 'https://www.plannedparenthoodaction.org/elections/congressional-scorecard/methodology', min: 0, max: 100, score: 100 },
      { slug: 'ada',              name: 'Americans for Democratic Action',   issue_area: 'liberal-policy',     lean: 'progressive',  methodology_url: 'https://adaction.org/voting-records/methodology',                       min: 0, max: 100, score: 95 },
      { slug: 'heritage-action',  name: 'Heritage Action for America',       issue_area: 'conservative-policy',lean: 'conservative', methodology_url: 'https://heritageaction.com/scorecard/methodology',                      min: 0, max: 100, score: 5 },
      { slug: 'us-chamber',       name: 'U.S. Chamber of Commerce',          issue_area: 'business-policy',    lean: 'conservative', methodology_url: 'https://www.uschamber.com/scorecard/methodology',                       min: 0, max: 100, score: 20 },
      { slug: 'nra',              name: 'NRA Political Victory Fund',        issue_area: 'second-amendment',   lean: 'single-issue', methodology_url: 'https://www.nrapvf.org/grades/methodology',                             min: 0, max: 100, score: 0 },
      { slug: 'afl-cio',          name: 'AFL-CIO',                           issue_area: 'labor',              lean: 'single-issue', methodology_url: 'https://aflcio.org/scorecard/methodology',                              min: 0, max: 100, score: 95 },
    ]

    for (const o of orgsSeed) {
      await client.query(
        `insert into public.scorecard_orgs (slug, name, issue_area, lean, methodology_url, scoring_min, scoring_max)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (slug) do update set
             name = excluded.name, issue_area = excluded.issue_area, lean = excluded.lean,
             methodology_url = excluded.methodology_url, scoring_min = excluded.scoring_min,
             scoring_max = excluded.scoring_max`,
        [o.slug, o.name, o.issue_area, o.lean, o.methodology_url, o.min, o.max],
      )
    }
    for (const o of orgsSeed) {
      await client.query(
        `insert into public.scorecard_ratings (scorecard_id, official_id, congress, score, source_url)
           select id, $1, '119', $2,
             'https://scorecard.example.org/' || $3 || '/' || lower($4)
           from public.scorecard_orgs where slug = $3
           on conflict (scorecard_id, official_id, congress) do update set
             score = excluded.score, source_url = excluded.source_url`,
        [target.id, o.score, o.slug, target.bioguide_id],
      )
    }
    console.log(`  ✓ 10 scorecard_orgs + 10 scorecard_ratings`)

    // 3. FINANCE — summary + 3 industries + 3 PACs
    const fs = await client.query<{ id: string }>(
      `insert into public.finance_summaries
         (official_id, cycle, opensecrets_id, total_raised, total_disbursed,
          small_donor_pct, in_state_pct, out_of_state_pct, source_url)
         values ($1, '2024', 'AUDIT_FIXTURE', 5234189, 4892711, 28.4, 67.2, 32.8,
           'https://www.opensecrets.org/members-of-congress/summary?cid=AUDIT_FIXTURE&cycle=2024')
         on conflict (official_id, cycle) do update set
           total_raised = excluded.total_raised,
           total_disbursed = excluded.total_disbursed,
           small_donor_pct = excluded.small_donor_pct,
           in_state_pct = excluded.in_state_pct,
           out_of_state_pct = excluded.out_of_state_pct,
           source_url = excluded.source_url,
           ingested_at = now()
         returning id`,
      [target.id],
    )
    const fsId = fs.rows[0].id

    await client.query(`delete from public.finance_industry_top where finance_summary_id = $1`, [fsId])
    for (const [rank, industry, amount] of [
      [1, 'Securities & Investment', 412000],
      [2, 'Real Estate', 287500],
      [3, 'Lawyers/Law Firms', 245000],
    ] as Array<[number, string, number]>) {
      await client.query(
        `insert into public.finance_industry_top (finance_summary_id, rank, industry, amount)
           values ($1,$2,$3,$4)`,
        [fsId, rank, industry, amount],
      )
    }

    await client.query(`delete from public.finance_pac_contributions where finance_summary_id = $1`, [fsId])
    for (const [name, fec, amount] of [
      ['Realtors PAC',          'C00030718', 10000],
      ['AT&T Inc Federal PAC',  'C00109017', 7500],
      ['Comcast Corp PAC',      'C00373593', 5000],
    ] as Array<[string, string, number]>) {
      await client.query(
        `insert into public.finance_pac_contributions (finance_summary_id, pac_name, pac_fec_id, amount)
           values ($1,$2,$3,$4)`,
        [fsId, name, fec, amount],
      )
    }
    console.log(`  ✓ finance_summaries + 3 industries + 3 PACs`)

    // 4. EVIDENCE — 1 district_office, 1 town_hall, 2 stock_transactions (1 late),
    //    1 leadership_history (Speaker, current)
    await client.query(`delete from public.district_offices where official_id = $1`, [target.id])
    await client.query(
      `insert into public.district_offices (official_id, address, city, state, zip, phone, source_url)
         values ($1, '90 7th Street, Suite 2-800', 'San Francisco', 'CA', '94103', '415-556-4862',
           'https://github.com/unitedstates/congress-legislators/blob/main/legislators-district-offices.yaml')`,
      [target.id],
    )

    await client.query(`delete from public.town_halls where official_id = $1 and event_date >= '2025-01-03'`, [target.id])
    await client.query(
      `insert into public.town_halls (official_id, event_date, city, state, format, attendance_estimate, source_url, source)
         values ($1, '2026-02-15', 'San Francisco', 'CA', 'in_person', 250,
           'https://townhallproject.com/event/audit-fixture-1', 'legacy')`,
      [target.id],
    )

    await client.query(`delete from public.stock_transactions where official_id = $1 and transaction_date >= '2025-01-03'`, [target.id])
    // on-time (15 days)
    await client.query(
      `insert into public.stock_transactions (official_id, transaction_date, filing_date, asset_ticker, asset_name, transaction_type, amount_range_low, amount_range_high, source_url, source)
         values ($1, '2026-01-10', '2026-01-25', 'NVDA', 'NVIDIA Corp', 'purchase', 15000, 50000,
           'https://housestockwatcher.com/transaction/audit-1', 'legacy')`,
      [target.id],
    )
    // late (73 days → days_late = 28)
    await client.query(
      `insert into public.stock_transactions (official_id, transaction_date, filing_date, asset_ticker, asset_name, transaction_type, amount_range_low, amount_range_high, source_url, source)
         values ($1, '2026-02-01', '2026-04-15', 'TSLA', 'Tesla Inc', 'sale', 100000, 250000,
           'https://housestockwatcher.com/transaction/audit-2', 'legacy')`,
      [target.id],
    )

    await client.query(`delete from public.officials_leadership_history where official_id = $1`, [target.id])
    await client.query(
      `insert into public.officials_leadership_history (official_id, role, chamber, party, start_date, source_url)
         values ($1, 'Speaker', $2::public.official_chamber, 'D', '2023-01-03',
           'https://github.com/unitedstates/congress-legislators/blob/main/legislators-current.yaml')`,
      [target.id, target.chamber],
    )
    console.log(`  ✓ 1 office + 1 town_hall + 2 stock_transactions (1 late) + 1 leadership role`)

    // 5. BILLS + VOTES — 2 bills (1 sponsored, 1 cosponsored), 2 votes (1 yes, 1 missed)
    const b1 = await client.query<{ id: string }>(
      `insert into public.bills (congress, bill_type, number, title, short_title, policy_area, status, introduced_date, source_url)
         values ('119', 'hr', 9001, 'Audit Fixture Environmental Bill', 'Audit Env', 'Environment', 'introduced', '2026-01-15',
           'https://www.congress.gov/bill/119th-congress/hr-bill/9001')
         on conflict (congress, bill_type, number) do update set title = excluded.title
         returning id`,
    )
    const b1Id = b1.rows[0].id
    await client.query(`delete from public.bill_subjects where bill_id = $1`, [b1Id])
    await client.query(`insert into public.bill_subjects (bill_id, subject) values ($1, $2)`, [b1Id, 'Environmental protection'])
    await client.query(`insert into public.bill_subjects (bill_id, subject) values ($1, $2)`, [b1Id, 'Air quality'])
    await client.query(`delete from public.bill_sponsors where bill_id = $1`, [b1Id])
    await client.query(
      `insert into public.bill_sponsors (bill_id, official_id, role, added_date) values ($1, $2, 'sponsor', '2026-01-15')`,
      [b1Id, target.id],
    )

    const b2 = await client.query<{ id: string }>(
      `insert into public.bills (congress, bill_type, number, title, short_title, policy_area, status, introduced_date, source_url)
         values ('119', 'hr', 9002, 'Audit Fixture Civil Rights Bill', null, 'Civil Rights', 'in_committee', '2026-02-01',
           'https://www.congress.gov/bill/119th-congress/hr-bill/9002')
         on conflict (congress, bill_type, number) do update set title = excluded.title
         returning id`,
    )
    const b2Id = b2.rows[0].id
    await client.query(`delete from public.bill_subjects where bill_id = $1`, [b2Id])
    await client.query(`insert into public.bill_subjects (bill_id, subject) values ($1, $2)`, [b2Id, 'Civil rights and liberties, minority issues'])
    await client.query(`delete from public.bill_sponsors where bill_id = $1`, [b2Id])
    await client.query(
      `insert into public.bill_sponsors (bill_id, official_id, role, added_date) values ($1, $2, 'cosponsor', '2026-02-01')`,
      [b2Id, target.id],
    )

    // Votes: 1 attended (yes), 1 missed
    const v1 = await client.query<{ id: string }>(
      `insert into public.votes (congress, chamber, session, roll_call, vote_date, question, result, bill_id, source_url)
         values ('119', $1::public.official_chamber, 1, 101, '2026-01-20', 'On Passage', 'Passed', $2,
           'https://www.congress.gov/vote/119/' || $1::text || '/1/101')
         on conflict (congress, chamber, session, roll_call) do update set question = excluded.question
         returning id`,
      [target.chamber, b1Id],
    )
    const v2 = await client.query<{ id: string }>(
      `insert into public.votes (congress, chamber, session, roll_call, vote_date, question, result, bill_id, source_url)
         values ('119', $1::public.official_chamber, 1, 102, '2026-02-10', 'On Cloture', 'Failed', $2,
           'https://www.congress.gov/vote/119/' || $1::text || '/1/102')
         on conflict (congress, chamber, session, roll_call) do update set question = excluded.question
         returning id`,
      [target.chamber, b2Id],
    )
    await client.query(`delete from public.vote_positions where vote_id in ($1, $2) and official_id = $3`, [v1.rows[0].id, v2.rows[0].id, target.id])
    await client.query(`insert into public.vote_positions (vote_id, official_id, position) values ($1, $2, 'yes')`, [v1.rows[0].id, target.id])
    await client.query(`insert into public.vote_positions (vote_id, official_id, position) values ($1, $2, 'not_voting')`, [v2.rows[0].id, target.id])
    console.log(`  ✓ 2 bills + sponsors + subjects + 2 votes (1 attended, 1 missed)`)

    // 6. OFFICIAL_METRICS — populate the scalar rollup
    await client.query(
      `insert into public.official_metrics (
         official_id, congress,
         attendance_pct, votes_voted_count, votes_missed_count, total_roll_calls,
         bills_sponsored_count, bills_cosponsored_count, career_bills_sponsored_count,
         committee_assignment_count, committee_leadership_count,
         tenure_years, party_unity_pct, bipartisan_vote_pct,
         salary_usd, salary_role,
         lives_in_district, home_district_id,
         in_state_donations_pct, out_of_state_donations_pct,
         district_offices_count, town_halls_count,
         stock_act_disclosures_total, stock_act_disclosures_late, stock_act_compliance_pct
       ) values (
         $1, '119',
         50.00, 1, 1, 2,
         1, 1, 1,
         null, null,
         18.5, null, null,
         223500, 'Speaker',
         $2::boolean, $3,
         67.2, 32.8,
         1, 1,
         2, 1, 50.00
       )
       on conflict (official_id) do update set
         congress = excluded.congress,
         attendance_pct = excluded.attendance_pct,
         votes_voted_count = excluded.votes_voted_count,
         votes_missed_count = excluded.votes_missed_count,
         total_roll_calls = excluded.total_roll_calls,
         bills_sponsored_count = excluded.bills_sponsored_count,
         bills_cosponsored_count = excluded.bills_cosponsored_count,
         career_bills_sponsored_count = excluded.career_bills_sponsored_count,
         tenure_years = excluded.tenure_years,
         salary_usd = excluded.salary_usd,
         salary_role = excluded.salary_role,
         lives_in_district = excluded.lives_in_district,
         home_district_id = excluded.home_district_id,
         in_state_donations_pct = excluded.in_state_donations_pct,
         out_of_state_donations_pct = excluded.out_of_state_donations_pct,
         district_offices_count = excluded.district_offices_count,
         town_halls_count = excluded.town_halls_count,
         stock_act_disclosures_total = excluded.stock_act_disclosures_total,
         stock_act_disclosures_late = excluded.stock_act_disclosures_late,
         stock_act_compliance_pct = excluded.stock_act_compliance_pct,
         computed_at = now()`,
      [target.id, target.chamber === 'federal_house', target.district_id],
    )
    console.log(`  ✓ official_metrics scalar rollup`)

    await client.query('COMMIT')
    console.log('')
    console.log('Audit-fixture-attach complete.')
    console.log(`Detail page URL: http://localhost:3000/officials/${target.id}`)
    console.log(`Target bioguide:  ${target.bioguide_id}`)
    console.log(`Target name:      ${target.full_name}`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1) })
}
