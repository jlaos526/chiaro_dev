import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateOfficialEventsList } from '@/components/state/StateOfficialEventsList'

// COLORS.signal.error = '#c5364a' = rgb(197, 54, 74); JSDOM serializes inline
// style colors as rgb(), so assert the rgb form to keep the test robust to
// hex-vs-rgb formatting.
const ERROR_RGB = 'rgb(197, 54, 74)'

describe('StateOfficialEventsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateOfficialEventsList rows={[]} />)
    expect(getByText(/No sanctions or tenure events on file/i)).toBeTruthy()
  })

  it('renders rows with event type label + outcome subline', () => {
    const rows = [{
      id: 'e1', official_id: 'oid', state: 'CA',
      event_date: '2026-04-01', event_type: 'censure',
      summary: 'Censured by the assembly for misconduct.',
      outcome: 'Lost committee chair seat',
      source_url: 'https://x', source: 'ballotpedia',
      external_id: 'e1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateOfficialEventsList rows={rows} />)
    expect(getByText(/^Censure$/)).toBeTruthy()
    expect(getByText(/Censured by the assembly for misconduct\./)).toBeTruthy()
    expect(getByText(/Lost committee chair seat/)).toBeTruthy()
  })

  it('renders type chip with correct color (error for expulsion)', () => {
    const rows = [{
      id: 'e1', official_id: 'oid', state: 'CA',
      event_date: '2026-04-01', event_type: 'expulsion',
      summary: 'Expelled from chamber.',
      outcome: null,
      source_url: 'https://x', source: 'ballotpedia',
      external_id: 'e1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateOfficialEventsList rows={rows} />)
    const chip = getByText(/^Expulsion$/)
    expect(chip).toBeTruthy()
    const style = (chip as HTMLElement).getAttribute('style') ?? ''
    expect(style).toContain(ERROR_RGB)
  })
})
