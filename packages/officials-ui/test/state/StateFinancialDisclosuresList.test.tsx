import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateFinancialDisclosuresList } from '../../src/state/StateFinancialDisclosuresList.tsx'

function makeRow(id: string, overrides: Partial<Record<string, unknown>> = {}): never {
  return {
    id,
    filing_year: 2026,
    income_source: 'Acme Inc.',
    income_kind: 'salary',
    amount_range_low: 50000,
    amount_range_high: 100000,
    ...overrides,
  } as never
}

describe('StateFinancialDisclosuresList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateFinancialDisclosuresList rows={[]} />)
    expect(getByText(/No financial disclosures on file/i)).toBeTruthy()
  })

  it('renders rows grouped by filing_year', () => {
    const rows = [makeRow('d1', { filing_year: 2026 }), makeRow('d2', { filing_year: 2025 })]
    const { getByText } = render(<StateFinancialDisclosuresList rows={rows} />)
    expect(getByText(/2026 \(1 disclosure\)/)).toBeTruthy()
    expect(getByText(/2025 \(1 disclosure\)/)).toBeTruthy()
  })

  it('formats amount range with kilo + mega thresholds', () => {
    const rows = [makeRow('d1', { amount_range_low: 50000, amount_range_high: 1500000 })]
    const { getByText } = render(<StateFinancialDisclosuresList rows={rows} />)
    expect(getByText(/\$50k–\$1\.5M/)).toBeTruthy()
  })

  it('renders unspecified source fallback', () => {
    const rows = [makeRow('d1', { income_source: null })]
    const { getByText } = render(<StateFinancialDisclosuresList rows={rows} />)
    expect(getByText(/\(unspecified source\)/)).toBeTruthy()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateFinancialDisclosuresList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows = [makeRow('d1')]
    expect(() =>
      render(<StateFinancialDisclosuresList rows={rows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateFinancialDisclosuresList rows={rows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
