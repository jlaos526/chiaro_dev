import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { StateOfficialEventsList } from '../../src/state/StateOfficialEventsList.tsx'

describe('StateOfficialEventsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateOfficialEventsList rows={[]} />)
    expect(getByText(/No sanctions or tenure events on file/i)).toBeTruthy()
  })

  it('renders event_date, type chip, summary, and outcome', () => {
    const rows = [{
      id: 'e1',
      event_date: '2026-03-01',
      event_type: 'recall_succeeded',
      summary: 'Recalled by 60% vote.',
      outcome: 'Replaced by special election.',
      source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateOfficialEventsList rows={rows} />)
    expect(getByText(/2026-03-01/)).toBeTruthy()
    expect(getByText(/Recall succeeded/)).toBeTruthy()
    expect(getByText(/Recalled by 60% vote/)).toBeTruthy()
    expect(getByText(/Replaced by special election/)).toBeTruthy()
  })

  it('uses fallback label for unknown event_type', () => {
    const rows = [{
      id: 'e1', event_date: '2026-03-01', event_type: 'censure',
      summary: 'X', outcome: null, source_url: 'https://x',
    }] as never[]
    const { getByText } = render(<StateOfficialEventsList rows={rows} />)
    expect(getByText(/Censure/)).toBeTruthy()
  })

  it('does not call openURL for a null source_url row, does for a valid one (B6)', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const nullRows = [{
      id: 'e1', event_date: '2026-03-01', event_type: 'censure',
      summary: 'Null summary', outcome: null, source_url: null,
    }] as never[]
    const { unmount } = render(<StateOfficialEventsList rows={nullRows} />)
    fireEvent.click(screen.getByText(/Null summary/))
    expect(spy).not.toHaveBeenCalled()
    unmount()
    spy.mockClear()
    const validRows = [{
      id: 'e2', event_date: '2026-03-01', event_type: 'censure',
      summary: 'Valid summary', outcome: null, source_url: 'https://x',
    }] as never[]
    render(<StateOfficialEventsList rows={validRows} />)
    fireEvent.click(screen.getByText(/Valid summary/))
    expect(spy).toHaveBeenCalledWith('https://x')
    spy.mockRestore()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateOfficialEventsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const rows = [{
      id: 'e1', event_date: '2026-03-01', event_type: 'recall_succeeded',
      summary: 'X', outcome: null, source_url: 'https://x',
    }] as never[]
    expect(() =>
      render(<StateOfficialEventsList rows={rows} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<StateOfficialEventsList rows={rows} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
