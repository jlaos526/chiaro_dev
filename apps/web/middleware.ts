import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@chiaro/db'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const ALLOW_LIST = [
  '/calibrate',
  '/sign-out',
  '/profile/edit',
  '/settings',
  '/settings/address',
  '/issues',
  '/legal',
]

export function isAllowlisted(path: string): boolean {
  return ALLOW_LIST.some((p) => path === p || path.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Refresh session — must be called for cookie rotation to happen
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const path = request.nextUrl.pathname

    if (!isAllowlisted(path)) {
      const skip = request.cookies.get('chiaro_skip_calibrate')?.value === '1'
      // Positive-cache cookie (slice 74, audit C3/C49): before this, only the
      // NEGATIVE path was cached — a calibrated user paid the DB probe on
      // every matched request forever, including RSC navigations + prefetches.
      const calibrated = request.cookies.get('chiaro_calibrated')?.value === '1'
      if (!skip && !calibrated) {
        // Cheapest possible existence probe — head select with exact count
        const { count } = await supabase
          .from('user_locations')
          .select('id', { head: true, count: 'exact' })
          .eq('id', user.id)
        if ((count ?? 0) === 0) {
          const url = request.nextUrl.clone()
          url.pathname = '/calibrate'
          return NextResponse.redirect(url)
        }
        // 1h TTL cache; cleared on sign-out. Recalibration keeps it truthful
        // (still calibrated) and no flow un-calibrates a user.
        response.cookies.set('chiaro_calibrated', '1', {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 3600,
        })
      }
    }
  }

  return response
}

export const config = {
  // `monitoring` = the Sentry tunnelRoute (next.config.mjs, audit C51):
  // beacons are fire-and-forget POSTs — running auth (a getUser network
  // round-trip) on them is waste, and an authenticated-but-uncalibrated
  // user's error beacons would 307 to /calibrate and be dropped.
  // robots/sitemap/manifest/fonts (slice 74, audit C49 adjunct): crawler +
  // asset requests were running the full auth middleware.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|monitoring|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf)$).*)',
  ],
}
