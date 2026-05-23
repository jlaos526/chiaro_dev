import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalMissedVotesList } from '../../src/federal/FederalMissedVotesList.tsx'

describe('FederalMissedVotesList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalMissedVotesList rows={[]} />)
    expect(getByText(/No missed votes in current Congress/i)).toBeTruthy()
  })

  it('renders roll call + date + question + MISSED chip', () => {
    const rows = [{
      vote_id: 'v1', position: 'not_voting',
      vote: {
        id: 'v1', roll_call: 42, vote_date: '2026-04-15',
        question: 'On Passage', result: 'Passed',
        chamber: 'federal_house', congress: '119', session: 2,
        bill_id: null, source_url: 'https://x', ingested_at: '2026-01-01',
      },
    }] as never[]
    const { getByText } = render(<FederalMissedVotesList rows={rows} />)
    expect(getByText(/Roll Call #42/)).toBeTruthy()
    expect(getByText(/2026-04-15/)).toBeTruthy()
    expect(getByText(/On Passage/)).toBeTruthy()
    expect(getByText(/MISSED/)).toBeTruthy()
  })
})
