import { render } from '@testing-library/react-native'
import { FederalKPIList } from '@/components/federal/FederalKPIList'

describe('mobile FederalKPIList', () => {
  it('renders empty state when metrics null', () => {
    const { getByText } = render(<FederalKPIList metrics={null} />)
    expect(getByText(/No KPI data/i)).toBeTruthy()
  })

  it('renders 5 tiles with values for House (no senate guard)', () => {
    const metrics = {
      bills_sponsored_count: 12,
      bills_cosponsored_count: 45,
      attendance_pct: 96,
      subject_breadth: 8,
      lives_in_district: true,
    } as never
    const { getByText } = render(<FederalKPIList metrics={metrics} />)
    expect(getByText('12')).toBeTruthy()
    expect(getByText('45')).toBeTruthy()
    expect(getByText('96%')).toBeTruthy()
    expect(getByText('8')).toBeTruthy()
    expect(getByText('✓ Yes')).toBeTruthy()
    expect(getByText('Lives in district')).toBeTruthy()
  })

  it('hides "Lives in district" tile when hideLivesInDistrict (Senate)', () => {
    const metrics = {
      bills_sponsored_count: 1,
      bills_cosponsored_count: 2,
      attendance_pct: 90,
      subject_breadth: 3,
      lives_in_district: false,
    } as never
    const { queryByText } = render(<FederalKPIList metrics={metrics} hideLivesInDistrict />)
    expect(queryByText('Lives in district')).toBeNull()
  })
})
