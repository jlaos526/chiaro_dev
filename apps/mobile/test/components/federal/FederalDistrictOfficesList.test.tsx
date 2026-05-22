import { render } from '@testing-library/react-native'
import { FederalDistrictOfficesList } from '@/components/federal/FederalDistrictOfficesList'

describe('mobile FederalDistrictOfficesList', () => {
  it('renders empty state when no offices', () => {
    const { getByText } = render(<FederalDistrictOfficesList rows={[]} />)
    expect(getByText(/No district offices/i)).toBeTruthy()
  })

  it('renders office with city + state + address + phone', () => {
    const rows = [
      {
        id: 'o1',
        address: '500 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        phone: '415-555-1234',
        source_url: 'https://example.com',
      },
    ] as never
    const { getByText } = render(<FederalDistrictOfficesList rows={rows} />)
    expect(getByText(/District Office · San Francisco, CA/)).toBeTruthy()
    // address + phone live in a single Text node separated by a newline.
    expect(getByText(/500 Main St[\s\S]*415-555-1234/)).toBeTruthy()
  })
})
