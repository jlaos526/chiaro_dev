import { render } from '@testing-library/react-native'
import { FederalScorecardRatingsList } from '@/components/federal/FederalScorecardRatingsList'

describe('mobile FederalScorecardRatingsList', () => {
  it('renders empty state when no rows', () => {
    const { getByText } = render(<FederalScorecardRatingsList rows={[]} />)
    expect(getByText(/No scorecard ratings/i)).toBeTruthy()
  })

  it('groups ratings by lean and renders scores', () => {
    const rows = [
      {
        id: 'r1', score: 85,
        org: { name: 'ACLU', lean: 'progressive', issue_area: 'Civil liberties', scoring_max: 100 },
      },
      {
        id: 'r2', score: 42,
        org: { name: 'Heritage', lean: 'conservative', issue_area: 'Limited gov', scoring_max: 100 },
      },
    ] as never
    const { getByText } = render(<FederalScorecardRatingsList rows={rows} />)
    expect(getByText('ACLU')).toBeTruthy()
    expect(getByText('Heritage')).toBeTruthy()
    expect(getByText('85 / 100')).toBeTruthy()
    expect(getByText('42 / 100')).toBeTruthy()
  })
})
