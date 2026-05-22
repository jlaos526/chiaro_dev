import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useComplaintsMock = vi.fn()
const useEventsMock     = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateEthicsComplaints: (...args: unknown[]) => useComplaintsMock(...args),
    useOfficialStateOfficialEvents:   (...args: unknown[]) => useEventsMock(...args),
  }
})

import { StateConductCard } from '@/components/state/StateConductCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const emptyOk = { data: [], isLoading: false, isSuccess: true }

describe('StateConductCard', () => {
  it('renders empty state when both hooks return []', () => {
    useComplaintsMock.mockReturnValue(emptyOk)
    useEventsMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateConductCard officialId="oid" />)
    expect(getByText(/No ethics complaints or conduct events on record/i)).toBeTruthy()
  })

  it('renders summary row with complaint count + open subcount + event count', () => {
    useComplaintsMock.mockReturnValue({
      data: [
        {
          id: 'c1', official_id: 'oid', state: 'CA',
          complaint_date: '2026-02-10', status: 'open',
          summary: 'Pending review.', disposition: null,
          source_url: 'https://x', source: 'state-ethics',
          external_id: 'c1', ingested_at: '2026-01-01',
        },
        {
          id: 'c2', official_id: 'oid', state: 'CA',
          complaint_date: '2026-01-10', status: 'dismissed',
          summary: 'Dismissed.', disposition: null,
          source_url: 'https://x', source: 'state-ethics',
          external_id: 'c2', ingested_at: '2026-01-01',
        },
      ],
      isLoading: false, isSuccess: true,
    })
    useEventsMock.mockReturnValue({
      data: [{
        id: 'e1', official_id: 'oid', state: 'CA',
        event_date: '2026-04-01', event_type: 'censure',
        summary: 'Censured.', outcome: null,
        source_url: 'https://x', source: 'ballotpedia',
        external_id: 'e1', ingested_at: '2026-01-01',
      }],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<StateConductCard officialId="oid" />)
    expect(getByText(/2 complaints \(1 open\)/i)).toBeTruthy()
    expect(getByText(/1 event/i)).toBeTruthy()
  })

  it('subsections start collapsed; clicking expands', () => {
    useComplaintsMock.mockReturnValue({
      data: [{
        id: 'c1', official_id: 'oid', state: 'CA',
        complaint_date: '2026-02-10', status: 'open',
        summary: 'Allegation pending review.', disposition: null,
        source_url: 'https://x', source: 'state-ethics',
        external_id: 'c1', ingested_at: '2026-01-01',
      }],
      isLoading: false, isSuccess: true,
    })
    useEventsMock.mockReturnValue(emptyOk)
    const { getByText, queryByText, getByRole } = wrap(<StateConductCard officialId="oid" />)
    expect(queryByText(/Allegation pending review\./)).toBeNull()
    fireEvent.click(getByRole('button', { name: /Ethics complaints/i }))
    expect(getByText(/Allegation pending review\./)).toBeTruthy()
  })

  it('renders loading state when any hook is loading', () => {
    useComplaintsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useEventsMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateConductCard officialId="oid" />)
    expect(getByText(/Loading conduct records/i)).toBeTruthy()
  })
})
