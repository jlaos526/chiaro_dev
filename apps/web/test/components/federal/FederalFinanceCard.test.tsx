import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

const useFinanceMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialFinance: (...args: unknown[]) => useFinanceMock(...args),
  }
})

import { FederalFinanceCard } from '@/components/federal/FederalFinanceCard'

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const SAMPLE_FINANCE = {
  summary: {
    id: 'fs1',
    cycle: '2024',
    official_id: 'oid',
    opensecrets_id: 'os1',
    source_url: 'https://opensecrets.org/x',
    total_raised: 1250000,
    total_disbursed: 1100000,
    in_state_pct: 40,
    out_of_state_pct: 60,
    small_donor_pct: 20,
    ingested_at: '2026-01-01',
  },
  industries: [],
  pacs: [
    { id: 'p1', finance_summary_id: 'fs1', pac_name: 'ActBlue', amount: 25000, rank: 1, ingested_at: '2026-01-01' },
  ],
  individualDonors: [
    { id: 'd1', finance_summary_id: 'fs1', donor_name: 'Jane Doe', employer: null, occupation: null, amount: 5000, rank: 1, ingested_at: '2026-01-01' },
    { id: 'd2', finance_summary_id: 'fs1', donor_name: 'John Smith', employer: null, occupation: null, amount: 3000, rank: 2, ingested_at: '2026-01-01' },
  ],
  topOrgs: [],
}

describe('FederalFinanceCard', () => {
  it('renders empty state when finance data is null', () => {
    useFinanceMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(getByText(/No finance data available/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    useFinanceMock.mockReturnValue({ data: SAMPLE_FINANCE, isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(getByText(/\$1\.25M raised/)).toBeTruthy()
    expect(getByText(/2 donors/i)).toBeTruthy()
    expect(getByText(/1 PAC/i)).toBeTruthy()
  })

  it('Donors subsection expands on click', () => {
    useFinanceMock.mockReturnValue({ data: SAMPLE_FINANCE, isLoading: false, isSuccess: true })
    const { getByText, queryByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(queryByText(/Jane Doe/)).toBeNull()
    fireEvent.click(getByText(/Top individual donors/i))
    expect(getByText(/Jane Doe/)).toBeTruthy()
  })

  it('renders loading state', () => {
    useFinanceMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    const { getByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(getByText(/Loading finance/i)).toBeTruthy()
  })
})
