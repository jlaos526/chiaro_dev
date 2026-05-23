import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useStockMock = vi.fn()
const useDisclosuresMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateStockTransactions: (...args: unknown[]) => useStockMock(...args),
    useOfficialStateFinancialDisclosures: (...args: unknown[]) => useDisclosuresMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateFinancialActivityCard } from '../../src/state/StateFinancialActivityCard.tsx'

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
  useStockMock.mockReset()
  useDisclosuresMock.mockReset()
})

describe('StateFinancialActivityCard', () => {
  it('renders loading', () => {
    useStockMock.mockReturnValue({ data: undefined, isLoading: true })
    useDisclosuresMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/Loading financial activity/i)).toBeTruthy()
  })

  it('renders empty when no stock and no disclosures', () => {
    useStockMock.mockReturnValue({ data: [], isLoading: false })
    useDisclosuresMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/No stock or financial-disclosure records/i)).toBeTruthy()
  })

  it('renders summary with counts + latest year', () => {
    useStockMock.mockReturnValue({
      data: [{ id: 's1' }, { id: 's2' }],
      isLoading: false,
    })
    useDisclosuresMock.mockReturnValue({
      data: [{ id: 'd1', filing_year: 2024 }],
      isLoading: false,
    })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/2 stock trades/i)).toBeTruthy()
    expect(getByText(/1 disclosure \(2024\)/i)).toBeTruthy()
  })

  it('Financial disclosures subsection expands on press', () => {
    useStockMock.mockReturnValue({ data: [], isLoading: false })
    useDisclosuresMock.mockReturnValue({
      data: [
        {
          id: 'd1',
          official_id: 'oid',
          filing_year: 2024,
          income_source: 'Acme Consulting Group',
          income_kind: 'consulting',
          amount_range_low: 10_000,
          amount_range_high: 50_000,
        },
      ],
      isLoading: false,
    })
    const { getByText, queryByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(queryByText(/Acme Consulting/)).toBeNull()
    fireEvent.click(getByText(/^▸ Financial disclosures/))
    expect(getByText(/Acme Consulting/)).toBeTruthy()
  })
})
