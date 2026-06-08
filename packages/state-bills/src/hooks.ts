import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import {
  fetchOfficialSponsoredStateBills,
  fetchOfficialCosponsoredStateBills,
  fetchOfficialStateVotes,
  fetchOfficialMissedStateVotes,
  fetchOfficialStateVotesOnSubject,
} from './queries.ts'
import { stateBillsKeys } from './keys.ts'
import type {
  StateBillWithSponsors,
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

export function useOfficialStateVotesOnSubject(
  client: ChiaroClient,
  officialId: string,
  subjects: string[],
  opts: { enabled?: boolean } = {},
): UseQueryResult<StateVoteWithPosition[], Error> {
  return useQuery({
    queryKey: stateBillsKeys.officialStateVotesOnSubject(officialId, subjects),
    queryFn: () => fetchOfficialStateVotesOnSubject(client, officialId, subjects),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: opts.enabled !== false && !!officialId && subjects.length > 0,
  })
}
