import { QueryProvider } from '@/lib/query-client'

export const metadata = { title: 'Chiaro' }

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
