import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useStockMock        = vi.fn()
const useDisclosuresMock  = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateStockTransactions:    (...args: unknown[]) => useStockMock(...args),
    useOfficialStateFinancialDisclosures: (...args: unknown[]) => useDisclosuresMock(...args),
  }
})

import { StateFinancialActivityCard } from '@/components/state/StateFinancialActivityCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const emptyOk = { data: [], isLoading: false, isSuccess: true }

describe('StateFinancialActivityCard', () => {
  it('renders empty state when both hooks return []', () => {
    useStockMock.mockReturnValue(emptyOk)
    useDisclosuresMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/No stock or financial-disclosure records on file/i)).toBeTruthy()
  })

  it('renders summary row with counts + latest disclosure year', () => {
    useStockMock.mockReturnValue({
      data: [{
        id: 's1', official_id: 'oid', state: 'CA',
        transaction_date: '2026-03-15', filing_date: '2026-03-20',
        transaction_type: 'purchase', asset_ticker: 'AAPL', asset_name: 'Apple Inc',
        amount_range_low: 15000, amount_range_high: 50000, days_late: 0,
        source_url: 'https://x', source: 'state-disclosure',
        external_id: 's1', ingested_at: '2026-01-01',
      }],
      isLoading: false, isSuccess: true,
    })
    useDisclosuresMock.mockReturnValue({
      data: [
        {
          id: 'd1', official_id: 'oid', state: 'CA',
          filing_year: 2025, filing_date: '2025-03-01',
          income_source: 'Acme', income_kind: 'consulting',
          amount_range_low: 10000, amount_range_high: 25000,
          source_url: 'https://x', source: 'src',
          external_id: 'd1', ingested_at: '2026-01-01',
        },
        {
          id: 'd2', official_id: 'oid', state: 'CA',
          filing_year: 2024, filing_date: '2024-03-01',
          income_source: 'Older Acme', income_kind: 'consulting',
          amount_range_low: 10000, amount_range_high: 25000,
          source_url: 'https://x', source: 'src',
          external_id: 'd2', ingested_at: '2026-01-01',
        },
      ],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/1 stock trade/i)).toBeTruthy()
    expect(getByText(/2 disclosures \(2025\)/i)).toBeTruthy()
  })

  it('subsections start collapsed; clicking expands', () => {
    useStockMock.mockReturnValue({
      data: [{
        id: 's1', official_id: 'oid', state: 'CA',
        transaction_date: '2026-03-15', filing_date: '2026-03-20',
        transaction_type: 'purchase', asset_ticker: 'AAPL', asset_name: 'Apple Inc',
        amount_range_low: 15000, amount_range_high: 50000, days_late: 0,
        source_url: 'https://x', source: 'state-disclosure',
        external_id: 's1', ingested_at: '2026-01-01',
      }],
      isLoading: false, isSuccess: true,
    })
    useDisclosuresMock.mockReturnValue(emptyOk)
    const { getByText, queryByText, getByRole } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(queryByText(/AAPL/)).toBeNull()
    fireEvent.click(getByRole('button', { name: /Stock trades/i }))
    expect(getByText(/AAPL/)).toBeTruthy()
  })

  it('renders loading state when any hook is loading', () => {
    useStockMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useDisclosuresMock.mockReturnValue(emptyOk)
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/Loading financial activity/i)).toBeTruthy()
  })
})
