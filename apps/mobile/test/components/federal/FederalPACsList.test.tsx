import { render } from '@testing-library/react-native'
import { FederalPACsList } from '@/components/federal/FederalPACsList'

describe('mobile FederalPACsList', () => {
  it('renders empty state when no PACs', () => {
    const { getByText } = render(<FederalPACsList finance={null} />)
    expect(getByText(/No PAC contribution data/i)).toBeTruthy()
  })

  it('renders PAC rows with formatted amounts', () => {
    const finance = {
      pacs: [
        { pac_name: 'Acme PAC', amount: 10_000 },
        { pac_name: 'Mega PAC', amount: 2_500_000 },
      ],
    } as never
    const { getByText } = render(<FederalPACsList finance={finance} />)
    expect(getByText('Acme PAC')).toBeTruthy()
    expect(getByText('$10K')).toBeTruthy()
    expect(getByText('Mega PAC')).toBeTruthy()
    expect(getByText('$2.5M')).toBeTruthy()
  })
})
