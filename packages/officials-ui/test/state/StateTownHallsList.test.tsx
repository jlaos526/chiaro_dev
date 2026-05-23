import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateTownHallsList } from '../../src/state/StateTownHallsList.tsx'

describe('StateTownHallsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateTownHallsList rows={[]} />)
    expect(getByText(/No town halls in the past 12 months/i)).toBeTruthy()
  })

  it('renders town hall with format and attendance', () => {
    const rows = [{
      id: 't1',
      event_date: '2026-03-15',
      city: 'Sacramento',
      state: 'CA',
      format: 'hybrid',
      attendance_estimate: 80,
      source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/2026-03-15/)).toBeTruthy()
    expect(getByText(/Sacramento, CA/)).toBeTruthy()
    expect(getByText(/Hybrid/)).toBeTruthy()
    expect(getByText(/~80 attendees/)).toBeTruthy()
  })

  it('renders state-only location when city is null', () => {
    const rows = [{
      id: 't1', event_date: '2026-03-15', city: null, state: 'CA',
      format: null, attendance_estimate: null, source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/Format n\/a/)).toBeTruthy()
  })
})
