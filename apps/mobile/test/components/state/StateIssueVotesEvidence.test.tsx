import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Avoid loading the real Supabase env module which throws when
// EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are absent in the jest process.
jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

// Mutable mock state — tests reassign before rendering so the same jest.mock
// factory closure can serve different fixtures without jest.resetModules()
// (which breaks React's module identity under jest-expo).
let mockVotes: unknown = []
let mockLoading = false

jest.mock('@chiaro/state-bills', () => {
  const actual = jest.requireActual('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: () => ({
      data: mockVotes,
      isLoading: mockLoading,
      isSuccess: !mockLoading,
    }),
  }
})

// Import after mocks.
import { StateIssueVotesEvidence } from '@/components/state/StateIssueVotesEvidence'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockVotes = []
  mockLoading = false
})

describe('mobile StateIssueVotesEvidence', () => {
  it('renders empty-state when no matching votes', () => {
    const { getByText } = render(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
      { wrapper: wrap },
    )
    expect(getByText(/No matching votes/i)).toBeTruthy()
  })

  it('renders vote rows when matches exist', () => {
    mockVotes = [
      {
        position: 'yes',
        vote: {
          id: 'v1',
          state: 'CA',
          session: '20252026',
          chamber: 'state_senate',
          vote_date: '2025-03-01',
          question: 'On Passage',
          result: 'passed',
          bill: { bill_type: 'SB', number: 100, title: 'CA Clean Energy Act' },
        },
      },
    ]
    const { getByText } = render(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
      { wrapper: wrap },
    )
    expect(getByText(/CA Clean Energy Act/i)).toBeTruthy()
    expect(getByText(/YES/)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoading = true
    const { getByText } = render(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
      { wrapper: wrap },
    )
    expect(getByText(/Loading evidence votes/i)).toBeTruthy()
  })
})
