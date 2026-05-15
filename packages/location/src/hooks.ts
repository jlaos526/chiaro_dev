import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { locationKeys } from './keys.ts'
import { getMyDistricts, getMyHomePoint } from './queries.ts'

const FIVE_MIN  = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useMyDistricts(client: ChiaroClient) {
  return useQuery({
    queryKey: locationKeys.districts(),
    queryFn: () => getMyDistricts(client),
    staleTime: FIVE_MIN,
    gcTime:    THIRTY_MIN,
  })
}

export function useMyHomePoint(client: ChiaroClient) {
  return useQuery({
    queryKey: locationKeys.homePoint(),
    queryFn: () => getMyHomePoint(client),
    staleTime: FIVE_MIN,
    gcTime:    THIRTY_MIN,
  })
}
