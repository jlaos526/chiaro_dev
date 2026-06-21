import { ActivityIndicator } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'

// Navigation-guard tests for the two mobile route guards.
//
// 1. App calibration gate — apps/mobile/app/(app)/_layout.tsx: redirects an
//    uncalibrated user to /calibrate, EXCEPT on the calibrate / settings routes.
//    We capture the <Redirect href> and a BrandDrawer marker, drive useSegments
//    per-case, and stub the supabase user_locations count chain. This is the
//    cleaner, higher-value guard and is covered fully.
//
// 2. Root auth redirect — apps/mobile/app/_layout.tsx: redirects a session-less
//    user to /(auth)/sign-in. It is mock-heavy (Sentry / providers / Slot /
//    gesture-handler / supabase auth). We add a single focused assertion that a
//    null session with a non-auth segment triggers router.replace.
//
// Top-level jest.mock (hoisted) — no resetModules (Gotcha #11). All module-level
// vars referenced inside jest.mock factories are `mock`-prefixed so jest's
// out-of-scope-variable guard permits the (hoisted) reference.

// ---------------------------------------------------------------------------
// Shared expo-router mock: Redirect captures its href; useSegments + Slot driven
// per-case via mutable module-level state.
// ---------------------------------------------------------------------------
let mockRedirectHref: string | null = null
let mockSegmentsValue: readonly string[] = []
const mockRouterReplace = jest.fn()
jest.mock('expo-router', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    Redirect: ({ href }: { href: string }) => {
      mockRedirectHref = href
      return React.createElement(Text, null, `Redirect:${href}`)
    },
    useSegments: () => mockSegmentsValue,
    useRouter: () => ({ replace: mockRouterReplace }),
    Slot: () => React.createElement(Text, null, 'Slot'),
  }
})

// ---------------------------------------------------------------------------
// supabase mock for the calibration gate: auth.getUser + a thenable
// from().select().eq() chain that resolves to { count }. Drivable per-case.
// Also satisfies the root layout's auth.getSession + onAuthStateChange.
// ---------------------------------------------------------------------------
let mockUserResult: { data: { user: { id: string } | null } } = { data: { user: { id: 'u1' } } }
let mockLocationCount = 0
let mockSessionResult: { data: { session: unknown } } = { data: { session: null } }

const mockEq = jest.fn((_col: string, _val: string) => Promise.resolve({ count: mockLocationCount }))
const mockSelect = jest.fn((_cols: string, _opts: unknown) => ({ eq: mockEq }))
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve(mockUserResult)),
      getSession: jest.fn(() => Promise.resolve(mockSessionResult)),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: (table: string) => mockFrom(table),
  },
}))

const mockGetItem = jest.fn().mockResolvedValue(null)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: () => mockGetItem(),
  setItem: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@chiaro/officials-ui/src/nav/BrandDrawer.tsx', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { BrandDrawer: () => React.createElement(Text, null, 'BrandDrawer') }
})

// ---------------------------------------------------------------------------
// Root-layout-only dependencies (mock-heavy). These keep the root layout
// importable for the single focused auth-redirect assertion.
// ---------------------------------------------------------------------------
jest.mock('@/lib/sentry', () => ({
  initSentry: jest.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/lib/query-client', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/lib/brand-mode-storage', () => ({
  readBrandMode: jest.fn().mockResolvedValue(null),
  writeBrandMode: jest.fn(),
}))
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@chiaro/officials-ui', () => ({
  BrandModeProvider: ({ children }: { children: React.ReactNode }) => children,
  ChiaroClientProvider: ({ children }: { children: React.ReactNode }) => children,
  BrandImageProvider: ({ children }: { children: React.ReactNode }) => children,
}))
// Slice 66: RootLayout imports the expo-image adapter; stub it so jest doesn't
// load the native expo-image module.
jest.mock('@/lib/brand-image', () => ({ ExpoBrandImage: () => null }))

import AppLayout from '../app/(app)/_layout'
import RootLayout from '../app/_layout'

