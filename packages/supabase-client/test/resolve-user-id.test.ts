import { describe, it, expect, vi } from 'vitest'
import { resolveUserId } from '../src/auth.ts'
import type { ChiaroClient } from '../src/client.ts'

function clientWithSession(session: unknown): ChiaroClient {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
  } as unknown as ChiaroClient
}

describe('resolveUserId', () => {
  it('returns the passed userId without touching the session (no network/local read)', async () => {
    const getSession = vi.fn()
    const client = { auth: { getSession } } as unknown as ChiaroClient
    expect(await resolveUserId(client, 'user-123')).toBe('user-123')
    expect(getSession).not.toHaveBeenCalled()
  })

  it('reads the id from the local session when userId is omitted', async () => {
    const client = clientWithSession({ user: { id: 'sess-456' } })
    expect(await resolveUserId(client)).toBe('sess-456')
  })

  it('returns null when there is no session', async () => {
    const client = clientWithSession(null)
    expect(await resolveUserId(client)).toBeNull()
  })
})
