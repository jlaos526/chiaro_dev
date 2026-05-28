import { QueryProvider } from '@/lib/query-client'
import { readBrandModeCookie } from '@/lib/brand-mode-cookie'
import { ClientBrandModeWiring } from '@/lib/brand-mode-client-wiring'

export const metadata = { title: 'Chiaro' }

export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const defaultMode = await readBrandModeCookie()
  return (
    <html lang="en">
      <body>
        <ClientBrandModeWiring defaultMode={defaultMode}>
          <QueryProvider>{children}</QueryProvider>
        </ClientBrandModeWiring>
      </body>
    </html>
  )
}
