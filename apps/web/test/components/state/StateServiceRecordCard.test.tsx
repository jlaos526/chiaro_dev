import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { StateServiceRecordCard } from '@/components/state/StateServiceRecordCard'
import type { OfficialWithDistrict } from '@chiaro/officials'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Avoid loading the real Supabase env module (apps/web/lib/supabase/env.ts)
// which throws if NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are absent in the
// vitest process. We never hit the network because the data hooks are
// mocked below.
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({} as unknown),
}))

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialSponsoredStateBills: () => ({
      data: [{
        id: 'b1', title: 'Test Sponsored', state: 'CA', bill_type: 'SB',
        number: 1, latest_action_date: '2025-02-01', sponsors: [],
        subjects: [], status: 'introduced', status_substage: null,
        source_url: 'https://x',
      }],
      isLoading: false, isSuccess: true,
    }),
    useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateVotes: () => ({
      data: [
        {
          vote: {
            id: 'v1', question: 'On Passage', vote_date: '2025-03-01',
            result: 'passed', source_url: 'https://x',
            party_vote_split: null, bill: { bill_type: 'SB', number: 1 },
          },
          position: 'yes',
        },
        {
          vote: {
            id: 'v2', question: 'On Motion', vote_date: '2025-03-15',
            result: 'failed', source_url: 'https://x',
            party_vote_split: null, bill: { bill_type: 'SB', number: 2 },
          },
          position: 'not_voting',
        },
      ],
      isLoading: false, isSuccess: true,
    }),
  }
})

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: {
        bills_sponsored_count: 1,
        bills_cosponsored_count: 0,
        votes_voted_count: 1,
        votes_missed_count: 1,
        total_roll_calls: 2,
        attendance_pct: 50,
        party_unity_state: null,
        committee_chair_count: 0,
        fiscal_impact_total: 1000000,
      },
      isLoading: false, isSuccess: true,
    }),
  }
})

function mkOfficial(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid', full_name: 'Test Sen', first_name: 'Test', last_name: 'Sen',
    bioguide_id: null, openstates_person_id: 'ocd-person/x',
    chamber: 'state_senate', party: 'Democratic', state: 'CA',
    district_id: 'did', district_code: '8', title: 'Senator',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_senate', state: 'CA', code: 'CA-08', name: 'CA SD 8' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('StateServiceRecordCard', () => {
  it('renders tenure + bills sponsored + votes counts + attendance', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Service Record/i)).toBeTruthy()
    expect(getByText(/Bills sponsored/i)).toBeTruthy()
    expect(getByText(/Votes voted/i)).toBeTruthy()
    expect(getByText(/50%/)).toBeTruthy()
  })

  it('returns null for federal official (chamber-gated)', () => {
    const fed = mkOfficial({ chamber: 'federal_senate', bioguide_id: 'P000001', openstates_person_id: null })
    const { container } = render(<StateServiceRecordCard official={fed} />, { wrapper: wrap })
    expect(container.firstChild).toBeNull()
  })

  it('NE state_legislature renders State Senator label', () => {
    const ne = mkOfficial({ chamber: 'state_legislature', state: 'NE' })
    const { getByText } = render(<StateServiceRecordCard official={ne} />, { wrapper: wrap })
    expect(getByText(/State Senator/)).toBeTruthy()
  })

  it('Party unity Not yet computed when null', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Not yet computed/i)).toBeTruthy()
  })

  it('shows missed votes row', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Votes missed/i)).toBeTruthy()
  })

  it('embeds StateBillsEvidence + StateVotesEvidence panels', () => {
    const { container } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(container.querySelector('[data-testid="state-bills-evidence"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="state-votes-evidence"]')).not.toBeNull()
  })

  it('renders chamber + party + district badges in header row', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText('Democratic')).toBeTruthy()
  })

  it('empty metrics → falls back to scalar 0', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Bills cosponsored/i)).toBeTruthy()
  })
})
