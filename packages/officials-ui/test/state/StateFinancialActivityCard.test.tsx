import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useDisclosuresMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateFinancialDisclosures: (...args: unknown[]) => useDisclosuresMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateFinancialActivityCard } from '../../src/state/StateFinancialActivityCard.tsx'

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
  useDisclosuresMock.mockReset()
})

describe('StateFinancialActivityCard', () => {
  it('renders loading', () => {
    useDisclosuresMock.mockReturnValue({ data: undefined, isLoading: true })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/Loading financial disclosures/i)).toBeTruthy()
  })

  it('renders empty when no disclosures', () => {
    useDisclosuresMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/No financial-disclosure records on file for this legislator/i)).toBeTruthy()
  })

  it('renders summary with count + latest year', () => {
    useDisclosuresMock.mockReturnValue({
      data: [{ id: 'd1', filing_year: 2024 }],
      isLoading: false,
    })
    const { getByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(getByText(/1 disclosure \(latest 2024\)/i)).toBeTruthy()
  })

  it('Financial disclosures subsection expands on press', () => {
    useDisclosuresMock.mockReturnValue({
      data: [
        {
          id: 'd1',
          official_id: 'oid',
          filing_year: 2024,
          income_source: 'Acme Consulting Group',
          income_kind: 'consulting',
          amount_range_low: 10_000,
          amount_range_high: 50_000,
        },
      ],
      isLoading: false,
    })
    const { getByText, queryByText } = wrap(<StateFinancialActivityCard officialId="oid" />)
    expect(queryByText(/Acme Consulting/)).toBeNull()
    fireEvent.click(getByText(/^▸ Financial disclosures/))
    expect(getByText(/Acme Consulting/)).toBeTruthy()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateFinancialActivityCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useDisclosuresMock.mockReturnValue({ data: [], isLoading: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider client={qc}>
          <StateFinancialActivityCard officialId="oid" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(tree, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(tree, { wrapper: darkWrapper })).not.toThrow()
  })
})
