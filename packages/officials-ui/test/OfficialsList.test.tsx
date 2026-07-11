import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from '@chiaro/officials'

const useMyOfficialsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useMyOfficials: (...args: unknown[]) => useMyOfficialsMock(...args),
  }
})

import { BRAND_SEMANTIC } from '@chiaro/ui-tokens'
import { ChiaroClientProvider } from '../src/client-context.tsx'
import { OfficialsList } from '../src/OfficialsList.tsx'
import { BrandModeOverrideContext } from '../src/brand-hooks.ts'

// RNW StyleSheet normalizes hex colors to rgb(R, G, B) form in inline styles
// (see Gotcha #19 / slice 39 RNW pattern findings). Accept either form.
function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function styleContainsColor(style: string, hex: string): boolean {
  return style.includes(hex) || style.includes(hexToRgb(hex))
}

const mockClient = { from: () => {} } as unknown as ChiaroClient

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
  )
}

afterEach(() => {
  useMyOfficialsMock.mockReset()
})

function mkOfficial(
  chamber: OfficialWithDistrict['chamber'],
  fullName: string,
  id = 'oid-' + fullName,
): OfficialWithDistrict {
  return {
    id,
    full_name: fullName,
    first_name: fullName,
    last_name: '',
    bioguide_id: id,
    openstates_person_id: null,
    chamber,
    party: 'D',
    state: 'CA',
    district_id: 'did',
    district_code: 'CA-12',
    title: null,
    senate_class: chamber === 'federal_senate' ? 1 : null,
    in_office: true,
    source_version: 'x',
    opensecrets_id: null,
    fec_candidate_id: null,
    portrait_url: null,
    district: { id: 'did', tier: chamber, state: 'CA', code: 'CA-12', name: 'CA-12' },
  } as unknown as OfficialWithDistrict
}

describe('OfficialsList', () => {
  it('shows loading state', () => {
    useMyOfficialsMock.mockReturnValue({ data: null, isLoading: true, error: null })
    const { getByText } = wrap(<OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />)
    expect(getByText(/Loading/i)).toBeTruthy()
  })

  it('error branch renders a Retry affordance that calls refetch (audit U2-rider)', () => {
    const refetch = vi.fn()
    useMyOfficialsMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    })
    const { getByText } = wrap(<OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />)
    expect(getByText("Couldn't load officials.")).toBeTruthy()
    fireEvent.click(getByText('Retry'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows calibrate prompt when no officials and invokes onCalibrate', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    const onCalibrate = vi.fn()
    const { getByText } = wrap(<OfficialsList onSelect={vi.fn()} onCalibrate={onCalibrate} />)
    fireEvent.click(getByText(/Calibrate your address/i))
    expect(onCalibrate).toHaveBeenCalledTimes(1)
  })

  it('renders Senate and House sections when both have officials', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_senate', 'Padilla'), mkOfficial('federal_house', 'Pelosi')],
      isLoading: false,
      error: null,
    })
    const { getByText } = wrap(<OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />)
    expect(getByText('Senate')).toBeTruthy()
    expect(getByText('House')).toBeTruthy()
    expect(getByText('Padilla')).toBeTruthy()
    expect(getByText('Pelosi')).toBeTruthy()
  })

  it('fires onSelect with officialId when row tapped', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    const onSelect = vi.fn()
    const { getByText } = wrap(<OfficialsList onSelect={onSelect} onCalibrate={vi.fn()} />)
    fireEvent.click(getByText('Pelosi'))
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'oid-pelosi' })
  })

  it('omits Senate section when no senators', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi')],
      isLoading: false,
      error: null,
    })
    const { queryByText, getByText } = wrap(
      <OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />,
    )
    expect(queryByText('Senate')).toBeNull()
    expect(getByText('House')).toBeTruthy()
  })
})

