import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useScorecardsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialScorecardRatings: (...args: unknown[]) => useScorecardsMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
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

afterEach(() => {
  useScorecardsMock.mockReset()
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
