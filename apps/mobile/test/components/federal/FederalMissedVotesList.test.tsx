import { render } from '@testing-library/react-native'
import { FederalMissedVotesList } from '@/components/federal/FederalMissedVotesList'

describe('mobile FederalMissedVotesList', () => {
  it('renders empty state when no rows', () => {
    const { getByText } = render(<FederalMissedVotesList rows={[]} />)
    expect(getByText(/No missed votes/i)).toBeTruthy()
  })

  it('renders missed vote row with date + roll call + question', () => {
    const rows = [
      {
        vote_id: 'v1',
        position: 'missed',
        vote: {
          id: 'v1',
          vote_date: '2025-04-22',
          roll_call: 142,
          question: 'On Motion to Recommit',
          source_url: 'https://x',
        },
      },
    ] as never
    const { getByText } = render(<FederalMissedVotesList rows={rows} />)
    expect(getByText(/2025-04-22 · Roll Call #142/)).toBeTruthy()
    expect(getByText('On Motion to Recommit')).toBeTruthy()
    expect(getByText('MISSED')).toBeTruthy()
  })

  it('caps at 25 rows', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      vote_id: `v${i}`,
      position: 'missed',
      vote: {
        id: `v${i}`,
        vote_date: '2025-01-01',
        roll_call: i,
        question: `Question ${i}`,
        source_url: 'https://x',
      },
    })) as never
    const { queryByText } = render(<FederalMissedVotesList rows={rows} />)
    expect(queryByText(/Question 0\b/)).toBeTruthy()
    expect(queryByText(/Question 24\b/)).toBeTruthy()
    expect(queryByText(/Question 25\b/)).toBeNull()
  })
})
