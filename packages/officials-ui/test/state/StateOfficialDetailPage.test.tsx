import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from '@chiaro/officials'

// Mock every hook touched by the 6 composed cards to a quick no-op shape.
// vi.mock factories are hoisted — keep them self-contained (no outer refs).
vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  const list = () => ({ data: [], isLoading: false })
  const single = () => ({ data: null, isLoading: false })
  return {
    ...actual,
    useOfficialMetrics: single,
    useOfficialStateFinanceSummary: single,
    useOfficialStateDonors: list,
    useOfficialStateScorecardRatings: list,
    useOfficialStateTownHalls: list,
    useOfficialStateDistrictOffices: list,
    useOfficialStateCommitteeHearings: list,
    useOfficialStateEthicsComplaints: list,
    useOfficialStateOfficialEvents: list,
    useOfficialStateStockTransactions: list,
    useOfficialStateFinancialDisclosures: list,
  }
})

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  const list = () => ({ data: [], isLoading: false })
  return {
    ...actual,
    useOfficialSponsoredStateBills: list,
    useOfficialStateVotes: list,
    useOfficialStateVotesOnSubject: list,
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateOfficialDetailPage } from '../../src/state/StateOfficialDetailPage.tsx'

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
  vi.restoreAllMocks()
})

const stateOfficial = {
  id: 'oid',
  full_name: 'Jane Doe',
  party: 'D',
  chamber: 'state_house',
  district_code: 'CA-12',
  district: { code: 'CA-12' },
  title: null,
} as unknown as OfficialWithDistrict

describe('StateOfficialDetailPage', () => {
  it('renders bio header with name, party, district', () => {
    const { getByText, getAllByText } = wrap(
      <StateOfficialDetailPage official={stateOfficial} offices={[]} />,
    )
    expect(getByText('Jane Doe')).toBeTruthy()
    // "State Representative" appears in both the bio header and the
    // StateServiceRecordCard subtitle — both are expected.
    expect(getAllByText('State Representative').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('D').length).toBeGreaterThanOrEqual(1)
    expect(getByText('CA-12')).toBeTruthy()
  })

  it('renders offices section when offices supplied', () => {
    const offices = [
      {
        id: 'o1',
        official_id: 'oid',
        address: '123 Main St, San Jose, CA 95113',
        phone: '(408) 555-1212',
      },
    ] as unknown as Array<{ id: string; official_id: string; address: string; phone: string }>
    const { getByText } = wrap(
      <StateOfficialDetailPage
        official={stateOfficial}
        offices={offices as never}
      />,
    )
    expect(getByText('Offices')).toBeTruthy()
    expect(getByText(/123 Main St/i)).toBeTruthy()
    expect(getByText(/\(408\) 555-1212/)).toBeTruthy()
  })

  it('shows title when present', () => {
    const officialWithTitle = { ...stateOfficial, title: 'Speaker of the House' }
    const { getByText, getByTestId } = wrap(
      <StateOfficialDetailPage official={officialWithTitle} offices={[]} />,
    )
    expect(getByText('Speaker of the House')).toBeTruthy()
    expect(getByTestId('official-title')).toBeTruthy()
  })

  it('omits offices section when empty', () => {
    const { queryByTestId } = wrap(
      <StateOfficialDetailPage official={stateOfficial} offices={[]} />,
    )
    expect(queryByTestId('offices-section')).toBeNull()
  })
})
