import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { useMyOfficials, useOfficial } from '../src/hooks.ts'
import * as queries from '../src/queries.ts'

function wrapper(client: QueryClient) {
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useMyOfficials', () => {
  it('returns data via fetchMyOfficials', async () => {
    const stub = [{ id: '1', bioguide_id: 'P000197', district: { id: 'd1' } }] as any
    const spy = vi.spyOn(queries, 'fetchMyOfficials').mockResolvedValue(stub)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const fakeClient = {} as ChiaroClient
    const { result } = renderHook(() => useMyOfficials(fakeClient), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stub)
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('useOfficial', () => {
  it('returns data via fetchOfficial', async () => {
    const stub = { id: 'a', bioguide_id: 'F000062', district: { id: 'd2' } } as any
    vi.spyOn(queries, 'fetchOfficial').mockResolvedValue(stub)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useOfficial({} as ChiaroClient, 'a'), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stub)
  })
})
