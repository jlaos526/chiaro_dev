import { Inter } from 'next/font/google'
import { getSemantic, BRAND_TYPE_FAMILY_WEB } from '@chiaro/ui-tokens'
import { QueryProvider } from '@/lib/query-client'
import { readBrandModeCookie } from '@/lib/brand-mode-cookie'
import { ClientBrandModeWiring } from '@/lib/brand-mode-client-wiring'

// Brand font (slice 70, audit C6). next/font self-hosts the woff2 at build
// time (no runtime Google request, size-adjusted fallback metrics ≈ zero
// CLS) and exposes it via the --font-inter CSS variable — the contract
// BRAND_TYPE_FAMILY_WEB and the officials-ui primitives consume. General
// RNW <Text> (defaults to the System font) is the S80 remainder.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = { title: 'Chiaro' }

export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const defaultMode = await readBrandModeCookie()
  // Effective mode for server-side <body> styling. Cookie is the only signal
  // available pre-hydration; useColorScheme() can't run on the server, so a
  // first-time visitor whose OS is dark will still see the documented single
  // frame of light before the client effect snaps to dark.
  const effectiveMode = defaultMode ?? 'light'
  const semantic = getSemantic(effectiveMode)
  return (
    <html lang="en" className={inter.variable} style={{ colorScheme: effectiveMode }}>
      <body style={{ backgroundColor: semantic.bg.app, color: semantic.text.body, margin: 0, fontFamily: BRAND_TYPE_FAMILY_WEB }}>
        <ClientBrandModeWiring defaultMode={defaultMode}>
          <QueryProvider>{children}</QueryProvider>
        </ClientBrandModeWiring>
      </body>
    </html>
  )
}
