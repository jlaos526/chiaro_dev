import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from '@chiaro/db'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Per-request-deduped server client + authenticated user (slice 74, audit
 * C3b). React cache() scopes the memo to one RSC render pass, so a layout
 * and its page share ONE GoTrue round-trip instead of each paying their own.
 * The middleware's getUser is separate by design (it owns cookie rotation).
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
})

export async function createSupabaseServerClient(): Promise<ChiaroClient> {
  const cookieStore = await cookies()
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // setAll called from a Server Component; safe to ignore — middleware refreshes
        }
      },
    },
  })
}
