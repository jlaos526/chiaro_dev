import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockMetrics: unknown = null
let mockLeadership: unknown[] = []
let mockLoadingMetrics = false
let mockLoadingLeadership = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: mockMetrics,
      isLoading: mockLoadingMetrics,
      isSuccess: !mockLoadingMetrics,
    }),
    useOfficialLeadershipHistory: () => ({
      data: mockLeadership,
      isLoading: mockLoadingLeadership,
      isSuccess: !mockLoadingLeadership,
    }),
  }
})

import { FederalServiceRecordCard } from '@/components/federal/FederalServiceRecordCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockMetrics = null
  mockLeadership = []
  mockLoadingMetrics = false
  mockLoadingLeadership = false
})

describe('mobile FederalServiceRecordCard', () => {
  it('renders empty state when no metrics and no leadership', () => {
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/No service record data on file/i)).toBeTruthy()
  })

  it('renders summary row when metrics present', () => {
    mockMetrics = {
      bills_sponsored_count: 12, bills_cosponsored_count: 45,
      attendance_pct: 96, subject_breadth: 8, lives_in_district: true,
    }
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/12 bills sponsored/i)).toBeTruthy()
    expect(getByText(/45 cosponsored/i)).toBeTruthy()
    expect(getByText(/96% attendance/i)).toBeTruthy()
  })

  it('Leadership subsection expands on press', () => {
    mockMetrics = {
      bills_sponsored_count: 1, bills_cosponsored_count: 1,
      attendance_pct: 95, subject_breadth: 1, lives_in_district: null,
    }
    mockLeadership = [
      { id: 'l1', role: 'Chair, Energy and Commerce', start_date: '2023-01-03', end_date: null },
    ]
    const { getByText, queryByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(queryByText(/Energy and Commerce/)).toBeNull()
    fireEvent.press(getByText(/Leadership history/i))
    expect(getByText(/Energy and Commerce/)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingMetrics = true
    const { getByText } = render(<FederalServiceRecordCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/Loading service record/i)).toBeTruthy()
  })
})
