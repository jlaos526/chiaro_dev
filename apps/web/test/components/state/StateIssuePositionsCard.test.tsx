import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useStateScorecardRatingsMock = vi.fn()
const useStateVotesOnSubjectMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateScorecardRatings: (...args: unknown[]) =>
      useStateScorecardRatingsMock(...args),
  }
})

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: (...args: unknown[]) =>
      useStateVotesOnSubjectMock(...args),
  }
})

import { StateIssuePositionsCard } from '@/components/state/StateIssuePositionsCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const ratingFx = (
  overrides: Partial<{ slug: string; lean: string; score: number; issue_area: string }> = {},
) => ({
  id: `r-${overrides.slug ?? 'aclu'}`,
  scorecard_id: `s-${overrides.slug ?? 'aclu'}`,
  official_id: 'oid',
  session: '20252026',
  score: String(overrides.score ?? 80),
  source_url: 'https://x',
  ingested_at: '2025-01-01',
  org: {
    id: `s-${overrides.slug ?? 'aclu'}`,
    slug: overrides.slug ?? 'aclu',
    state: 'CA',
    name: `${overrides.slug ?? 'aclu'} CA`,
    issue_area: overrides.issue_area ?? 'civil-liberties',
    lean: overrides.lean ?? 'progressive',
    methodology_url: 'https://m',
    scoring_min: 0,
    scoring_max: 100,
    notes: null,
  },
})

describe('StateIssuePositionsCard', () => {
  it('renders empty-state when no ratings', () => {
    useStateScorecardRatingsMock.mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings available/i)).toBeTruthy()
  })

  it('renders 3 rating rows from 3 orgs', () => {
    useStateScorecardRatingsMock.mockReturnValue({
      data: [
        ratingFx({ slug: 'aclu', lean: 'progressive', issue_area: 'civil-liberties' }),
        ratingFx({ slug: 'lcv', lean: 'progressive', issue_area: 'environment' }),
        ratingFx({ slug: 'nra', lean: 'conservative', issue_area: 'second-amendment' }),
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/aclu CA/i)).toBeTruthy()
    expect(getByText(/lcv CA/i)).toBeTruthy()
    expect(getByText(/nra CA/i)).toBeTruthy()
  })

  it('expanding a rating row reveals StateIssueVotesEvidence', () => {
    useStateScorecardRatingsMock.mockReturnValue({
      data: [ratingFx({ slug: 'lcv', issue_area: 'environment' })],
      isLoading: false,
      isSuccess: true,
    })
    useStateVotesOnSubjectMock.mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    })
    const { getByRole, getByText, queryByText } = wrap(
      <StateIssuePositionsCard officialId="oid" />,
    )
    expect(queryByText(/No matching votes/i)).toBeNull()
    fireEvent.click(getByRole('button', { name: /lcv CA/i }))
    expect(getByText(/No matching votes/i)).toBeTruthy()
  })

  it('renders loading skeleton', () => {
    useStateScorecardRatingsMock.mockReturnValue({
      data: undefined, isLoading: true, isSuccess: false,
    })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })

  it('groups ratings by lean header', () => {
    useStateScorecardRatingsMock.mockReturnValue({
      data: [
        ratingFx({ slug: 'aclu', lean: 'progressive' }),
        ratingFx({ slug: 'nra', lean: 'conservative' }),
        ratingFx({ slug: 'pp', lean: 'single-issue' }),
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText('Progressive')).toBeTruthy()
    expect(getByText('Conservative')).toBeTruthy()
    expect(getByText('Single-issue')).toBeTruthy()
  })
})
