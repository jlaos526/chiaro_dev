const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy apps/mobile/.env.example to apps/mobile/.env.local and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see `pnpm db:start` then `supabase status`).',
  )
}

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey
