import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

let mockComplaints: unknown[] = []
let mockEvents: unknown[] = []
let mockLoadingComplaints = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateEthicsComplaints: () => ({
      data: mockComplaints,
      isLoading: mockLoadingComplaints,
      isSuccess: !mockLoadingComplaints,
    }),
    useOfficialStateOfficialEvents: () => ({
      data: mockEvents,
      isLoading: false,
      isSuccess: true,
    }),
  }
})

import { StateConductCard } from '@/components/state/StateConductCard'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockComplaints = []
  mockEvents = []
  mockLoadingComplaints = false
})

describe('mobile StateConductCard', () => {
  it('renders empty state when both sources empty', () => {
    const { getByText } = render(
      <StateConductCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/No ethics complaints or conduct events on record/i)).toBeTruthy()
  })

  it('renders summary row with complaint + open counts', () => {
    mockComplaints = [
      {
        id: 'c1',
        official_id: 'oid',
        complaint_date: '2026-01-15',
        status: 'open',
        disposition: null,
        summary: 'Test complaint',
        state: 'CA',
        source_url: 'https://x',
        source: 'ca-fppc',
        external_id: 'c-1',
        ingested_at: '2026-01-01',
      },
    ]
    const { getByText } = render(
      <StateConductCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/1 complaint \(1 open\)/i)).toBeTruthy()
  })

  it('subsections collapsed by default; clicking expands', () => {
    mockEvents = [
      {
        id: 'e1',
        official_id: 'oid',
        event_date: '2026-01-15',
        event_type: 'censure',
        outcome: 'Formal censure recorded',
        summary: 'Censured by floor vote',
        state: 'CA',
        source_url: 'https://x',
        source: 'ca-fppc',
        external_id: 'e-1',
        ingested_at: '2026-01-01',
      },
    ]
    const { getByText, queryByText } = render(
      <StateConductCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(queryByText(/Censured by floor vote/i)).toBeNull()
    fireEvent.press(getByText(/Sanctions \/ recall \/ resignation/i))
    expect(getByText(/Censured by floor vote/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingComplaints = true
    const { getByText } = render(
      <StateConductCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading conduct records/i)).toBeTruthy()
  })
})
