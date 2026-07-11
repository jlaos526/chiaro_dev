import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  // Request origin is the default (audit C50 — the old literal
  // http://localhost:3000 fallback sent production sign-outs to a dead page);
  // NEXT_PUBLIC_SITE_URL remains an explicit override for proxied setups.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? request.url
  const response = NextResponse.redirect(new URL('/sign-in', base))
  // Slice 74: the middleware's calibration positive-cache is per-user — clear
  // it so the next account on this browser re-probes.
  response.cookies.delete('chiaro_calibrated')
  return response
}
