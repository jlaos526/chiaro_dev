import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from '@chiaro/officials'

// C1 (slice 57 T8): every detail-page card TITLE must render as an
// <h2>-equivalent heading. RNW renders accessibilityRole="header" +
// accessibilityLevel={2} as <div role="heading" aria-level="2">. One assertion
// per distinct title string, across BOTH the federal and state platforms.

// --- Hook mocks (union across the cards we exercise) ---------------------
const useMetricsMock = vi.fn()
const useSponsoredMock = vi.fn()
const useVotesMock = vi.fn()
const useStateFinanceSummaryMock = vi.fn()
const useStateDonorsMock = vi.fn()
const useComplaintsMock = vi.fn()
const useEventsMock = vi.fn()
const useScorecardsMock = vi.fn()
const useMySelectionsMock = vi.fn()
const useIssueCatalogMock = vi.fn()
const useRepWatchlistFlagsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
    useOfficialStateFinanceSummary: (...args: unknown[]) => useStateFinanceSummaryMock(...args),
    useOfficialStateDonors: (...args: unknown[]) => useStateDonorsMock(...args),
    useOfficialStateEthicsComplaints: (...args: unknown[]) => useComplaintsMock(...args),
    useOfficialStateOfficialEvents: (...args: unknown[]) => useEventsMock(...args),
    useOfficialScorecardRatings: (...args: unknown[]) => useScorecardsMock(...args),
  }
})

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialSponsoredStateBills: (...args: unknown[]) => useSponsoredMock(...args),
    useOfficialStateVotes: (...args: unknown[]) => useVotesMock(...args),
  }
})

vi.mock('@chiaro/issues', async () => {
  const actual = await vi.importActual<object>('@chiaro/issues')
  return {
    ...actual,
    useMySelections: (...args: unknown[]) => useMySelectionsMock(...args),
    useIssueCatalog: (...args: unknown[]) => useIssueCatalogMock(...args),
    useRepWatchlistFlags: (...args: unknown[]) => useRepWatchlistFlagsMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { FederalServiceRecordCard } from '../../src/federal/FederalServiceRecordCard.tsx'
import { FederalIssuePositionsCard } from '../../src/federal/FederalIssuePositionsCard.tsx'
import { StateServiceRecordCard } from '../../src/state/StateServiceRecordCard.tsx'
import { StateFinanceCard } from '../../src/state/StateFinanceCard.tsx'
import { StateConductCard } from '../../src/state/StateConductCard.tsx'

const mockClient = { from: () => {} } as unknown as ChiaroClient

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
  )
}

const stateOfficial = {
  id: 'oid',
  full_name: 'Jane Doe',
  party: 'D',
  chamber: 'state_house',
  district_code: 'CA-12',
  district: { code: 'CA-12' },
} as unknown as OfficialWithDistrict

beforeEach(() => {
  // Issue-priority queries default to empty / no flags (slice-52 baseline).
  useMySelectionsMock.mockReturnValue({ data: undefined, isLoading: false })
  useIssueCatalogMock.mockReturnValue({ data: undefined, isLoading: false })
  useRepWatchlistFlagsMock.mockReturnValue({ data: [], isLoading: false })
})

afterEach(() => {
  useMetricsMock.mockReset()
  useSponsoredMock.mockReset()
  useVotesMock.mockReset()
  useStateFinanceSummaryMock.mockReset()
  useStateDonorsMock.mockReset()
  useComplaintsMock.mockReset()
  useEventsMock.mockReset()
  useScorecardsMock.mockReset()
  useMySelectionsMock.mockReset()
  useIssueCatalogMock.mockReset()
  useRepWatchlistFlagsMock.mockReset()
})

function expectH2(title: HTMLElement) {
  expect(title.getAttribute('role')).toBe('heading')
  expect(title.getAttribute('aria-level')).toBe('2')
}

describe('card titles are h2-equivalent headings (C1)', () => {
  it('federal Service Record card title is an h2 heading', () => {
    useMetricsMock.mockReturnValue({
      data: { bills_sponsored_count: 12, bills_cosponsored_count: 45, attendance_pct: 96 },
      isLoading: false,
      isSuccess: true,
    })
    // FederalServiceRecordCard uses useOfficialLeadershipHistory too — provide a
    // benign default via the real module (not mocked here); empty leadership.
    wrap(<FederalServiceRecordCard officialId="oid" />)
    expectH2(screen.getByText('Service Record'))
  })

  it('state Service Record card title is an h2 heading', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 3,
        bills_cosponsored_count: 5,
        votes_voted_count: 100,
        votes_missed_count: 4,
        attendance_pct: 96,
        party_unity_state: null,
        bills_passed_count: 2,
        hearings_held_count: 4,
        subject_breadth: 7,
        bill_passage_rate: 50,
        fiscal_impact_per_dollar_raised: 1.23,
        committee_chair_count: 2,
      },
      isLoading: false,
    })
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false })
    useVotesMock.mockReturnValue({ data: [], isLoading: false })
    wrap(<StateServiceRecordCard official={stateOfficial} />)
    expectH2(screen.getByText('Service Record'))
  })

  it('state Service Record card title is an h2 heading in the loading branch', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true })
    useSponsoredMock.mockReturnValue({ data: undefined, isLoading: true })
    useVotesMock.mockReturnValue({ data: undefined, isLoading: true })
    wrap(<StateServiceRecordCard official={stateOfficial} />)
    expectH2(screen.getByText('Service Record'))
  })

  it('state Finance card title is an h2 heading', () => {
    useStateFinanceSummaryMock.mockReturnValue({
      data: {
        source: 'ca-cal-access',
        cycle: '2024',
        total_raised: 100,
        total_disbursed: 50,
        small_donor_pct: 10,
        in_state_pct: 90,
      },
      isLoading: false,
    })
    useStateDonorsMock.mockReturnValue({ data: [], isLoading: false })
    wrap(<StateFinanceCard official={stateOfficial} />)
    expectH2(screen.getByText('Finance'))
  })

  it('state Conduct card title is an h2 heading', () => {
    useComplaintsMock.mockReturnValue({ data: [{ id: 'c1', status: 'open' }], isLoading: false })
    useEventsMock.mockReturnValue({ data: [{ id: 'e1' }], isLoading: false })
    wrap(<StateConductCard officialId="oid" />)
    expectH2(screen.getByText('Conduct & Sanctions'))
  })

  it('federal Issue Positions card title is an h2 heading', () => {
    useScorecardsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    wrap(<FederalIssuePositionsCard officialId="oid" />)
    expectH2(screen.getByText('Issue Positions'))
  })
})
