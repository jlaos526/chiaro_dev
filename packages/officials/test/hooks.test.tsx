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
  useOfficialStateTownHalls,
  useOfficialStateDistrictOffices,
  useOfficialStateCommitteeHearings,
  useOfficialStateFinancialDisclosures,
  useOfficialStateEthicsComplaints,
  useOfficialStateOfficialEvents,
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
    const { result } = renderHook(() => useOfficial({} as ChiaroClient, 'a'), {
      wrapper: wrapper(qc),
    })
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
    const { result } = renderHook(() => useOfficialStateFinanceSummary({} as ChiaroClient, 'oid'), {
      wrapper: wrapper(qc),
    })
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
    const { result } = renderHook(() => useOfficialStateDonors({} as ChiaroClient, 'oid'), {
      wrapper: wrapper(qc),
    })
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

describe('useOfficialStateTownHalls', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateTownHalls').mockResolvedValue([
      {
        id: 'h1',
        official_id: 'oid',
        event_date: '2026-01-15',
        city: 'San Jose',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 120,
        source_url: 'https://x',
        source: 'townhallproject',
        external_id: 'thp-1',
        ingested_at: '2025-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useOfficialStateTownHalls({} as ChiaroClient, 'oid'), {
      wrapper: wrapper(qc),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.format).toBe('hybrid')
  })
})

describe('useOfficialStateDistrictOffices', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateDistrictOffices').mockResolvedValue([
      {
        id: 'o1',
        official_id: 'oid',
        kind: 'district',
        street_1: '123 Main',
        street_2: null,
        city: 'San Jose',
        state: 'CA',
        postal_code: '95113',
        phone: '(408) 555-0100',
        email: null,
        hours_text: 'Mon-Fri 9-5',
        source_url: 'https://x',
        ingested_at: '2025-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateDistrictOffices({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.kind).toBe('district')
  })
})

describe('useOfficialStateCommitteeHearings', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateCommitteeHearings').mockResolvedValue([
      {
        id: 'hr1',
        openstates_committee_id: 'ocd-org/x',
        state: 'CA',
        session: '20252026',
        hearing_date: '2026-03-01',
        location: 'Capitol Room 1',
        agenda_topic: 'SB-91',
        source_url: 'https://x',
        ingested_at: '2025-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateCommitteeHearings({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.agenda_topic).toBe('SB-91')
  })
})

describe('useOfficialStateFinancialDisclosures', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateFinancialDisclosures').mockResolvedValue([
      {
        id: 'fd1',
        official_id: 'oid',
        filing_year: 2025,
        filing_date: '2026-02-01',
        income_source: 'Acme Consulting',
        income_kind: 'consulting',
        amount_range_low: 5000,
        amount_range_high: 25000,
        state: 'CA',
        source_url: 'https://x',
        source: 'ca-fppc',
        external_id: 'fd-1',
        ingested_at: '2026-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateFinancialDisclosures({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.filing_year).toBe(2025)
  })
})

describe('useOfficialStateEthicsComplaints', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateEthicsComplaints').mockResolvedValue([
      {
        id: 'ec1',
        official_id: 'oid',
        complaint_date: '2025-09-10',
        status: 'dismissed',
        disposition: 'no violation found',
        summary: 'Allegation of misuse of district funds',
        state: 'CA',
        source_url: 'https://x',
        source: 'ca-fppc',
        external_id: 'ec-1',
        ingested_at: '2026-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateEthicsComplaints({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.status).toBe('dismissed')
  })
})

describe('useOfficialStateOfficialEvents', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateOfficialEvents').mockResolvedValue([
      {
        id: 'ev1',
        official_id: 'oid',
        event_date: '2025-06-15',
        event_type: 'expulsion_vote',
        outcome: 'failed',
        summary: 'Vote to expel did not pass committee',
        state: 'CA',
        source_url: 'https://x',
        source: 'ballotpedia',
        external_id: 'ev-1',
        ingested_at: '2026-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useOfficialStateOfficialEvents({} as ChiaroClient, 'oid'), {
      wrapper: wrapper(qc),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.event_type).toBe('expulsion_vote')
  })
})
