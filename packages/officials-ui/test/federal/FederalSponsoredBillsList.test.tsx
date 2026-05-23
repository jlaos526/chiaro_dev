import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalSponsoredBillsList } from '../../src/federal/FederalSponsoredBillsList.tsx'

describe('FederalSponsoredBillsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalSponsoredBillsList rows={[]} />)
    expect(getByText(/No sponsored bills/i)).toBeTruthy()
  })

  it('renders bill_type + number + title + status', () => {
    const rows = [{
      id: 'b1', bill_type: 'HR', number: 1234, title: 'A bill to do things',
      short_title: null, status: 'introduced', congress: '119',
      introduced_date: '2026-01-01', latest_action: null, policy_area: null,
      source_url: 'https://x', congress_gov_url: null, ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<FederalSponsoredBillsList rows={rows} />)
    expect(getByText(/HR 1234/)).toBeTruthy()
    expect(getByText(/A bill to do things/)).toBeTruthy()
    expect(getByText(/introduced/)).toBeTruthy()
  })

  it('caps at 25 bills', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `b${i}`, bill_type: 'HR', number: i, title: `Bill ${i}`,
      short_title: null, status: 'introduced', congress: '119',
      introduced_date: '2026-01-01', latest_action: null, policy_area: null,
      source_url: 'https://x', congress_gov_url: null, ingested_at: '2026-01-01',
    }))
    const { getByText, queryByText } = render(<FederalSponsoredBillsList rows={rows as never} />)
    expect(getByText(/Bill 24/)).toBeTruthy()
    expect(queryByText(/Bill 25/)).toBeNull()
  })
})
