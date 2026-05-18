import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { billsKeys, votesKeys } from './keys.ts'
import {
  fetchBills, fetchBill, fetchBillVotes,
  fetchOfficialSponsoredBills, fetchOfficialCosponsoredBills,
  fetchOfficialMissedVotes, fetchOfficialVotesOnSubject,
  type BillsFilter,
} from './queries.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useBills(client: ChiaroClient, filter: BillsFilter) {
  return useQuery({
    queryKey: billsKeys.list(filter),
    queryFn: () => fetchBills(client, filter),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
  })
}

export function useBill(client: ChiaroClient, id: string) {
  return useQuery({
    queryKey: billsKeys.detail(id),
    queryFn: () => fetchBill(client, id),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!id,
  })
}

export function useBillVotes(client: ChiaroClient, billId: string) {
  return useQuery({
    queryKey: votesKeys.byBill(billId),
    queryFn: () => fetchBillVotes(client, billId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!billId,
  })
}

export function useOfficialSponsoredBills(
  client: ChiaroClient, officialId: string, congress: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: billsKeys.officialSponsored(officialId, congress),
    queryFn: () => fetchOfficialSponsoredBills(client, officialId, congress),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialCosponsoredBills(
  client: ChiaroClient, officialId: string, congress: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: billsKeys.officialCosponsored(officialId, congress),
    queryFn: () => fetchOfficialCosponsoredBills(client, officialId, congress),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialMissedVotes(
  client: ChiaroClient, officialId: string, congress: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: votesKeys.officialMissed(officialId, congress),
    queryFn: () => fetchOfficialMissedVotes(client, officialId, congress),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialVotesOnSubject(
  client: ChiaroClient, officialId: string, subject: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: votesKeys.officialOnSubject(officialId, subject),
    queryFn: () => fetchOfficialVotesOnSubject(client, officialId, subject),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId && !!subject,
  })
}
