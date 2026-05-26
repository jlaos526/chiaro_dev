import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { officialsKeys } from './keys.ts'
import {
  fetchMyOfficials, fetchOfficial,
  fetchOfficialMetrics, fetchOfficialScorecardRatings,
  fetchOfficialFinance, fetchOfficialDistrictOffices,
  fetchOfficialTownHalls, fetchOfficialStockTransactions,
  fetchOfficialLeadershipHistory,
  fetchOfficialStateFinanceSummary, fetchOfficialStateDonors,
  fetchOfficialStateScorecardRatings,
  fetchOfficialStateTownHalls, fetchOfficialStateDistrictOffices,
  fetchOfficialStateCommitteeHearings,
  fetchOfficialStateFinancialDisclosures,
  fetchOfficialStateEthicsComplaints,
  fetchOfficialStateOfficialEvents,
  fetchOfficialHoldings,
  fetchOfficialDisclosureOther,
} from './queries.ts'
import type {
  StateFinanceSummaryRow,
  StateFinanceIndividualDonorRow,
  StateScorecardRatingWithOrg,
  StateTownHallRow,
  StateDistrictOfficeRow,
  StateCommitteeHearingRow,
  StateFinancialDisclosureRow,
  StateEthicsComplaintRow,
  StateOfficialEventRow,
} from './types.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useMyOfficials(client: ChiaroClient) {
  return useQuery({
    queryKey: officialsKeys.myList(),
    queryFn: () => fetchMyOfficials(client),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}

export function useOfficial(client: ChiaroClient, id: string) {
  return useQuery({
    queryKey: officialsKeys.detail(id),
    queryFn: () => fetchOfficial(client, id),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!id,
  })
}

export function useOfficialMetrics(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: officialsKeys.metrics(officialId),
    queryFn: () => fetchOfficialMetrics(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialScorecardRatings(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: officialsKeys.scorecards(officialId),
    queryFn: () => fetchOfficialScorecardRatings(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialFinance(client: ChiaroClient, officialId: string, cycle: string) {
  return useQuery({
    queryKey: officialsKeys.finance(officialId, cycle),
    queryFn: () => fetchOfficialFinance(client, officialId, cycle),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId && !!cycle,
  })
}

export function useOfficialDistrictOffices(
  client: ChiaroClient, officialId: string, opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: officialsKeys.districtOffices(officialId),
    queryFn: () => fetchOfficialDistrictOffices(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialTownHalls(
  client: ChiaroClient, officialId: string, congress: string, opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: officialsKeys.townHalls(officialId, congress),
    queryFn: () => fetchOfficialTownHalls(client, officialId, congress),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialStockTransactions(
  client: ChiaroClient, officialId: string, opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: officialsKeys.stockTransactions(officialId),
    queryFn: () => fetchOfficialStockTransactions(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialHoldings(
  client: ChiaroClient, officialId: string, opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: officialsKeys.holdings(officialId),
    queryFn: () => fetchOfficialHoldings(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialDisclosureOther(
  client: ChiaroClient, officialId: string, opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: officialsKeys.disclosureOther(officialId),
    queryFn: () => fetchOfficialDisclosureOther(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialLeadershipHistory(
  client: ChiaroClient, officialId: string, opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: officialsKeys.leadershipHistory(officialId),
    queryFn: () => fetchOfficialLeadershipHistory(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

// Explicit UseQueryResult<T, Error> annotations dodge TS2742 — cross-workspace
// Database-derived row types from @chiaro/db can't be named from inference
// alone. Same workaround as @chiaro/state-bills hooks (slice 5D).
export function useOfficialStateFinanceSummary(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateFinanceSummaryRow | null, Error> {
  return useQuery({
    queryKey: officialsKeys.stateFinanceSummary(officialId),
    queryFn: () => fetchOfficialStateFinanceSummary(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateDonors(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateFinanceIndividualDonorRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateDonors(officialId),
    queryFn: () => fetchOfficialStateDonors(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateScorecardRatings(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateScorecardRatingWithOrg[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateScorecardRatings(officialId),
    queryFn: () => fetchOfficialStateScorecardRatings(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateTownHalls(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateTownHallRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateTownHalls(officialId),
    queryFn: () => fetchOfficialStateTownHalls(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateDistrictOffices(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateDistrictOfficeRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateDistrictOffices(officialId),
    queryFn: () => fetchOfficialStateDistrictOffices(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateCommitteeHearings(
  client: ChiaroClient,
  officialId: string,
  session?: string,
): UseQueryResult<StateCommitteeHearingRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateCommitteeHearings(officialId, session),
    queryFn: () => fetchOfficialStateCommitteeHearings(client, officialId, session),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateFinancialDisclosures(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateFinancialDisclosureRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateFinancialDisclosures(officialId),
    queryFn: () => fetchOfficialStateFinancialDisclosures(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateEthicsComplaints(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateEthicsComplaintRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateEthicsComplaints(officialId),
    queryFn: () => fetchOfficialStateEthicsComplaints(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateOfficialEvents(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateOfficialEventRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateOfficialEvents(officialId),
    queryFn: () => fetchOfficialStateOfficialEvents(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}
