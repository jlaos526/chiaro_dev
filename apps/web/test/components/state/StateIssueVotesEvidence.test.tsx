import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useStateVotesOnSubjectMock = vi.fn()

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: (...args: unknown[]) => useStateVotesOnSubjectMock(...args),
  }
})

import { StateIssueVotesEvidence } from '@/components/state/StateIssueVotesEvidence'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('StateIssueVotesEvidence', () => {
  it('renders empty-state when no matching votes', () => {
    useStateVotesOnSubjectMock.mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/No matching votes/i)).toBeTruthy()
  })

  it('renders vote rows when matches exist', () => {
    useStateVotesOnSubjectMock.mockReturnValue({
      data: [{
        position: 'yes',
        vote: {
          id: 'v1', openstates_vote_id: 'ocd-vote/x', bill_id: 'b1',
          state: 'CA', session: '20252026', chamber: 'state_senate',
          vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
          source_url: 'https://x', party_vote_split: null, created_at: '2025-03-01',
          bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'CA Clean Energy Act' },
        },
      }],
      isLoading: false, isSuccess: true,
    })
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/CA Clean Energy Act/i)).toBeTruthy()
    expect(getByText(/On Passage/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    useStateVotesOnSubjectMock.mockReturnValue({
      data: undefined, isLoading: true, isSuccess: false,
    })
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/Loading/i)).toBeTruthy()
  })

  it('unknown issue_area passes empty subjects to hook', () => {
    useStateVotesOnSubjectMock.mockClear()
    useStateVotesOnSubjectMock.mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    })
    wrap(<StateIssueVotesEvidence officialId="oid" issueArea="something-unknown" />)
    // 3rd arg to the hook is subjects[]
    expect(useStateVotesOnSubjectMock).toHaveBeenCalledWith(expect.anything(), 'oid', [])
  })
})
