import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockMetrics: unknown = null
let mockStock: unknown[] = []
let mockLoadingMetrics = false
let mockLoadingStock = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: mockMetrics, isLoading: mockLoadingMetrics, isSuccess: !mockLoadingMetrics,
    }),
    useOfficialStockTransactions: () => ({
      data: mockStock, isLoading: mockLoadingStock, isSuccess: !mockLoadingStock,
    }),
  }
})

import { FederalEthicsAccountabilityCard } from '@/components/federal/FederalEthicsAccountabilityCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockMetrics = null
  mockStock = []
  mockLoadingMetrics = false
  mockLoadingStock = false
})

describe('mobile FederalEthicsAccountabilityCard', () => {
  it('renders empty state when no metrics + no stock', () => {
    const { getByText } = render(<FederalEthicsAccountabilityCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/No stock-trade or STOCK-Act-compliance/i)).toBeTruthy()
  })

  it('renders STOCK Act compliance tile when pct present', () => {
    mockMetrics = { stock_act_compliance_pct: 92 }
    mockStock = [
      { id: 's1', transaction_date: '2025-01-01', asset_ticker: 'AAPL', asset_name: null, transaction_type: 'purchase', amount_range_low: 1000, amount_range_high: 5000, days_late: 0, source_url: 'https://x' },
    ]
    const { getByText } = render(<FederalEthicsAccountabilityCard officialId="oid" />, { wrapper: wrap })
    expect(getByText('92%')).toBeTruthy()
    expect(getByText(/STOCK Act on-time filing compliance/i)).toBeTruthy()
    expect(getByText(/1 stock trade · 0 late filings · 92% STOCK Act compliance/)).toBeTruthy()
  })

  it('Stock trades subsection expands on press', () => {
    mockMetrics = { stock_act_compliance_pct: 80 }
    mockStock = [
      { id: 's1', transaction_date: '2025-04-15', asset_ticker: 'TSLA', asset_name: null, transaction_type: 'sale', amount_range_low: 50000, amount_range_high: 100000, days_late: 0, source_url: 'https://x' },
    ]
    const { getByText, queryByText } = render(<FederalEthicsAccountabilityCard officialId="oid" />, { wrapper: wrap })
    expect(queryByText(/TSLA/)).toBeNull()
    fireEvent.press(getByText(/Stock trades/i))
    expect(getByText(/TSLA/)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingStock = true
    const { getByText } = render(<FederalEthicsAccountabilityCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/Loading ethics/i)).toBeTruthy()
  })
})
