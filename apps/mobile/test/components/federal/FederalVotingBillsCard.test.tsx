import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockMetrics: unknown = null
let mockSponsored: unknown[] = []
let mockCosponsored: unknown[] = []
let mockMissed: unknown[] = []
let mockLoadingMetrics = false
let mockLoadingSponsored = false
let mockLoadingCosponsored = false
let mockLoadingMissed = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: mockMetrics, isLoading: mockLoadingMetrics, isSuccess: !mockLoadingMetrics,
    }),
  }
})

jest.mock('@chiaro/bills', () => {
  const actual = jest.requireActual('@chiaro/bills')
  return {
    ...actual,
    useOfficialSponsoredBills: () => ({
      data: mockSponsored, isLoading: mockLoadingSponsored, isSuccess: !mockLoadingSponsored,
    }),
    useOfficialCosponsoredBills: () => ({
      data: mockCosponsored, isLoading: mockLoadingCosponsored, isSuccess: !mockLoadingCosponsored,
    }),
    useOfficialMissedVotes: () => ({
      data: mockMissed, isLoading: mockLoadingMissed, isSuccess: !mockLoadingMissed,
    }),
  }
})

import { FederalVotingBillsCard } from '@/components/federal/FederalVotingBillsCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockMetrics = null
  mockSponsored = []
  mockCosponsored = []
  mockMissed = []
  mockLoadingMetrics = false
  mockLoadingSponsored = false
  mockLoadingCosponsored = false
  mockLoadingMissed = false
})

describe('mobile FederalVotingBillsCard', () => {
  it('renders empty state when no bills + no votes', () => {
    const { getByText } = render(
      <FederalVotingBillsCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(getByText(/No bill or voting-record data/i)).toBeTruthy()
  })

  it('renders summary line with counts + attendance', () => {
    mockMetrics = { attendance_pct: 94 }
    mockSponsored = [{ id: 'b1', bill_type: 'hr', number: 1, title: 'Bill', short_title: null, status: 'introduced', source_url: 'https://x' }]
    mockCosponsored = [
      { id: 'c1', bill_type: 'hr', number: 2, title: 'Bill 2', short_title: null, status: 'introduced', source_url: 'https://x' },
      { id: 'c2', bill_type: 'hr', number: 3, title: 'Bill 3', short_title: null, status: 'introduced', source_url: 'https://x' },
    ]
    const { getByText } = render(
      <FederalVotingBillsCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(getByText(/1 sponsored · 2 cosponsored · 94% attendance/)).toBeTruthy()
    expect(getByText(/Voting & Bills \(119th Congress\)/)).toBeTruthy()
  })

  it('Sponsored bills subsection expands on press', () => {
    mockSponsored = [
      { id: 'b1', bill_type: 'hr', number: 4242, title: 'Climate Bill', short_title: null, status: 'introduced', source_url: 'https://x' },
    ]
    const { getByText, queryByText } = render(
      <FederalVotingBillsCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(queryByText(/Climate Bill/)).toBeNull()
    // Use word boundary to avoid matching "Cosponsored bills"
    fireEvent.press(getByText(/▸ Sponsored bills/i))
    expect(getByText(/Climate Bill/)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingSponsored = true
    const { getByText } = render(
      <FederalVotingBillsCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading voting/i)).toBeTruthy()
  })
})
