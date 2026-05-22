import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

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
    useOfficialSponsoredBills:   (...args: unknown[]) => useSponsoredMock(...args),
    useOfficialCosponsoredBills: (...args: unknown[]) => useCosponsoredMock(...args),
    useOfficialMissedVotes:      (...args: unknown[]) => useMissedMock(...args),
  }
})

import { FederalVotingBillsCard } from '@/components/federal/FederalVotingBillsCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const emptyOk = { data: [], isLoading: false, isSuccess: true }

describe('FederalVotingBillsCard', () => {
  it('renders empty state when all 3 hooks return []', () => {
    useMetricsMock.mockReturnValue({ data: { attendance_pct: null }, isLoading: false, isSuccess: true })
    useSponsoredMock.mockReturnValue(emptyOk)
    useCosponsoredMock.mockReturnValue(emptyOk)
    useMissedMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/No bill or voting-record data on file/i)).toBeTruthy()
  })

  it('renders summary row with counts + attendance', () => {
    useMetricsMock.mockReturnValue({
      data: { attendance_pct: 97 },
      isLoading: false, isSuccess: true,
    })
    useSponsoredMock.mockReturnValue({
      data: [
        { id: 'b1', bill_type: 'HR', number: '1', short_title: 'A Bill', title: 'A Bill', status: 'introduced' },
        { id: 'b2', bill_type: 'HR', number: '2', short_title: 'Another Bill', title: 'Another', status: 'passed' },
      ],
      isLoading: false, isSuccess: true,
    })
    useCosponsoredMock.mockReturnValue({
      data: [
        { id: 'b3', bill_type: 'HR', number: '5', short_title: 'Cosp1', title: 'Cosp1', status: 'introduced' },
      ],
      isLoading: false, isSuccess: true,
    })
    useMissedMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/2 sponsored/)).toBeTruthy()
    expect(getByText(/1 cosponsored/)).toBeTruthy()
    expect(getByText(/97% attendance/i)).toBeTruthy()
  })

  it('Sponsored subsection expands on click', () => {
    useMetricsMock.mockReturnValue({ data: { attendance_pct: 90 }, isLoading: false, isSuccess: true })
    useSponsoredMock.mockReturnValue({
      data: [
        { id: 'b1', bill_type: 'HR', number: '42', short_title: 'Climate Action', title: 'Climate Action Act', status: 'introduced' },
      ],
      isLoading: false, isSuccess: true,
    })
    useCosponsoredMock.mockReturnValue(emptyOk)
    useMissedMock.mockReturnValue(emptyOk)
    const { getByText, queryByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(queryByText(/Climate Action/)).toBeNull()
    fireEvent.click(getByText(/Sponsored bills/))
    expect(getByText(/Climate Action/)).toBeTruthy()
  })

  it('renders loading state when any hook is loading', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useSponsoredMock.mockReturnValue(emptyOk)
    useCosponsoredMock.mockReturnValue(emptyOk)
    useMissedMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<FederalVotingBillsCard officialId="oid" congress="119" />)
    expect(getByText(/Loading voting & bills/i)).toBeTruthy()
  })
})
