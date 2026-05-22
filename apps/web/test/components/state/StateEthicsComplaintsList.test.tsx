import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateEthicsComplaintsList } from '@/components/state/StateEthicsComplaintsList'

// COLORS.signal.warning = '#d68a1f' = rgb(214, 138, 31); JSDOM serializes inline
// style colors as rgb(), so assert the rgb form.
const WARNING_RGB = 'rgb(214, 138, 31)'

describe('StateEthicsComplaintsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateEthicsComplaintsList rows={[]} />)
    expect(getByText(/No ethics complaints on file/i)).toBeTruthy()
  })

  it('renders rows with status chip + summary + disposition', () => {
    const rows = [{
      id: 'c1', official_id: 'oid', state: 'CA',
      complaint_date: '2026-02-10', status: 'sanctioned',
      summary: 'Failure to disclose income.',
      disposition: 'Fined $5,000',
      source_url: 'https://x', source: 'state-ethics',
      external_id: 'c1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateEthicsComplaintsList rows={rows} />)
    expect(getByText(/Sanctioned/)).toBeTruthy()
    expect(getByText(/Failure to disclose income\./)).toBeTruthy()
    expect(getByText(/Disposition: Fined \$5,000/)).toBeTruthy()
  })

  it('renders status chip with correct color (warning for open)', () => {
    const rows = [{
      id: 'c1', official_id: 'oid', state: 'CA',
      complaint_date: '2026-02-10', status: 'open',
      summary: 'Allegation pending review.',
      disposition: null,
      source_url: 'https://x', source: 'state-ethics',
      external_id: 'c1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateEthicsComplaintsList rows={rows} />)
    const chip = getByText(/^Open$/)
    expect(chip).toBeTruthy()
    const style = (chip as HTMLElement).getAttribute('style') ?? ''
    expect(style).toContain(WARNING_RGB)
  })
})
