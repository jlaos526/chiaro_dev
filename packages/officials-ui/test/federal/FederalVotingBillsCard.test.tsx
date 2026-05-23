import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useMetricsMock = vi.fn()
const useSponsoredMock = vi.fn()
const useCosponsoredMock = vi.fn()
const useMissedMock = vi.fn()

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
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
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
})

describe('FederalVotingBillsCard', () => {
  it('renders loading state', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useSponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useCosponsoredMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useMissedMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/Loading voting & bills/i)).toBeTruthy()
  })

  it('renders empty state when all empty', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
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
    useMetricsMock.mockReturnValue({ data: { attendance_pct: 90 }, isLoading: false, isSuccess: true })
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
