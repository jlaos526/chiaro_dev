import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

let mockStock: unknown[] = []
let mockDisclosures: unknown[] = []
let mockLoadingStock = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateStockTransactions: () => ({
      data: mockStock,
      isLoading: mockLoadingStock,
      isSuccess: !mockLoadingStock,
    }),
    useOfficialStateFinancialDisclosures: () => ({
      data: mockDisclosures,
      isLoading: false,
      isSuccess: true,
    }),
  }
})

import { StateFinancialActivityCard } from '@/components/state/StateFinancialActivityCard'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockStock = []
  mockDisclosures = []
  mockLoadingStock = false
})

describe('mobile StateFinancialActivityCard', () => {
  it('renders empty state when both sources empty', () => {
    const { getByText } = render(
      <StateFinancialActivityCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/No stock or financial-disclosure records on file/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    mockStock = [
      {
        id: 'stk1',
        official_id: 'oid',
        transaction_date: '2026-01-15',
        filing_date: '2026-02-10',
        days_late: 0,
        asset_ticker: 'AAPL',
        asset_name: 'Apple Inc.',
        transaction_type: 'purchase',
        amount_range_low: 1000,
        amount_range_high: 10000,
        state: 'CA',
        source_url: 'https://x',
        source: 'ca-fppc',
        external_id: 'stk-1',
        ingested_at: '2026-01-01',
      },
    ]
    const { getByText } = render(
      <StateFinancialActivityCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/1 stock trade/i)).toBeTruthy()
  })

  it('subsections collapsed by default; clicking expands', () => {
    mockStock = [
      {
        id: 'stk1',
        official_id: 'oid',
        transaction_date: '2026-01-15',
        filing_date: '2026-02-10',
        days_late: 0,
        asset_ticker: 'AAPL',
        asset_name: 'Apple Inc.',
        transaction_type: 'purchase',
        amount_range_low: 1000,
        amount_range_high: 10000,
        state: 'CA',
        source_url: 'https://x',
        source: 'ca-fppc',
        external_id: 'stk-1',
        ingested_at: '2026-01-01',
      },
    ]
    const { getByText, queryByText } = render(
      <StateFinancialActivityCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(queryByText(/AAPL/i)).toBeNull()
    fireEvent.press(getByText(/Stock trades/i))
    expect(getByText(/AAPL/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingStock = true
    const { getByText } = render(
      <StateFinancialActivityCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading financial activity/i)).toBeTruthy()
  })
})
