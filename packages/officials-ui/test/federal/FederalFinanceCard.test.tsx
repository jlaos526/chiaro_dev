import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useFinanceMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialFinance: (...args: unknown[]) => useFinanceMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { FederalFinanceCard } from '../../src/federal/FederalFinanceCard.tsx'

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
  useFinanceMock.mockReset()
})

describe('FederalFinanceCard', () => {
  it('renders loading state', () => {
    useFinanceMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    const { getByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(getByText(/Loading finance/i)).toBeTruthy()
  })

  it('renders empty state when no finance data', () => {
    useFinanceMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(getByText(/No finance data available/i)).toBeTruthy()
  })

  it('renders summary with formatted totals and counts', () => {
    useFinanceMock.mockReturnValue({
      data: {
        summary: { total_raised: 2_500_000 },
        individualDonors: [
          { donor_name: 'Alice', amount: 5000 },
          { donor_name: 'Bob', amount: 3000 },
        ],
        pacs: [{ pac_name: 'PAC One', amount: 10000 }],
      },
      isLoading: false,
      isSuccess: true,
    })
    const { getByText } = wrap(<FederalFinanceCard officialId="oid" cycle="2024" />)
    expect(getByText(/\$2\.50M raised/)).toBeTruthy()
    expect(getByText(/2 donors/i)).toBeTruthy()
    expect(getByText(/1 PAC/i)).toBeTruthy()
  })

  it('Donors subsection expands on press', () => {
    useFinanceMock.mockReturnValue({
      data: {
        summary: { total_raised: 1000 },
        individualDonors: [{ donor_name: 'Alice', amount: 5000 }],
        pacs: [],
      },
      isLoading: false,
      isSuccess: true,
    })
    const { getByText, queryByText } = wrap(
      <FederalFinanceCard officialId="oid" cycle="2024" />,
    )
    expect(queryByText('Alice')).toBeNull()
    fireEvent.click(getByText(/Top individual donors/i))
    expect(getByText('Alice')).toBeTruthy()
  })
})
