import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateTownHallsList } from '@/components/state/StateTownHallsList'

describe('StateTownHallsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateTownHallsList rows={[]} />)
    expect(getByText(/No town halls in the past 12 months/i)).toBeTruthy()
  })

  it('renders rows with format and attendance', () => {
    const rows = [{
      id: 't1',
      official_id: 'oid',
      event_date: '2026-03-15',
      city: 'San Jose',
      state: 'CA',
      format: 'hybrid',
      attendance_estimate: 120,
      source_url: 'https://x',
      source: 'townhallproject',
      external_id: 't1',
      ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/Hybrid/i)).toBeTruthy()
    expect(getByText(/~120 attendees/)).toBeTruthy()
    expect(getByText(/San Jose, CA/i)).toBeTruthy()
  })

  it('renders Format n/a when format is null', () => {
    const rows = [{
      id: 't1',
      official_id: 'oid',
      event_date: '2026-03-15',
      city: null,
      state: 'CA',
      format: null,
      attendance_estimate: null,
      source_url: 'https://x',
      source: 'townhallproject',
      external_id: null,
      ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/Format n\/a/i)).toBeTruthy()
  })
})
