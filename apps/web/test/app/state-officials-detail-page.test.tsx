import { describe, expect, it, vi, beforeEach } from 'vitest'

// redirectMock THROWS so control flow stops at the redirect like the real
// next/navigation redirect() (which throws a NEXT_REDIRECT control-flow error).
const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((_: string) => {
    throw new Error('REDIRECT')
  }),
}))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

let mockUser: { id: string } | null = { id: 'u1' }
// Discriminated result so the mocked fetchOfficial can throw (bad id) or resolve.
let officialResult: { ok: true; official: Record<string, unknown> } | { ok: false } = { ok: false }

vi.mock('@/lib/supabase/server', () => {
  const stub = () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) },
  })
  return {
    createSupabaseServerClient: vi.fn(async () => stub()),
    getAuthenticatedUser: vi.fn(async () => ({ supabase: stub(), user: mockUser })),
  }
})

vi.mock('@chiaro/officials', async (orig) => ({
  ...(await orig<typeof import('@chiaro/officials')>()),
  fetchOfficial: vi.fn(async () => {
    if (!officialResult.ok) throw new Error('not found')
    return officialResult.official
  }),
  fetchOfficialDistrictOffices: vi.fn(async () => []),
}))

// The page's only client island — render as a marker div.
vi.mock('../../app/state-officials/[id]/StateOfficialDetailClient', () => ({
  StateOfficialDetailClient: () => <div data-testid="state-detail" />,
}))

import Page from '../../app/state-officials/[id]/page'

// Minimal fields the page touches: chamber drives the cross-route guard.
const STATE = { id: 's1', chamber: 'state_house' as const, full_name: 'Jane Doe' }

const args = (id: string) => ({ params: Promise.resolve({ id }) })

describe('state-officials/[id] page', () => {
  beforeEach(() => {
    redirectMock.mockClear()
    mockUser = { id: 'u1' }
    officialResult = { ok: true, official: { ...STATE } }
  })

  it('redirects to / when the id is not found — no 500 (B1)', async () => {
    officialResult = { ok: false }
    await expect(Page(args('bad'))).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it('redirects to /sign-in when there is no user', async () => {
    mockUser = null
    await expect(Page(args('s1'))).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
  })

  it('cross-route guard: a federal official redirects to /officials/[id]', async () => {
    officialResult = { ok: true, official: { ...STATE, chamber: 'federal_house' } }
    await expect(Page(args('s1'))).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/officials/s1')
  })

  it('renders the detail client for a valid state official (no redirect)', async () => {
    officialResult = { ok: true, official: { ...STATE } }
    const el = await Page(args('s1'))
    expect(el).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
