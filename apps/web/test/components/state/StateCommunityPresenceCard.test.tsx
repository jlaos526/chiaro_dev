import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useTownHallsMock          = vi.fn()
const useDistrictOfficesMock    = vi.fn()
const useCommitteeHearingsMock  = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateTownHalls:         (...args: unknown[]) => useTownHallsMock(...args),
    useOfficialStateDistrictOffices:   (...args: unknown[]) => useDistrictOfficesMock(...args),
    useOfficialStateCommitteeHearings: (...args: unknown[]) => useCommitteeHearingsMock(...args),
  }
})

import { StateCommunityPresenceCard } from '@/components/state/StateCommunityPresenceCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const emptyOk = { data: [], isLoading: false, isSuccess: true }

describe('StateCommunityPresenceCard', () => {
  it('renders empty state when all 3 hooks return []', () => {
    useTownHallsMock.mockReturnValue(emptyOk)
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    useCommitteeHearingsMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/No community-presence data available/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    useTownHallsMock.mockReturnValue({
      data: [{
        id: 't1', official_id: 'oid', event_date: '2026-01-01',
        city: null, state: 'CA', format: null, attendance_estimate: null,
        source_url: 'https://x', source: 'townhallproject', external_id: null,
        ingested_at: '2026-01-01',
      }],
      isLoading: false, isSuccess: true,
    })
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    useCommitteeHearingsMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/1 town hall/i)).toBeTruthy()
    expect(getByText(/0 hearings attended/i)).toBeTruthy()
    expect(getByText(/0 offices/i)).toBeTruthy()
  })

  it('subsections start collapsed; clicking expands', () => {
    useTownHallsMock.mockReturnValue({
      data: [{
        id: 't1', official_id: 'oid', event_date: '2026-01-01',
        city: 'San Jose', state: 'CA', format: 'hybrid', attendance_estimate: 50,
        source_url: 'https://x', source: 'thp', external_id: null,
        ingested_at: '2026-01-01',
      }],
      isLoading: false, isSuccess: true,
    })
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    useCommitteeHearingsMock.mockReturnValue(emptyOk)
    const { getByText, queryByText, getByRole } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(queryByText(/San Jose, CA/i)).toBeNull()
    fireEvent.click(getByRole('button', { name: /Town halls/i }))
    expect(getByText(/San Jose, CA/i)).toBeTruthy()
  })

  it('renders loading state when any hook is loading', () => {
    useTownHallsMock.mockReturnValue({
      data: undefined, isLoading: true, isSuccess: false,
    })
    useDistrictOfficesMock.mockReturnValue(emptyOk)
    useCommitteeHearingsMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })
})
