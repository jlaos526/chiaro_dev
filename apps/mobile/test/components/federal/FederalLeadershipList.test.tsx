import { render } from '@testing-library/react-native'
import { FederalLeadershipList } from '@/components/federal/FederalLeadershipList'

describe('mobile FederalLeadershipList', () => {
  it('renders empty state when no leadership', () => {
    const { getByText } = render(<FederalLeadershipList rows={[]} />)
    expect(getByText(/No leadership positions/i)).toBeTruthy()
  })

  it('renders rows with role + date range', () => {
    const rows = [
      { id: 'l1', role: 'Chair, Energy and Commerce', start_date: '2023-01-03', end_date: null },
      { id: 'l2', role: 'Ranking Member, Judiciary', start_date: '2021-01-03', end_date: '2022-12-31' },
    ] as never
    const { getByText } = render(<FederalLeadershipList rows={rows} />)
    expect(getByText('Chair, Energy and Commerce')).toBeTruthy()
    expect(getByText(/2023-01-03 – present/)).toBeTruthy()
    expect(getByText(/2021-01-03 – 2022-12-31/)).toBeTruthy()
  })
})
