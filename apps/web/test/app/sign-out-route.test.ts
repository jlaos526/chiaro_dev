// Slice 71 (audit C50): sign-out redirect derives from the REQUEST origin;
// the old literal http://localhost:3000 fallback sent production users to a
// dead page whenever NEXT_PUBLIC_SITE_URL was unset.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut: vi.fn() } }),
}))

import { POST } from '@/app/sign-out/route'

describe('POST /sign-out', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('redirects to /sign-in on the request origin when NEXT_PUBLIC_SITE_URL is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    // '' is falsy for ?? only via delete; stub to undefined instead:
    vi.unstubAllEnvs()
    delete process.env.NEXT_PUBLIC_SITE_URL
    const res = await POST(
      new Request('https://chiaro-dev-web.vercel.app/sign-out', { method: 'POST' }),
    )
    expect(res.headers.get('location')).toBe('https://chiaro-dev-web.vercel.app/sign-in')
  })

  it('honors NEXT_PUBLIC_SITE_URL as an explicit override', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://chiaro.example.com')
    const res = await POST(
      new Request('https://chiaro-dev-web.vercel.app/sign-out', { method: 'POST' }),
    )
    expect(res.headers.get('location')).toBe('https://chiaro.example.com/sign-in')
  })
})
