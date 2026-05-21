import { render, fireEvent } from '@testing-library/react-native'
import { StateDonorsEvidence } from '@/components/state/StateDonorsEvidence'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

function mkDonor(rank: number, overrides: Partial<StateFinanceIndividualDonorRow> = {}): StateFinanceIndividualDonorRow {
  return {
    state_finance_summary_id: 's1',
    rank,
    donor_name: `Donor ${rank}`,
    amount: 1000 * (11 - rank) as never,
    employer: null,
    occupation: null,
    city: null,
    donor_state: null,
    ...overrides,
  } as unknown as StateFinanceIndividualDonorRow
}

describe('mobile StateDonorsEvidence', () => {
  it('renders donor name + dollar-formatted amount', () => {
    const { getByText } = render(
      <StateDonorsEvidence
        donors={[mkDonor(1, { donor_name: 'Alice', amount: 5000 as never })]}
      />,
    )
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText(/\$5,000/)).toBeTruthy()
  })

  it('renders secondary line when employer/occupation/city present', () => {
    const { getByText } = render(
      <StateDonorsEvidence
        donors={[mkDonor(1, {
          donor_name: 'Alice',
          employer: 'Acme',
          occupation: 'CEO',
          city: 'SF',
          donor_state: 'CA',
        })]}
      />,
    )
    expect(getByText(/Acme · CEO · SF, CA/)).toBeTruthy()
  })

  it('renders empty-state copy when no donors', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[]} />)
    expect(getByText(/no donor data/i)).toBeTruthy()
  })

  it('shows top 5 + toggle for >5 donors', () => {
    const donors = Array.from({ length: 8 }, (_, i) =>
      mkDonor(i + 1, { donor_name: `D${i + 1}` }),
    )
    const { getByText, queryByText } = render(<StateDonorsEvidence donors={donors} />)
    expect(getByText('D1')).toBeTruthy()
    expect(getByText('D5')).toBeTruthy()
    expect(queryByText('D8')).toBeNull()
    fireEvent.press(getByText(/show more/i))
    expect(getByText('D8')).toBeTruthy()
  })

  it('omits secondary line when all optional fields are null', () => {
    const { queryByText } = render(
      <StateDonorsEvidence donors={[mkDonor(1, { donor_name: 'Alice' })]} />,
    )
    expect(queryByText(/ · /)).toBeNull()
  })
})
