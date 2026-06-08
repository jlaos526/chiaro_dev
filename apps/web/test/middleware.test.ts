import { describe, expect, it, vi } from 'vitest'

// middleware.ts imports SUPABASE_URL/SUPABASE_ANON_KEY from @/lib/supabase/env,
// whose module-level guard throws when env vars are absent. isAllowlisted is a
// pure helper that doesn't touch Supabase, so stub the env module to keep the
// import side-effect-free (mirrors how page tests mock @/lib/supabase/*).
vi.mock('@/lib/supabase/env', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
}))

import { isAllowlisted } from '../middleware'

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
