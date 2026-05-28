import { getSemantic } from '@chiaro/ui-tokens'
import { QueryProvider } from '@/lib/query-client'
import { readBrandModeCookie } from '@/lib/brand-mode-cookie'
import { ClientBrandModeWiring } from '@/lib/brand-mode-client-wiring'

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
    <html lang="en" style={{ colorScheme: effectiveMode }}>
      <body style={{ backgroundColor: semantic.bg.app, color: semantic.text.body, margin: 0 }}>
        <ClientBrandModeWiring defaultMode={defaultMode}>
          <QueryProvider>{children}</QueryProvider>
        </ClientBrandModeWiring>
      </body>
    </html>
  )
}
