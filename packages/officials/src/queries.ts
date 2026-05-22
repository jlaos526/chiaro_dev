import type { ChiaroClient } from '@chiaro/supabase-client'
import type { Database } from '@chiaro/db'
import type {
  OfficialWithDistrict,
  StateFinanceSummaryRow,
  StateFinanceIndividualDonorRow,
  StateScorecardRatingWithOrg,
  StateTownHallRow,
  StateDistrictOfficeRow,
  StateCommitteeHearingRow,
} from './types.ts'

const SELECT_WITH_DISTRICT =
  '*, district:districts!officials_district_id_fkey(id,tier,state,code,name)'

export async function fetchMyOfficials(
  client: ChiaroClient,
): Promise<OfficialWithDistrict[]> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return []

  const { data: districtIds, error: dErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', user.id)
  if (dErr) throw dErr
  if (!districtIds || districtIds.length === 0) return []

  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT)
    .eq('in_office', true)
    .in('district_id', districtIds.map((d) => d.district_id))
    .order('chamber', { ascending: true })
    .order('last_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as OfficialWithDistrict[]
}

export async function fetchOfficial(
  client: ChiaroClient,
  id: string,
): Promise<OfficialWithDistrict> {
  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as OfficialWithDistrict
}

type OfficialMetricsRow              = Database['public']['Tables']['official_metrics']['Row']
type ScorecardOrgRow                 = Database['public']['Tables']['scorecard_orgs']['Row']
type ScorecardRatingRow              = Database['public']['Tables']['scorecard_ratings']['Row']
type FinanceSummaryRow               = Database['public']['Tables']['finance_summaries']['Row']
type FinanceIndustryRow              = Database['public']['Tables']['finance_industry_top']['Row']
type FinancePACRow                   = Database['public']['Tables']['finance_pac_contributions']['Row']
type FinanceIndividualDonorRow      = Database['public']['Tables']['finance_individual_donors']['Row']
type FinanceTopOrganizationRow      = Database['public']['Tables']['finance_top_organizations']['Row']
type DistrictOfficeRow               = Database['public']['Tables']['district_offices']['Row']
type TownHallRow                     = Database['public']['Tables']['town_halls']['Row']
type StockTransactionRow             = Database['public']['Tables']['stock_transactions']['Row']
type LeadershipHistoryRow            = Database['public']['Tables']['officials_leadership_history']['Row']

export async function fetchOfficialMetrics(
  client: ChiaroClient, officialId: string,
): Promise<OfficialMetricsRow | null> {
  const { data, error } = await client.from('official_metrics')
    .select('*').eq('official_id', officialId).maybeSingle()
  if (error) throw error
  return data as OfficialMetricsRow | null
}

export interface ScorecardRatingWithOrg extends ScorecardRatingRow {
  org: ScorecardOrgRow
}

