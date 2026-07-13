import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Canonical seed-tree HTTP helpers (slice 81, audit C36 + C37).
 *
 * Before this module the seed tree had THREE independent fetchWithRetry
 * implementations (tiger-retry.ts, state-bills/shared.ts,
 * scorecards/shared.ts) while the newer slice 15-26 scrape/PDF/disclosure
 * fetchers were single-attempt — and the federal-disclosures fetchers had
 * no timeout at all (a hung connection stalled the run indefinitely).
 *
 * - `fetchWithRetry` — bounded per-attempt timeout + exponential-backoff
 *   retry on transient failures only.
 * - `loadCachedUrl` — on-disk cache for immutable payloads (House yearly
 *   disclosure ZIPs, per-filing PDFs), following the slice-55
 *   tiger-cache.ts contract (skip-if-present, atomic `.tmp` + rename,
 *   corrupt/zero-byte entry evict-and-refetch).
 *
 * tiger-retry.ts / tiger-cache.ts stay bespoke (tagged-union FetchResult
 * consumed by the TIGER ingest's gap-vs-error handling); new call sites
 * should use this module.
 */

/** Default per-attempt timeout. Matches shared/pdf.ts's historical 15s. */
export const DEFAULT_TIMEOUT_MS = 15_000
/** Default retry count AFTER the initial attempt (2 → 3 attempts total). */
export const DEFAULT_RETRIES = 2
/** Default base backoff; retry k (0-indexed) waits backoffMs * 2^k. */
export const DEFAULT_BACKOFF_MS = 1000

export interface FetchWithRetryOpts {
  /**
   * Per-attempt timeout in ms (default 15000), applied via a fresh
   * `AbortSignal.timeout` per attempt. Ignored when `init.signal` is
   * provided (the caller's signal wins; no merging).
   */
  timeoutMs?: number
  /** Retries after the initial attempt (default 2 → 3 attempts total). */
  retries?: number
  /** Base backoff in ms; retry k (0-indexed) waits backoffMs * 2^k. */
  backoffMs?: number
  /** RequestInit forwarded to fetch (method, headers, body, ...). */
  init?: RequestInit
  /** Injectable fetch for tests (slice 18 stub-fetch convention). */
  fetcher?: typeof fetch
}

/** Transient statuses worth retrying: rate-limit + server errors. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Fetch with bounded timeout + exponential-backoff retry (modeled on
 * tiger-retry.ts's backoff loop).
 *
 * Retries ONLY on transient failures: thrown fetch errors (network /
 * timeout), 5xx, or 429. Any other response — 2xx, 3xx, non-429 4xx — is
 * returned immediately (callers keep their own `res.ok` handling).
 *
 * Exhaustion semantics: when every attempt failed, returns the LAST
 * retryable Response if one exists (so callers' `!res.ok` guards fire),
 * else rethrows the last thrown error.
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchWithRetryOpts = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = opts.retries ?? DEFAULT_RETRIES
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS
  const fetcher = opts.fetcher ?? fetch

  let lastError: unknown
  let lastResponse: Response | undefined
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** (attempt - 1)))
    }
    // Fresh signal per attempt — AbortSignal.timeout starts ticking at creation.
    const init: RequestInit = { ...opts.init }
    if (!init.signal) init.signal = AbortSignal.timeout(timeoutMs)
    try {
      const res = await fetcher(url, init)
      if (!isRetryableStatus(res.status)) return res
      lastResponse = res
      lastError = undefined
    } catch (err) {
      // AbortError (our timeout), ECONNRESET, ENOTFOUND, socket hang up,
      // TLS handshake flakes (the documented MI House class) — all transient.
      lastError = err
      lastResponse = undefined
    }
  }
  if (lastResponse) return lastResponse
  throw lastError ?? new Error(`fetchWithRetry exhausted for ${url}`)
}

/**
 * Default on-disk cache root for `loadCachedUrl`. Overridable via
 * `CHIARO_FETCH_CACHE_DIR`; resolves via `homedir()` so a CI
 * `actions/cache` `~/.cache/chiaro` path matches what this producer
 * writes (Gotcha #31 — never point tools at a `~`-containing env value).
 */
export function fetchCacheDir(): string {
  return process.env.CHIARO_FETCH_CACHE_DIR ?? join(homedir(), '.cache', 'chiaro')
}

/**
 * Stable cache path for a url: sha1(url) hex, extension-less. A content
 * hash of the URL (not its basename) because generic source URLs collide
 * on basename (`.../2024.zip`, `.../search/`) and may carry query strings.
 */
export function cachedUrlFile(url: string, cacheDir: string): string {
  return join(cacheDir, createHash('sha1').update(url).digest('hex'))
}

export interface LoadCachedUrlOpts extends FetchWithRetryOpts {
  /** Cache directory (default `fetchCacheDir()`). */
  cacheDir?: string
}

/**
 * Return the bytes for `url` — from the on-disk cache if present, else via
 * `fetchWithRetry`, writing a successful (2xx) body to the cache
 * atomically (`.tmp` + rename). Follows the slice-55 tiger-cache contract:
 * skip-if-present, corrupt/zero-byte entry evicted + refetched once.
 *
 * Non-ok responses THROW (`fetch <url> failed: <status>`) and are never
 * cached. Set `CHIARO_NO_FETCH_CACHE=1` to bypass the cache entirely
 * (every call fetches; nothing is read from or written to disk).
 *
 * Intended for immutable payloads (filed disclosures don't change):
 * House yearly bulk ZIPs + per-filing PDFs (audit C37).
 */
export async function loadCachedUrl(url: string, opts: LoadCachedUrlOpts = {}): Promise<Buffer> {
  const bypass = process.env.CHIARO_NO_FETCH_CACHE === '1'
  const cacheDir = opts.cacheDir ?? fetchCacheDir()
  const file = cachedUrlFile(url, cacheDir)

  if (!bypass) {
    const cached = await readCachedEntry(file)
    if (cached) return cached
  }

  const res = await fetchWithRetry(url, opts)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  if (!bypass) {
    await mkdir(cacheDir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, buf)
    await rename(tmp, file)
  }
  return buf
}

/**
 * Read a cache entry. Returns null on miss; a zero-byte entry (corrupt —
 * e.g. a truncated write predating the atomic rename) is evicted so the
 * caller refetches once.
 */
async function readCachedEntry(file: string): Promise<Buffer | null> {
  let size: number
  try {
    const s = await stat(file)
    if (!s.isFile()) return null
    size = s.size
  } catch {
    return null // miss
  }
  if (size > 0) {
    try {
      return await readFile(file)
    } catch {
      return null
    }
  }
  await rm(file, { force: true })
  return null
}
