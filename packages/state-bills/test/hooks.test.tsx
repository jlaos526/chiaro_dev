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
  fetchOfficialStateVotesOnSubject: vi.fn(),
  fetchStateBillVotes: vi.fn(),
}))

import { useOfficialSponsoredStateBills, useOfficialStateVotesOnSubject } from '../src/hooks.ts'
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

describe('useOfficialStateVotesOnSubject', () => {
  beforeEach(() => {
    vi.mocked(queries.fetchOfficialStateVotesOnSubject).mockResolvedValue([
      {
        position: 'yes',
        vote: {
          id: 'v1', openstates_vote_id: 'ocd-vote/x', bill_id: 'b1',
          state: 'CA', session: '20252026', chamber: 'state_senate',
          vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
          source_url: 'https://x', party_vote_split: null,
          created_at: '2025-03-01',
          bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'Env Test' },
        },
      },
    ] as never)
  })

  it('returns vote positions when subjects matched', async () => {
    const { result } = renderHook(
      () => useOfficialStateVotesOnSubject({} as never, 'oid', ['Environment', 'Energy']),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.position).toBe('yes')
  })

  it('disabled when subjects array is empty', () => {
    const { result } = renderHook(
      () => useOfficialStateVotesOnSubject({} as never, 'oid', []),
      { wrapper: wrap },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('respects opts.enabled: false', () => {
    const { result } = renderHook(
      () => useOfficialStateVotesOnSubject({} as never, 'oid', ['Environment'], { enabled: false }),
      { wrapper: wrap },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })
})