export async function fetchOfficialScorecardRatings(
  client: ChiaroClient, officialId: string,
): Promise<ScorecardRatingWithOrg[]> {
  const { data, error } = await client.from('scorecard_ratings')
    .select('*, org:scorecard_orgs!scorecard_ratings_scorecard_id_fkey(*)')
    .eq('official_id', officialId)
    .order('issue_area', { referencedTable: 'scorecard_orgs', ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ScorecardRatingWithOrg[]
}

export interface OfficialFinance {
  summary:           FinanceSummaryRow
  industries:        FinanceIndustryRow[]
  pacs:              FinancePACRow[]
  individualDonors:  FinanceIndividualDonorRow[]
  topOrgs:           FinanceTopOrganizationRow[]
}

export async function fetchOfficialFinance(
  client: ChiaroClient, officialId: string, cycle: string,
): Promise<OfficialFinance | null> {
  const { data: summary, error } = await client.from('finance_summaries')
    .select('*').eq('official_id', officialId).eq('cycle', cycle).maybeSingle()
  if (error) throw error
  if (!summary) return null
  const summaryRow = summary as FinanceSummaryRow

  const [industriesRes, pacsRes, donorsRes, orgsRes] = await Promise.all([
    client.from('finance_industry_top')
      .select('*').eq('finance_summary_id', summaryRow.id).order('rank', { ascending: true }),
    client.from('finance_pac_contributions')
      .select('*').eq('finance_summary_id', summaryRow.id).order('amount', { ascending: false }),
    client.from('finance_individual_donors')
      .select('*').eq('finance_summary_id', summaryRow.id).order('rank', { ascending: true }),
    client.from('finance_top_organizations')
      .select('*').eq('finance_summary_id', summaryRow.id).order('rank', { ascending: true }),
  ])

  return {
    summary: summaryRow,
    industries: (industriesRes.data ?? []) as FinanceIndustryRow[],
    pacs: (pacsRes.data ?? []) as FinancePACRow[],
    individualDonors: (donorsRes.data ?? []) as FinanceIndividualDonorRow[],
    topOrgs: (orgsRes.data ?? []) as FinanceTopOrganizationRow[],
  }
}

/**
 * Returns the most-recent (by ingested_at) state_finance_summaries row for
 * an official, or null when none exists. Federal officials never have rows
 * here, so a null return is normal for federal_house / federal_senate.
 */
export async function fetchOfficialStateFinanceSummary(
  client: ChiaroClient,
  officialId: string,
): Promise<StateFinanceSummaryRow | null> {
  const { data, error } = await client
    .from('state_finance_summaries')
    .select('*')
    .eq('official_id', officialId)
    .order('ingested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Returns up to 10 top individual donors for the official's most-recent
 * cycle, ranked ascending (rank 1 first). Returns [] when no finance
 * summary exists or the summary has no donor rows.
 */
export async function fetchOfficialStateDonors(
  client: ChiaroClient,
  officialId: string,
): Promise<StateFinanceIndividualDonorRow[]> {
  const summary = await fetchOfficialStateFinanceSummary(client, officialId)
  if (!summary) return []
  const { data, error } = await client
    .from('state_finance_individual_donors')
    .select('*')
    .eq('state_finance_summary_id', summary.id)
    .order('rank', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Returns the legislator's state scorecard ratings, one per org. For each
 * (org, official) tuple, keeps the row with the most recent ingested_at
 * when multiple sessions exist (matches the latest-by-ingested pattern
 * used by fetchOfficialStateFinanceSummary in slice 5E). Empty array when
 * no ratings exist.
 */
export async function fetchOfficialStateScorecardRatings(
  client: ChiaroClient,
  officialId: string,
): Promise<StateScorecardRatingWithOrg[]> {
  const { data, error } = await client
    .from('state_scorecard_ratings')
    .select('*, org:state_scorecard_orgs!state_scorecard_ratings_scorecard_id_fkey(*)')
    .eq('official_id', officialId)
    .order('ingested_at', { ascending: false })
  if (error) throw error
  // De-dupe to one rating per scorecard_id, keeping the latest by ingested_at.
  const seen = new Set<string>()
  const out: StateScorecardRatingWithOrg[] = []
  for (const row of (data ?? []) as unknown as StateScorecardRatingWithOrg[]) {
    if (seen.has(row.scorecard_id)) continue
    seen.add(row.scorecard_id)
    out.push(row)
  }
  return out
}

export async function fetchOfficialDistrictOffices(
  client: ChiaroClient, officialId: string,
): Promise<DistrictOfficeRow[]> {
  const { data, error } = await client.from('district_offices')
    .select('*').eq('official_id', officialId).order('city', { ascending: true })
  if (error) throw error
  return (data ?? []) as DistrictOfficeRow[]
}

export async function fetchOfficialTownHalls(
  client: ChiaroClient, officialId: string, congress: string,
): Promise<TownHallRow[]> {
  // Filter to current congress window. Congress dates: 119th = 2025-01-03 → 2027-01-03.
  // Approximate; refined in slice 6's per-congress drill-down.
  const congressStart = congress === '119' ? '2025-01-03' : '2023-01-03'
  const { data, error } = await client.from('town_halls')
    .select('*').eq('official_id', officialId)
    .gte('event_date', congressStart)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as TownHallRow[]
}

export async function fetchOfficialStockTransactions(
  client: ChiaroClient, officialId: string,
): Promise<StockTransactionRow[]> {
  const { data, error } = await client.from('stock_transactions')
    .select('*').eq('official_id', officialId)
    .order('transaction_date', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as StockTransactionRow[]
}

export async function fetchOfficialLeadershipHistory(
  client: ChiaroClient, officialId: string,
): Promise<LeadershipHistoryRow[]> {
  const { data, error } = await client.from('officials_leadership_history')
    .select('*').eq('official_id', officialId)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as LeadershipHistoryRow[]
}

/**
 * Past 12 months + upcoming, ordered by event_date desc.
 * 12-month window is fixed in v1; operator-tunable via env later.
 */
export async function fetchOfficialStateTownHalls(
  client: ChiaroClient,
  officialId: string,
): Promise<StateTownHallRow[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

  const { data, error } = await client
    .from('state_town_halls')
    .select('*')
    .eq('official_id', officialId)
    .gte('event_date', cutoff)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateTownHallRow[]
}

/**
 * Custom priority order: district -> satellite -> capitol.
 * Postgres text-asc would put capitol first (alphabetical), so use
 * a JS-side sort instead.
 */
export async function fetchOfficialStateDistrictOffices(
  client: ChiaroClient,
  officialId: string,
): Promise<StateDistrictOfficeRow[]> {
  const { data, error } = await client
    .from('state_district_offices')
    .select('*')
    .eq('official_id', officialId)
  if (error) throw error
  const priority: Record<string, number> = { district: 0, satellite: 1, capitol: 2 }
  return ((data ?? []) as StateDistrictOfficeRow[]).sort((a, b) => {
    return (priority[a.kind] ?? 99) - (priority[b.kind] ?? 99)
  })
}

/**
 * Two-step fetcher (PostgREST cannot filter on joined columns per slice 5G):
 * 1. Find hearing_ids from state_committee_hearing_attendance where official_id matches
 * 2. Optionally infer most-recent session from those hearings
 * 3. Fetch hearings with .in('id', hearingIds) + session filter
 */
export async function fetchOfficialStateCommitteeHearings(
  client: ChiaroClient,
  officialId: string,
  session?: string,
): Promise<StateCommitteeHearingRow[]> {
  const attRows = await client
    .from('state_committee_hearing_attendance')
    .select('hearing_id')
    .eq('official_id', officialId)
  if (attRows.error) throw attRows.error
  const hearingIds = Array.from(new Set((attRows.data ?? []).map(r => r.hearing_id)))
  if (hearingIds.length === 0) return []

  let effectiveSession = session
  if (!effectiveSession) {
    const recent = await client
      .from('state_committee_hearings')
      .select('session')
      .in('id', hearingIds)
      .order('hearing_date', { ascending: false })
      .limit(1)
    if (recent.error) throw recent.error
    effectiveSession = recent.data?.[0]?.session
    if (!effectiveSession) return []
  }

  const { data, error } = await client
    .from('state_committee_hearings')
    .select('*')
    .in('id', hearingIds)
    .eq('session', effectiveSession)
    .order('hearing_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateCommitteeHearingRow[]
}
