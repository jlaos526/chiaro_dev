import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import {
  fetchOfficialSponsoredStateBills,
  fetchOfficialCosponsoredStateBills,
  fetchOfficialStateVotes,
  fetchOfficialMissedStateVotes,
  fetchStateBill,
  fetchStateBillVotes,
} from './queries.ts'
import { stateBillsKeys } from './keys.ts'
import type {
  StateBillWithSponsors,
  StateVoteRow,
  StateVoteWithPosition,
} from './types.ts'

const STALE_TIME = 5 * 60 * 1000        // 5 min — matches @chiaro/bills convention
const GC_TIME    = 30 * 60 * 1000       // 30 min

export function useOfficialSponsoredStateBills(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateBillWithSponsors[], Error> {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialSponsored(officialId),
    queryFn: () => fetchOfficialSponsoredStateBills(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialCosponsoredStateBills(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateBillWithSponsors[], Error> {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialCosponsored(officialId),
    queryFn: () => fetchOfficialCosponsoredStateBills(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialStateVotes(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateVoteWithPosition[], Error> {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialVotes(officialId),
    queryFn: () => fetchOfficialStateVotes(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialMissedStateVotes(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateVoteWithPosition[], Error> {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialMissedVotes(officialId),
    queryFn: () => fetchOfficialMissedStateVotes(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useStateBill(
  client: ChiaroClient,
  billId: string,
): UseQueryResult<StateBillWithSponsors, Error> {
  return useQuery({
    queryKey: stateBillsKeys.byId(billId),
    queryFn: () => fetchStateBill(client, billId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useStateBillVotes(
  client: ChiaroClient,
  billId: string,
): UseQueryResult<StateVoteRow[], Error> {
  return useQuery({
    queryKey: ['state-bills', 'votes', billId] as const,
    queryFn: () => fetchStateBillVotes(client, billId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}
