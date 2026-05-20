import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../src/queries.ts', () => ({
  fetchOfficialSponsoredStateBills: vi.fn(),
  fetchOfficialCosponsoredStateBills: vi.fn(),
  fetchStateBill: vi.fn(),
  fetchOfficialStateVotes: vi.fn(),
  fetchOfficialMissedStateVotes: vi.fn(),
  fetchStateBillVotes: vi.fn(),
}))

import { useOfficialSponsoredStateBills } from '../src/hooks.ts'
import * as queries from '../src/queries.ts'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  // Re-establish mock implementations after vitest's restoreMocks resets them.
  vi.mocked(queries.fetchOfficialSponsoredStateBills).mockResolvedValue([
    { id: 'b1', title: 'Mock Bill', state: 'CA', session: '20252026', sponsors: [], subjects: [] } as never,
  ])
  vi.mocked(queries.fetchOfficialCosponsoredStateBills).mockResolvedValue([])
  vi.mocked(queries.fetchOfficialStateVotes).mockResolvedValue([])
  vi.mocked(queries.fetchOfficialMissedStateVotes).mockResolvedValue([])
})

describe('useOfficialSponsoredStateBills', () => {
  it('returns data from fetchOfficialSponsoredStateBills', async () => {
    const fakeClient = { from: vi.fn() } as never
    const { result } = renderHook(
      () => useOfficialSponsoredStateBills(fakeClient, 'oid-1'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.title).toBe('Mock Bill')
  })

  it('reaches success state without errors', async () => {
    const fakeClient = { from: vi.fn() } as never
    const { result } = renderHook(
      () => useOfficialSponsoredStateBills(fakeClient, 'oid-1'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0)
  })
})
