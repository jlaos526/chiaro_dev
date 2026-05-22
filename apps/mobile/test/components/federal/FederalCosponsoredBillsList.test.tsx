import { render } from '@testing-library/react-native'
import { FederalCosponsoredBillsList } from '@/components/federal/FederalCosponsoredBillsList'

describe('mobile FederalCosponsoredBillsList', () => {
  it('renders empty state when no bills', () => {
    const { getByText } = render(<FederalCosponsoredBillsList rows={[]} />)
    expect(getByText(/No cosponsored bills/i)).toBeTruthy()
  })

  it('renders bill rows with id + status + title', () => {
    const rows = [
      {
        id: 'b1',
        bill_type: 's',
        number: 99,
        title: 'Reform Act',
        short_title: 'Reform',
        status: 'passed',
        source_url: 'https://x',
      },
    ] as never
    const { getByText } = render(<FederalCosponsoredBillsList rows={rows} />)
    expect(getByText(/s 99/)).toBeTruthy()
    expect(getByText('Reform')).toBeTruthy()
    expect(getByText('passed')).toBeTruthy()
  })

  it('caps at 25 rows', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      bill_type: 'hr',
      number: i,
      title: `Cosponsored ${i}`,
      short_title: null,
      status: 'introduced',
      source_url: 'https://x',
    })) as never
    const { queryByText } = render(<FederalCosponsoredBillsList rows={rows} />)
    expect(queryByText(/Cosponsored 0\b/)).toBeTruthy()
    expect(queryByText(/Cosponsored 24\b/)).toBeTruthy()
    expect(queryByText(/Cosponsored 25\b/)).toBeNull()
  })
})
