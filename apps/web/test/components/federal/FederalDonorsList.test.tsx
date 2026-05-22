import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalDonorsList } from '@/components/federal/FederalDonorsList'

describe('FederalDonorsList', () => {
  it('renders empty when finance is null', () => {
    const { getByText } = render(<FederalDonorsList finance={null} />)
    expect(getByText(/No individual donor data available/i)).toBeTruthy()
  })

  it('renders donors with formatted amounts', () => {
    const finance = {
      individualDonors: [
        { donor_name: 'Doe, John', amount: 5800, rank: 1, finance_summary_id: 's1', employer: null, occupation: null },
        { donor_name: 'Smith, Jane', amount: 3000, rank: 2, finance_summary_id: 's1', employer: null, occupation: null },
      ],
      pacs: [],
      industries: [],
      topOrgs: [],
      summary: {},
    } as never
    const { getByText } = render(<FederalDonorsList finance={finance} />)
    expect(getByText(/Doe, John/)).toBeTruthy()
    expect(getByText(/\$6K/)).toBeTruthy() // 5800 rounds to $6K
  })

  it('caps at 10 donors', () => {
    const donors = Array.from({ length: 15 }, (_, i) => ({
      donor_name: `Donor ${i}`, amount: 1000, rank: i + 1,
      finance_summary_id: 's1', employer: null, occupation: null,
    }))
    const finance = { individualDonors: donors, pacs: [], industries: [], topOrgs: [], summary: {} } as never
    const { getByText, queryByText } = render(<FederalDonorsList finance={finance} />)
    expect(getByText(/Donor 9/)).toBeTruthy()
    expect(queryByText(/Donor 10/)).toBeNull()
  })
})
