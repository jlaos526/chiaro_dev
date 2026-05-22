import { render } from '@testing-library/react-native'
import { FederalSponsoredBillsList } from '@/components/federal/FederalSponsoredBillsList'

describe('mobile FederalSponsoredBillsList', () => {
  it('renders empty state when no bills', () => {
    const { getByText } = render(<FederalSponsoredBillsList rows={[]} />)
    expect(getByText(/No sponsored bills/i)).toBeTruthy()
  })

  it('renders bill rows with id + status + title', () => {
    const rows = [
      {
        id: 'b1',
        bill_type: 'hr',
        number: 1234,
        title: 'Climate Action Act',
        short_title: null,
        status: 'introduced',
        source_url: 'https://x',
      },
    ] as never
    const { getByText } = render(<FederalSponsoredBillsList rows={rows} />)
    expect(getByText(/hr 1234/)).toBeTruthy()
    expect(getByText(/Climate Action Act/)).toBeTruthy()
    expect(getByText('introduced')).toBeTruthy()
  })

  it('caps at 25 rows', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      id: `b${i}`,
      bill_type: 'hr',
      number: i,
      title: `Bill ${i}`,
      short_title: null,
      status: 'introduced',
      source_url: 'https://x',
    })) as never
    const { queryByText } = render(<FederalSponsoredBillsList rows={rows} />)
    expect(queryByText(/Bill 0\b/)).toBeTruthy()
    expect(queryByText(/Bill 24\b/)).toBeTruthy()
    expect(queryByText(/Bill 25\b/)).toBeNull()
  })
})
