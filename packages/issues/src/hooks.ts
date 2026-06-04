import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { issuesKeys } from './keys.ts'
import { fetchCatalog, fetchMySelections, fetchRepAlignment, fetchRepWatchlistFlags } from './queries.ts'
import { saveSelections } from './mutations.ts'
import type { SaveSelectionsPayload } from './schemas.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useIssueCatalog(client: ChiaroClient) {
  return useQuery({
    queryKey: issuesKeys.catalog(),
    queryFn: () => fetchCatalog(client),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}

export function useMySelections(client: ChiaroClient) {
  return useQuery({
    queryKey: issuesKeys.mySelections(),
    queryFn: () => fetchMySelections(client),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}

export function useRepAlignment(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: issuesKeys.repAlignment(officialId),
    queryFn: () => fetchRepAlignment(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}

export function useRepWatchlistFlags(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: issuesKeys.repWatchlistFlags(officialId),
    queryFn: () => fetchRepWatchlistFlags(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}

export function useSaveSelections(client: ChiaroClient) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (selections: SaveSelectionsPayload) => saveSelections(client, selections),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issuesKeys.mySelections() })
    },
  })
}
