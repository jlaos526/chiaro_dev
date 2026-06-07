import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { useOfficialMissedVotes } from '../src/hooks.ts'
import * as queries from '../src/queries.ts'

function wrap(qc: QueryClient) {
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useOfficialMissedVotes', () => {
  it('respects enabled flag (lazy drill-down)', async () => {
    const spy = vi.spyOn(queries, 'fetchOfficialMissedVotes').mockResolvedValue([])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderHook(
      () => useOfficialMissedVotes({} as ChiaroClient, 'off1', '119', { enabled: false }),
      { wrapper: wrap(qc) },
    )
    await new Promise(r => setTimeout(r, 50))
    expect(spy).not.toHaveBeenCalled()
  })
})
