import { describe, expect, it, vi, beforeEach } from 'vitest'

// redirectMock THROWS so control flow stops at the redirect like the real
// next/navigation redirect() (NEXT_REDIRECT control-flow throw).
const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((_: string) => {
    throw new Error('REDIRECT')
  }),
}))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

let mockUser: { id: string } | null = { id: 'u1' }
// The official row the `officials` table query returns (null → not-found path).
let officialRow: Record<string, unknown> | null = null

/**
 * Chainable PostgREST-builder stub. Each `from(table)` returns a builder whose
 * `.select/.eq/.order` return `this`, and whose `.single()` (officials/districts)
 * or thenable resolution (leadership/scorecard lists) yields canned `{ data }`.
 */
function makeQuery(table: string) {
  const result: { data: unknown } =
    table === 'officials'
      ? { data: officialRow }
      : table === 'districts'
        ? { data: { code: 'NY-12' } }
        : { data: [] } // leadership_history + scorecard_ratings
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(result), // list chains terminate here (awaited)
    single: () => Promise.resolve(result), // officials + districts terminate here
    // make the builder itself awaitable for the scorecard chain (ends on .eq)
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) },
    from: (table: string) => makeQuery(table),
  })),
}))

// Client islands → marker divs.
vi.mock('../../app/officials/[id]/BioHeaderClient', () => ({
  BioHeaderClient: () => <div data-testid="bio-header" />,
}))
vi.mock('../../app/officials/[id]/RepAlignmentSectionClient', () => ({
  RepAlignmentSectionClient: () => <div data-testid="rep-alignment" />,
}))

// @chiaro/officials-ui federal cards → marker divs (jsdom can't render RNW deeply).
vi.mock('@chiaro/officials-ui', () => ({
  FederalServiceRecordCard: () => <div data-testid="federal-service" />,
  FederalCommunityPresenceCard: () => <div data-testid="federal-community" />,
  FederalFinanceCard: () => <div data-testid="federal-finance" />,
  FederalIssuePositionsCard: () => <div data-testid="federal-issues" />,
  FederalEthicsAccountabilityCard: () => <div data-testid="federal-ethics" />,
  FederalVotingBillsCard: () => <div data-testid="federal-voting" />,
}))

import Page from '../../app/officials/[id]/page'

const FEDERAL = {
  id: 'o1',
  chamber: 'federal_house' as const,
  full_name: 'Rep. Federal',
  portrait_url: null,
  party: 'Democratic',
  state: 'NY',
  district_id: 'd1',
  senate_class: null,
  official_url: null,
  twitter_handle: null,
}

const args = (id: string) => ({ params: Promise.resolve({ id }) })

describe('officials/[id] page', () => {
  beforeEach(() => {
    redirectMock.mockClear()
    mockUser = { id: 'u1' }
    officialRow = { ...FEDERAL }
  })

  it('redirects to /sign-in when there is no user', async () => {
    mockUser = null
    await expect(Page(args('o1'))).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
  })

  it('redirects to / when the official is not found', async () => {
    officialRow = null
    await expect(Page(args('bad'))).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it('cross-route guard: a state official redirects to /state-officials/[id]', async () => {
    officialRow = { ...FEDERAL, chamber: 'state_house' }
    await expect(Page(args('o1'))).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/state-officials/o1')
  })

  it('renders the federal detail page for a valid federal official (no redirect)', async () => {
    officialRow = { ...FEDERAL }
    const el = await Page(args('o1'))
    expect(el).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
