import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useMetricsMock = vi.fn()
const useStockMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
    useOfficialStockTransactions: (...args: unknown[]) => useStockMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { FederalEthicsAccountabilityCard } from '../../src/federal/FederalEthicsAccountabilityCard.tsx'

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
  useMetricsMock.mockReset()
  useStockMock.mockReset()
})

describe('FederalEthicsAccountabilityCard', () => {
  it('renders loading state', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useStockMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/Loading ethics & accountability/i)).toBeTruthy()
  })

  it('renders empty state when no compliance + no stock', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: null },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/No stock-trade or STOCK-Act-compliance records/i)).toBeTruthy()
  })

  it('renders compliance tile when compliance pct present', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 95 },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue({
      data: [{ id: 't1', days_late: 0 }],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText('95%')).toBeTruthy()
    expect(getByText(/STOCK Act on-time filing compliance/i)).toBeTruthy()
  })

  it('counts late filings in summary', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 60 },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue({
      data: [
        { id: 't1', days_late: 0 },
        { id: 't2', days_late: 50 },
        { id: 't3', days_late: 100 },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/3 stock trades/i)).toBeTruthy()
    expect(getByText(/2 late filings/i)).toBeTruthy()
    expect(getByText(/60% STOCK Act compliance/i)).toBeTruthy()
  })

  it('Stock trades subsection expands on press', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 90 },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue({
      data: [
        {
          id: 't1',
          official_id: 'oid',
          asset_ticker: 'AAPL',
          asset_name: 'Apple Inc.',
          transaction_type: 'purchase',
          amount_range_low: 1000,
          amount_range_high: 15000,
          transaction_date: '2025-03-01',
          disclosure_date: '2025-04-01',
          days_late: 0,
          source_url: 'https://example.com',
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText, queryByText } = wrap(
      <FederalEthicsAccountabilityCard officialId="oid" />,
    )
    expect(queryByText(/AAPL/)).toBeNull()
    fireEvent.click(getByText(/^▸ Stock trades/))
    expect(getByText(/AAPL/)).toBeTruthy()
  })
})
