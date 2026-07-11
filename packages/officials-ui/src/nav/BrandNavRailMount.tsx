'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMyProfile } from '@chiaro/profile'
import { useChiaroClient } from '../client-context.tsx'
import { useBreakpoint } from './useBreakpoint.ts'
import { BrandNavRail, type RailUser } from './BrandNavRail.tsx'
import { signOut } from './sign-out.ts'

const EXCLUDED_PREFIXES = ['/sign-in', '/sign-up', '/calibrate']

function deriveInitial(p: { display_name: string | null; username: string | null } | null): string {
  const source = p?.display_name ?? p?.username
  if (!source || source.length === 0) return '?'
  return source[0]!.toUpperCase()
}

export interface BrandNavRailMountProps {
  /**
   * Server-derived auth hint (slice 74, audit C5): the web root layout reads
   * the Supabase auth cookie's PRESENCE and passes it down so the rail (and
   * its 200px CSS var) render on first paint instead of after a client
   * getUser round-trip — the old flow was a visible layout shift on every
   * authenticated desktop hard load. The hint is optimistic (an expired
   * cookie renders the rail briefly); the local-session probe below corrects
   * it without any network call.
   */
  // `| undefined` so exactOptionalPropertyTypes callers can forward an
  // optional value directly (slice-39 SettingsRow precedent).
  initialHasUser?: boolean | undefined
}

/**
 * Auth-gated + route-aware mount for BrandNavRail. Renders null on pre-auth
 * routes and when no session user; otherwise renders the responsive rail
 * (desktop persistent ≥768px, mobile hamburger overlay <768px) and writes
 * the CSS var `--chiaro-rail-width` so BrandPageScreen + BrandFormScreen can
 * push their content right of the rail.
 *
 * Slice 74 (audit C5): auth state comes from the server hint + a LOCAL
 * getSession() read (no GoTrue network call — the slice-66 pattern), and the
 * profile loads through useMyProfile so it dedupes against the home page's
 * query cache instead of re-fetching per hard load.
 */
export function BrandNavRailMount({
  initialHasUser,
}: BrandNavRailMountProps): React.JSX.Element | null {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const client = useChiaroClient()
  const isDesktop = useBreakpoint(768)

  const [hasUser, setHasUser] = useState<boolean | null>(initialHasUser ?? null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await client.auth.getSession() // local read, no network
      if (!cancelled) setHasUser(!!data.session)
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  const { data: profile } = useMyProfile(client, { enabled: hasUser === true })

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    const railShown =
      !!hasUser && !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
    const desktopRail = railShown && isDesktop
    const mobileTopBar = railShown && !isDesktop
    document.documentElement.style.setProperty('--chiaro-rail-width', desktopRail ? '200px' : '0px')
    document.documentElement.style.setProperty(
      '--chiaro-rail-topbar',
      mobileTopBar ? '52px' : '0px',
    )
    return () => {
      document.documentElement.style.setProperty('--chiaro-rail-width', '0px')
      document.documentElement.style.setProperty('--chiaro-rail-topbar', '0px')
    }
  }, [hasUser, pathname, isDesktop])

  const handleNavigate = useCallback((path: string) => router.push(path), [router])
  const handleSignOut = useCallback(() => {
    void signOut(router, client)
  }, [router, client])

  if (hasUser === false || hasUser === null) return null
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null

  const user: RailUser = {
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    initial: deriveInitial(profile ?? null),
  }

  if (isDesktop) {
    return (
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname={pathname}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
    )
  }
  return (
    <BrandNavRail
      variant="mobile"
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      user={user}
      pathname={pathname}
      onNavigate={handleNavigate}
      onSignOut={handleSignOut}
    />
  )
}
