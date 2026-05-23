import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useHallsMock = vi.fn()
const useOfficesMock = vi.fn()
const useHearingsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateTownHalls: (...args: unknown[]) => useHallsMock(...args),
    useOfficialStateDistrictOffices: (...args: unknown[]) => useOfficesMock(...args),
    useOfficialStateCommitteeHearings: (...args: unknown[]) => useHearingsMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateCommunityPresenceCard } from '../../src/state/StateCommunityPresenceCard.tsx'

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
  useHallsMock.mockReset()
  useOfficesMock.mockReset()
  useHearingsMock.mockReset()
})

describe('StateCommunityPresenceCard', () => {
  it('renders loading state', () => {
    useHallsMock.mockReturnValue({ data: undefined, isLoading: true })
    useOfficesMock.mockReturnValue({ data: [], isLoading: false })
    useHearingsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })

  it('renders empty state when no data across all three', () => {
    useHallsMock.mockReturnValue({ data: [], isLoading: false })
    useOfficesMock.mockReturnValue({ data: [], isLoading: false })
    useHearingsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/No community-presence data available/i)).toBeTruthy()
  })

  it('renders summary counts', () => {
    useHallsMock.mockReturnValue({
      data: [{ id: 'h1' }, { id: 'h2' }],
      isLoading: false,
    })
    useOfficesMock.mockReturnValue({
      data: [{ id: 'o1' }],
      isLoading: false,
    })
    useHearingsMock.mockReturnValue({
      data: [{ id: 'm1' }],
      isLoading: false,
    })
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/2 town halls/i)).toBeTruthy()
    expect(getByText(/1 hearing attended/i)).toBeTruthy()
    expect(getByText(/1 office/i)).toBeTruthy()
  })

  it('Town halls subsection expands on press', () => {
    useHallsMock.mockReturnValue({
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
    })
    useOfficesMock.mockReturnValue({ data: [], isLoading: false })
    useHearingsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText, queryByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(queryByText(/Springfield/)).toBeNull()
    fireEvent.click(getByText(/^▸ Town halls/))
    expect(getByText(/Springfield/)).toBeTruthy()
  })
})
