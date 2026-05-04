const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy apps/web/.env.example to apps/web/.env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see `pnpm db:start` then `supabase status`).',
  )
}

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey
