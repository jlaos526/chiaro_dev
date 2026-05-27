import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const useMetricsMock = vi.fn()
const useStockMock = vi.fn()
const useHoldingsMock = vi.fn()
const useOtherMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
    useOfficialStockTransactions: (...args: unknown[]) => useStockMock(...args),
    useOfficialHoldings: (...args: unknown[]) => useHoldingsMock(...args),
    useOfficialDisclosureOther: (...args: unknown[]) => useOtherMock(...args),
  }
})

const EMPTY_HOOK = { data: [], isLoading: false, isSuccess: true }

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
  useHoldingsMock.mockReset()
  useOtherMock.mockReset()
})

// Each existing test only set metrics + stock; default holdings/other to empty.
beforeEach(() => {
  useHoldingsMock.mockReturnValue(EMPTY_HOOK)
  useOtherMock.mockReturnValue(EMPTY_HOOK)
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

  it('renders Holdings + Other Disclosures subsections with row counts', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 95 },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue(EMPTY_HOOK)
    useHoldingsMock.mockReturnValue({
      data: [
        { id: 'h1', filing_year: 2024, asset_name: 'Apple', asset_ticker: 'AAPL',
          asset_type: 'stock', value_min: 1000, value_max: 15000,
          source: 'house-fd', external_id: null, source_url: 'https://x',
          official_id: 'oid', income_type: null, income_min: null, income_max: null,
          ingested_at: '2026-01-01' },
        { id: 'h2', filing_year: 2024, asset_name: 'Tesla', asset_ticker: 'TSLA',
          asset_type: 'stock', value_min: 50000, value_max: 100000,
          source: 'house-fd', external_id: null, source_url: 'https://x',
          official_id: 'oid', income_type: null, income_min: null, income_max: null,
          ingested_at: '2026-01-01' },
      ],
      isLoading: false,
      isSuccess: true,
    })
    useOtherMock.mockReturnValue({
      data: [
        { id: 'o1', filing_year: 2024, category: 'gift', description: 'Tickets',
          source_party: 'Lobby Inc', value_min: 500, value_max: 1000, value_text: null,
          source: 'house-fd', external_id: null, source_url: 'https://x',
          official_id: 'oid', ingested_at: '2026-01-01' },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<FederalEthicsAccountabilityCard officialId="oid" />)
    expect(getByText(/^▸ Holdings \(2\)/)).toBeTruthy()
    expect(getByText(/^▸ Other Disclosures \(1\)/)).toBeTruthy()
  })

  it('Holdings subsection expands on press', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 90 },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue(EMPTY_HOOK)
    useHoldingsMock.mockReturnValue({
      data: [
        { id: 'h1', filing_year: 2024, asset_name: 'Apple Inc.', asset_ticker: 'AAPL',
          asset_type: 'stock', value_min: 1000, value_max: 15000,
          source: 'house-fd', external_id: null, source_url: 'https://x',
          official_id: 'oid', income_type: null, income_min: null, income_max: null,
          ingested_at: '2026-01-01' },
      ],
      isLoading: false,
      isSuccess: true,
    })
    useOtherMock.mockReturnValue(EMPTY_HOOK)
    const { getByText, queryByText } = wrap(
      <FederalEthicsAccountabilityCard officialId="oid" />,
    )
    expect(queryByText('AAPL')).toBeNull()
    fireEvent.click(getByText(/^▸ Holdings/))
    expect(getByText('AAPL')).toBeTruthy()
  })

  it('Other Disclosures subsection expands on press', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: 90 },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue(EMPTY_HOOK)
    useHoldingsMock.mockReturnValue(EMPTY_HOOK)
    useOtherMock.mockReturnValue({
      data: [
        { id: 'o1', filing_year: 2024, category: 'travel', description: 'Davos trip',
          source_party: 'WEF', value_min: 5000, value_max: 10000, value_text: null,
          source: 'house-fd', external_id: null, source_url: 'https://x',
          official_id: 'oid', ingested_at: '2026-01-01' },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText, queryByText } = wrap(
      <FederalEthicsAccountabilityCard officialId="oid" />,
    )
    expect(queryByText('Davos trip')).toBeNull()
    fireEvent.click(getByText(/^▸ Other Disclosures/))
    expect(getByText('Davos trip')).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalEthicsAccountabilityCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useMetricsMock.mockReturnValue({
      data: { stock_act_compliance_pct: null },
      isLoading: false,
      isSuccess: true,
    })
    useStockMock.mockReturnValue(EMPTY_HOOK)
    useHoldingsMock.mockReturnValue(EMPTY_HOOK)
    useOtherMock.mockReturnValue(EMPTY_HOOK)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const renderWith = (wrapper: typeof lightWrapper) =>
      render(
        <ChiaroClientProvider client={mockClient}>
          <QueryClientProvider client={qc}>
            <FederalEthicsAccountabilityCard officialId="oid" />
          </QueryClientProvider>
        </ChiaroClientProvider>,
        { wrapper },
      )
    expect(() => renderWith(lightWrapper)).not.toThrow()
    expect(() => renderWith(darkWrapper)).not.toThrow()
  })
})
