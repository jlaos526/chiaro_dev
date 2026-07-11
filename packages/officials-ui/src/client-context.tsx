'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const ChiaroClientContext = createContext<ChiaroClient | null>(null)

export interface ChiaroClientProviderProps {
  client: ChiaroClient
  children: ReactNode
}

export function ChiaroClientProvider({
  client,
  children,
}: ChiaroClientProviderProps): React.JSX.Element {
  return <ChiaroClientContext.Provider value={client}>{children}</ChiaroClientContext.Provider>
}

export function useChiaroClient(): ChiaroClient {
  const c = useContext(ChiaroClientContext)
  if (!c) {
    throw new Error('useChiaroClient must be used inside <ChiaroClientProvider>')
  }
  return c
}
