import { resolveUserId, type ChiaroClient } from '@chiaro/supabase-client'
import type { Database } from '@chiaro/db'
import type {
  OfficialWithCardData,
  OfficialWithDistrict,
  StateFinanceSummaryRow,
  StateFinanceIndividualDonorRow,
  StateScorecardRatingWithOrg,
  StateTownHallRow,
  StateDistrictOfficeRow,
  StateCommitteeHearingRow,
  StateFinancialDisclosureRow,
  StateEthicsComplaintRow,
  StateOfficialEventRow,
  FederalHolding,
  FederalDisclosureOther,
} from './types.ts'

const SELECT_WITH_DISTRICT =
  '*, district:districts!officials_district_id_fkey(id,tier,state,code,name)'

// Slice 79 (audit C22): the home card's per-row data (role/tenure metrics +
// alignment-chip ratings) rides as embeds so OfficialsCard rows don't fire 2
// hooks each. The org hint mirrors fetchOfficialScorecardRatings.
const SELECT_WITH_DISTRICT_AND_CARD_DATA =
  `${SELECT_WITH_DISTRICT}, metrics:official_metrics(salary_role,tenure_years), ` +
  'ratings:scorecard_ratings(*, org:scorecard_orgs!scorecard_ratings_scorecard_id_fkey(issue_area,scoring_max))'

export async function fetchMyOfficials(
  client: ChiaroClient,
  userId?: string,
): Promise<OfficialWithCardData[]> {
  const uid = await resolveUserId(client, userId)
  if (!uid) return []

  const { data: districtIds, error: dErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', uid)
  if (dErr) throw dErr
  if (!districtIds || districtIds.length === 0) return []

  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT_AND_CARD_DATA)
    .eq('in_office', true)
    .in(
      'district_id',
      districtIds.map((d) => d.district_id),
    )
    .order('chamber', { ascending: true })
    .order('last_name', { ascending: true })
    // Slice 78 (audit C26): .returns<T>() instead of `as unknown as T` — the
    // builder chain stays type-checked up to the embed override.
    .returns<OfficialWithCardData[]>()
  if (error) throw error
  return data ?? []
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
    .returns<OfficialWithDistrict>()
  if (error) throw error
  return data
}

type OfficialMetricsRow = Database['public']['Tables']['official_metrics']['Row']
type ScorecardOrgRow = Database['public']['Tables']['scorecard_orgs']['Row']
type ScorecardRatingRow = Database['public']['Tables']['scorecard_ratings']['Row']
type FinanceSummaryRow = Database['public']['Tables']['finance_summaries']['Row']
type FinanceIndustryRow = Database['public']['Tables']['finance_industry_top']['Row']
type FinancePACRow = Database['public']['Tables']['finance_pac_contributions']['Row']
type FinanceIndividualDonorRow = Database['public']['Tables']['finance_individual_donors']['Row']
type FinanceTopOrganizationRow = Database['public']['Tables']['finance_top_organizations']['Row']
type DistrictOfficeRow = Database['public']['Tables']['district_offices']['Row']
type TownHallRow = Database['public']['Tables']['town_halls']['Row']
type StockTransactionRow = Database['public']['Tables']['stock_transactions']['Row']
type LeadershipHistoryRow = Database['public']['Tables']['officials_leadership_history']['Row']

export async function fetchOfficialMetrics(
  client: ChiaroClient,
  officialId: string,
): Promise<OfficialMetricsRow | null> {
  const { data, error } = await client
    .from('official_metrics')
    .select('*')
    .eq('official_id', officialId)
    .maybeSingle()
  if (error) throw error
  return data as OfficialMetricsRow | null
}

export interface ScorecardRatingWithOrg extends ScorecardRatingRow {
  org: ScorecardOrgRow
}

export async function fetchOfficialScorecardRatings(
  client: ChiaroClient,
  officialId: string,
): Promise<ScorecardRatingWithOrg[]> {
  const { data, error } = await client
    .from('scorecard_ratings')
    .select('*, org:scorecard_orgs!scorecard_ratings_scorecard_id_fkey(*)')
    .eq('official_id', officialId)
    .order('issue_area', { referencedTable: 'scorecard_orgs', ascending: true })
    .returns<ScorecardRatingWithOrg[]>()
  if (error) throw error
  return data ?? []
}

