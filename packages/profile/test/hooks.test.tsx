import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { useMyProfile } from '../src/hooks.ts'
import { profileKeys } from '../src/keys.ts'
import * as queries from '../src/queries.ts'

function wrapper(client: QueryClient) {
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useMyProfile', () => {
  it('returns data via getMyProfile and uses profileKeys.me()', async () => {
    const stub = {
      id: 'u1',
      display_name: 'Ada',
      username: 'ada',
      completed: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const spy = vi.spyOn(queries, 'getMyProfile').mockResolvedValue(stub as never)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const fakeClient = {} as ChiaroClient
    const { result } = renderHook(() => useMyProfile(fakeClient), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stub)
    expect(spy).toHaveBeenCalledOnce()
    // The query is registered under profileKeys.me().
    expect(qc.getQueryData(profileKeys.me())).toEqual(stub)
  })
})
