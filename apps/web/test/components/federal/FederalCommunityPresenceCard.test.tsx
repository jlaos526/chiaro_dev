import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useDistrictOfficesMock = vi.fn()
const useTownHallsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialDistrictOffices: (...args: unknown[]) => useDistrictOfficesMock(...args),
    useOfficialTownHalls:       (...args: unknown[]) => useTownHallsMock(...args),
  }
})

import { FederalCommunityPresenceCard } from '@/components/federal/FederalCommunityPresenceCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const emptyOk = { data: [], isLoading: false, isSuccess: true }

describe('FederalCommunityPresenceCard', () => {
  it('renders empty state when both hooks return []', () => {
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    useTownHallsMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<FederalCommunityPresenceCard officialId="oid" congress="119" />)
    expect(getByText(/No community-presence data available/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    useTownHallsMock.mockReturnValue({
      data: [
        { id: 't1', event_date: '2026-01-15', city: 'Oakland', state: 'CA', format: 'in_person', attendance_estimate: 80, source_url: 'https://x' },
      ],
      isLoading: false, isSuccess: true,
    })
    useDistrictOfficesMock.mockReturnValue({
      data: [
        { id: 'o1', city: 'Oakland', state: 'CA', address: '123 Main', zip: '94601', phone: '510-555-1212' },
        { id: 'o2', city: 'Berkeley', state: 'CA', address: '456 Elm', zip: '94704', phone: null },
      ],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<FederalCommunityPresenceCard officialId="oid" congress="119" />)
    expect(getByText(/1 town hall/i)).toBeTruthy()
    expect(getByText(/2 offices/i)).toBeTruthy()
  })

  it('subsections start collapsed; clicking expands', () => {
    useTownHallsMock.mockReturnValue({
      data: [
        { id: 't1', event_date: '2026-01-15', city: 'San Jose', state: 'CA', format: 'hybrid', attendance_estimate: 60, source_url: 'https://x' },
      ],
      isLoading: false, isSuccess: true,
    })
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    const { getByText, queryByText } = wrap(<FederalCommunityPresenceCard officialId="oid" congress="119" />)
    expect(queryByText(/San Jose, CA/)).toBeNull()
    fireEvent.click(getByText(/Town halls/))
    expect(getByText(/San Jose, CA/)).toBeTruthy()
  })

  it('renders loading state when any hook is loading', () => {
    useTownHallsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<FederalCommunityPresenceCard officialId="oid" congress="119" />)
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })
})
