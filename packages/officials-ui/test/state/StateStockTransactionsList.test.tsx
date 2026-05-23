import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateStockTransactionsList } from '../../src/state/StateStockTransactionsList.tsx'

describe('StateStockTransactionsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateStockTransactionsList rows={[]} />)
    expect(getByText(/No stock transactions on file/i)).toBeTruthy()
  })

  it('renders row with ticker, type label, and amount range', () => {
    const rows = [{
      id: 's1',
      transaction_date: '2026-04-01',
      transaction_type: 'purchase',
      asset_name: 'Apple Inc.',
      asset_ticker: 'AAPL',
      amount_range_low: 1000,
      amount_range_high: 15000,
      days_late: 0,
      source_url: 'https://x',
    }] as never[]
    const { getByText, queryByText } = render(<StateStockTransactionsList rows={rows} />)
    expect(getByText(/AAPL/)).toBeTruthy()
    expect(getByText(/Purchase/)).toBeTruthy()
    expect(getByText(/\$1k–\$15k/)).toBeTruthy()
    expect(queryByText(/d late/)).toBeNull()
  })

  it('shows days_late chip when > 0', () => {
    const rows = [{
      id: 's2', transaction_date: '2026-03-01', transaction_type: 'sale',
      asset_name: 'Tesla', asset_ticker: 'TSLA',
      amount_range_low: 50000, amount_range_high: 100000,
      days_late: 12, source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateStockTransactionsList rows={rows} />)
    expect(getByText(/12d late/)).toBeTruthy()
  })
})
