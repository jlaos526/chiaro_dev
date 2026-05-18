import type { ChiaroClient } from '@chiaro/supabase-client'
import type { Database } from '@chiaro/db'
import type { OfficialWithDistrict } from './types.ts'

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
