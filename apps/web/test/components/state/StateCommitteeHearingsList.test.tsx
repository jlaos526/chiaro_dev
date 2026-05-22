import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateCommitteeHearingsList } from '@/components/state/StateCommitteeHearingsList'

describe('StateCommitteeHearingsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateCommitteeHearingsList rows={[]} />)
    expect(getByText(/No committee hearings attended/i)).toBeTruthy()
  })

  it('renders 3 rows + and-N-more button when count > 3', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`,
      openstates_committee_id: 'ocd-org/x',
      state: 'CA',
      session: '20252026',
      hearing_date: `2026-03-0${i + 1}`,
      location: 'Capitol',
      agenda_topic: `Bill SB-${i}`,
      source_url: 'https://x',
      ingested_at: '2026-01-01',
    })) as never[]
    const { getByText, queryByText } = render(<StateCommitteeHearingsList rows={rows} />)
    expect(getByText(/Bill SB-0/)).toBeTruthy()
    expect(getByText(/Bill SB-2/)).toBeTruthy()
    expect(queryByText(/Bill SB-3/)).toBeNull()
    expect(getByText(/and 2 more/i)).toBeTruthy()
  })

  it('expanding and-N-more button shows all rows', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`,
      openstates_committee_id: 'ocd-org/x',
      state: 'CA',
      session: '20252026',
      hearing_date: `2026-03-0${i + 1}`,
      location: 'Capitol',
      agenda_topic: `Bill SB-${i}`,
      source_url: 'https://x',
      ingested_at: '2026-01-01',
    })) as never[]
    const { getByText, queryByText } = render(<StateCommitteeHearingsList rows={rows} />)
    fireEvent.click(getByText(/and 2 more/i))
    expect(getByText(/Bill SB-4/)).toBeTruthy()
    expect(queryByText(/and 2 more/i)).toBeNull()
  })
})
