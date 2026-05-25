import pdfParse from 'pdf-parse'

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
 */
export async function fetchPdf(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
