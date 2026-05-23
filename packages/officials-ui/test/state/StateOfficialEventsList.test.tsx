import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateOfficialEventsList } from '../../src/state/StateOfficialEventsList.tsx'

describe('StateOfficialEventsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateOfficialEventsList rows={[]} />)
    expect(getByText(/No sanctions or tenure events on file/i)).toBeTruthy()
  })

  it('renders event_date, type chip, summary, and outcome', () => {
    const rows = [{
      id: 'e1',
      event_date: '2026-03-01',
      event_type: 'recall_succeeded',
      summary: 'Recalled by 60% vote.',
      outcome: 'Replaced by special election.',
      source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateOfficialEventsList rows={rows} />)
    expect(getByText(/2026-03-01/)).toBeTruthy()
    expect(getByText(/Recall succeeded/)).toBeTruthy()
    expect(getByText(/Recalled by 60% vote/)).toBeTruthy()
    expect(getByText(/Replaced by special election/)).toBeTruthy()
  })

  it('uses fallback label for unknown event_type', () => {
    const rows = [{
      id: 'e1', event_date: '2026-03-01', event_type: 'censure',
      summary: 'X', outcome: null, source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateOfficialEventsList rows={rows} />)
    expect(getByText(/Censure/)).toBeTruthy()
  })
})