describe('app calibration gate — (app)/_layout', () => {
  beforeEach(() => {
    mockRedirectHref = null
    mockSegmentsValue = []
    mockUserResult = { data: { user: { id: 'u1' } } }
    // Slice 66 (C10): the gate now reads the user id from the LOCAL session
    // (getSession), not the network getUser. Drive a signed-in session.
    mockSessionResult = { data: { session: { user: { id: 'u1' } } } }
    mockLocationCount = 0
    mockGetItem.mockClear().mockResolvedValue(null)
    mockEq.mockClear()
    mockSelect.mockClear()
    mockFrom.mockClear()
  })

  it('redirects an uncalibrated user (count 0) to /calibrate on a normal route', async () => {
    mockLocationCount = 0
    mockSegmentsValue = ['(app)', 'officials']
    const { getByText } = render(<AppLayout />)
    await waitFor(() => expect(getByText('Redirect:/calibrate')).toBeTruthy())
    expect(mockRedirectHref).toBe('/calibrate')
    expect(mockFrom).toHaveBeenCalledWith('user_locations')
    expect(mockEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('renders BrandDrawer (no redirect) for a calibrated user (count 1)', async () => {
    mockLocationCount = 1
    mockSegmentsValue = ['(app)', 'officials']
    const { getByText } = render(<AppLayout />)
    await waitFor(() => expect(getByText('BrandDrawer')).toBeTruthy())
    expect(mockRedirectHref).toBeNull()
  })

  it('exempts the settings route even when uncalibrated', async () => {
    mockLocationCount = 0
    mockSegmentsValue = ['(app)', 'settings']
    const { getByText } = render(<AppLayout />)
    await waitFor(() => expect(getByText('BrandDrawer')).toBeTruthy())
    expect(mockRedirectHref).toBeNull()
  })

  it('exempts the calibrate route even when uncalibrated', async () => {
    mockLocationCount = 0
    mockSegmentsValue = ['(app)', 'calibrate']
    const { getByText } = render(<AppLayout />)
    await waitFor(() => expect(getByText('BrandDrawer')).toBeTruthy())
    expect(mockRedirectHref).toBeNull()
  })

  it('treats a skipped user as calibrated (no redirect)', async () => {
    mockGetItem.mockResolvedValue('1')
    mockSegmentsValue = ['(app)', 'officials']
    const { getByText } = render(<AppLayout />)
    await waitFor(() => expect(getByText('BrandDrawer')).toBeTruthy())
    expect(mockRedirectHref).toBeNull()
  })

  it('re-probes after leaving the calibrate route and does not redirect once calibrated (audit U1)', async () => {
    // Mount ON the calibrate route while uncalibrated (exempt — no redirect).
    mockLocationCount = 0
    mockSegmentsValue = ['(app)', 'calibrate']
    const { getByText, queryByText, rerender } = render(<AppLayout />)
    await waitFor(() => expect(getByText('BrandDrawer')).toBeTruthy())
    expect(mockRedirectHref).toBeNull()

    // The user calibrates (count now 1) and calibrate.tsx replaces to '/'.
    // Same mounted layout, new segments: the stale 'uncalibrated' status must
    // NOT redirect back to /calibrate — the layout re-probes instead.
    mockLocationCount = 1
    mockRedirectHref = null
    mockSegmentsValue = ['(app)']
    rerender(<AppLayout />)
    await waitFor(() => expect(getByText('BrandDrawer')).toBeTruthy())
    expect(queryByText('Redirect:/calibrate')).toBeNull()
    expect(mockRedirectHref).toBeNull()
  })

  it('renders a loading gate (no app chrome, no redirect) while calibration status is unknown', async () => {
    // Keep the async check() pending so status stays 'unknown': getItem never
    // resolves. Assert the synchronous initial render before flushing effects.
    mockGetItem.mockReturnValue(new Promise(() => {}))
    mockSegmentsValue = ['(app)', 'officials']
    const { UNSAFE_getByType, queryByText } = render(<AppLayout />)
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
    expect(queryByText('BrandDrawer')).toBeNull()
    expect(queryByText('Redirect:/calibrate')).toBeNull()
    expect(mockRedirectHref).toBeNull()
  })
})

describe('root auth redirect — _layout', () => {
  beforeEach(() => {
    mockSegmentsValue = []
    mockSessionResult = { data: { session: null } }
    mockRouterReplace.mockClear()
  })

  it('replaces to /(auth)/sign-in when there is no session outside the auth group', async () => {
    mockSessionResult = { data: { session: null } }
    mockSegmentsValue = ['(app)']
    render(<RootLayout />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/sign-in'))
  })
})
