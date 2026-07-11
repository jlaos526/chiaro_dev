import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalDonorsList } from '../../src/federal/FederalDonorsList.tsx'

describe('FederalDonorsList', () => {
  it('renders empty when finance is null', () => {
    const { getByText } = render(<FederalDonorsList finance={null} />)
    expect(getByText(/No individual donor data available/i)).toBeTruthy()
  })

  it('renders donors with formatted amounts', () => {
    const finance = {
      individualDonors: [
        {
          donor_name: 'Doe, John',
          amount: 5800,
          rank: 1,
          finance_summary_id: 's1',
          employer: null,
          occupation: null,
        },
        {
          donor_name: 'Smith, Jane',
          amount: 3000,
          rank: 2,
          finance_summary_id: 's1',
          employer: null,
          occupation: null,
        },
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
      donor_name: `Donor ${i}`,
      amount: 1000,
      rank: i + 1,
      finance_summary_id: 's1',
      employer: null,
      occupation: null,
    }))
    const finance = {
      individualDonors: donors,
      pacs: [],
      industries: [],
      topOrgs: [],
      summary: {},
    } as never
    const { getByText, queryByText } = render(<FederalDonorsList finance={finance} />)
    expect(getByText(/Donor 9/)).toBeTruthy()
    expect(queryByText(/Donor 10/)).toBeNull()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalDonorsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const finance = {
      individualDonors: [
        {
          donor_name: 'Doe, John',
          amount: 5800,
          rank: 1,
          finance_summary_id: 's1',
          employer: null,
          occupation: null,
        },
      ],
      pacs: [],
      industries: [],
      topOrgs: [],
      summary: {},
    } as never
    expect(() =>
      render(<FederalDonorsList finance={finance} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalDonorsList finance={finance} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
