import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/lib/supabase', () => ({ supabase: {} as unknown }))

let mockFinance: unknown = null
let mockLoading = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials')
  return {
    ...actual,
    useOfficialFinance: () => ({
      data: mockFinance,
      isLoading: mockLoading,
      isSuccess: !mockLoading,
    }),
  }
})

import { FederalFinanceCard } from '@/components/federal/FederalFinanceCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockFinance = null
  mockLoading = false
})

describe('mobile FederalFinanceCard', () => {
  it('renders empty state when finance null', () => {
    const { getByText } = render(<FederalFinanceCard officialId="oid" cycle="2024" />, { wrapper: wrap })
    expect(getByText(/No finance data available/i)).toBeTruthy()
  })

  it('renders summary line with total raised + counts', () => {
    mockFinance = {
      summary: { total_raised: 2_500_000 },
      individualDonors: [
        { donor_name: 'Alice', amount: 1000 },
        { donor_name: 'Bob', amount: 2000 },
      ],
      pacs: [{ pac_name: 'PAC1', amount: 5000 }],
      industries: [], topOrgs: [],
    }
    const { getByText } = render(<FederalFinanceCard officialId="oid" cycle="2024" />, { wrapper: wrap })
    expect(getByText(/Finance \(2024\)/)).toBeTruthy()
    expect(getByText(/\$2\.50M raised · 2 donors · 1 PAC/)).toBeTruthy()
  })

  it('Top Donors subsection expands on press', () => {
    mockFinance = {
      summary: { total_raised: 100 },
      individualDonors: [{ donor_name: 'Alice Adams', amount: 5000 }],
      pacs: [],
      industries: [], topOrgs: [],
    }
    const { getByText, queryByText } = render(<FederalFinanceCard officialId="oid" cycle="2024" />, { wrapper: wrap })
    expect(queryByText('Alice Adams')).toBeNull()
    fireEvent.press(getByText(/Top individual donors/i))
    expect(getByText('Alice Adams')).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoading = true
    const { getByText } = render(<FederalFinanceCard officialId="oid" cycle="2024" />, { wrapper: wrap })
    expect(getByText(/Loading finance/i)).toBeTruthy()
  })
})
