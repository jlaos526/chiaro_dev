import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { billsKeys, votesKeys } from './keys.ts'
import {
  fetchOfficialSponsoredBills,
  fetchOfficialCosponsoredBills,
  fetchOfficialMissedVotes,
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
