import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@chiaro/db'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

export function createSupabaseBrowserClient(): ChiaroClient {
  // See server.ts for the cast rationale: ssr@0.5.2's d.ts is compiled
  // against older supabase-js generics; runtime shape is identical.
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY) as unknown as ChiaroClient
}
