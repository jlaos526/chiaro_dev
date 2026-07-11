import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { profileKeys } from './keys.ts'
import { getMyProfile } from './queries.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useMyProfile(client: ChiaroClient, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => getMyProfile(client),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    // Slice 74: callers that render for signed-out visitors (BrandNavRailMount)
    // gate the fetch — getMyProfile throws 'Not signed in' without a session.
    enabled: opts?.enabled ?? true,
  })
}
