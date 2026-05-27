import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalCosponsoredBillsList } from '../../src/federal/FederalCosponsoredBillsList.tsx'

describe('FederalCosponsoredBillsList', () => {
  it('renders empty state with cosponsored-specific copy', () => {
    const { getByText } = render(<FederalCosponsoredBillsList rows={[]} />)
    expect(getByText(/No cosponsored bills/i)).toBeTruthy()
  })

  it('renders bill rows', () => {
    const rows = [{
      id: 'b1', bill_type: 'S', number: 99, title: 'Senate bill',
      short_title: 'SB', status: 'passed_house', congress: '119',
      introduced_date: '2026-01-01', latest_action: null, policy_area: null,
      source_url: 'https://x', congress_gov_url: null, ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<FederalCosponsoredBillsList rows={rows} />)
    expect(getByText(/S 99/)).toBeTruthy()
    expect(getByText(/SB/)).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalCosponsoredBillsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows = [{
      id: 'b1', bill_type: 'S', number: 99, title: 'Senate bill',
      short_title: 'SB', status: 'passed_house', congress: '119',
      introduced_date: '2026-01-01', latest_action: null, policy_area: null,
      source_url: 'https://x', congress_gov_url: null, ingested_at: '2026-01-01',
    }] as never[]
    expect(() => render(<FederalCosponsoredBillsList rows={rows} />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<FederalCosponsoredBillsList rows={rows} />, { wrapper: darkWrapper })).not.toThrow()
  })
})
