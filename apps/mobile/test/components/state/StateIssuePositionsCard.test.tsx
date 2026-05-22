import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Avoid loading the real Supabase env module which throws when env vars are absent.
jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

// Mutable mock state — see [[feedback-jest-expo-dynamic-mock-pattern]].
const DEFAULT_RATINGS: unknown[] = []
let mockRatings: unknown[] = DEFAULT_RATINGS
let mockLoading = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateScorecardRatings: () => ({
      data: mockRatings,
      isLoading: mockLoading,
      isSuccess: !mockLoading,
    }),
  }
})

jest.mock('@chiaro/state-bills', () => {
  const actual = jest.requireActual('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: () => ({
      data: [],
      isLoading: false,
      isSuccess: true,
    }),
  }
})

// Import after mocks.
import { StateIssuePositionsCard } from '@/components/state/StateIssuePositionsCard'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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

beforeEach(() => {
  mockRatings = DEFAULT_RATINGS
  mockLoading = false
})

describe('mobile StateIssuePositionsCard', () => {
  it('renders empty-state when no ratings', () => {
    const { getByText } = render(
      <StateIssuePositionsCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/No issue-position ratings available/i)).toBeTruthy()
  })

  it('renders rating rows from multiple orgs', () => {
    mockRatings = [
      ratingFx({ slug: 'aclu', score: 90 }),
      ratingFx({ slug: 'lcv', score: 85, lean: 'progressive', issue_area: 'environment' }),
    ]
    const { getByText } = render(
      <StateIssuePositionsCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/aclu CA/i)).toBeTruthy()
    expect(getByText(/lcv CA/i)).toBeTruthy()
  })

  it('expanding a rating row shows evidence panel', () => {
    mockRatings = [ratingFx({ slug: 'lcv', issue_area: 'environment' })]
    const { getByText, queryByText } = render(
      <StateIssuePositionsCard officialId="oid" />,
      { wrapper: wrap },
    )
    // Evidence panel not present before expanding.
    expect(queryByText(/No matching votes/i)).toBeNull()
    fireEvent.press(getByText(/lcv CA/i))
    expect(getByText(/No matching votes/i)).toBeTruthy()
  })

  it('renders loading skeleton', () => {
    mockLoading = true
    const { getByText } = render(
      <StateIssuePositionsCard officialId="oid" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })
})
