import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@chiaro/db'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function createSupabaseServerClient(): Promise<ChiaroClient> {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
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
    },
  )
}
