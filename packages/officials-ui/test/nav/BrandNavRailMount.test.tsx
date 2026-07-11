import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { BrandNavRailMount } from '../../src/nav/BrandNavRailMount.tsx'
import type { ChiaroClient } from '@chiaro/supabase-client'

// next/navigation stubs — vi.mock'd so the mount can be tested in isolation
let mockPathname = '/'
const mockRouter = { push: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}))

// Slice 74: the mount consumes useMyProfile (the REAL hook + REAL getMyProfile,
// which internally imports its fetcher — a barrel mock can't intercept it).
// Instead the fake client serves getMyProfile's actual chain:
// getSession (local auth) → from('profiles').select().eq().single().
let mockProfile: {
  display_name: string | null
  username: string | null
  completed: boolean
} | null = {
  display_name: 'Sarah',
  username: 'sarah',
  completed: true,
}

// Fake client: slice 74 replaced the network getUser with a LOCAL getSession
// read. Cast via unknown to avoid strict SupabaseClient shape requirements.
const fakeAuth = {
  getSession: vi.fn(),
  signOut: vi.fn(async () => ({})),
}
const fakeClient = {
  auth: fakeAuth,
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: mockProfile, error: null }),
      }),
    }),
  }),
} as unknown as ChiaroClient

function wrap(mode: 'light' | 'dark' = 'light') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <ChiaroClientProvider client={fakeClient}>
      <QueryClientProvider client={qc}>
        <BrandModeOverrideContext.Provider value={mode}>
          {children}
        </BrandModeOverrideContext.Provider>
      </QueryClientProvider>
    </ChiaroClientProvider>
  )
}

const sessionOf = (userId: string | null) =>
  vi.fn(async () => ({
    data: { session: userId ? { user: { id: userId } } : null },
    error: null,
  }))

describe('BrandNavRailMount', () => {
  beforeEach(() => {
    // Stub matchMedia so useBreakpoint returns true (desktop) deterministically.
    ;(window as unknown as Record<string, unknown>).matchMedia = (q: string) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    })
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true }
  })

  it('renders null when no session user', async () => {
    fakeAuth.getSession = sessionOf(null)
    mockPathname = '/'
    const { container } = render(<BrandNavRailMount />, { wrapper: wrap() })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.firstChild).toBeNull()
  })

  it.each([
    '/sign-in',
    '/sign-up',
    '/calibrate',
  ])('renders null on excluded route %s', async (path) => {
    fakeAuth.getSession = sessionOf('u1')
    mockPathname = path
    const { container } = render(<BrandNavRailMount />, { wrapper: wrap() })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.firstChild).toBeNull()
  })

  it('renders rail on /', async () => {
    fakeAuth.getSession = sessionOf('u1')
    mockPathname = '/'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sarah')).toBeTruthy()
  })

  it('renders the rail on FIRST render with initialHasUser (slice 74 — no auth wait)', () => {
    fakeAuth.getSession = sessionOf('u1')
    mockPathname = '/'
    const { getByText } = render(<BrandNavRailMount initialHasUser={true} />, { wrapper: wrap() })
    // Synchronous assertion — the rail exists before any async auth resolves.
    expect(getByText('Sign out')).toBeTruthy()
  })

  it('corrects an optimistic initialHasUser via the local session read', async () => {
    fakeAuth.getSession = sessionOf(null) // expired cookie: hint said yes, session says no
    mockPathname = '/'
    const { container } = render(<BrandNavRailMount initialHasUser={true} />, { wrapper: wrap() })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.firstChild).toBeNull()
  })

  it('renders rail on /officials', async () => {
    fakeAuth.getSession = sessionOf('u1')
    mockPathname = '/officials'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sign out')).toBeTruthy()
  })

  it('falls back to "Welcome" + "?" when profile is null', async () => {
    fakeAuth.getSession = sessionOf('u1')
    mockProfile = null
    mockPathname = '/'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Welcome')).toBeTruthy()
    expect(await findByText('?')).toBeTruthy()
  })

  it('renders rail on /settings', async () => {
    fakeAuth.getSession = sessionOf('u1')
    mockPathname = '/settings'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sign out')).toBeTruthy()
  })

  it('renders rail on /profile/edit', async () => {
    fakeAuth.getSession = sessionOf('u1')
    mockPathname = '/profile/edit'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sign out')).toBeTruthy()
  })
})
