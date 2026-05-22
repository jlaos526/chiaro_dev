import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateStockTransactionsList } from '@/components/state/StateStockTransactionsList'

describe('StateStockTransactionsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateStockTransactionsList rows={[]} />)
    expect(getByText(/No stock transactions on file/i)).toBeTruthy()
  })

  it('renders rows with ticker, type, amount range', () => {
    const rows = [{
      id: 's1', official_id: 'oid', state: 'CA',
      transaction_date: '2026-03-15', filing_date: '2026-03-20',
      transaction_type: 'purchase', asset_ticker: 'AAPL', asset_name: 'Apple Inc',
      amount_range_low: 15000, amount_range_high: 50000,
      days_late: 0,
      source_url: 'https://x', source: 'state-disclosure',
      external_id: 's1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateStockTransactionsList rows={rows} />)
    expect(getByText(/AAPL/)).toBeTruthy()
    expect(getByText(/Purchase/)).toBeTruthy()
    expect(getByText(/\$15k–\$50k/)).toBeTruthy()
  })

  it('renders Nd-late warning chip when days_late > 0', () => {
    const rows = [{
      id: 's1', official_id: 'oid', state: 'CA',
      transaction_date: '2026-03-15', filing_date: '2026-04-30',
      transaction_type: 'sale', asset_ticker: 'TSLA', asset_name: null,
      amount_range_low: 1000, amount_range_high: 15000,
      days_late: 12,
      source_url: 'https://x', source: 'state-disclosure',
      external_id: 's1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateStockTransactionsList rows={rows} />)
    expect(getByText(/12d late/)).toBeTruthy()
  })
})
