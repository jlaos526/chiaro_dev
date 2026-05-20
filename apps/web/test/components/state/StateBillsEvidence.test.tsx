import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateBillsEvidence } from '@/components/state/StateBillsEvidence'
import type { StateBillWithSponsors } from '@chiaro/state-bills'

function mkBill(overrides: Partial<StateBillWithSponsors> = {}): StateBillWithSponsors {
  return {
    id: 'b1', openstates_bill_id: 'ocd-bill/x',
    state: 'CA', session: '20252026', bill_type: 'AB', number: 123,
    title: 'Test Bill', status: 'introduced',
    introduced_date: '2025-01-15', latest_action: 'Introduced',
    latest_action_date: '2025-01-15',
    source_url: 'https://x', openstates_url: 'https://o',
    status_substage: null, hearing_date: null, fiscal_impact_amount: null,
    party_vote_split: null, augmented_from: null,
    created_at: '2025-01-15', updated_at: '2025-01-15',
    sponsors: [], subjects: [],
    ...overrides,
  } as unknown as StateBillWithSponsors
}

describe('StateBillsEvidence', () => {
  it('renders bill list with title + status + date', () => {
    const bills = [mkBill({ title: 'Bill One', latest_action_date: '2025-02-01' })]
    const { getByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText(/Bill One/)).toBeTruthy()
    expect(getByText(/2025-02-01/)).toBeTruthy()
  })

  it('augment status_substage shown when present', () => {
    const bills = [mkBill({ status_substage: 'Senate Appropriations' })]
    const { getByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText(/Senate Appropriations/)).toBeTruthy()
  })

  it('augment hidden when null', () => {
    const bills = [mkBill({ status_substage: null })]
    const { queryByText } = render(<StateBillsEvidence bills={bills} />)
    expect(queryByText(/Senate Appropriations/)).toBeNull()
  })

  it('renders empty-state copy when bills empty', () => {
    const { getByText } = render(<StateBillsEvidence bills={[]} />)
    expect(getByText(/no bills/i)).toBeTruthy()
  })

  it('shows top N (5) + "show more" toggle', () => {
    const bills = Array.from({ length: 8 }, (_, i) =>
      mkBill({ id: `b${i}`, number: 100 + i, title: `Bill ${i}` }),
    )
    const { getByText, queryByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText(/Bill 0/)).toBeTruthy()
    expect(getByText(/Bill 4/)).toBeTruthy()
    expect(queryByText(/Bill 7/)).toBeNull()
    expect(getByText(/show more/i)).toBeTruthy()
  })
})
