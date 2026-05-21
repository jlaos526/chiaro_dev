import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateFinanceSummary: () => ({
      data: {
        id: 's1', official_id: 'oid', cycle: '2023-2024',
        total_raised: 250000, total_disbursed: 180000,
        small_donor_pct: 22.5, in_state_pct: 78.0,
        source: 'ca-cal-access', source_url: 'https://x',
        ingested_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false, isSuccess: true,
    }),
    useOfficialStateDonors: () => ({
      data: [
        { state_finance_summary_id: 's1', rank: 1, donor_name: 'Alice', amount: 5000, employer: null, occupation: null, city: null, donor_state: null },
      ],
      isLoading: false, isSuccess: true,
    }),
  }
})

import { StateFinanceCard } from '@/components/state/StateFinanceCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

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

describe('StateFinanceCard', () => {
  it('renders Finance header + cycle label + source pill', () => {
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
    expect(getByText(/Small.donor/i)).toBeTruthy()
    expect(getByText(/22.5%/)).toBeTruthy()
    expect(getByText(/In.state/i)).toBeTruthy()
    expect(getByText(/78%/)).toBeTruthy()
  })

  it('returns null for federal official (chamber-gated)', () => {
    const fed = mkOfficial({ chamber: 'federal_senate', bioguide_id: 'P000001', openstates_person_id: null })
    const { container } = render(<StateFinanceCard official={fed} />, { wrapper: wrap })
    expect(container.firstChild).toBeNull()
  })

  it('embeds StateDonorsEvidence panel', () => {
    const { container } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(container.querySelector('[data-testid="state-donors-evidence"]')).not.toBeNull()
  })

  it('renders em-dash for null scalar fields', async () => {
    vi.resetModules()
    vi.doMock('@chiaro/officials', async () => {
      const actual = await vi.importActual<object>('@chiaro/officials')
      return {
        ...actual,
        useOfficialStateFinanceSummary: () => ({
          data: {
            id: 's1', official_id: 'oid', cycle: '2024',
            total_raised: 100000, total_disbursed: null,
            small_donor_pct: null, in_state_pct: null,
            source: 'ny-nysboe', source_url: 'https://x',
            ingested_at: '2025-01-01T00:00:00Z',
          },
          isLoading: false, isSuccess: true,
        }),
        useOfficialStateDonors: () => ({ data: [], isLoading: false, isSuccess: true }),
      }
    })
    const { StateFinanceCard: Reimported } = await import('@/components/state/StateFinanceCard')
    const { getAllByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
    expect(getAllByText(/—/).length).toBeGreaterThanOrEqual(3)
  })

  it('NE state_legislature is chamber-eligible (renders the card)', () => {
    const ne = mkOfficial({ chamber: 'state_legislature', state: 'NE' })
    const { getByText } = render(<StateFinanceCard official={ne} />, { wrapper: wrap })
    expect(getByText(/Finance/i)).toBeTruthy()
  })

  it('no-summary path renders empty-state copy', async () => {
    vi.resetModules()
    vi.doMock('@chiaro/officials', async () => {
      const actual = await vi.importActual<object>('@chiaro/officials')
      return {
        ...actual,
        useOfficialStateFinanceSummary: () => ({ data: null, isLoading: false, isSuccess: true }),
        useOfficialStateDonors: () => ({ data: [], isLoading: false, isSuccess: true }),
      }
    })
    const { StateFinanceCard: Reimported } = await import('@/components/state/StateFinanceCard')
    const { getByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/no state finance data/i)).toBeTruthy()
  })
})
