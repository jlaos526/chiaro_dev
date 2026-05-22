import { render } from '@testing-library/react-native'
import { FederalStockTransactionsList } from '@/components/federal/FederalStockTransactionsList'

describe('mobile FederalStockTransactionsList', () => {
  it('renders empty state when no rows', () => {
    const { getByText } = render(<FederalStockTransactionsList rows={[]} />)
    expect(getByText(/No stock transactions/i)).toBeTruthy()
  })

  it('renders transaction row with type + amount range', () => {
    const rows = [
      {
        id: 's1',
        transaction_date: '2025-03-10',
        asset_ticker: 'AAPL',
        asset_name: 'Apple Inc.',
        transaction_type: 'purchase',
        amount_range_low: 15000,
        amount_range_high: 50000,
        days_late: 42,
        source_url: 'https://example.com',
      },
    ] as never
    const { getByText } = render(<FederalStockTransactionsList rows={rows} />)
    expect(getByText(/2025-03-10 · AAPL/)).toBeTruthy()
    expect(getByText(/Purchase · \$15k–\$50k/)).toBeTruthy()
    expect(getByText('42d late')).toBeTruthy()
  })
})
