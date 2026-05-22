import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useMetricsMock = vi.fn()
const useStockMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics:           (...args: unknown[]) => useMetricsMock(...args),
    useOfficialStockTransactions: (...args: unknown[]) => useStockMock(...args),
  }
})

import { FederalEthicsAccountabilityCard } from '@/components/federal/FederalEthicsAccountabilityCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('FederalEthicsAccountabilityCard', () => {
  it('renders empty state when no compliance pct + no trades', () => {
    useMetricsMock.mockReturnValue({ data: { stock_act_compliance_pct: null }, isLoading: false, isSuccess: true })
    useStockMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/No stock-trade or STOCK-Act-compliance records/i)).toBeTruthy()
  })

  it('renders summary row with counts and compliance tile', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 95 },
      isLoading: false, isSuccess: true,
    })
    useStockMock.mockReturnValue({
      data: [
        { id: 's1', transaction_date: '2026-01-01', asset_ticker: 'AAPL', asset_name: 'Apple', transaction_type: 'purchase', amount_range_low: 1000, amount_range_high: 15000, days_late: 60, source_url: 'https://x' },
        { id: 's2', transaction_date: '2026-02-01', asset_ticker: 'MSFT', asset_name: 'Microsoft', transaction_type: 'sale', amount_range_low: 1000, amount_range_high: 15000, days_late: 0, source_url: 'https://y' },
      ],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/2 stock trades/i)).toBeTruthy()
    expect(getByText(/1 late filing/i)).toBeTruthy()
    expect(getByText(/95% STOCK Act compliance/i)).toBeTruthy()
  })

  it('Stock trades subsection expands on click', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 80 },
      isLoading: false, isSuccess: true,
    })
    useStockMock.mockReturnValue({
      data: [
        { id: 's1', transaction_date: '2026-01-01', asset_ticker: 'NVDA', asset_name: 'Nvidia', transaction_type: 'purchase', amount_range_low: 1000, amount_range_high: 15000, days_late: 0, source_url: 'https://x' },
      ],
      isLoading: false, isSuccess: true,
    })
    const { getByText, queryByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(queryByText(/NVDA/)).toBeNull()
    fireEvent.click(getByText(/Stock trades/))
    expect(getByText(/NVDA/)).toBeTruthy()
  })

  it('renders loading state', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useStockMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/Loading ethics & accountability/i)).toBeTruthy()
  })
})
