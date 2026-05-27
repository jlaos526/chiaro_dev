import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalStockTransactionsList } from '../../src/federal/FederalStockTransactionsList.tsx'

describe('FederalStockTransactionsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalStockTransactionsList rows={[]} />)
    expect(getByText(/No stock transactions on file/i)).toBeTruthy()
  })

  it('renders row with type label and amount range', () => {
    const rows = [{
      id: 's1', official_id: 'oid',
      transaction_date: '2026-04-01', transaction_type: 'purchase',
      asset_name: 'Apple Inc.', asset_ticker: 'AAPL',
      amount_range_low: 1000, amount_range_high: 15000,
      days_late: 0, filing_date: '2026-04-15',
      source_url: 'https://x', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText, queryByText } = render(<FederalStockTransactionsList rows={rows} />)
    expect(getByText(/AAPL/)).toBeTruthy()
    expect(getByText(/Purchase/)).toBeTruthy()
    expect(getByText(/\$1k–\$15k/)).toBeTruthy()
    expect(queryByText(/d late/)).toBeNull()
  })

  it('shows days_late warning chip when > 0 (45-day federal deadline)', () => {
    const rows = [{
      id: 's2', official_id: 'oid',
      transaction_date: '2026-03-01', transaction_type: 'sale',
      asset_name: 'Tesla', asset_ticker: 'TSLA',
      amount_range_low: 50000, amount_range_high: 100000,
      days_late: 12, filing_date: '2026-04-26',
      source_url: 'https://x', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<FederalStockTransactionsList rows={rows} />)
    expect(getByText(/12d late/)).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalStockTransactionsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows = [{
      id: 's1', official_id: 'oid',
      transaction_date: '2026-04-01', transaction_type: 'purchase',
      asset_name: 'Apple Inc.', asset_ticker: 'AAPL',
      amount_range_low: 1000, amount_range_high: 15000,
      days_late: 0, filing_date: '2026-04-15',
      source_url: 'https://x', ingested_at: '2026-01-01',
    }] as never[]
    expect(() =>
      render(<FederalStockTransactionsList rows={[]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalStockTransactionsList rows={rows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
