import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  // Request origin is the default (audit C50 — the old literal
  // http://localhost:3000 fallback sent production sign-outs to a dead page);
  // NEXT_PUBLIC_SITE_URL remains an explicit override for proxied setups.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? request.url
  return NextResponse.redirect(new URL('/sign-in', base))
}
