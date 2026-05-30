import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { BrandNavRailMount } from '../../src/nav/BrandNavRailMount.tsx'

// next/navigation stubs — vi.mock'd so the mount can be tested in isolation
let mockPathname = '/'
const mockRouter = { push: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}))

// Stub getMyProfile from @chiaro/profile so we control the user identity
let mockProfile: { display_name: string | null; username: string | null; completed: boolean } | null = {
  display_name: 'Sarah', username: 'sarah', completed: true,
}
vi.mock('@chiaro/profile', () => ({
  getMyProfile: vi.fn(async () => mockProfile),
}))

const fakeClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })),
    signOut: vi.fn(async () => ({})),
  },
} as never

function wrap(mode: 'light' | 'dark' = 'light') {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      ChiaroClientProvider,
      { client: fakeClient },
      createElement(BrandModeOverrideContext.Provider, { value: mode }, children),
    )
}

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
    // Reset profile to default
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true }
  })

  it('renders null when no session user', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: null } }))
    mockPathname = '/'
    const { container } = render(<BrandNavRailMount />, { wrapper: wrap() })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(container.firstChild).toBeNull()
  })

  it.each(['/sign-in', '/sign-up', '/calibrate'])(
    'renders null on excluded route %s',
    async (path) => {
      fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
      mockPathname = path
      const { container } = render(<BrandNavRailMount />, { wrapper: wrap() })
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(container.firstChild).toBeNull()
    },
  )

  it('renders rail on /', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
    mockPathname = '/'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sarah')).toBeTruthy()
  })

  it('renders rail on /officials', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
    mockPathname = '/officials'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sign out')).toBeTruthy()
  })

  it('falls back to "Welcome" + "?" when profile is null', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
    mockProfile = null
    mockPathname = '/'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Welcome')).toBeTruthy()
    expect(await findByText('?')).toBeTruthy()
  })
})
