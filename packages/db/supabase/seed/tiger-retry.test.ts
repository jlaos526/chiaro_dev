import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.mock('undici', () => ({
  fetch: (...args: unknown[]) => fetchMock(...args),
}))

const { fetchWithRetry } = await import('./tiger-retry.ts')

describe('fetchWithRetry', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // Collapse backoff sleeps to zero so tests don't wait 1+2+4s between attempts.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      Promise.resolve().then(fn)
      return 0 as never
    }) as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok on first 200', async () => {
    const buf = new ArrayBuffer(8)
    fetchMock.mockResolvedValueOnce(new Response(buf, { status: 200 }))
    const result = await fetchWithRetry('https://example.invalid/x.zip')
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.body.byteLength).toBe(8)
  })

  it('returns gap on 404 (no retry)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
    const result = await fetchWithRetry('https://example.invalid/missing.zip')
    expect(result.kind).toBe('gap')
    if (result.kind === 'gap') expect(result.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns gap when all 3 attempts time out (AbortError)', async () => {
    const abortErr = new DOMException('This operation was aborted', 'AbortError')
    fetchMock.mockRejectedValue(abortErr)
    const result = await fetchWithRetry('https://example.invalid/hung.zip')
    expect(result.kind).toBe('gap')
    if (result.kind === 'gap') {
      expect(result.status).toBe(0)
      expect(result.message).toMatch(/timeout after 3 attempts/)
    }
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns error when all 3 attempts fail with a non-timeout network error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))
    const result = await fetchWithRetry('https://example.invalid/reset.zip')
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.attempts).toBe(3)
      expect(result.message).toMatch(/ECONNRESET/)
    }
  })

  it('retries 5xx then succeeds', async () => {
    const buf = new ArrayBuffer(4)
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(buf,  { status: 200 }))
    const result = await fetchWithRetry('https://example.invalid/flaky.zip')
    expect(result.kind).toBe('ok')
  })
})
