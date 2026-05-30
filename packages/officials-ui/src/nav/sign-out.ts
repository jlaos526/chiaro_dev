'use client'

import type { ChiaroClient } from '@chiaro/supabase-client'

export interface SignOutRouter {
  push: (path: string) => void
  refresh: () => void
}

/**
 * Single sign-out implementation consumed by both the nav rail and the
 * settings page Sign Out row. Clears the skip-calibrate cookie, ends the
 * Supabase session, then routes to /sign-in.
 */
export async function signOut(router: SignOutRouter, client: ChiaroClient): Promise<void> {
  document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  await client.auth.signOut()
  router.push('/sign-in')
  router.refresh()
}
