// @vitest-environment node
// (jsdom's Request/Headers are a different realm than the undici globals
// NextResponse.next() instanceof-checks — middleware needs the node env.)
import { describe, expect, it, vi } from 'vitest'

// middleware.ts imports SUPABASE_URL/SUPABASE_ANON_KEY from @/lib/supabase/env,
// whose module-level guard throws when env vars are absent. isAllowlisted is a
// pure helper that doesn't touch Supabase, so stub the env module to keep the
// import side-effect-free (mirrors how page tests mock @/lib/supabase/*).
vi.mock('@/lib/supabase/env', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
}))

// Slice 74 (audit C3/C49): mock @supabase/ssr so middleware() itself is
// testable — getUser resolves a fixed user; the user_locations probe counts
// invocations and returns a configurable count.
const probe = vi.hoisted(() => ({ count: 1 as number | null, calls: 0 }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    from: () => ({
      select: () => ({
        eq: () => {
          probe.calls += 1
          return Promise.resolve({ count: probe.count })
        },
      }),
    }),
  }),
}))

import { NextRequest } from 'next/server'
import { isAllowlisted, middleware } from '../middleware'

describe('middleware calibrate-redirect allowList', () => {
  it('allows /issues and /legal (+ subpaths) for uncalibrated users', () => {
    expect(isAllowlisted('/issues')).toBe(true)
    expect(isAllowlisted('/legal/privacy')).toBe(true)
    expect(isAllowlisted('/legal/terms')).toBe(true)
  })
  it('still gates a non-allowlisted path', () => {
    expect(isAllowlisted('/officials/abc')).toBe(false)
  })
})

describe('middleware calibration positive-cache (slice 74)', () => {
  const req = (path: string, cookies: Record<string, string> = {}) => {
    const r = new NextRequest(`http://localhost:3000${path}`)
    for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v)
    return r
  }

  it('probes on a cold request and sets chiaro_calibrated when calibrated', async () => {
    probe.count = 1
    probe.calls = 0
    const res = await middleware(req('/officials'))
    expect(probe.calls).toBe(1)
    expect(res.cookies.get('chiaro_calibrated')?.value).toBe('1')
    expect(res.cookies.get('chiaro_calibrated')?.httpOnly).toBe(true)
  })

  it('skips the DB probe entirely when the positive-cache cookie is present', async () => {
    probe.count = 1
    probe.calls = 0
    const res = await middleware(req('/officials', { chiaro_calibrated: '1' }))
    expect(probe.calls).toBe(0)
    expect(res.status).toBe(200)
  })

  it('redirects uncalibrated users to /calibrate without setting the cookie', async () => {
    probe.count = 0
    probe.calls = 0
    const res = await middleware(req('/officials'))
    expect(probe.calls).toBe(1)
    expect(res.status).toBeGreaterThanOrEqual(307)
    expect(res.headers.get('location')).toContain('/calibrate')
    expect(res.cookies.get('chiaro_calibrated')).toBeUndefined()
  })

  it('skip cookie still short-circuits the probe (pre-existing negative cache)', async () => {
    probe.count = 0
    probe.calls = 0
    const res = await middleware(req('/officials', { chiaro_skip_calibrate: '1' }))
    expect(probe.calls).toBe(0)
    expect(res.status).toBe(200)
  })
})
