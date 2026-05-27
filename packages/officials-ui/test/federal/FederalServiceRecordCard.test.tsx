import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const useMetricsMock = vi.fn()
const useLeadershipMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: (...args: unknown[]) => useMetricsMock(...args),
    useOfficialLeadershipHistory: (...args: unknown[]) => useLeadershipMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { FederalServiceRecordCard } from '../../src/federal/FederalServiceRecordCard.tsx'

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
  useMetricsMock.mockReset()
  useLeadershipMock.mockReset()
})

describe('FederalServiceRecordCard', () => {
  it('renders loading state', () => {
    useMetricsMock.mockReturnValue({ data: undefined, isLoading: true, isSuccess: false })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/Loading service record/i)).toBeTruthy()
  })

  it('renders empty state when no metrics + no leadership', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/No service record data on file/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 12,
        bills_cosponsored_count: 45,
        attendance_pct: 96,
        subject_breadth: 8,
        lives_in_district: true,
      },
      isLoading: false,
      isSuccess: true,
    })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { getByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(getByText(/12 bills sponsored/i)).toBeTruthy()
    expect(getByText(/96% attendance/i)).toBeTruthy()
  })

  it('Leadership subsection expands on press', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 1,
        bills_cosponsored_count: 1,
        attendance_pct: 95,
        subject_breadth: 1,
        lives_in_district: null,
      },
      isLoading: false,
      isSuccess: true,
    })
    useLeadershipMock.mockReturnValue({
      data: [
        {
          id: 'l1',
          official_id: 'oid',
          role: 'Chair of Energy and Commerce',
          chamber: 'federal_house',
          party: 'D',
          start_date: '2023-01-03',
          end_date: null,
          source_url: null,
        },
      ],
      isLoading: false,
      isSuccess: true,
    })
    const { getByText, queryByText } = wrap(<FederalServiceRecordCard officialId="oid" />)
    expect(queryByText(/Chair of Energy and Commerce/)).toBeNull()
    fireEvent.click(getByText(/Leadership history/i))
    expect(getByText(/Chair of Energy and Commerce/)).toBeTruthy()
  })

  it('hides Lives in district tile when hideLivesInDistrict (Senate)', () => {
    useMetricsMock.mockReturnValue({
      data: {
        bills_sponsored_count: 1,
        bills_cosponsored_count: 1,
        attendance_pct: 95,
        subject_breadth: 1,
        lives_in_district: null,
      },
      isLoading: false,
      isSuccess: true,
    })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const { queryByText } = wrap(
      <FederalServiceRecordCard officialId="oid" hideLivesInDistrict />,
    )
    expect(queryByText(/Lives in district/)).toBeNull()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FederalServiceRecordCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useMetricsMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
    useLeadershipMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const renderWith = (wrapper: typeof lightWrapper) =>
      render(
        <ChiaroClientProvider client={mockClient}>
          <QueryClientProvider client={qc}>
            <FederalServiceRecordCard officialId="oid" />
          </QueryClientProvider>
        </ChiaroClientProvider>,
        { wrapper },
      )
    expect(() => renderWith(lightWrapper)).not.toThrow()
    expect(() => renderWith(darkWrapper)).not.toThrow()
  })
})
