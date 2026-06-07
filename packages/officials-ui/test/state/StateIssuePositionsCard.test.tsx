import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useRatingsMock = vi.fn()
const useVotesOnSubjectMock = vi.fn()
const useMySelectionsMock = vi.fn()
const useIssueCatalogMock = vi.fn()
const useRepWatchlistFlagsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateScorecardRatings: (...args: unknown[]) => useRatingsMock(...args),
  }
})

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: (...args: unknown[]) =>
      useVotesOnSubjectMock(...args),
  }
})

vi.mock('@chiaro/issues', async () => {
  const actual = await vi.importActual<object>('@chiaro/issues')
  return {
    ...actual,
    useMySelections: (...args: unknown[]) => useMySelectionsMock(...args),
    useIssueCatalog: (...args: unknown[]) => useIssueCatalogMock(...args),
    useRepWatchlistFlags: (...args: unknown[]) => useRepWatchlistFlagsMock(...args),
  }
})

// Catalog whose "environment" lens maps to the Sierra Club scorecard org slug.
const CATALOG = [
  {
    slug: 'environment',
    name: 'Environment',
    display_order: 0,
    lenses: [
      {
        topic_slug: 'environment',
        slug: 'climate',
        lens_type: 'stance',
        measurement_sources: [
          { type: 'scorecard', weight: 1, config: { orgs: ['sierra'] } },
        ],
        quiz_questions: [],
      },
    ],
  },
]
const SELECTION = {
  topic_slug: 'environment',
  lens_slug: 'climate',
  position: 80,
  importance: 1,
  display_order: 0,
  selected_at: '2026-01-01',
  user_id: 'u1',
}

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateIssuePositionsCard } from '../../src/state/StateIssuePositionsCard.tsx'

const mockClient = { from: () => {} } as unknown as ChiaroClient

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ChiaroClientProvider client={mockClient}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ChiaroClientProvider>,
  )
}

beforeEach(() => {
  // Default: no selections / no catalog → priority set is empty (today's behavior).
  useMySelectionsMock.mockReturnValue({ data: undefined, isLoading: false })
  useIssueCatalogMock.mockReturnValue({ data: undefined, isLoading: false })
  // Default: no watchlist flags → flagsSection is null (slice-52 behavior).
  useRepWatchlistFlagsMock.mockReturnValue({ data: [], isLoading: false })
})

afterEach(() => {
  useRatingsMock.mockReset()
  useVotesOnSubjectMock.mockReset()
  useMySelectionsMock.mockReset()
  useIssueCatalogMock.mockReset()
  useRepWatchlistFlagsMock.mockReset()
})

describe('StateIssuePositionsCard', () => {
  it('renders loading', () => {
    useRatingsMock.mockReturnValue({ data: undefined, isLoading: true })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })

  it('renders empty when no ratings', () => {
    useRatingsMock.mockReturnValue({ data: [], isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings/i)).toBeTruthy()
  })

  it('renders ratings grouped by lean', () => {
    useRatingsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          score: 85,
          org: {
            id: 'org1',
            name: 'Sierra Club',
            issue_area: 'environment',
            lean: 'progressive',
            scoring_max: 100,
          },
        },
        {
          id: 'r2',
          official_id: 'oid',
          score: 20,
          org: {
            id: 'org2',
            name: 'NRA',
            issue_area: 'second-amendment',
            lean: 'conservative',
            scoring_max: 100,
          },
        },
      ],
      isLoading: false,
    })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText('Issue Positions')).toBeTruthy()
    expect(getByText('Sierra Club')).toBeTruthy()
    expect(getByText('NRA')).toBeTruthy()
  })

  it('clicking a rating mounts evidence panel', () => {
    useRatingsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          score: 85,
          org: {
            id: 'org1',
            name: 'Sierra Club',
            issue_area: 'environment',
            lean: 'progressive',
            scoring_max: 100,
          },
        },
      ],
      isLoading: false,
    })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText, queryByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(queryByText(/No matching votes for this subject/i)).toBeNull()
    fireEvent.click(getByText('Sierra Club'))
    // Evidence panel mounts and renders empty-state message.
    expect(getByText(/No matching votes for this subject/i)).toBeTruthy()
  })

  it('per-row expand control exposes aria-expanded that flips on press (C2)', () => {
    useRatingsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          score: 85,
          org: {
            id: 'org1',
            name: 'Sierra Club',
            issue_area: 'environment',
            lean: 'progressive',
            scoring_max: 100,
          },
        },
      ],
      isLoading: false,
    })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    const toggle = getByText('Sierra Club').closest('[aria-expanded]') as HTMLElement
    expect(toggle).not.toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})

