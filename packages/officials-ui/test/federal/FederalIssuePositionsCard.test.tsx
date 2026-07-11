import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useScorecardsMock = vi.fn()
const useMySelectionsMock = vi.fn()
const useIssueCatalogMock = vi.fn()
const useRepWatchlistFlagsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialScorecardRatings: (...args: unknown[]) => useScorecardsMock(...args),
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

// Catalog whose "civil-rights" lens maps to the ACLU scorecard org slug.
const CATALOG = [
  {
    slug: 'civil-rights',
    name: 'Civil Rights',
    display_order: 0,
    lenses: [
      {
        topic_slug: 'civil-rights',
        slug: 'liberties',
        lens_type: 'stance',
        measurement_sources: [{ type: 'scorecard', weight: 1, config: { orgs: ['aclu'] } }],
        quiz_questions: [],
      },
    ],
  },
]
const SELECTION = {
  topic_slug: 'civil-rights',
  lens_slug: 'liberties',
  position: 80,
  importance: 1,
  display_order: 0,
  selected_at: '2026-01-01',
  user_id: 'u1',
}

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { FederalIssuePositionsCard } from '../../src/federal/FederalIssuePositionsCard.tsx'

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
  useScorecardsMock.mockReset()
  useMySelectionsMock.mockReset()
  useIssueCatalogMock.mockReset()
  useRepWatchlistFlagsMock.mockReset()
})

describe('FederalIssuePositionsCard', () => {
  it('renders loading state', () => {
    useScorecardsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })

  it('renders empty state when no ratings', () => {
    useScorecardsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings available/i)).toBeTruthy()
  })

  it('renders summary with org + lean counts', () => {
    useScorecardsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          org_id: 'aclu',
          score_numeric: 80,
          source_url: null,
          org: { name: 'ACLU', lean: 'left', issue_area: 'civil-rights', scoring_max: 100 },
        },
        {
          id: 'r2',
          official_id: 'oid',
          org_id: 'nra',
          score_numeric: 30,
          source_url: null,
          org: { name: 'NRA', lean: 'right', issue_area: 'guns', scoring_max: 100 },
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    expect(getByText(/2 orgs rated/i)).toBeTruthy()
    expect(getByText(/2 lean groups/i)).toBeTruthy()
  })
})

// Two scorecard rows where NRA is listed BEFORE ACLU so a successful
// matched-first sort is observable (ACLU floats above NRA).
const NRA_THEN_ACLU = [
  {
    id: 'r-nra',
    official_id: 'oid',
    org_id: 'nra',
    score_numeric: 30,
    source_url: null,
    score: 30,
    org: { name: 'NRA', lean: 'conservative', issue_area: 'guns', scoring_max: 100, slug: 'nra' },
  },
  {
    id: 'r-aclu',
    official_id: 'oid',
    org_id: 'aclu',
    score_numeric: 80,
    source_url: null,
    score: 80,
    org: {
      name: 'ACLU',
      lean: 'progressive',
      issue_area: 'civil-rights',
      scoring_max: 100,
      slug: 'aclu',
    },
  },
]

describe('FederalIssuePositionsCard — priority tagging', () => {
  it('tags the matched org row and floats it to the top', () => {
    useScorecardsMock.mockReturnValue({ data: NRA_THEN_ACLU, isLoading: false, isSuccess: true })
    useMySelectionsMock.mockReturnValue({ data: [SELECTION], isLoading: false })
    useIssueCatalogMock.mockReturnValue({ data: CATALOG, isLoading: false })
    const { getByText, container } = wrap(<FederalIssuePositionsCard officialId="oid" />)

    // The ★ tag is rendered exactly once (for ACLU).
    expect(getByText(/★ Your priority/i)).toBeTruthy()

    // ACLU (matched) now precedes NRA in DOM order despite original order.
    const text = container.textContent ?? ''
    expect(text.indexOf('ACLU')).toBeLessThan(text.indexOf('NRA'))
    expect(text.indexOf('ACLU')).toBeGreaterThan(-1)
  })

  it('renders NO tag and preserves original order when there are no selections', () => {
    useScorecardsMock.mockReturnValue({ data: NRA_THEN_ACLU, isLoading: false, isSuccess: true })
    useMySelectionsMock.mockReturnValue({ data: [], isLoading: false })
    useIssueCatalogMock.mockReturnValue({ data: CATALOG, isLoading: false })
    const { queryByText, getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)

    expect(queryByText(/★ Your priority/i)).toBeNull()
    // Existing grouped-by-lean behavior intact: both orgs + the summary present.
    expect(getByText(/2 orgs rated/i)).toBeTruthy()
    expect(getByText('ACLU')).toBeTruthy()
    expect(getByText('NRA')).toBeTruthy()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

const WATCHLIST_FLAG = {
  topicSlug: 'environment',
  lensSlug: 'industry-donor-recipients',
  label: 'Industry Donor Recipients',
  category: 'fossil-fuel',
  totalAmount: 42000,
  evidence: [{ industry: 'Oil & Gas', amount: 42000 }],
}

describe('FederalIssuePositionsCard — watchlist flags', () => {
  it('renders a watchlist flag even with no scorecard ratings', () => {
    useScorecardsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    useRepWatchlistFlagsMock.mockReturnValue({ data: [WATCHLIST_FLAG], isLoading: false })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="off-1" />)
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
  })

  it('renders a watchlist flag alongside scorecard ratings', () => {
    useScorecardsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          org_id: 'aclu',
          score_numeric: 80,
          source_url: null,
          org: { name: 'ACLU', lean: 'left', issue_area: 'civil-rights', scoring_max: 100 },
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    useRepWatchlistFlagsMock.mockReturnValue({ data: [WATCHLIST_FLAG], isLoading: false })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="off-1" />)
    // Flag renders in the normal (ratings-present) branch: both the flag label
    // and the scorecard summary line are present.
    expect(getByText(/Industry Donor Recipients/i)).toBeTruthy()
    expect(getByText(/1 org rated/i)).toBeTruthy()
  })
})

describe('FederalIssuePositionsCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useScorecardsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          org_id: 'aclu',
          score_numeric: 80,
          source_url: null,
          org: { name: 'ACLU', lean: 'progressive', issue_area: 'civil-rights', scoring_max: 100 },
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const ui = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <FederalIssuePositionsCard officialId="oid" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(ui, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(ui, { wrapper: darkWrapper })).not.toThrow()
  })
})
