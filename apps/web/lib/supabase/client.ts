import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@chiaro/db'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

export function createSupabaseBrowserClient(): ChiaroClient {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
