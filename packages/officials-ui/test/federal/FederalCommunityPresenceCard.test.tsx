import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useOfficesMock = vi.fn()
const useTownHallsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialDistrictOffices: (...args: unknown[]) => useOfficesMock(...args),
    useOfficialTownHalls: (...args: unknown[]) => useTownHallsMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { FederalCommunityPresenceCard } from '../../src/federal/FederalCommunityPresenceCard.tsx'

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
  useOfficesMock.mockReset()
  useTownHallsMock.mockReset()
})

describe('FederalCommunityPresenceCard', () => {
  it('renders loading state', () => {
    useOfficesMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useTownHallsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
    )
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })

  it('renders empty state when no halls + no offices', () => {
    useOfficesMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useTownHallsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
    )
    expect(getByText(/No community-presence data/i)).toBeTruthy()
  })

  it('renders summary with counts', () => {
    useOfficesMock.mockReturnValue({
      data: [
        { id: 'o1', address: '123 Main St', city: 'Anywhere', state: 'CA' },
      ],
      isLoading: false,
      isSuccess: true,
    })
    useTownHallsMock.mockReturnValue({
      data: [
        { id: 'h1', event_date: '2025-06-01', location: 'Town Center' },
        { id: 'h2', event_date: '2025-07-01', location: 'School Gym' },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
    )
    expect(getByText(/2 town halls/i)).toBeTruthy()
    expect(getByText(/1 office/i)).toBeTruthy()
  })

  it('Town halls subsection expands on press', () => {
    useOfficesMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useTownHallsMock.mockReturnValue({
      data: [
        {
          id: 'h1',
          official_id: 'oid',
          event_date: '2025-06-01',
          city: 'Springfield',
          state: 'IL',
          format: 'in_person',
          source_url: 'https://example.com',
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText, queryByText } = wrap(
      <FederalCommunityPresenceCard officialId="oid" congress="119" />,
    )
    expect(queryByText(/Springfield/)).toBeNull()
    fireEvent.click(getByText(/^▸ Town halls/))
    expect(getByText(/Springfield/)).toBeTruthy()
  })
})
