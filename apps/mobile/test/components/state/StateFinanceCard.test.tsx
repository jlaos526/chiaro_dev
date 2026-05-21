import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'

// Avoid loading the real Supabase env module (apps/mobile/lib/env.ts) which
// throws when EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are absent in the jest
// process. We never hit the network because the data hooks are mocked below.
jest.mock('@/lib/supabase', () => ({
  supabase: {} as unknown,
}))

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateFinanceSummary: () => ({
      data: {
        id: 's1',
        official_id: 'oid',
        cycle: '2023-2024',
        total_raised: 250000,
        total_disbursed: 180000,
        small_donor_pct: 22.5,
        in_state_pct: 78.0,
        source: 'ca-cal-access',
        source_url: 'https://x',
        ingested_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false,
      isSuccess: true,
    }),
    useOfficialStateDonors: () => ({
      data: [
        {
          state_finance_summary_id: 's1',
          rank: 1,
          donor_name: 'Alice',
          amount: 5000,
          employer: null,
          occupation: null,
          city: null,
          donor_state: null,
        },
      ],
      isLoading: false,
      isSuccess: true,
    }),
  }
})

// Import the component AFTER jest.mock declarations to ensure mocks apply.
import { StateFinanceCard } from '@/components/state/StateFinanceCard'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mkOfficial(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid',
    full_name: 'Test Sen',
    first_name: 'Test',
    last_name: 'Sen',
    bioguide_id: null,
    openstates_person_id: 'ocd-person/x',
    chamber: 'state_senate',
    party: 'Democratic',
    state: 'CA',
    district_id: 'did',
    district_code: '8',
    title: 'Senator',
    senate_class: null,
    in_office: true,
    source_version: 'openstates',
    opensecrets_id: null,
    fec_candidate_id: null,
    district: { id: 'did', tier: 'state_senate', state: 'CA', code: 'CA-08', name: 'CA SD 8' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('mobile StateFinanceCard', () => {
  it('renders Finance header + cycle + source label', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Finance/i)).toBeTruthy()
    expect(getByText(/2023.2024/)).toBeTruthy()
    expect(getByText(/Cal-Access/i)).toBeTruthy()
  })

  it('renders 4 scalar rows: Total raised, Total disbursed, Small-donor %, In-state %', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Total raised/i)).toBeTruthy()
    expect(getByText(/\$250,000/)).toBeTruthy()
    expect(getByText(/Total disbursed/i)).toBeTruthy()
    expect(getByText(/\$180,000/)).toBeTruthy()
    expect(getByText(/Small.donor/i)).toBeTruthy()
    expect(getByText(/22.5%/)).toBeTruthy()
    expect(getByText(/In.state/i)).toBeTruthy()
    expect(getByText(/78%/)).toBeTruthy()
  })

  it('returns null for federal official (chamber-gated)', () => {
    const fed = mkOfficial({ chamber: 'federal_senate', bioguide_id: 'P000001', openstates_person_id: null })
    const { toJSON } = render(<StateFinanceCard official={fed} />, { wrapper: wrap })
    expect(toJSON()).toBeNull()
  })

  it('embeds StateDonorsEvidence panel', () => {
    const { queryByTestId } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(queryByTestId('state-donors-evidence')).not.toBeNull()
  })

  it('NE state_legislature is chamber-eligible (renders the card)', () => {
    const ne = mkOfficial({ chamber: 'state_legislature', state: 'NE' })
    const { getByText } = render(<StateFinanceCard official={ne} />, { wrapper: wrap })
    expect(getByText(/Finance/i)).toBeTruthy()
  })

  it('renders Top donors header with donor count', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Top donors \(1\)/)).toBeTruthy()
  })

  it('dollar amounts use comma-grouped formatting', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/\$250,000/)).toBeTruthy()
    expect(getByText(/\$180,000/)).toBeTruthy()
  })
})
