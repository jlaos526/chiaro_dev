import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { StateBillsEvidence } from '../../src/state/StateBillsEvidence.tsx'

function makeBill(id: string, overrides: Partial<Record<string, unknown>> = {}): never {
  return {
    id,
    bill_type: 'AB',
    number: '101',
    title: `Title ${id}`,
    status: 'introduced',
    status_substage: null,
    latest_action_date: '2026-04-01',
    source_url: `https://x/${id}`,
    ...overrides,
  } as never
}

describe('StateBillsEvidence', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateBillsEvidence bills={[]} />)
    expect(getByText(/No bills this session/i)).toBeTruthy()
  })

  it('renders bills with status + latest_action_date', () => {
    const bills = [makeBill('b1', { status_substage: 'committee' })]
    const { getByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText(/AB 101: Title b1/)).toBeTruthy()
    expect(getByText(/committee/)).toBeTruthy()
    expect(getByText(/2026-04-01/)).toBeTruthy()
  })

  it('shows up to 5 rows initially and expands via show-more', () => {
    const bills = Array.from({ length: 8 }, (_, i) => makeBill(`b${i}`))
    const { getByText, queryByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText(/AB 101: Title b0/)).toBeTruthy()
    expect(getByText(/AB 101: Title b4/)).toBeTruthy()
    expect(queryByText(/AB 101: Title b5/)).toBeNull()
    fireEvent.click(getByText(/show more \(3 more\)/i))
    expect(getByText(/AB 101: Title b7/)).toBeTruthy()
    expect(getByText(/show less/i)).toBeTruthy()
  })

  it('does not call openURL for a null source_url row, does for a valid one (B6)', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { unmount } = render(
      <StateBillsEvidence bills={[makeBill('nullrow', { source_url: null })]} />,
    )
    fireEvent.click(screen.getByText(/AB 101: Title nullrow/))
    expect(spy).not.toHaveBeenCalled()
    unmount()
    spy.mockClear()
    render(<StateBillsEvidence bills={[makeBill('validrow', { source_url: 'https://x' })]} />)
    fireEvent.click(screen.getByText(/AB 101: Title validrow/))
    expect(spy).toHaveBeenCalledWith('https://x')
    spy.mockRestore()
  })

  it('show-more toggle exposes aria-expanded that flips on press (C2)', () => {
    const bills = Array.from({ length: 8 }, (_, i) => makeBill(`b${i}`))
    render(<StateBillsEvidence bills={bills} />)
    const toggle = screen.getByText(/show more/i).closest('[aria-expanded]') as HTMLElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateBillsEvidence — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const bills = [makeBill('b1')]
    expect(() =>
      render(<StateBillsEvidence bills={bills} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateBillsEvidence bills={bills} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
