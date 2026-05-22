import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Avoid loading the real Supabase env module which throws when env vars are absent.
jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

// Mutable mock state — see [[feedback-jest-expo-dynamic-mock-pattern]].
let mockHalls: unknown[] = []
let mockOffices: unknown[] = []
let mockHearings: unknown[] = []
let mockLoadingHalls = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateTownHalls: () => ({
      data: mockHalls,
      isLoading: mockLoadingHalls,
      isSuccess: !mockLoadingHalls,
    }),
    useOfficialStateDistrictOffices: () => ({
      data: mockOffices,
      isLoading: false,
      isSuccess: true,
    }),
    useOfficialStateCommitteeHearings: () => ({
      data: mockHearings,
      isLoading: false,
      isSuccess: true,
    }),
  }
})

// Import after mocks.
import { StateCommunityPresenceCard } from '@/components/state/StateCommunityPresenceCard'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockHalls = []
  mockOffices = []
  mockHearings = []
  mockLoadingHalls = false
})

describe('mobile StateCommunityPresenceCard', () => {
  it('renders empty state when all 3 sources empty', () => {
    const { getByText } = render(
      <StateCommunityPresenceCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/No community-presence data available/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    mockHalls = [
      {
        id: 't1',
        official_id: 'oid',
        event_date: '2026-01-01',
        city: null,
        state: 'CA',
        format: null,
        attendance_estimate: null,
        source_url: 'https://x',
        source: 'townhallproject',
        external_id: null,
        ingested_at: '2026-01-01',
      },
    ]
    const { getByText } = render(
      <StateCommunityPresenceCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/1 town hall/i)).toBeTruthy()
  })

  it('subsections collapsed by default; clicking expands', () => {
    mockHalls = [
      {
        id: 't1',
        official_id: 'oid',
        event_date: '2026-01-01',
        city: 'San Jose',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 50,
        source_url: 'https://x',
        source: 'thp',
        external_id: null,
        ingested_at: '2026-01-01',
      },
    ]
    const { getByText, queryByText } = render(
      <StateCommunityPresenceCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(queryByText(/San Jose, CA/i)).toBeNull()
    fireEvent.press(getByText(/Town halls/i))
    expect(getByText(/San Jose, CA/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingHalls = true
    const { getByText } = render(
      <StateCommunityPresenceCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })
})
