import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { profileKeys } from './keys.ts'
import { getMyProfile } from './queries.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useMyProfile(client: ChiaroClient) {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => getMyProfile(client),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  })
}
