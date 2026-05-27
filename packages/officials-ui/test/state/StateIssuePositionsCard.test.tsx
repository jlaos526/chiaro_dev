import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useRatingsMock = vi.fn()
const useVotesOnSubjectMock = vi.fn()

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateScorecardRatings: (...args: unknown[]) => useRatingsMock(...args),
  }
})

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: (...args: unknown[]) =>
      useVotesOnSubjectMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateIssuePositionsCard } from '../../src/state/StateIssuePositionsCard.tsx'

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
  useRatingsMock.mockReset()
  useVotesOnSubjectMock.mockReset()
})

describe('StateIssuePositionsCard', () => {
  it('renders loading', () => {
    useRatingsMock.mockReturnValue({ data: undefined, isLoading: true })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })

  it('renders empty when no ratings', () => {
    useRatingsMock.mockReturnValue({ data: [], isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings/i)).toBeTruthy()
  })

  it('renders ratings grouped by lean', () => {
    useRatingsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          score: 85,
          org: {
            id: 'org1',
            name: 'Sierra Club',
            issue_area: 'environment',
            lean: 'progressive',
            scoring_max: 100,
          },
        },
        {
          id: 'r2',
          official_id: 'oid',
          score: 20,
          org: {
            id: 'org2',
            name: 'NRA',
            issue_area: 'second-amendment',
            lean: 'conservative',
            scoring_max: 100,
          },
        },
      ],
      isLoading: false,
    })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText('Issue Positions')).toBeTruthy()
    expect(getByText('Sierra Club')).toBeTruthy()
    expect(getByText('NRA')).toBeTruthy()
  })

  it('clicking a rating mounts evidence panel', () => {
    useRatingsMock.mockReturnValue({
      data: [
        {
          id: 'r1',
          official_id: 'oid',
          score: 85,
          org: {
            id: 'org1',
            name: 'Sierra Club',
            issue_area: 'environment',
            lean: 'progressive',
            scoring_max: 100,
          },
        },
      ],
      isLoading: false,
    })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText, queryByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(queryByText(/No matching votes for this subject/i)).toBeNull()
    fireEvent.click(getByText('Sierra Club'))
    // Evidence panel mounts and renders empty-state message.
    expect(getByText(/No matching votes for this subject/i)).toBeTruthy()
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateIssuePositionsCard — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useRatingsMock.mockReturnValue({ data: [], isLoading: false })
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider client={qc}>
          <StateIssuePositionsCard officialId="oid" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(tree, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(tree, { wrapper: darkWrapper })).not.toThrow()
  })
})
