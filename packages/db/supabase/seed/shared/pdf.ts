import pdfParse from 'pdf-parse'
import { fetchWithRetry, loadCachedUrl } from './http.ts'

const DEFAULT_TIMEOUT_MS = 15000

/**
 * Extract text from a PDF buffer. Wraps pdf-parse's bare API.
 *
 * Returns empty string on parse failure (caller handles via empty
 * line-item array). Errors are swallowed because pdf-parse is known
 * to write warnings to stderr for edge cases (encrypted PDFs,
 * embedded fonts, non-standard layouts) without throwing — empty
 * result is the canonical "couldn't extract" signal.
 *
 * Slice 19 helper. Consumers: MI PFD (slice 19), NY FDS line-items
 * (slice 20), TX TEC sworn-complaint orders (slice 21+), CA FPPC
 * Form 700 (slice 22+).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer)
    return result.text ?? ''
  } catch {
    return ''
  }
}

/**
 * Fetch a PDF URL and return its contents as a Buffer.
 *
 * 15s default timeout (PDFs may be MB-scale; HTML adapters use 5s).
 * Throws on network failure or non-2xx response; callers wrap in
 * try/catch + silently skip.
 *
 * Slice 81 (audit C36 + C37): rides the shared fetchWithRetry helper
 * (bounded retries on transient failures) and, on the production path,
 * the shared on-disk cache — filed disclosure PDFs are immutable, so
 * re-runs after parser fixes skip the re-download. Cache root
 * `~/.cache/chiaro` (env `CHIARO_FETCH_CACHE_DIR` override;
 * `CHIARO_NO_FETCH_CACHE=1` bypass). An injected `fetcher` (test seam)
 * bypasses the disk cache so tests stay hermetic.
 */
export async function fetchPdf(
  url: string,
  opts: {
    timeoutMs?: number
    retries?: number
    backoffMs?: number
    fetcher?: typeof fetch
  } = {},
): Promise<Buffer> {
  const retryOpts = {
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(opts.retries !== undefined ? { retries: opts.retries } : {}),
    ...(opts.backoffMs !== undefined ? { backoffMs: opts.backoffMs } : {}),
  }
  if (opts.fetcher) {
    const res = await fetchWithRetry(url, { ...retryOpts, fetcher: opts.fetcher })
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
  return loadCachedUrl(url, retryOpts)
}
