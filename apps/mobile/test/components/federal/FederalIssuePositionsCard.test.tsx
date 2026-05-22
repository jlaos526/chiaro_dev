import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockRatings: unknown[] = []
let mockLoading = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialScorecardRatings: () => ({
      data: mockRatings,
      isLoading: mockLoading,
      isSuccess: !mockLoading,
    }),
  }
})

import { FederalIssuePositionsCard } from '@/components/federal/FederalIssuePositionsCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockRatings = []
  mockLoading = false
})

describe('mobile FederalIssuePositionsCard', () => {
  it('renders empty state when no ratings', () => {
    const { getByText } = render(<FederalIssuePositionsCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/No issue-position ratings/i)).toBeTruthy()
  })

  it('renders summary + scorecards list when data present', () => {
    mockRatings = [
      {
        id: 'r1', score: 90,
        org: { name: 'ACLU', lean: 'progressive', issue_area: 'Civil liberties', scoring_max: 100 },
      },
      {
        id: 'r2', score: 30,
        org: { name: 'Heritage', lean: 'conservative', issue_area: 'Limited gov', scoring_max: 100 },
      },
    ]
    const { getByText } = render(<FederalIssuePositionsCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/2 orgs rated · 2 lean groups/i)).toBeTruthy()
    expect(getByText('ACLU')).toBeTruthy()
    expect(getByText('Heritage')).toBeTruthy()
  })

  it('single org + single lean → singular labels', () => {
    mockRatings = [
      {
        id: 'r1', score: 80,
        org: { name: 'ACLU', lean: 'progressive', issue_area: null, scoring_max: 100 },
      },
    ]
    const { getByText } = render(<FederalIssuePositionsCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/1 org rated · 1 lean group/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoading = true
    const { getByText } = render(<FederalIssuePositionsCard officialId="oid" />, { wrapper: wrap })
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })
})
