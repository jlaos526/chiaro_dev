import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { signOut } from '../../src/nav/sign-out.ts'

describe('signOut', () => {
  beforeEach(() => {
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
  })

  afterEach(() => {
    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('clears the chiaro_skip_calibrate cookie', async () => {
    const router = { push: vi.fn(), refresh: vi.fn() }
    const client = { auth: { signOut: vi.fn().mockResolvedValue({}) } }
    await signOut(router, client as never)
    expect(document.cookie).not.toContain('chiaro_skip_calibrate=1')
  })

  it('awaits client.auth.signOut() before routing', async () => {
    const router = { push: vi.fn(), refresh: vi.fn() }
    const order: string[] = []
    const client = {
      auth: {
        signOut: vi.fn(async () => {
          order.push('signOut')
          return {}
        }),
      },
    }
    const orig = router.push
    router.push = vi.fn((path: string) => {
      order.push(`push:${path}`)
      return orig(path)
    })
    await signOut(router, client as never)
    expect(order).toEqual(['signOut', 'push:/sign-in'])
  })

  it('routes to /sign-in then calls refresh', async () => {
    const router = { push: vi.fn(), refresh: vi.fn() }
    const client = { auth: { signOut: vi.fn().mockResolvedValue({}) } }
    await signOut(router, client as never)
    expect(router.push).toHaveBeenCalledWith('/sign-in')
    expect(router.refresh).toHaveBeenCalled()
  })
})