export interface OfficialFinance {
  summary: FinanceSummaryRow
  industries: FinanceIndustryRow[]
  pacs: FinancePACRow[]
  individualDonors: FinanceIndividualDonorRow[]
  topOrgs: FinanceTopOrganizationRow[]
}

type FinanceSummaryJoinRow = FinanceSummaryRow & {
  industries: FinanceIndustryRow[]
  pacs: FinancePACRow[]
  individualDonors: FinanceIndividualDonorRow[]
  topOrgs: FinanceTopOrganizationRow[]
}

export async function fetchOfficialFinance(
  client: ChiaroClient,
  officialId: string,
  cycle: string,
): Promise<OfficialFinance | null> {
  // Slice 79 (audit C18): one request — the 4 child tables ride as embeds on
  // the summary row (was a summary fetch + a 4-query Promise.all keyed on its
  // id). Per-embed ordering uses the alias as referencedTable; proven against
  // real PostgREST in queries.integration.test.ts.
  const { data, error } = await client
    .from('finance_summaries')
    .select(
      '*, industries:finance_industry_top(*), pacs:finance_pac_contributions(*), individualDonors:finance_individual_donors(*), topOrgs:finance_top_organizations(*)',
    )
    .eq('official_id', officialId)
    .eq('cycle', cycle)
    .order('rank', { referencedTable: 'industries', ascending: true })
    .order('amount', { referencedTable: 'pacs', ascending: false })
    .order('rank', { referencedTable: 'individualDonors', ascending: true })
    .order('rank', { referencedTable: 'topOrgs', ascending: true })
    .maybeSingle()
    .returns<FinanceSummaryJoinRow | null>()
  if (error) throw error
  if (!data) return null
  const { industries, pacs, individualDonors, topOrgs, ...summary } = data
  return {
    summary: summary as FinanceSummaryRow,
    industries: industries ?? [],
    pacs: pacs ?? [],
    individualDonors: individualDonors ?? [],
    topOrgs: topOrgs ?? [],
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
  // Slice 79 (audit C18): one request — donors ride as an embed on the
  // most-recent summary row (was a summary fetch + a second query keyed on
  // its id). Rank-ordered via the alias referencedTable.
  const { data, error } = await client
    .from('state_finance_summaries')
    .select('id, donors:state_finance_individual_donors(*)')
    .eq('official_id', officialId)
    .order('ingested_at', { ascending: false })
    .order('rank', { referencedTable: 'donors', ascending: true })
    .limit(1)
    .maybeSingle()
    .returns<{ id: string; donors: StateFinanceIndividualDonorRow[] } | null>()
  if (error) throw error
  return data?.donors ?? []
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
    // Slice 75 (audit C20): interim cap — the fetch pulls ALL sessions' rows
    // and dedupes latest-per-org in JS, growing every session. 50 covers ~10
    // sessions of the ≤5-org catalog; server-side distinct-on is the eventual
    // fix if history browsing becomes a feature.
    .limit(50)
    .returns<StateScorecardRatingWithOrg[]>()
  if (error) throw error
  // De-dupe to one rating per scorecard_id, keeping the latest by ingested_at.
  const seen = new Set<string>()
  const out: StateScorecardRatingWithOrg[] = []
  for (const row of data ?? []) {
    if (seen.has(row.scorecard_id)) continue
    seen.add(row.scorecard_id)
    out.push(row)
  }
  return out
}

export async function fetchOfficialDistrictOffices(
  client: ChiaroClient,
  officialId: string,
): Promise<DistrictOfficeRow[]> {
  const { data, error } = await client
    .from('district_offices')
    .select('*')
    .eq('official_id', officialId)
    .order('city', { ascending: true })
  if (error) throw error
  return (data ?? []) as DistrictOfficeRow[]
}

export async function fetchOfficialTownHalls(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<TownHallRow[]> {
  // Filter to current congress window. Congress dates: 119th = 2025-01-03 → 2027-01-03.
  // Approximate; refined in slice 6's per-congress drill-down.
  const congressStart = congress === '119' ? '2025-01-03' : '2023-01-03'
  const { data, error } = await client
    .from('town_halls')
    .select('*')
    .eq('official_id', officialId)
    .gte('event_date', congressStart)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as TownHallRow[]
}

export async function fetchOfficialStockTransactions(
  client: ChiaroClient,
  officialId: string,
): Promise<StockTransactionRow[]> {
  const { data, error } = await client
    .from('stock_transactions')
    .select('*')
    .eq('official_id', officialId)
    .order('transaction_date', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as StockTransactionRow[]
}

export async function fetchOfficialLeadershipHistory(
  client: ChiaroClient,
  officialId: string,
): Promise<LeadershipHistoryRow[]> {
  const { data, error } = await client
    .from('officials_leadership_history')
    .select('*')
    .eq('official_id', officialId)
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
 * Slice 79 (audit C18): one request anchored on hearings — the filtered
 * `!inner` attendance embed constrains parents server-side (the old 3-step
 * "PostgREST cannot filter on joined columns" comment predates `!inner`).
 * When no session is passed, rows arrive date-desc so the first row's
 * session is the most recent; the latest-session filter happens client-side
 * on the already-fetched rows (still one request).
 */
export async function fetchOfficialStateCommitteeHearings(
  client: ChiaroClient,
  officialId: string,
  session?: string,
): Promise<StateCommitteeHearingRow[]> {
  let query = client
    .from('state_committee_hearings')
    .select('*, attendance:state_committee_hearing_attendance!inner(official_id)')
    .eq('attendance.official_id', officialId)
  if (session) query = query.eq('session', session)
  const { data, error } = await query
    .order('hearing_date', { ascending: false })
    // Cap per the slice-75 C20 convention: date-desc means the latest session
    // (all we keep in the no-session path) is always inside the window.
    .limit(200)
    .returns<Array<StateCommitteeHearingRow & { attendance: unknown }>>()
  if (error) throw error
  const rows = (data ?? []).map(({ attendance: _attendance, ...hearing }) => {
    return hearing as StateCommitteeHearingRow
  })
  if (session) return rows
  const latestSession = rows[0]?.session
  if (!latestSession) return []
  return rows.filter((r) => r.session === latestSession)
}

export async function fetchOfficialStateFinancialDisclosures(
  client: ChiaroClient,
  officialId: string,
): Promise<StateFinancialDisclosureRow[]> {
  const { data, error } = await client
    .from('state_financial_disclosures')
    .select('*')
    .eq('official_id', officialId)
    .order('filing_year', { ascending: false })
    .order('ingested_at', { ascending: false })
    // Slice 75 (audit C20): NY FDS writes 1 placeholder + N line items per
    // filing per year (slice 20) — intended growth, cap above show-more depth.
    .limit(300)
  if (error) throw error
  return (data ?? []) as StateFinancialDisclosureRow[]
}

export async function fetchOfficialStateEthicsComplaints(
  client: ChiaroClient,
  officialId: string,
): Promise<StateEthicsComplaintRow[]> {
  const { data, error } = await client
    .from('state_ethics_complaints')
    .select('*')
    .eq('official_id', officialId)
    .order('complaint_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateEthicsComplaintRow[]
}

export async function fetchOfficialStateOfficialEvents(
  client: ChiaroClient,
  officialId: string,
): Promise<StateOfficialEventRow[]> {
  const { data, error } = await client
    .from('state_official_events')
    .select('*')
    .eq('official_id', officialId)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateOfficialEventRow[]
}

export async function fetchOfficialHoldings(
  client: ChiaroClient,
  officialId: string,
): Promise<FederalHolding[]> {
  const { data, error } = await client
    .from('federal_holdings')
    .select('*')
    .eq('official_id', officialId)
    .order('filing_year', { ascending: false })
    .order('value_max', { ascending: false, nullsFirst: false })
    // Slice 75 (audit C20): FDs accumulate per filing_year (wealthy members
    // file hundreds of holdings/year — slice 26 ingests every line item);
    // 300 is sized well above the show-more depth. Stock precedent: limit(100).
    .limit(300)
  if (error) throw error
  return data ?? []
}

export async function fetchOfficialDisclosureOther(
  client: ChiaroClient,
  officialId: string,
): Promise<FederalDisclosureOther[]> {
  const { data, error } = await client
    .from('federal_disclosure_other')
    .select('*')
    .eq('official_id', officialId)
    .order('filing_year', { ascending: false })
    .order('category', { ascending: true })
    .limit(300) // slice 75 (audit C20) — see fetchOfficialHoldings
  if (error) throw error
  return data ?? []
}
