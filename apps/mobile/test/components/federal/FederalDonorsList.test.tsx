import { render } from '@testing-library/react-native'
import { FederalDonorsList } from '@/components/federal/FederalDonorsList'

describe('mobile FederalDonorsList', () => {
  it('renders empty state when no donors', () => {
    const { getByText } = render(<FederalDonorsList finance={null} />)
    expect(getByText(/No individual donor data/i)).toBeTruthy()
  })

  it('renders donor rows with formatted amounts', () => {
    const finance = {
      individualDonors: [
        { donor_name: 'Alice Adams', amount: 5500 },
        { donor_name: 'Bob Brown', amount: 1_200_000 },
      ],
    } as never
    const { getByText } = render(<FederalDonorsList finance={finance} />)
    expect(getByText('Alice Adams')).toBeTruthy()
    expect(getByText('$6K')).toBeTruthy()
    expect(getByText('Bob Brown')).toBeTruthy()
    expect(getByText('$1.2M')).toBeTruthy()
  })
})
