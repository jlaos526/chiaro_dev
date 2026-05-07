import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY
  ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export type TestClient = SupabaseClient<Database>

export function makeAnonClient(): TestClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) as TestClient
}

export async function makeAuthedUser(suffix = ''): Promise<{ client: TestClient; userId: string; email: string }> {
  const email = `loc-test-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const client = makeAnonClient()
  const { data, error } = await client.auth.signUp({ email, password: 'testpassword123' })
  if (error || !data.user) throw error ?? new Error('signUp returned null user')
  return { client, userId: data.user.id, email }
}
