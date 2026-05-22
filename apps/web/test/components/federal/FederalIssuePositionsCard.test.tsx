import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useRatingsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialScorecardRatings: (...args: unknown[]) => useRatingsMock(...args),
  }
})

import { FederalIssuePositionsCard } from '@/components/federal/FederalIssuePositionsCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('FederalIssuePositionsCard', () => {
  it('renders empty state when no ratings', () => {
    useRatingsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings available/i)).toBeTruthy()
  })

  it('renders summary row with orgs + lean groups count', () => {
    useRatingsMock.mockReturnValue({
      data: [
        { id: 'r1', score: 95, org: { name: 'ACLU', lean: 'progressive', issue_area: 'civil rights', scoring_max: 100 } },
        { id: 'r2', score: 12, org: { name: 'Heritage', lean: 'conservative', issue_area: 'fiscal', scoring_max: 100 } },
        { id: 'r3', score: 80, org: { name: 'EFF',   lean: 'progressive', issue_area: 'tech', scoring_max: 100 } },
      ],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    expect(getByText(/3 orgs rated/i)).toBeTruthy()
    expect(getByText(/2 lean groups/i)).toBeTruthy()
  })

  it('renders ratings inline (no subsection)', () => {
    useRatingsMock.mockReturnValue({
      data: [
        { id: 'r1', score: 95, org: { name: 'ACLU', lean: 'progressive', issue_area: 'civil rights', scoring_max: 100 } },
      ],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    // Ratings render directly without requiring a click.
    expect(getByText(/ACLU/)).toBeTruthy()
  })

  it('renders loading state', () => {
    useRatingsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    const { getByText } = wrap(<FederalIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })
})
