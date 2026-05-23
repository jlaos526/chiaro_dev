import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FederalPACsList } from '../../src/federal/FederalPACsList.tsx'

describe('FederalPACsList', () => {
  it('renders empty when finance is null', () => {
    const { getByText } = render(<FederalPACsList finance={null} />)
    expect(getByText(/No PAC contribution data available/i)).toBeTruthy()
  })

  it('renders PACs with formatted amounts', () => {
    const finance = {
      individualDonors: [],
      pacs: [
        { pac_name: 'ActBlue', amount: 2500000, finance_summary_id: 's1', pac_fec_id: 'C12345' },
        { pac_name: 'Realtors PAC', amount: 8000, finance_summary_id: 's1', pac_fec_id: null },
      ],
      industries: [],
      topOrgs: [],
      summary: {},
    } as never
    const { getByText } = render(<FederalPACsList finance={finance} />)
    expect(getByText(/ActBlue/)).toBeTruthy()
    expect(getByText(/\$2\.5M/)).toBeTruthy()
    expect(getByText(/Realtors PAC/)).toBeTruthy()
    expect(getByText(/\$8K/)).toBeTruthy()
  })

  it('caps at 10 PACs', () => {
    const pacs = Array.from({ length: 15 }, (_, i) => ({
      pac_name: `PAC ${i}`, amount: 1000,
      finance_summary_id: 's1', pac_fec_id: null,
    }))
    const finance = { individualDonors: [], pacs, industries: [], topOrgs: [], summary: {} } as never
    const { getByText, queryByText } = render(<FederalPACsList finance={finance} />)
    expect(getByText(/PAC 9/)).toBeTruthy()
    expect(queryByText(/PAC 10/)).toBeNull()
  })
})
