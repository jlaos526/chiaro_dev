import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { officialsKeys } from './keys.ts'
import { fetchMyOfficials, fetchOfficial } from './queries.ts'

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
