import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { billsKeys, votesKeys } from './keys.ts'
import {
  fetchOfficialSponsoredBills,
  fetchOfficialCosponsoredBills,
  fetchOfficialMissedVotes,
  fetchOfficialSponsoredBillsCount,
  fetchOfficialCosponsoredBillsCount,
  fetchOfficialMissedVotesCount,
} from './queries.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useOfficialSponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: billsKeys.officialSponsored(officialId, congress),
    queryFn: () => fetchOfficialSponsoredBills(client, officialId, congress),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialCosponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: billsKeys.officialCosponsored(officialId, congress),
    queryFn: () => fetchOfficialCosponsoredBills(client, officialId, congress),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

export function useOfficialMissedVotes(
  client: ChiaroClient,
  officialId: string,
  congress: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: votesKeys.officialMissed(officialId, congress),
    queryFn: () => fetchOfficialMissedVotes(client, officialId, congress),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: opts?.enabled !== false && !!officialId,
  })
}

// Slice 75 (audit C12): head-only counts for collapsed subsection labels.
export function useOfficialSponsoredBillsCount(
  client: ChiaroClient,
  officialId: string,
  congress: string,
) {
  return useQuery({
    queryKey: billsKeys.officialSponsoredCount(officialId, congress),
    queryFn: () => fetchOfficialSponsoredBillsCount(client, officialId, congress),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialCosponsoredBillsCount(
  client: ChiaroClient,
  officialId: string,
  congress: string,
) {
  return useQuery({
    queryKey: billsKeys.officialCosponsoredCount(officialId, congress),
    queryFn: () => fetchOfficialCosponsoredBillsCount(client, officialId, congress),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialMissedVotesCount(
  client: ChiaroClient,
  officialId: string,
  congress: string,
) {
  return useQuery({
    queryKey: votesKeys.officialMissedCount(officialId, congress),
    queryFn: () => fetchOfficialMissedVotesCount(client, officialId, congress),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}
