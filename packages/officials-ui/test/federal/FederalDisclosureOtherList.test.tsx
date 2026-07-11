import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalDisclosureOtherList } from '../../src/federal/FederalDisclosureOtherList.tsx'
import type { FederalDisclosureOther } from '@chiaro/officials'

function row(overrides: Partial<FederalDisclosureOther> = {}): FederalDisclosureOther {
  return {
    id: 'o1',
    official_id: 'oid',
    filing_year: 2024,
    source: 'house-fd',
    external_id: null,
    source_url: 'https://example.com/fd',
    category: 'gift',
    description: 'World Series tickets',
    source_party: 'ACME Lobby Group',
    value_min: 500,
    value_max: 1000,
    value_text: null,
    ingested_at: '2026-01-01',
    ...overrides,
  }
}

describe('FederalDisclosureOtherList', () => {
  it('renders empty state when rows is empty', () => {
    const { getByText } = render(<FederalDisclosureOtherList rows={[]} />)
    expect(getByText(/No other disclosures on file/i)).toBeTruthy()
  })

  it('renders grouped sections by category (gifts/travel/positions etc.)', () => {
    const rows = [
      row({ id: 'o-gift', category: 'gift' }),
      row({ id: 'o-trav', category: 'travel', description: 'Trip to Davos' }),
      row({ id: 'o-pos', category: 'position', description: 'Trustee, X Foundation' }),
    ]
    const { getByText } = render(<FederalDisclosureOtherList rows={rows} />)
    expect(getByText('Gifts')).toBeTruthy()
    expect(getByText('Travel')).toBeTruthy()
    expect(getByText('Positions')).toBeTruthy()
  })

  it('renders categories in editorial order (gift before travel before honoraria)', () => {
    const rows = [
      row({ id: 'o-pos', category: 'position', description: 'Pos' }),
      row({ id: 'o-honor', category: 'honoraria', description: 'Honor' }),
      row({ id: 'o-gift', category: 'gift', description: 'Gift' }),
    ]
    const { container } = render(<FederalDisclosureOtherList rows={rows} />)
    const headings = Array.from(container.querySelectorAll('div')).map((d) => d.textContent ?? '')
    const headingsJoined = headings.join('|')
    // gift heading text must appear before honoraria, which must appear before positions
    const giftIdx = headingsJoined.indexOf('Gifts')
    const honorIdx = headingsJoined.indexOf('Honoraria')
    const posIdx = headingsJoined.indexOf('Positions')
    expect(giftIdx).toBeGreaterThan(-1)
    expect(honorIdx).toBeGreaterThan(giftIdx)
    expect(posIdx).toBeGreaterThan(honorIdx)
  })

  it('formats value ranges correctly ($1k–$15k)', () => {
    const { getByText } = render(
      <FederalDisclosureOtherList rows={[row({ id: 'o-v', value_min: 1000, value_max: 15000 })]} />,
    )
    expect(getByText(/\$1k–\$15k/)).toBeTruthy()
  })

  it('prefers value_text when provided over numeric range', () => {
    const { getByText } = render(
      <FederalDisclosureOtherList
        rows={[row({ id: 'o-t', value_text: 'Over $50,000', value_min: 50000, value_max: 100000 })]}
      />,
    )
    expect(getByText('Over $50,000')).toBeTruthy()
  })

  it('renders n/a when value_min + value_max + value_text all null', () => {
    const { getByText } = render(
      <FederalDisclosureOtherList
        rows={[row({ id: 'o-na', value_min: null, value_max: null, value_text: null })]}
      />,
    )
    expect(getByText('n/a')).toBeTruthy()
  })

  it('falls back to "Unknown" when description is null', () => {
    const { getByText } = render(
      <FederalDisclosureOtherList
        rows={[row({ id: 'o-u', description: null, source_party: null })]}
      />,
    )
    expect(getByText('Unknown')).toBeTruthy()
  })

  it('applies role=link to Pressable rows (smart-anchor pattern)', () => {
    const { container } = render(
      <FederalDisclosureOtherList
        rows={[row({ id: 'o1' }), row({ id: 'o2', category: 'travel' })]}
      />,
    )
    const links = container.querySelectorAll('[role="link"]')
    expect(links.length).toBe(2)
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalDisclosureOtherList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<FederalDisclosureOtherList rows={[]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalDisclosureOtherList rows={[]} />, { wrapper: darkWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalDisclosureOtherList rows={[row()]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalDisclosureOtherList rows={[row()]} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
