import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
  }
})

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: {
        bills_sponsored_count: 1, bills_cosponsored_count: 0,
        votes_voted_count: 0, votes_missed_count: 0, total_roll_calls: 0,
        attendance_pct: null, party_unity_state: null, fiscal_impact_total: 0,
        committee_chair_count: null,
        bills_passed_count: null, hearings_held_count: null, subject_breadth: null,
        bill_passage_rate: null, fiscal_impact_per_dollar_raised: null,
      },
      isLoading: false, isSuccess: true,
    }),
    // NEW for slice 5E:
    useOfficialStateFinanceSummary: () => ({ data: null, isLoading: false, isSuccess: true }),
    useOfficialStateDonors:         () => ({ data: [], isLoading: false, isSuccess: true }),
    // NEW for slice 5G:
    useOfficialStateScorecardRatings: () => ({ data: [], isLoading: false, isSuccess: true }),
    // NEW for slice 5H:
    useOfficialStateTownHalls:         () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateDistrictOffices:   () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateCommitteeHearings: () => ({ data: [], isLoading: false, isSuccess: true }),
    // NEW for slice 5I (ethics & accountability):
    useOfficialStateStockTransactions:    () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateFinancialDisclosures: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateEthicsComplaints:     () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateOfficialEvents:       () => ({ data: [], isLoading: false, isSuccess: true }),
  }
})

import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mkState(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid', full_name: 'Test Asm', first_name: 'Test', last_name: 'Asm',
    bioguide_id: null, openstates_person_id: 'ocd-person/x',
    chamber: 'state_house', party: 'Democratic', state: 'CA',
    district_id: 'did', district_code: '15', title: 'Assemblymember',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('StateOfficialDetailPage', () => {
  it('renders bio header with name + party + district', () => {
    const { getAllByText, getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />, { wrapper: wrap })
    expect(getByText('Test Asm')).toBeTruthy()
    expect(getAllByText(/Democratic/).length).toBeGreaterThanOrEqual(1)
    expect(getByText(/CA-15/)).toBeTruthy()
  })

  it('renders all 6 real cards + 0 ComingSoonCard placeholders (slice 5I closes redesign)', () => {
    const { getAllByText, queryByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />, { wrapper: wrap })
    expect(getAllByText(/^(?:Service Record|Issue Positions|Community Presence|Finance|Financial Activity|Conduct & Sanctions)$/i))
      .toHaveLength(6)
    // No more ComingSoonCard placeholder for Ethics & Accountability.
    expect(queryByText(/^Ethics & Accountability$/i)).toBeNull()
  })

  it('renders StateFinancialActivityCard (no longer a placeholder)', () => {
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />, { wrapper: wrap })
    expect(getByText(/No stock or financial-disclosure records on file/i)).toBeTruthy()
  })

  it('renders StateConductCard (no longer a placeholder)', () => {
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />, { wrapper: wrap })
    expect(getByText(/No ethics complaints or conduct events on record/i)).toBeTruthy()
  })

  it('renders StateCommunityPresenceCard (no longer a placeholder)', () => {
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />, { wrapper: wrap })
    // Real card renders its own empty-state copy; ComingSoonCard would render
    // the CATEGORY_COPY string for 'Community Presence'.
    expect(getByText(/No community-presence data available/i)).toBeTruthy()
  })

  it('renders StateIssuePositionsCard (no longer a placeholder)', () => {
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />, { wrapper: wrap })
    // The real card renders its own empty-state copy when there are no ratings;
    // ComingSoonCard would render the CATEGORY_COPY string for 'Issue Positions'.
    expect(getByText(/No issue-position ratings available/i)).toBeTruthy()
  })

  it('renders offices section above the cascade', () => {
    const offices = [{
      id: 'o1', official_id: 'oid', address: '1 Capitol, Sacramento CA',
      city: 'Sacramento', state: 'CA', zip: null, phone: '555-0100',
      source_url: 'https://openstates.org/',
    }]
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={offices as never} />, { wrapper: wrap })
    expect(getByText(/1 Capitol/)).toBeTruthy()
    expect(getByText('555-0100')).toBeTruthy()
  })

  it('NE state_legislature renders chamber as State Senator', () => {
    const ne = mkState({ chamber: 'state_legislature', state: 'NE', title: 'Senator',
      district: { id: 'did', tier: 'state_legislature', state: 'NE', code: 'NE-23', name: 'NE District 23' } as unknown as OfficialWithDistrict['district'] })
    const { getAllByText } = render(<StateOfficialDetailPage official={ne} offices={[]} />, { wrapper: wrap })
    expect(getAllByText(/State Senator/).length).toBeGreaterThanOrEqual(1)
  })

  it('multi-member district shows district_code with title', () => {
    const md = mkState({ state: 'MD', district_code: '1A', title: 'Delegate',
      district: { id: 'did', tier: 'state_house', state: 'MD', code: 'MD-01', name: 'MD HD 01' } })
    const { getByText } = render(<StateOfficialDetailPage official={md} offices={[]} />, { wrapper: wrap })
    expect(getByText(/Delegate/)).toBeTruthy()
    expect(getByText(/MD-01/)).toBeTruthy()
  })
})
