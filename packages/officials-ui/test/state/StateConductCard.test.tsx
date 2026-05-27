import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useComplaintsMock = vi.fn()
const useEventsMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateEthicsComplaints: (...args: unknown[]) => useComplaintsMock(...args),
    useOfficialStateOfficialEvents: (...args: unknown[]) => useEventsMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateConductCard } from '../../src/state/StateConductCard.tsx'

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
  useComplaintsMock.mockReset()
  useEventsMock.mockReset()
})

describe('StateConductCard', () => {
  it('renders loading', () => {
    useComplaintsMock.mockReturnValue({ data: undefined, isLoading: true })
    useEventsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateConductCard officialId="oid" />)
    expect(getByText(/Loading conduct records/i)).toBeTruthy()
  })

  it('renders empty when no complaints and no events', () => {
    useComplaintsMock.mockReturnValue({ data: [], isLoading: false })
    useEventsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateConductCard officialId="oid" />)
    expect(getByText(/No ethics complaints or conduct events/i)).toBeTruthy()
  })

  it('renders summary with counts including open complaints', () => {
    useComplaintsMock.mockReturnValue({
      data: [
        { id: 'c1', status: 'open' },
        { id: 'c2', status: 'closed' },
      ],
      isLoading: false,
    })
    useEventsMock.mockReturnValue({
      data: [{ id: 'e1' }],
      isLoading: false,
    })
    const { getByText } = wrap(<StateConductCard officialId="oid" />)
    expect(getByText(/2 complaints \(1 open\)/i)).toBeTruthy()
    expect(getByText(/1 event/i)).toBeTruthy()
  })

  it('Ethics complaints subsection expands on press', () => {
    useComplaintsMock.mockReturnValue({
      data: [
        {
          id: 'c1',
          official_id: 'oid',
          status: 'open',
          filed_date: '2025-01-15',
          summary: 'Test complaint about lobbying disclosure',
          source_url: 'https://example.com',
        },
      ],
      isLoading: false,
    })
    useEventsMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText, queryByText } = wrap(<StateConductCard officialId="oid" />)
    expect(queryByText(/lobbying disclosure/)).toBeNull()
    fireEvent.click(getByText(/^▸ Ethics complaints/))
    expect(getByText(/lobbying disclosure/)).toBeTruthy()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateConductCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useComplaintsMock.mockReturnValue({ data: [], isLoading: false })
    useEventsMock.mockReturnValue({ data: [], isLoading: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider client={qc}>
          <StateConductCard officialId="oid" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(tree, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(tree, { wrapper: darkWrapper })).not.toThrow()
  })
})
