import { fetch } from 'undici'

// fetchWithRetry returns a tagged union so callers can distinguish:
//   ok    — body downloaded, proceed
//   gap   — permanent (404/410); Census hasn't published this file yet.
//           Should be logged and skipped, NOT retried, NOT a CI failure.
//   error — transient retries exhausted (5xx, timeout, network errors).
//           A real pipeline failure; CI should fail.
export type FetchResult =
  | { kind: 'ok'; body: ArrayBuffer }
  | { kind: 'gap'; status: number; message: string }
  | { kind: 'error'; message: string; attempts: number }

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1000        // 1s, 2s, 4s
const REQUEST_TIMEOUT_MS = 60_000   // 60s per attempt

function isPermanentStatus(status: number): boolean {
  // 404 — Census hasn't published this state file yet (common during the
  // weeks after a Congress flips). 410 — file moved or removed upstream.
  // Either way, retrying won't help; surface as a gap.
  return status === 404 || status === 410
}

function backoffMs(attempt: number): number {
  // Exponential with ±25% jitter so concurrent runs don't synchronize.
  const base = BASE_BACKOFF_MS * Math.pow(2, attempt - 1)
  const jitter = base * 0.25 * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(base + jitter))
}

export async function fetchWithRetry(url: string): Promise<FetchResult> {
  let lastError = 'unknown'
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(timeoutId)

      if (isPermanentStatus(res.status)) {
        return { kind: 'gap', status: res.status, message: `HTTP ${res.status}` }
      }
      if (res.status >= 500 && res.status < 600) {
        lastError = `HTTP ${res.status}`
        // fall through to backoff + retry
      } else if (!res.ok) {
        // 4xx other than 404/410 — likely permanent (auth, bad request).
        // Treat as error so the operator sees it and fixes the URL.
        return { kind: 'error', message: `HTTP ${res.status}`, attempts: attempt }
      } else {
        const body = await res.arrayBuffer()
        return { kind: 'ok', body }
      }
    } catch (err) {
      clearTimeout(timeoutId)
      // AbortError (our timeout), ECONNRESET, ECONNREFUSED, ENOTFOUND, ETIMEDOUT,
      // socket hang up, etc. All transient — retry.
      lastError = err instanceof Error ? err.message : String(err)
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, backoffMs(attempt)))
    }
  }
  return { kind: 'error', message: lastError, attempts: MAX_ATTEMPTS }
}
