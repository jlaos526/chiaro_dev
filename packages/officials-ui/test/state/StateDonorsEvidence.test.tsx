import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateDonorsEvidence } from '../../src/state/StateDonorsEvidence.tsx'

function makeDonor(rank: number, overrides: Partial<Record<string, unknown>> = {}): never {
  return {
    rank,
    donor_name: `Donor ${rank}`,
    amount: 5000,
    employer: 'Acme',
    occupation: 'Engineer',
    city: 'San Jose',
    donor_state: 'CA',
    ...overrides,
  } as never
}

describe('StateDonorsEvidence', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[]} />)
    expect(getByText(/No donor data for this cycle/i)).toBeTruthy()
  })

  it('renders donor name, amount, and secondary line', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[makeDonor(1)]} />)
    expect(getByText(/Donor 1/)).toBeTruthy()
    expect(getByText(/\$5,000/)).toBeTruthy()
    expect(getByText(/Acme · Engineer · San Jose, CA/)).toBeTruthy()
  })

  it('omits secondary line when no employer/occupation/city', () => {
    const donors = [
      makeDonor(1, { employer: null, occupation: null, city: null, donor_state: null }),
    ]
    const { queryByText } = render(<StateDonorsEvidence donors={donors} />)
    expect(queryByText(/Acme/)).toBeNull()
  })

  it('expands beyond initial 5 rows', () => {
    const donors = Array.from({ length: 7 }, (_, i) => makeDonor(i + 1))
    const { getByText, queryByText } = render(<StateDonorsEvidence donors={donors} />)
    expect(queryByText(/Donor 6/)).toBeNull()
    fireEvent.click(getByText(/show more \(2 more\)/i))
    expect(getByText(/Donor 7/)).toBeTruthy()
  })

  it('expand toggle exposes aria-expanded that flips on press (C2)', () => {
    const donors = Array.from({ length: 7 }, (_, i) => makeDonor(i + 1))
    const { getByText } = render(<StateDonorsEvidence donors={donors} />)
    const toggle = getByText(/show more/i).closest('[aria-expanded]') as HTMLElement
    expect(toggle).not.toBeNull()
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

describe('StateDonorsEvidence — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const donors = [makeDonor(1)]
    expect(() =>
      render(<StateDonorsEvidence donors={donors} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateDonorsEvidence donors={donors} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
