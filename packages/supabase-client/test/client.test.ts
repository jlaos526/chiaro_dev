import { describe, it, expect } from 'vitest'
import { createChiaroClient } from '../src/client.ts'

describe('createChiaroClient', () => {
  it('returns a SupabaseClient with the provided url and key', () => {
    const client = createChiaroClient({
      url: 'http://127.0.0.1:54321',
      anonKey: 'test-anon-key',
    })
    // The client object exposes from() and auth — smoke check
    expect(typeof client.from).toBe('function')
    expect(typeof client.auth.signUp).toBe('function')
  })

  it('accepts a custom storage adapter', () => {
    const memoryStore = new Map<string, string>()
    const storage = {
      getItem: (k: string) => memoryStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memoryStore.set(k, v)
      },
      removeItem: (k: string) => {
        memoryStore.delete(k)
      },
    }
    const client = createChiaroClient({
      url: 'http://127.0.0.1:54321',
      anonKey: 'test-anon-key',
      storage,
    })
    expect(typeof client.auth.getSession).toBe('function')
  })
})
