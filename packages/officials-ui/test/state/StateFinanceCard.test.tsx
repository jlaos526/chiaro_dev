import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from '@chiaro/officials'

const useSummaryMock = vi.fn()
const useDonorsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateFinanceSummary: (...args: unknown[]) => useSummaryMock(...args),
    useOfficialStateDonors: (...args: unknown[]) => useDonorsMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateFinanceCard } from '../../src/state/StateFinanceCard.tsx'

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
  useSummaryMock.mockReset()
  useDonorsMock.mockReset()
})

const stateOfficial = {
  id: 'oid',
  chamber: 'state_senate',
  party: 'D',
} as unknown as OfficialWithDistrict

const federalOfficial = {
  id: 'oid',
  chamber: 'federal_senate',
  party: 'D',
} as unknown as OfficialWithDistrict

describe('StateFinanceCard', () => {
  it('returns null when chamber is not state-level', () => {
    useSummaryMock.mockReturnValue({ data: null, isLoading: false })
    useDonorsMock.mockReturnValue({ data: [], isLoading: false })
    const { container } = wrap(<StateFinanceCard official={federalOfficial} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders empty state when no summary', () => {
    useSummaryMock.mockReturnValue({ data: null, isLoading: false })
    useDonorsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateFinanceCard official={stateOfficial} />)
    expect(getByText(/No state finance data/i)).toBeTruthy()
  })

  it('renders summary + source pill', () => {
    useSummaryMock.mockReturnValue({
      data: {
        source: 'ca-cal-access',
        cycle: '2023-2024',
        total_raised: 1_250_000,
        total_disbursed: 800_000,
        small_donor_pct: 12.5,
        in_state_pct: 90,
      },
      isLoading: false,
    })
    useDonorsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateFinanceCard official={stateOfficial} />)
    expect(getByText('Finance')).toBeTruthy()
    expect(getByText('Cal-Access')).toBeTruthy()
    expect(getByText('2023-2024 cycle')).toBeTruthy()
    expect(getByText('$1,250,000')).toBeTruthy()
    expect(getByText('12.5%')).toBeTruthy()
    expect(getByText('90%')).toBeTruthy()
  })

  it('falls back to raw source when label missing', () => {
    useSummaryMock.mockReturnValue({
      data: {
        source: 'unknown-state',
        cycle: '2024',
        total_raised: null,
        total_disbursed: null,
        small_donor_pct: null,
        in_state_pct: null,
      },
      isLoading: false,
    })
    useDonorsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText, getAllByText } = wrap(<StateFinanceCard official={stateOfficial} />)
    expect(getByText('unknown-state')).toBeTruthy()
    // null fields render as em-dash
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})
