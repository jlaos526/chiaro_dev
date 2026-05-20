import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateVotesEvidence } from '@/components/state/StateVotesEvidence'
import type { StateVoteWithPosition } from '@chiaro/state-bills'

function mkVote(overrides: Partial<StateVoteWithPosition> = {}): StateVoteWithPosition {
  return {
    vote: {
      id: 'v1', openstates_vote_id: 'ocd-vote/x', bill_id: 'b1',
      state: 'CA', session: '20252026', chamber: 'state_senate',
      vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
      source_url: 'https://x', party_vote_split: null,
      created_at: '2025-03-01',
      bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'Test' },
    },
    position: 'yes',
    ...overrides,
  } as unknown as StateVoteWithPosition
}

describe('StateVotesEvidence', () => {
  it('renders vote with date + question + result + position', () => {
    const { getByText } = render(<StateVotesEvidence votes={[mkVote()]} />)
    expect(getByText(/On Passage/)).toBeTruthy()
    expect(getByText(/passed/i)).toBeTruthy()
    expect(getByText(/yes/i)).toBeTruthy()
  })

  it('party_vote_split shown when present', () => {
    const vote = mkVote()
    ;(vote.vote as { party_vote_split: unknown }).party_vote_split = { 'D-yes': 20, 'R-no': 12 }
    const { getByText } = render(<StateVotesEvidence votes={[vote]} />)
    expect(getByText(/D-yes/)).toBeTruthy()
  })

  it('missed-vote position renders distinctly', () => {
    const vote = mkVote({ position: 'not_voting' })
    const { getByText } = render(<StateVotesEvidence votes={[vote]} />)
    expect(getByText(/missed/i)).toBeTruthy()
  })

  it('empty state', () => {
    const { getByText } = render(<StateVotesEvidence votes={[]} />)
    expect(getByText(/no votes/i)).toBeTruthy()
  })

  it('show more toggle for >5 votes', () => {
    const votes = Array.from({ length: 7 }, (_, i) => {
      const v = mkVote()
      ;(v.vote as { id: string }).id = `v${i}`
      ;(v.vote as { question: string }).question = `Q ${i}`
      return v
    })
    const { getByText, queryByText } = render(<StateVotesEvidence votes={votes} />)
    expect(getByText(/Q 0/)).toBeTruthy()
    expect(queryByText(/Q 6/)).toBeNull()
    expect(getByText(/show more/i)).toBeTruthy()
  })
})
