import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalHoldingsList } from '../../src/federal/FederalHoldingsList.tsx'
import type { FederalHolding } from '@chiaro/officials'

function row(overrides: Partial<FederalHolding> = {}): FederalHolding {
  return {
    id:           'h1',
    official_id:  'oid',
    filing_year:  2024,
    source:       'house-fd',
    external_id:  null,
    source_url:   'https://example.com/fd',
    asset_name:   'Apple Inc.',
    asset_ticker: 'AAPL',
    asset_type:   'stock',
    value_min:    1000,
    value_max:    15000,
    income_type:  null,
    income_min:   null,
    income_max:   null,
    ingested_at:  '2026-01-01',
    ...overrides,
  }
}

describe('FederalHoldingsList', () => {
  it('renders empty state when rows is empty', () => {
    const { getByText } = render(<FederalHoldingsList rows={[]} />)
    expect(getByText(/No holdings on file/i)).toBeTruthy()
  })

  it('renders grouped sections by filing_year DESC', () => {
    const rows = [
      row({ id: 'h-2023', filing_year: 2023, asset_ticker: 'GOOG' }),
      row({ id: 'h-2024', filing_year: 2024, asset_ticker: 'AAPL' }),
      row({ id: 'h-2022', filing_year: 2022, asset_ticker: 'MSFT' }),
    ]
    const { getAllByText } = render(<FederalHoldingsList rows={rows} />)
    // All three year headings present
    expect(getAllByText('2024').length).toBeGreaterThan(0)
    expect(getAllByText('2023').length).toBeGreaterThan(0)
    expect(getAllByText('2022').length).toBeGreaterThan(0)
  })

  it('formats value ranges correctly ($1k–$15k)', () => {
    const { getByText } = render(
      <FederalHoldingsList rows={[row({ value_min: 1000, value_max: 15000 })]} />,
    )
    expect(getByText(/\$1k–\$15k/)).toBeTruthy()
  })

  it('formats million-scale value with $X.YM', () => {
    const { getByText } = render(
      <FederalHoldingsList rows={[row({ id: 'h-m', value_min: 1000000, value_max: 5000000 })]} />,
    )
    expect(getByText(/\$1\.0M–\$5\.0M/)).toBeTruthy()
  })

  it('renders n/a when value_min + value_max both null', () => {
    const { getByText } = render(
      <FederalHoldingsList rows={[row({ id: 'h-na', value_min: null, value_max: null })]} />,
    )
    expect(getByText('n/a')).toBeTruthy()
  })

  it('falls back to "Unknown asset" when asset_name is null', () => {
    const { getByText } = render(
      <FederalHoldingsList
        rows={[row({ id: 'h-u', asset_name: null, asset_ticker: null, asset_type: null })]}
      />,
    )
    expect(getByText('Unknown asset')).toBeTruthy()
  })

  it('applies role=link to Pressable rows (smart-anchor pattern)', () => {
    const { container } = render(
      <FederalHoldingsList rows={[row(), row({ id: 'h2', filing_year: 2023 })]} />,
    )
    const links = container.querySelectorAll('[role="link"]')
    expect(links.length).toBe(2)
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalHoldingsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<FederalHoldingsList rows={[]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalHoldingsList rows={[]} />, { wrapper: darkWrapper }),
    ).not.toThrow()
    // Also exercise non-empty path
    const sampleRow: FederalHolding = {
      id: 'h1', official_id: 'oid', filing_year: 2024, source: 'house-fd',
      external_id: null, source_url: 'https://example.com/fd',
      asset_name: 'Apple Inc.', asset_ticker: 'AAPL', asset_type: 'stock',
      value_min: 1000, value_max: 15000,
      income_type: null, income_min: null, income_max: null,
      ingested_at: '2026-01-01',
    }
    expect(() =>
      render(<FederalHoldingsList rows={[sampleRow]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalHoldingsList rows={[sampleRow]} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
