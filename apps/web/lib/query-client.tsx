'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Deep imports (audit C2): this file renders in the ROOT layout, so a barrel
// import would put the entire officials-ui graph in the /layout chunk group
// on every route. The './src/*' subpath export is the package's documented
// deep-import surface (README.md).
import { ChiaroClientProvider } from '@chiaro/officials-ui/src/client-context.tsx'
import { BrandNavRailMount } from '@chiaro/officials-ui/src/nav/BrandNavRailMount.tsx'
import { createSupabaseBrowserClient } from './supabase/client'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

const chiaroClient = createSupabaseBrowserClient()

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [qc] = React.useState(getQueryClient)
  return (
    <ChiaroClientProvider client={chiaroClient}>
      <QueryClientProvider client={qc}>
        <BrandNavRailMount />
        {children}
      </QueryClientProvider>
    </ChiaroClientProvider>
  )
}
