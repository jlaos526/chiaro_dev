import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useMetricsMock = vi.fn()
const useSponsoredMock = vi.fn()
const useCosponsoredMock = vi.fn()
const useMissedMock = vi.fn()
// Slice 75 (audit C12): labels/summary come from head-only count hooks.
const useSponsoredCountMock = vi.fn()
const useCosponsoredCountMock = vi.fn()
const useMissedCountMock = vi.fn()

function setCounts(sponsored: number, cosponsored: number, missed: number, isLoading = false) {
  useSponsoredCountMock.mockReturnValue({ data: sponsored, isLoading, isSuccess: !isLoading })
  useCosponsoredCountMock.mockReturnValue({ data: cosponsored, isLoading, isSuccess: !isLoading })
  useMissedCountMock.mockReturnValue({ data: missed, isLoading, isSuccess: !isLoading })
}

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
  }
})

vi.mock('@chiaro/bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/bills')
  return {
    ...actual,
    useOfficialSponsoredBills: (...args: unknown[]) => useSponsoredMock(...args),
    useOfficialCosponsoredBills: (...args: unknown[]) => useCosponsoredMock(...args),
    useOfficialMissedVotes: (...args: unknown[]) => useMissedMock(...args),
    useOfficialSponsoredBillsCount: (...args: unknown[]) => useSponsoredCountMock(...args),
    useOfficialCosponsoredBillsCount: (...args: unknown[]) => useCosponsoredCountMock(...args),
    useOfficialMissedVotesCount: (...args: unknown[]) => useMissedCountMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalVotingBillsCard } from '../../src/federal/FederalVotingBillsCard.tsx'

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
  useCosponsoredMock.mockReset()
  useMissedMock.mockReset()
  useSponsoredCountMock.mockReset()
  useCosponsoredCountMock.mockReset()
  useMissedCountMock.mockReset()
})

describe('FederalVotingBillsCard', () => {
  it('renders loading state', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    setCounts(0, 0, 0)
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useCosponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useMissedMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/Loading voting & bills/i)).toBeTruthy()
  })

  it('renders empty state when all empty', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
    setCounts(0, 0, 0)
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useCosponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useMissedMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/No bill or voting-record data/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    useMetricsMock.mockReturnValue({
      data: { attendance_pct: 96 },
      isLoading: false,
      isSuccess: true,
    })
    setCounts(2, 1, 0)
    useSponsoredMock.mockReturnValue({
      data: [{ id: 'b1' }, { id: 'b2' }],
      isLoading: false,
      isSuccess: true,
    })
    useCosponsoredMock.mockReturnValue({
      data: [{ id: 'b3' }],
      isLoading: false,
      isSuccess: true,
    })
    useMissedMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/2 sponsored/i)).toBeTruthy()
    expect(getByText(/1 cosponsored/i)).toBeTruthy()
    expect(getByText(/96% attendance/i)).toBeTruthy()
  })

  it('Sponsored subsection expands on press', () => {
    useMetricsMock.mockReturnValue({
      data: { attendance_pct: 90 },
      isLoading: false,
      isSuccess: true,
    })
    setCounts(1, 0, 0)
    useSponsoredMock.mockReturnValue({
      data: [
        {
          id: 'b1',
          bill_type: 'hr',
          number: '1234',
          title: 'A Test Bill',
          introduced_date: '2025-01-15',
          status: 'introduced',
          source_url: null,
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    useCosponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useMissedMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText, queryByText } = wrap(
      <FederalVotingBillsCard officialId="oid" congress="119" />,
    )
    expect(queryByText(/A Test Bill/)).toBeNull()
    fireEvent.click(getByText(/^▸ Sponsored bills/))
    expect(getByText(/A Test Bill/)).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalVotingBillsCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useMetricsMock.mockReturnValue({
      data: { attendance_pct: 90 },
      isLoading: false,
      isSuccess: true,
    })
    setCounts(1, 0, 0)
    useSponsoredMock.mockReturnValue({ data: [{ id: 'b1' }], isLoading: false, isSuccess: true })
    useCosponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useMissedMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const ui = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <FederalVotingBillsCard officialId="oid" congress="119" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(ui, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(ui, { wrapper: darkWrapper })).not.toThrow()
  })
})
