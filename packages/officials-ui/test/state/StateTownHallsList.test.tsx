import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { StateTownHallsList } from '../../src/state/StateTownHallsList.tsx'

describe('StateTownHallsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateTownHallsList rows={[]} />)
    expect(getByText(/No town halls in the past 12 months/i)).toBeTruthy()
  })

  it('renders town hall with format and attendance', () => {
    const rows = [
      {
        id: 't1',
        event_date: '2026-03-15',
        city: 'Sacramento',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 80,
        source_url: 'https://x',
      },
    ] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/2026-03-15/)).toBeTruthy()
    expect(getByText(/Sacramento, CA/)).toBeTruthy()
    expect(getByText(/Hybrid/)).toBeTruthy()
    expect(getByText(/~80 attendees/)).toBeTruthy()
  })

  it('renders state-only location when city is null', () => {
    const rows = [
      {
        id: 't1',
        event_date: '2026-03-15',
        city: null,
        state: 'CA',
        format: null,
        attendance_estimate: null,
        source_url: 'https://x',
      },
    ] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/Format n\/a/)).toBeTruthy()
  })

  it('does not call openURL for a null source_url row, does for a valid one (B6)', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const nullRows = [
      {
        id: 't1',
        event_date: '2026-03-15',
        city: null,
        state: 'CA',
        format: null,
        attendance_estimate: null,
        source_url: null,
      },
    ] as never[]
    const { unmount } = render(<StateTownHallsList rows={nullRows} />)
    fireEvent.click(screen.getByText(/2026-03-15/))
    expect(spy).not.toHaveBeenCalled()
    unmount()
    spy.mockClear()
    const validRows = [
      {
        id: 't2',
        event_date: '2026-04-20',
        city: null,
        state: 'CA',
        format: null,
        attendance_estimate: null,
        source_url: 'https://x',
      },
    ] as never[]
    render(<StateTownHallsList rows={validRows} />)
    fireEvent.click(screen.getByText(/2026-04-20/))
    expect(spy).toHaveBeenCalledWith('https://x')
    spy.mockRestore()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateTownHallsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() => render(<StateTownHallsList rows={[]} />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<StateTownHallsList rows={[]} />, { wrapper: darkWrapper })).not.toThrow()
    const sampleRows = [
      {
        id: 't1',
        event_date: '2026-03-15',
        city: 'Sacramento',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 80,
        source_url: 'https://x',
      },
    ] as never[]
    expect(() =>
      render(<StateTownHallsList rows={sampleRows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateTownHallsList rows={sampleRows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
