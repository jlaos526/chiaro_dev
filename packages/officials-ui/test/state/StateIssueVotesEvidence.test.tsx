import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'

const useVotesOnSubjectMock = vi.fn()

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialStateVotesOnSubject: (...args: unknown[]) => useVotesOnSubjectMock(...args),
  }
})

import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { StateIssueVotesEvidence } from '../../src/state/StateIssueVotesEvidence.tsx'

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
  useVotesOnSubjectMock.mockReset()
})

describe('StateIssueVotesEvidence', () => {
  it('renders loading state', () => {
    useVotesOnSubjectMock.mockReturnValue({ data: undefined, isLoading: true })
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/Loading evidence votes/i)).toBeTruthy()
  })

  it('renders empty state when no data', () => {
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/No matching votes for this subject area/i)).toBeTruthy()
  })

  it('renders bill rows with position color-coded uppercase', () => {
    useVotesOnSubjectMock.mockReturnValue({
      data: [{
        vote: {
          id: 'v1',
          question: 'Q1',
          vote_date: '2026-03-01',
          bill: { bill_type: 'AB', number: '101', title: 'Clean Air Act' },
        },
        position: 'yes',
      }],
      isLoading: false,
    })
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/AB 101 — Clean Air Act/)).toBeTruthy()
    expect(getByText(/YES/)).toBeTruthy()
  })

  it('passes subjects derived from issueArea to the hook', () => {
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    wrap(<StateIssueVotesEvidence officialId="oid" issueArea="environment" />)
    const args = useVotesOnSubjectMock.mock.calls[0]!
    expect(args[1]).toBe('oid')
    expect(args[2]).toEqual(['Environment', 'Energy', 'Climate'])
  })
})

import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateIssueVotesEvidence — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    useVotesOnSubjectMock.mockReturnValue({ data: [], isLoading: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (
      <ChiaroClientProvider client={mockClient}>
        <QueryClientProvider client={qc}>
          <StateIssueVotesEvidence officialId="oid" issueArea="environment" />
        </QueryClientProvider>
      </ChiaroClientProvider>
    )
    expect(() => render(tree, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(tree, { wrapper: darkWrapper })).not.toThrow()
  })
})
