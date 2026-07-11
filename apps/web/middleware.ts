import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@chiaro/db'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const ALLOW_LIST = ['/calibrate', '/sign-out', '/profile/edit', '/settings', '/settings/address', '/issues', '/legal']

export function isAllowlisted(path: string): boolean {
  return ALLOW_LIST.some(p => path === p || path.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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
    },
  )

  // Refresh session — must be called for cookie rotation to happen
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const path = request.nextUrl.pathname

    if (!isAllowlisted(path)) {
      const skip = request.cookies.get('chiaro_skip_calibrate')?.value === '1'
      if (!skip) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
