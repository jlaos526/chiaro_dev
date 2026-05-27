import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { StateCommitteeHearingsList } from '../../src/state/StateCommitteeHearingsList.tsx'

function makeRow(id: string, overrides: Partial<Record<string, unknown>> = {}): never {
  return {
    id,
    hearing_date: '2026-04-01',
    location: 'Sacramento',
    agenda_topic: null,
    ...overrides,
  } as never
}

describe('StateCommitteeHearingsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateCommitteeHearingsList rows={[]} />)
    expect(getByText(/No committee hearings attended/i)).toBeTruthy()
  })

  it('renders hearing_date + location + agenda_topic', () => {
    const rows = [makeRow('h1', { agenda_topic: 'Education funding' })]
    const { getByText } = render(<StateCommitteeHearingsList rows={rows} />)
    expect(getByText(/2026-04-01/)).toBeTruthy()
    expect(getByText(/Sacramento/)).toBeTruthy()
    expect(getByText(/Agenda: Education funding/)).toBeTruthy()
  })

  it('shows up to 3 by default and reveals more via "and N more"', () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(`h${i}`))
    const { getByText, queryByText } = render(<StateCommitteeHearingsList rows={rows} />)
    expect(queryByText(/and 2 more/)).toBeTruthy()
    fireEvent.click(getByText(/and 2 more/))
    expect(queryByText(/and 2 more/)).toBeNull()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateCommitteeHearingsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<StateCommitteeHearingsList rows={[]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateCommitteeHearingsList rows={[]} />, { wrapper: darkWrapper }),
    ).not.toThrow()
    const sampleRows = [makeRow('h1', { agenda_topic: 'Education funding' })]
    expect(() =>
      render(<StateCommitteeHearingsList rows={sampleRows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateCommitteeHearingsList rows={sampleRows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
