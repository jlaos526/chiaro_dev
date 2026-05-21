import type { Client } from 'pg'

export type FinanceState = 'CA' | 'NY' | 'FL' | 'TX' | 'MI'

export interface StateFinanceAdapter {
  state: FinanceState
  fetch(opts: { client: Client; cycle: string }): Promise<StateFinanceStats>
}

export interface StateFinanceStats {
  state: FinanceState
  summariesUpserted: number
  donorsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

export interface StateFinanceSummaryPayload {
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source: string
  source_url: string
}

export interface IndividualDonorPayload {
  rank: number
  donor_name: string
  amount: number
  employer?: string | null
  occupation?: string | null
  city?: string | null
  donor_state?: string | null
}

/**
 * Upsert one state_finance_summaries row (by (official_id, cycle)) and
 * cascade-replace its donors. Returns the summary id. Adapter callers
 * trust the donor input — caps and ordering are the adapter's job.
 */
export async function upsertStateFinance(
  client: Client,
  key: { official_id: string; cycle: string },
  summary: StateFinanceSummaryPayload,
  donors: IndividualDonorPayload[],
): Promise<string> {
  const upsert = await client.query<{ id: string }>(`
    insert into public.state_finance_summaries (
      official_id, cycle, total_raised, total_disbursed,
      small_donor_pct, in_state_pct, source, source_url
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (official_id, cycle) do update set
      total_raised    = excluded.total_raised,
      total_disbursed = excluded.total_disbursed,
      small_donor_pct = excluded.small_donor_pct,
      in_state_pct    = excluded.in_state_pct,
      source          = excluded.source,
      source_url      = excluded.source_url,
      ingested_at     = now()
    returning id
  `, [
    key.official_id, key.cycle,
    summary.total_raised, summary.total_disbursed,
    summary.small_donor_pct, summary.in_state_pct,
    summary.source, summary.source_url,
  ])
  const summaryId = upsert.rows[0]!.id

  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id = $1',
    [summaryId],
  )
  for (const d of donors) {
    await client.query(`
      insert into public.state_finance_individual_donors (
        state_finance_summary_id, rank, donor_name, amount,
        employer, occupation, city, donor_state
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      summaryId, d.rank, d.donor_name, d.amount,
      d.employer ?? null, d.occupation ?? null,
      d.city ?? null, d.donor_state ?? null,
    ])
  }

  return summaryId
}

/**
 * Resolve a state legislator's officials.id by name + chamber + state,
 * returning null if unmatched. Adapters call this per filing; null
 * results go to stats.officialsUnmatched[].
 */
export async function resolveOfficialByName(
  client: Client,
  opts: { full_name: string; state: FinanceState; chamber: 'state_house' | 'state_senate' | 'state_legislature' },
): Promise<string | null> {
  const res = await client.query<{ id: string }>(
    `select id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  return res.rows[0]?.id ?? null
}
