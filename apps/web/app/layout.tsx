import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { getSemantic, BRAND_TYPE_FAMILY_WEB } from '@chiaro/ui-tokens'
import { QueryProvider } from '@/lib/query-client'
import { readBrandModeCookie } from '@/lib/brand-mode-cookie'
import { ClientBrandModeWiring } from '@/lib/brand-mode-client-wiring'
import { RNWServerStyles } from '@/lib/rnw-ssr-styles'

// Brand font (slice 70, audit C6). next/font self-hosts the woff2 at build
// time (no runtime Google request) and exposes it via the --font-inter CSS
// variable — the contract BRAND_TYPE_FAMILY_WEB and the officials-ui
// primitives consume. General RNW <Text> (defaults to the System font) is
// still deferred (S80 D5).
// Slice 80 (Lighthouse baseline CLS 0.38 on /sign-in): 'swap' let raw HTML
// elements (smart-anchor <a>s, BrandTextInput fields — they inherit the body
// font) first-paint in the wider fallback, wrapping the auth top bar one
// line taller; the Inter swap then shrank it and slid the whole 100vh
// container up (~21px shift, puppeteer-measured 0.352). 'optional' never
// re-lays-out: the font is self-hosted + preloaded so it virtually always
// makes first paint; on a very slow load the metric-adjusted fallback
// simply stays for that navigation.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'optional',
  variable: '--font-inter',
})

export const metadata = { title: 'Chiaro' }

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const defaultMode = await readBrandModeCookie()
  // Effective mode for server-side <body> styling. Cookie is the only signal
  // available pre-hydration; useColorScheme() can't run on the server, so a
  // first-time visitor whose OS is dark will still see the documented single
  // frame of light before the client effect snaps to dark.
  const effectiveMode = defaultMode ?? 'light'
  const semantic = getSemantic(effectiveMode)
  // Auth hint for the nav rail (slice 74, audit C5): the PRESENCE of the
  // Supabase auth cookie (sb-<ref>-auth-token, possibly chunked) lets the
  // rail + its 200px CSS var render on first paint instead of after a client
  // auth round-trip — the old flow shifted all page content 200px right on
  // every authenticated desktop hard load. Presence is optimistic (expired
  // sessions correct client-side via a LOCAL getSession read).
  const cookieStore = await cookies()
  const initialHasUser = cookieStore.getAll().some((c) => /^sb-.*-auth-token/.test(c.name))
  return (
    <html
      lang="en"
      className={`${inter.variable}${initialHasUser ? ' chiaro-authed' : ''}`}
      style={{ colorScheme: effectiveMode }}
    >
      <body
        style={{
          backgroundColor: semantic.bg.app,
          color: semantic.text.body,
          margin: 0,
          fontFamily: BRAND_TYPE_FAMILY_WEB,
        }}
      >
        {/* Server-side default for the rail width so the FIRST paint is
            already laid out; BrandNavRailMount's useLayoutEffect takes over
            for route exclusions + client-side auth transitions (its inline
            documentElement.style wins over this stylesheet default). */}
        <style>{`@media (min-width: 768px) { html.chiaro-authed { --chiaro-rail-width: 200px; } }`}</style>
        {/* Slice 80: stream RNW's accumulated atomic CSS into the SSR HTML —
            without it every page first paints unstyled until hydration
            (the /sign-in CLS 0.385 + a sitewide FOUC). */}
        <RNWServerStyles>
          <ClientBrandModeWiring defaultMode={defaultMode}>
            <QueryProvider initialHasUser={initialHasUser}>{children}</QueryProvider>
          </ClientBrandModeWiring>
        </RNWServerStyles>
      </body>
    </html>
  )
}
