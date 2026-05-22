import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useMetricsMock = vi.fn()
const useLeadershipMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics:             (...args: unknown[]) => useMetricsMock(...args),
    useOfficialLeadershipHistory:   (...args: unknown[]) => useLeadershipMock(...args),
  }
})

import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('FederalServiceRecordCard', () => {
  it('renders empty state when no metrics + no leadership', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/No service record data on file/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 12,
        bills_cosponsored_count: 45,
        attendance_pct: 96,
        subject_breadth: 8,
        lives_in_district: true,
      },
      isLoading: false, isSuccess: true,
    })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/12 bills sponsored/i)).toBeTruthy()
    expect(getByText(/96% attendance/i)).toBeTruthy()
  })

  it('Leadership subsection expands on click', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 1,
        bills_cosponsored_count: 1,
        attendance_pct: 95,
        subject_breadth: 1,
        lives_in_district: null,
      },
      isLoading: false, isSuccess: true,
    })
    useLeadershipMock.mockReturnValue({
      data: [{ id: 'l1', role: 'Chair of Energy and Commerce', start_date: '2023-01-03', end_date: null }],
      isLoading: false, isSuccess: true,
    })
    const { getByText, queryByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(queryByText(/Chair of Energy and Commerce/)).toBeNull()
    fireEvent.click(getByText(/Leadership history/i))
    expect(getByText(/Chair of Energy and Commerce/)).toBeTruthy()
  })

  it('renders loading state', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/Loading service record/i)).toBeTruthy()
  })
})
