import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY
  ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export type TestClient = SupabaseClient<Database>

export function makeAnonClient(): TestClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) as TestClient
}

export function makeAdminClient(): TestClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY not set — required for admin operations in integration tests. ' +
      'Pull it from `supabase status` (Secret key) and add to .env.local.'
    )
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as TestClient
}

export async function makeAuthedUser(suffix = ''): Promise<{ client: TestClient; userId: string; email: string }> {
  const email = `loc-test-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const client = makeAnonClient()
  const { data, error } = await client.auth.signUp({ email, password: 'testpassword123' })
  if (error || !data.user) throw error ?? new Error('signUp returned null user')
  return { client, userId: data.user.id, email }
}
