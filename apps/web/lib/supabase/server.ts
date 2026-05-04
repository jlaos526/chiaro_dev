import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@chiaro/db'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function createSupabaseServerClient(): Promise<ChiaroClient> {
  const cookieStore = await cookies()
  // @supabase/ssr@0.5.2's createServerClient was compiled against an older
  // @supabase/supabase-js whose SupabaseClient took 3 generics; our resolved
  // supabase-js@2.105.3 takes 5. The runtime shape is identical — this cast
  // bridges the .d.ts mismatch. Remove when ssr is recompiled against >=2.105.
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
  ) as unknown as ChiaroClient
}
