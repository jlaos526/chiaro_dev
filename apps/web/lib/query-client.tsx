'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function makeClient() {
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

let browserClient: QueryClient | undefined

function getClient() {
  if (typeof window === 'undefined') return makeClient()
  if (!browserClient) browserClient = makeClient()
  return browserClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(getClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
