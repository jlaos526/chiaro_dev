import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'

export type ChiaroClient = SupabaseClient<Database>

export interface CreateChiaroClientOptions {
  url: string
  anonKey: string
  storage?: SupportedStorage
  detectSessionInUrl?: boolean
}

export function createChiaroClient(opts: CreateChiaroClientOptions): ChiaroClient {
  return createClient<Database>(opts.url, opts.anonKey, {
    auth: {
      storage: opts.storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: opts.detectSessionInUrl ?? false,
    },
  })
}
