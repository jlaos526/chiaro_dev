import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from '@chiaro/officials'

const useMyOfficialsMock = vi.fn()
const useScorecardsMock = vi.fn()
const useMetricsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useMyOfficials: (...args: unknown[]) => useMyOfficialsMock(...args),
    useOfficialScorecardRatings: (...args: unknown[]) => useScorecardsMock(...args),
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
  }
})

import { ChiaroClientProvider } from '../src/client-context.tsx'
import { OfficialsCard } from '../src/OfficialsCard.tsx'
import { BrandModeOverrideContext } from '../src/brand-hooks.ts'

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
  useScorecardsMock.mockReset()
  useMetricsMock.mockReset()
})

function mkOfficial(
  chamber: OfficialWithDistrict['chamber'],
  fullName: string,
  id = 'oid-' + fullName,
): OfficialWithDistrict {
  return {
    id, full_name: fullName, first_name: fullName, last_name: '',
    bioguide_id: id, openstates_person_id: null,
    chamber, party: 'D', state: 'CA',
    district_id: 'did', district_code: 'CA-12', title: null,
    senate_class: chamber === 'federal_senate' ? 1 : null,
    in_office: true, source_version: 'x',
    opensecrets_id: null, fec_candidate_id: null,
    portrait_url: null,
    district: { id: 'did', tier: chamber, state: 'CA', code: 'CA-12', name: 'CA-12' },
  } as unknown as OfficialWithDistrict
}

describe('OfficialsCard', () => {
  it('shows loading state', () => {
    useMyOfficialsMock.mockReturnValue({ data: null, isLoading: true, error: null })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const { getByText } = wrap(
      <OfficialsCard onSelect={vi.fn()} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
    )
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
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const { getByText } = wrap(
      <OfficialsCard onSelect={vi.fn()} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
    )
    expect(getByText("Couldn't load officials.")).toBeTruthy()
    fireEvent.click(getByText('Retry'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows calibrate prompt when no officials and invokes onCalibrate', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onCalibrate = vi.fn()
    const { getByText } = wrap(
      <OfficialsCard onSelect={vi.fn()} onSeeAll={vi.fn()} onCalibrate={onCalibrate} />,
    )
    fireEvent.click(getByText(/Calibrate your address/i))
    expect(onCalibrate).toHaveBeenCalledTimes(1)
  })

  it('renders federal officials and fires onSelect when row tapped', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSelect = vi.fn()
    const { getByText } = wrap(
      <OfficialsCard onSelect={onSelect} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
    )
    fireEvent.click(getByText('Pelosi'))
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'oid-pelosi' })
  })

  it('renders state officials section + fires onSelect for state row', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('state_house', 'Asm Doe', 'oid-asm')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSelect = vi.fn()
    const { getByText } = wrap(
      <OfficialsCard onSelect={onSelect} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
    )
    fireEvent.click(getByText('Asm Doe'))
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'oid-asm' })
  })

  it('fires onSeeAll when See all tapped', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSeeAll = vi.fn()
    const { getByText } = wrap(
      <OfficialsCard onSelect={vi.fn()} onSeeAll={onSeeAll} onCalibrate={vi.fn()} />,
    )
    fireEvent.click(getByText(/See all officials/i))
    expect(onSeeAll).toHaveBeenCalledTimes(1)
  })

  it('fires onSelect with subCascadeSlug when alignment chip is pressed', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({
      data: [
        {
          id: 'r1', scorecard_id: 's1', official_id: 'oid-pelosi',
          congress: '119', score: 95,
          source_url: 'https://example.org', ingested_at: '2026-01-01',
          org: { issue_area: 'environment', scoring_max: 100 },
        },
      ],
    })
    useMetricsMock.mockReturnValue({ data: null })
    const onSelect = vi.fn()
    const { getByRole } = wrap(
      <OfficialsCard onSelect={onSelect} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
    )
    fireEvent.click(getByRole('link', { name: /View Environment positions/i }))
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'oid-pelosi', subCascadeSlug: 'environment' })
  })
})

