import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { Linking } from 'react-native'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { EventRowList, FORMAT_LABEL } from '../../src/cards/EventRowList.tsx'

interface FixtureRow {
  id: string
  url: string | null
  label: string
  meta: Array<string | null>
}

const keyOf = (r: FixtureRow) => r.id
const urlOf = (r: FixtureRow) => r.url
const titleOf = (r: FixtureRow) => r.label
const metaOf = (r: FixtureRow) => r.meta

function renderRows(rows: FixtureRow[]) {
  return render(
    <EventRowList rows={rows} keyOf={keyOf} urlOf={urlOf} titleOf={titleOf} metaOf={metaOf} />,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventRowList', () => {
  it('url row renders a link role and fires Linking.openURL on press', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    renderRows([
      { id: 'r1', url: 'https://example.com/e1', label: '2026-03-15 · Sacramento', meta: [] },
    ])
    const link = screen.getByRole('link')
    expect(link.textContent).toContain('2026-03-15 · Sacramento')
    fireEvent.click(link)
    expect(spy).toHaveBeenCalledWith('https://example.com/e1')
  })

  it('null-url row renders NO link role and never opens a url (slice-57 B6)', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    renderRows([
      { id: 'r1', url: null, label: 'District Office · Albany, NY', meta: ['518-555-0100'] },
    ])
    expect(screen.queryByRole('link')).toBeNull()
    fireEvent.click(screen.getByText('District Office · Albany, NY'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('skips null and empty meta entries, rendering each survivor as its own line', () => {
    renderRows([
      { id: 'r1', url: null, label: 'Town hall', meta: ['In person', null, '', '~80 attendees'] },
    ])
    expect(screen.getByText('In person')).toBeTruthy()
    expect(screen.getByText('~80 attendees')).toBeTruthy()
    // 1 title + exactly 2 meta lines — the null/'' entries produce nothing.
    const texts = screen
      .getAllByText(/./)
      .map((el) => el.textContent)
      .filter((t) => t === 'In person' || t === '~80 attendees')
    expect(texts).toHaveLength(2)
  })

  it('keys are stable — keyOf drives row keys and no key warnings fire', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const keySpy = vi.fn(keyOf)
    const rows: FixtureRow[] = [
      // Duplicate meta lines within a row exercise the occurrence-suffix
      // (content-based keys must stay unique without array indexes).
      { id: 'r1', url: null, label: 'A', meta: ['Phone', 'Phone'] },
      { id: 'r2', url: 'https://x', label: 'B', meta: ['Virtual'] },
    ]
    render(
      <EventRowList rows={rows} keyOf={keySpy} urlOf={urlOf} titleOf={titleOf} metaOf={metaOf} />,
    )
    expect(keySpy).toHaveBeenCalledTimes(rows.length)
    const keyWarnings = errSpy.mock.calls.filter((args) => /key/i.test(args.map(String).join(' ')))
    expect(keyWarnings).toHaveLength(0)
  })

  it('renders nothing for empty rows — callers own their empty copy', () => {
    const { container } = renderRows([])
    expect(container.firstChild).toBeNull()
  })
})

describe('FORMAT_LABEL', () => {
  it('matches the map hoisted from the federal + state town-halls lists', () => {
    expect(FORMAT_LABEL).toEqual({
      in_person: 'In person',
      virtual: 'Virtual',
      phone: 'Phone',
      hybrid: 'Hybrid',
    })
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('EventRowList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows: FixtureRow[] = [
      { id: 'r1', url: 'https://x', label: '2026-03-15', meta: ['Hybrid'] },
    ]
    expect(() =>
      render(
        <EventRowList rows={rows} keyOf={keyOf} urlOf={urlOf} titleOf={titleOf} metaOf={metaOf} />,
        { wrapper: lightWrapper },
      ),
    ).not.toThrow()
    expect(() =>
      render(
        <EventRowList rows={rows} keyOf={keyOf} urlOf={urlOf} titleOf={titleOf} metaOf={metaOf} />,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
