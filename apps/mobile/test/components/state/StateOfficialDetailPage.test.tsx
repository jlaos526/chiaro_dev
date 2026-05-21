import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'

// Mocks must be declared before the component import.
// Avoid loading apps/mobile/lib/supabase which pulls in AsyncStorage native module.
jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

jest.mock('@chiaro/state-bills', () => {
  const actual = jest.requireActual('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialSponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateVotes: () => ({ data: [], isLoading: false, isSuccess: true }),
  }
})

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
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
    useOfficialStateFinanceSummary: () => ({ data: null, isLoading: false, isSuccess: true }),
    useOfficialStateDonors: () => ({ data: [], isLoading: false, isSuccess: true }),
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

describe('mobile StateOfficialDetailPage', () => {
  it('renders bio header with name + party + district', () => {
    const { getByText, getAllByText } = render(
      <StateOfficialDetailPage official={mkState()} offices={[]} />,
      { wrapper: wrap },
    )
    expect(getByText('Test Asm')).toBeTruthy()
    // Party + chamber render in both bio header AND Service Record header.
    expect(getAllByText(/Democratic/).length).toBeGreaterThanOrEqual(1)
    expect(getByText(/CA-15/)).toBeTruthy()
  })

  it('renders Service Record + Finance + 3 ComingSoonCard placeholders', () => {
    const { getAllByText } = render(
      <StateOfficialDetailPage official={mkState()} offices={[]} />,
      { wrapper: wrap },
    )
    // 'Service Record' rendered by <StateServiceRecordCard>; 'Finance' rendered by
    // <StateFinanceCard> (empty-state header). Remaining 3 are placeholders.
    const titles = [
      'Service Record',
      'Finance',
      'Issue Positions',
      'Community Presence',
      'Ethics & Accountability',
    ]
    for (const t of titles) {
      expect(getAllByText(t).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders offices section above the placeholder cascade', () => {
    const offices = [{
      id: 'o1', official_id: 'oid', address: '1 Capitol, Sacramento CA',
      city: 'Sacramento', state: 'CA', zip: null, phone: '555-0100',
      source_url: 'https://openstates.org/',
    }]
    const { getByText } = render(
      <StateOfficialDetailPage official={mkState()} offices={offices as never} />,
      { wrapper: wrap },
    )
    expect(getByText(/1 Capitol/)).toBeTruthy()
    expect(getByText('555-0100')).toBeTruthy()
  })

  it('NE state_legislature renders chamber as State Senator', () => {
    const ne = mkState({ chamber: 'state_legislature', state: 'NE', title: 'Senator',
      district: { id: 'did', tier: 'state_legislature' as never, state: 'NE', code: 'NE-23', name: 'NE District 23' } })
    const { getAllByText } = render(
      <StateOfficialDetailPage official={ne} offices={[]} />,
      { wrapper: wrap },
    )
    // Bio header + Service Record header both render "State Senator".
    expect(getAllByText(/State Senator/).length).toBeGreaterThanOrEqual(1)
  })

  it('multi-member district shows district code', () => {
    const md = mkState({ state: 'MD', district_code: '1A', title: 'Delegate',
      district: { id: 'did', tier: 'state_house', state: 'MD', code: 'MD-01', name: 'MD HD 01' } })
    const { getByText } = render(
      <StateOfficialDetailPage official={md} offices={[]} />,
      { wrapper: wrap },
    )
    expect(getByText(/Delegate/)).toBeTruthy()
    expect(getByText(/MD-01/)).toBeTruthy()
  })
})
