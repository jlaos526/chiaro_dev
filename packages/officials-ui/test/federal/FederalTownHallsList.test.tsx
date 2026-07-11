import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalTownHallsList } from '../../src/federal/FederalTownHallsList.tsx'

describe('FederalTownHallsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<FederalTownHallsList rows={[]} />)
    expect(getByText(/No town halls in the past 12 months/i)).toBeTruthy()
  })

  it('renders rows with format and attendance', () => {
    const rows = [
      {
        id: 't1',
        official_id: 'oid',
        event_date: '2026-03-15',
        city: 'San Jose',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 120,
        source_url: 'https://x',
        ingested_at: '2026-01-01',
      },
    ] as never[]
    const { getByText } = render(<FederalTownHallsList rows={rows} />)
    expect(getByText(/Hybrid/i)).toBeTruthy()
    expect(getByText(/~120 attendees/)).toBeTruthy()
    expect(getByText(/San Jose, CA/)).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalTownHallsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<FederalTownHallsList rows={[]} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() => render(<FederalTownHallsList rows={[]} />, { wrapper: darkWrapper })).not.toThrow()
    const sampleRows = [
      {
        id: 't1',
        official_id: 'oid',
        event_date: '2026-03-15',
        city: 'San Jose',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 120,
        source_url: 'https://x',
        ingested_at: '2026-01-01',
      },
    ] as never[]
    expect(() =>
      render(<FederalTownHallsList rows={sampleRows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<FederalTownHallsList rows={sampleRows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
