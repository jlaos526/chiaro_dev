import { vi, type MockInstance } from 'vitest'

/**
 * Stub `globalThis.fetch` to reject all calls during a test. Used
 * by production-path adapter tests where the production code path
 * naturally calls `fetch()` and we want to assert it gracefully
 * degrades to `[]` without making real network calls.
 *
 * Returns the spy so caller can assert on it; caller must
 * `.mockRestore()` in afterEach/finally to avoid leaking the stub
 * across tests.
 *
 * Per slice 18 audit + slice 15 Lesson 12 — formalized after the
 * pattern reached 11 occurrences across 9 files.
 *
 * @example
 *   const fetchSpy = stubFetchBlocked()
 *   const result = await adapter.fetchEvents({ client })
 *   expect(result).toEqual([])
 *   fetchSpy.mockRestore()
 */
export function stubFetchBlocked(): MockInstance {
  return vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
}

/**
 * Block fetch for the duration of `fn`. Auto-restores on completion
 * (success or throw). Use when stub scoping inside one test body
 * is preferred over manual `.mockRestore()`.
 *
 * @example
 *   await withStubbedFetch(async () => {
 *     const result = await adapter.fetchEvents({ client })
 *     expect(result).toEqual([])
 *   })
 */
export async function withStubbedFetch<T>(fn: () => Promise<T>): Promise<T> {
  const spy = stubFetchBlocked()
  try {
    return await fn()
  } finally {
    spy.mockRestore()
  }
}