describe('OfficialsList — smart-anchor (row link)', () => {
  it('renders official rows as real <a href> on web when getHref provided', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    const { container } = wrap(
      <OfficialsList
        onSelect={vi.fn()}
        onCalibrate={vi.fn()}
        getHref={({ officialId }) => `/officials/${officialId}`}
      />,
    )
    const anchor = container.querySelector('a[href="/officials/oid-pelosi"]')
    expect(anchor).not.toBeNull()
  })

  it('plain left-click on row anchor calls preventDefault + invokes onSelect', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    const onSelect = vi.fn()
    const { container } = wrap(
      <OfficialsList
        onSelect={onSelect}
        onCalibrate={vi.fn()}
        getHref={({ officialId }) => `/officials/${officialId}`}
      />,
    )
    const anchor = container.querySelector('a[href="/officials/oid-pelosi"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'oid-pelosi' })
  })

  it('cmd-click on row anchor falls through to browser default', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    const onSelect = vi.fn()
    const { container } = wrap(
      <OfficialsList
        onSelect={onSelect}
        onCalibrate={vi.fn()}
        getHref={({ officialId }) => `/officials/${officialId}`}
      />,
    )
    const anchor = container.querySelector('a[href="/officials/oid-pelosi"]')!
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('OfficialsList — smart-anchor (calibrate prompt)', () => {
  it('renders calibrate prompt as real <a href> on web when calibrateHref provided', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    const { container } = wrap(
      <OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} calibrateHref="/calibrate" />,
    )
    const anchor = container.querySelector('a[href="/calibrate"]')
    expect(anchor).not.toBeNull()
  })

  it('plain left-click on calibrate anchor calls preventDefault + invokes onCalibrate', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    const onCalibrate = vi.fn()
    const { container } = wrap(
      <OfficialsList onSelect={vi.fn()} onCalibrate={onCalibrate} calibrateHref="/calibrate" />,
    )
    const anchor = container.querySelector('a[href="/calibrate"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onCalibrate).toHaveBeenCalledTimes(1)
  })

  it('shift-click on calibrate anchor falls through to browser default', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    const onCalibrate = vi.fn()
    const { container } = wrap(
      <OfficialsList onSelect={vi.fn()} onCalibrate={onCalibrate} calibrateHref="/calibrate" />,
    )
    const anchor = container.querySelector('a[href="/calibrate"]')!
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      shiftKey: true,
    })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onCalibrate).not.toHaveBeenCalled()
  })
})

function wrapWithMode(ui: ReactElement, mode: 'light' | 'dark') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = createElement(
    BrandModeOverrideContext.Provider,
    { value: mode },
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
  ) as ReactNode
  return render(tree as ReactElement)
}

describe('OfficialsList — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    expect(() =>
      wrapWithMode(<OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />, 'light'),
    ).not.toThrow()
    expect(() =>
      wrapWithMode(<OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />, 'dark'),
    ).not.toThrow()
  })

  it('colors names + section titles with the dark text.primary token in dark mode (audit U3)', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    const { getByText } = wrapWithMode(
      <OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />,
      'dark',
    )
    const darkPrimary = BRAND_SEMANTIC.dark.text.primary
    const nameStyle = getByText('Pelosi').getAttribute('style') ?? ''
    expect(styleContainsColor(nameStyle, darkPrimary)).toBe(true)
    const titleStyle = getByText('House').getAttribute('style') ?? ''
    expect(styleContainsColor(titleStyle, darkPrimary)).toBe(true)
  })

  it('colors the loading state with the dark text.muted token in dark mode (audit U3)', () => {
    useMyOfficialsMock.mockReturnValue({ data: null, isLoading: true, error: null })
    const { getByText } = wrapWithMode(
      <OfficialsList onSelect={vi.fn()} onCalibrate={vi.fn()} />,
      'dark',
    )
    const loadingStyle = getByText('Loading…').getAttribute('style') ?? ''
    expect(styleContainsColor(loadingStyle, BRAND_SEMANTIC.dark.text.muted)).toBe(true)
  })
})
