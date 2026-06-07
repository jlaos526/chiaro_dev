import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from '@chiaro/officials'

const useMetricsMock = vi.fn()
const useSponsoredMock = vi.fn()
const useVotesMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
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

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateServiceRecordCard } from '../../src/state/StateServiceRecordCard.tsx'

const mockClient = { from: () => {} } as unknown as ChiaroClient

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
  )
}

afterEach(() => {
  useMetricsMock.mockReset()
  useSponsoredMock.mockReset()
  useVotesMock.mockReset()
})

const stateOfficial = {
  id: 'oid',
  full_name: 'Jane Doe',
  party: 'D',
  chamber: 'state_house',
  district_code: 'CA-12',
  district: { code: 'CA-12' },
} as unknown as OfficialWithDistrict

const federalOfficial = {
  id: 'oid',
  full_name: 'Jane Doe',
  party: 'D',
  chamber: 'federal_house',
  district_code: 'CA-12',
  district: { code: 'CA-12' },
} as unknown as OfficialWithDistrict

describe('StateServiceRecordCard', () => {
  it('returns null when chamber is not state-level', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false })
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false })
    useVotesMock.mockReturnValue({ data: [], isLoading: false })
    const { container } = wrap(<StateServiceRecordCard official={federalOfficial} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders core metrics + performance metrics', () => {
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
    const { getByText } = wrap(<StateServiceRecordCard official={stateOfficial} />)
    expect(getByText('Service Record')).toBeTruthy()
    expect(getByText('Performance metrics')).toBeTruthy()
    expect(getByText('96%')).toBeTruthy()
    expect(getByText('Not yet computed')).toBeTruthy()
    expect(getByText('50%')).toBeTruthy()
    expect(getByText('Committee chair seats')).toBeTruthy()
  })

  it('renders static sub-section headings as h3 (C1)', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 3,
        bills_cosponsored_count: 5,
        votes_voted_count: 100,
        votes_missed_count: 4,
        attendance_pct: 96,
        party_unity_state: 80,
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
    const { getByText } = wrap(<StateServiceRecordCard official={stateOfficial} />)

    const perf = getByText('Performance metrics')
    expect(perf.getAttribute('role')).toBe('heading')
    expect(perf.getAttribute('aria-level')).toBe('3')

    const sponsored = getByText(/View sponsored bills/i)
    expect(sponsored.getAttribute('role')).toBe('heading')
    expect(sponsored.getAttribute('aria-level')).toBe('3')

    const voteRecord = getByText(/View vote record/i)
    expect(voteRecord.getAttribute('role')).toBe('heading')
    expect(voteRecord.getAttribute('aria-level')).toBe('3')
  })

  it('hides committee chair row when null', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 1,
        bills_cosponsored_count: 1,
        votes_voted_count: 1,
        votes_missed_count: 0,
        attendance_pct: 100,
        party_unity_state: 80,
        bills_passed_count: null,
        hearings_held_count: null,
        subject_breadth: null,
        bill_passage_rate: null,
        fiscal_impact_per_dollar_raised: null,
        committee_chair_count: null,
      },
      isLoading: false,
    })
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false })
    useVotesMock.mockReturnValue({ data: [], isLoading: false })
    const { queryByText } = wrap(<StateServiceRecordCard official={stateOfficial} />)
    expect(queryByText('Committee chair seats')).toBeNull()
  })

  it('renders "—" not "0" for NULL top-row metrics (B3)', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: null,
        bills_cosponsored_count: null,
        votes_voted_count: null,
        votes_missed_count: null,
        attendance_pct: null,
        party_unity_state: null,
        bills_passed_count: null,
        hearings_held_count: null,
        subject_breadth: null,
        bill_passage_rate: null,
        fiscal_impact_per_dollar_raised: null,
        committee_chair_count: null,
      },
      isLoading: false,
    })
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false })
    useVotesMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText, queryByText } = wrap(<StateServiceRecordCard official={stateOfficial} />)
    expect(getByText('Bills sponsored').parentElement?.textContent).toContain('—')
    expect(queryByText('0')).toBeNull()
  })

  it('shows a loading branch while queries are in flight (B4)', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true })
    useSponsoredMock.mockReturnValue({ data: undefined, isLoading: true })
    useVotesMock.mockReturnValue({ data: undefined, isLoading: true })
    const { getByText, queryByText } = wrap(<StateServiceRecordCard official={stateOfficial} />)
    expect(getByText(/loading service record/i)).toBeTruthy()
    expect(queryByText('Bills sponsored')).toBeNull()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateServiceRecordCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false })
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false })
    useVotesMock.mockReturnValue({ data: [], isLoading: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider client={qc}>
          <StateServiceRecordCard official={stateOfficial} />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(tree, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(tree, { wrapper: darkWrapper })).not.toThrow()
  })
})
