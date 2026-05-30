'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChiaroClientProvider, BrandNavRailMount } from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from './supabase/client'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime:    5 * 60 * 1000,
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
