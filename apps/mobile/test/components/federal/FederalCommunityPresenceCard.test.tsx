import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockOffices: unknown[] = []
let mockHalls: unknown[] = []
let mockLoadingOffices = false
let mockLoadingHalls = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialDistrictOffices: () => ({
      data: mockOffices, isLoading: mockLoadingOffices, isSuccess: !mockLoadingOffices,
    }),
    useOfficialTownHalls: () => ({
      data: mockHalls, isLoading: mockLoadingHalls, isSuccess: !mockLoadingHalls,
    }),
  }
})

import { FederalCommunityPresenceCard } from '@/components/federal/FederalCommunityPresenceCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockOffices = []
  mockHalls = []
  mockLoadingOffices = false
  mockLoadingHalls = false
})

describe('mobile FederalCommunityPresenceCard', () => {
  it('renders empty state when no offices + no halls', () => {
    const { getByText } = render(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(getByText(/No community-presence data/i)).toBeTruthy()
  })

  it('renders summary line with counts', () => {
    mockOffices = [{ id: 'o1', address: '1 Main', city: 'SF', state: 'CA', zip: null, phone: null, source_url: '' }]
    mockHalls = [
      { id: 'h1', event_date: '2025-09-01', city: 'SF', state: 'CA', format: 'in_person', attendance_estimate: 100, source_url: '' },
      { id: 'h2', event_date: '2025-09-15', city: 'Oakland', state: 'CA', format: 'virtual', attendance_estimate: null, source_url: '' },
    ]
    const { getByText } = render(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(getByText(/2 town halls · 1 office/)).toBeTruthy()
  })

  it('Town halls subsection expands on press', () => {
    mockHalls = [
      { id: 'h1', event_date: '2025-09-01', city: 'Berkeley', state: 'CA', format: 'in_person', attendance_estimate: 50, source_url: 'https://x' },
    ]
    const { getByText, queryByText } = render(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(queryByText(/Berkeley/)).toBeNull()
    fireEvent.press(getByText(/Town halls/i))
    expect(getByText(/Berkeley/)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingOffices = true
    const { getByText } = render(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })
})