// NRA (conservative) listed BEFORE Sierra Club (progressive). In the default
// grouped view, progressive sorts above conservative anyway — so to make the
// priority sort observable we assert the ★ tag AND that the matched org floats
// to the top of a now-FLAT list.
const NRA_THEN_SIERRA = [
  {
    id: 'r-nra',
    official_id: 'oid',
    score: 20,
    org: {
      id: 'org-nra',
      slug: 'nra',
      name: 'NRA',
      issue_area: 'second-amendment',
      lean: 'conservative',
      scoring_max: 100,
    },
  },
  {
    id: 'r-sierra',
    official_id: 'oid',
    score: 85,
    org: {
      id: 'org-sierra',
      slug: 'sierra',
      name: 'Sierra Club',
      issue_area: 'environment',
      lean: 'progressive',
      scoring_max: 100,
    },
  },
]

describe('StateIssuePositionsCard — priority tagging', () => {
  it('tags the matched org row and floats it to the top', () => {
    useRatingsMock.mockReturnValue({ data: NRA_THEN_SIERRA, isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    useMySelectionsMock.mockReturnValue({ data: [SELECTION], isLoading: false })
    useIssueCatalogMock.mockReturnValue({ data: CATALOG, isLoading: false })
    const { getByText, container } = wrap(<StateIssuePositionsCard officialId="oid" />)

    expect(getByText(/★ Your priority/i)).toBeTruthy()
    const text = container.textContent ?? ''
    expect(text.indexOf('Sierra Club')).toBeGreaterThan(-1)
    expect(text.indexOf('Sierra Club')).toBeLessThan(text.indexOf('NRA'))
  })

  it('renders NO tag and preserves grouped order when there are no selections', () => {
    useRatingsMock.mockReturnValue({ data: NRA_THEN_SIERRA, isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    useMySelectionsMock.mockReturnValue({ data: [], isLoading: false })
    useIssueCatalogMock.mockReturnValue({ data: CATALOG, isLoading: false })
    const { queryByText, getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)

    expect(queryByText(/★ Your priority/i)).toBeNull()
    // Existing grouped-by-lean behavior intact (both lean headers + orgs present).
    expect(getByText('Progressive')).toBeTruthy()
    expect(getByText('Conservative')).toBeTruthy()
    expect(getByText('Sierra Club')).toBeTruthy()
    expect(getByText('NRA')).toBeTruthy()
  })

  it('clicking a tagged row still mounts the evidence panel', () => {
    useRatingsMock.mockReturnValue({ data: NRA_THEN_SIERRA, isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    useMySelectionsMock.mockReturnValue({ data: [SELECTION], isLoading: false })
    useIssueCatalogMock.mockReturnValue({ data: CATALOG, isLoading: false })
    const { getByText, queryByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(queryByText(/No matching votes for this subject/i)).toBeNull()
    fireEvent.click(getByText('Sierra Club'))
    expect(getByText(/No matching votes for this subject/i)).toBeTruthy()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateIssuePositionsCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useRatingsMock.mockReturnValue({ data: [], isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider client={qc}>
          <StateIssuePositionsCard officialId="oid" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(tree, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(tree, { wrapper: darkWrapper })).not.toThrow()
  })
})

const WATCHLIST_FLAG = {
  topicSlug: 'environment',
  lensSlug: 'industry-donor-recipients',
  label: 'Industry Donor Recipients',
  category: 'fossil-fuel',
  totalAmount: 42000,
  evidence: [{ industry: 'Oil & Gas', amount: 42000 }],
}

describe('StateIssuePositionsCard — watchlist flags', () => {
  it('renders a watchlist flag even with no scorecard ratings', () => {
    useRatingsMock.mockReturnValue({ data: [], isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    useRepWatchlistFlagsMock.mockReturnValue({ data: [WATCHLIST_FLAG], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="off-1" />)
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
  })
})