describe('OfficialsCard — smart-anchor (row link)', () => {
  it('renders official name as real <a href> on web when rowHref provided', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const { container } = wrap(
      <OfficialsCard
        onSelect={vi.fn()}
        onSeeAll={vi.fn()}
        onCalibrate={vi.fn()}
        rowHref={({ officialId }) => `/officials/${officialId}`}
      />,
    )
    const anchor = container.querySelector('a[href="/officials/oid-pelosi"]')
    expect(anchor).not.toBeNull()
  })

  it('plain left-click on row name anchor calls preventDefault + invokes onSelect', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSelect = vi.fn()
    const { container } = wrap(
      <OfficialsCard
        onSelect={onSelect}
        onSeeAll={vi.fn()}
        onCalibrate={vi.fn()}
        rowHref={({ officialId }) => `/officials/${officialId}`}
      />,
    )
    const anchor = container.querySelector('a[href="/officials/oid-pelosi"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'oid-pelosi' })
  })

  it('middle-click on row name anchor falls through to browser default', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi', 'oid-pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSelect = vi.fn()
    const { container } = wrap(
      <OfficialsCard
        onSelect={onSelect}
        onSeeAll={vi.fn()}
        onCalibrate={vi.fn()}
        rowHref={({ officialId }) => `/officials/${officialId}`}
      />,
    )
    const anchor = container.querySelector('a[href="/officials/oid-pelosi"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('OfficialsCard — smart-anchor (See all + calibrate links)', () => {
  it('renders "See all officials" as real <a href> on web when seeAllHref provided', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const { container } = wrap(
      <OfficialsCard
        onSelect={vi.fn()}
        onSeeAll={vi.fn()}
        onCalibrate={vi.fn()}
        seeAllHref="/officials"
      />,
    )
    const anchor = container.querySelector('a[href="/officials"]')
    expect(anchor).not.toBeNull()
  })

  it('plain left-click on "See all" anchor calls preventDefault + invokes onSeeAll', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSeeAll = vi.fn()
    const { container } = wrap(
      <OfficialsCard
        onSelect={vi.fn()}
        onSeeAll={onSeeAll}
        onCalibrate={vi.fn()}
        seeAllHref="/officials"
      />,
    )
    const anchor = container.querySelector('a[href="/officials"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onSeeAll).toHaveBeenCalledTimes(1)
  })

  it('ctrl-click on "See all" anchor falls through to browser default', () => {
    useMyOfficialsMock.mockReturnValue({
      data: [mkOfficial('federal_house', 'Pelosi')],
      isLoading: false,
      error: null,
    })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const onSeeAll = vi.fn()
    const { container } = wrap(
      <OfficialsCard
        onSelect={vi.fn()}
        onSeeAll={onSeeAll}
        onCalibrate={vi.fn()}
        seeAllHref="/officials"
      />,
    )
    const anchor = container.querySelector('a[href="/officials"]')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onSeeAll).not.toHaveBeenCalled()
  })

  it('renders calibrate prompt as real <a href> on web when calibrateHref provided', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    const { container } = wrap(
      <OfficialsCard
        onSelect={vi.fn()}
        onSeeAll={vi.fn()}
        onCalibrate={vi.fn()}
        calibrateHref="/calibrate"
      />,
    )
    const anchor = container.querySelector('a[href="/calibrate"]')
    expect(anchor).not.toBeNull()
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

describe('OfficialsCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useMyOfficialsMock.mockReturnValue({ data: [], isLoading: false, error: null })
    useScorecardsMock.mockReturnValue({ data: [] })
    useMetricsMock.mockReturnValue({ data: null })
    expect(() =>
      wrapWithMode(
        <OfficialsCard onSelect={vi.fn()} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
        'light',
      ),
    ).not.toThrow()
    expect(() =>
      wrapWithMode(
        <OfficialsCard onSelect={vi.fn()} onSeeAll={vi.fn()} onCalibrate={vi.fn()} />,
        'dark',
      ),
    ).not.toThrow()
  })
})
