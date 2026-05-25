import { describe, expect, it, vi, beforeEach, afterEach, type MockInstance } from 'vitest'

// Mock pdf-parse at the module level — pdf-parse runs a side-effect
// at import time (reads its own test PDF), which fails in tests
// without a properly-loaded module. The mock returns a callable that
// we control per test.
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

import pdfParse from 'pdf-parse'
import { extractPdfText, fetchPdf } from './pdf.ts'
import { stubFetchBlocked } from '../test-utils/stub-fetch.ts'

const mockedPdfParse = vi.mocked(pdfParse)

describe('extractPdfText', () => {
  beforeEach(() => {
    mockedPdfParse.mockReset()
  })

  it('returns text from pdf-parse result', async () => {
    mockedPdfParse.mockResolvedValue({ text: 'Hello PDF', numpages: 1 } as never)
    const result = await extractPdfText(Buffer.from('fake-pdf-bytes'))
    expect(result).toBe('Hello PDF')
  })

  it('returns empty string when pdf-parse returns empty text', async () => {
    mockedPdfParse.mockResolvedValue({ text: '', numpages: 0 } as never)
    expect(await extractPdfText(Buffer.from('empty'))).toBe('')
  })

  it('returns empty string when pdf-parse rejects (swallows errors)', async () => {
    mockedPdfParse.mockRejectedValue(new Error('parse failed'))
    expect(await extractPdfText(Buffer.from('garbage'))).toBe('')
  })

  it('returns empty string when pdf-parse returns null/undefined text', async () => {
    mockedPdfParse.mockResolvedValue({ text: null, numpages: 0 } as never)
    expect(await extractPdfText(Buffer.from('weird'))).toBe('')
  })
})

describe('fetchPdf', () => {
  let fetchSpy: MockInstance | undefined

  afterEach(() => {
    fetchSpy?.mockRestore()
  })

  it('returns Buffer when fetch is 2xx', async () => {
    const fakeBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])  // "%PDF"
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => fakeBytes.buffer,
    } as never)
    const result = await fetchPdf('https://example.com/test.pdf')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(4)
  })

  it('throws on non-2xx response', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as never)
    await expect(fetchPdf('https://example.com/missing.pdf')).rejects.toThrow('404')
  })

  it('throws when fetch rejects (network / timeout)', async () => {
    const blocked = stubFetchBlocked()
    await expect(fetchPdf('https://example.com/timeout.pdf')).rejects.toThrow('blocked in test')
    blocked.mockRestore()
  })

  it('uses custom timeoutMs when provided', async () => {
    const fakeBytes = new Uint8Array([])
    let observedSignal: AbortSignal | undefined
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      observedSignal = init?.signal ?? undefined
      return { ok: true, status: 200, arrayBuffer: async () => fakeBytes.buffer } as never
    })
    await fetchPdf('https://example.com/ok.pdf', { timeoutMs: 5000 })
    expect(observedSignal).toBeDefined()
  })
})
