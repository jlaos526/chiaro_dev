import { render } from '@testing-library/react-native'
import { FederalTownHallsList } from '@/components/federal/FederalTownHallsList'

describe('mobile FederalTownHallsList', () => {
  it('renders empty state when no rows', () => {
    const { getByText } = render(<FederalTownHallsList rows={[]} />)
    expect(getByText(/No town halls/i)).toBeTruthy()
  })

  it('renders row with date + city + format', () => {
    const rows = [
      {
        id: 't1',
        event_date: '2025-09-15',
        city: 'Sacramento',
        state: 'CA',
        format: 'in_person',
        attendance_estimate: 250,
        source_url: 'https://example.com/th',
      },
    ] as never
    const { getByText } = render(<FederalTownHallsList rows={rows} />)
    expect(getByText(/2025-09-15/)).toBeTruthy()
    expect(getByText(/Sacramento, CA/)).toBeTruthy()
    expect(getByText(/In person · ~250 attendees/)).toBeTruthy()
  })
})
