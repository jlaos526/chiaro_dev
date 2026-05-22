import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import {
  useMyOfficials,
  useOfficial,
  useOfficialStateFinanceSummary,
  useOfficialStateDonors,
  useOfficialStateScorecardRatings,
} from '../src/hooks.ts'
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

// vitest restoreMocks: true wipes spies between tests, so spy setup MUST live
// in beforeEach (not at module load). Matches slice 5D state-bills convention.
describe('useOfficialStateFinanceSummary', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateFinanceSummary').mockResolvedValue({
      id: 's1',
      official_id: 'oid',
      cycle: '2024',
      total_raised: 100000,
      total_disbursed: 80000,
      small_donor_pct: 25,
      in_state_pct: 60,
      source: 'ca-cal-access',
      source_url: 'https://x',
      ingested_at: '2025-01-01T00:00:00Z',
    } as never)
  })

  it('returns latest cycle summary', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateFinanceSummary({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.cycle).toBe('2024')
    expect(result.current.data?.source).toBe('ca-cal-access')
  })
})

describe('useOfficialStateDonors', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateDonors').mockResolvedValue([
      {
        state_finance_summary_id: 's1',
        rank: 1,
        donor_name: 'Alice',
        amount: 10000,
        employer: 'Acme',
        occupation: 'CEO',
        city: 'SF',
        donor_state: 'CA',
      },
      {
        state_finance_summary_id: 's1',
        rank: 2,
        donor_name: 'Bob',
        amount: 5000,
        employer: null,
        occupation: null,
        city: null,
        donor_state: null,
      },
    ] as never)
  })

  it('returns donors ordered by rank', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateDonors({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0]!.rank).toBe(1)
    expect(result.current.data![1]!.donor_name).toBe('Bob')
  })
})

describe('useOfficialStateScorecardRatings', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateScorecardRatings').mockResolvedValue([
      {
        id: 'r1',
        scorecard_id: 's1',
        official_id: 'oid',
        session: '20252026',
        score: 82.5,
        source_url: 'https://x',
        ingested_at: '2025-01-01T00:00:00Z',
        org: {
          id: 's1',
          slug: 'aclu',
          state: 'CA',
          name: 'ACLU of California',
          issue_area: 'civil-liberties',
          lean: 'progressive',
          methodology_url: 'https://y',
          scoring_min: 0,
          scoring_max: 100,
          notes: null,
        },
      },
    ] as never)
  })

  it('returns scorecard ratings joined to org', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateScorecardRatings({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.org.slug).toBe('aclu')
    expect(Number(result.current.data![0]!.score)).toBe(82.5)
  })
})
