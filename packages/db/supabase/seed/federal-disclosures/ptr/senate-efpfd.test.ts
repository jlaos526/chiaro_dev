import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Buffer } from 'node:buffer'

// Mock shared/pdf (extractPdfText + fetchPdf).
vi.mock('../../shared/pdf.ts', () => ({
  extractPdfText: vi.fn(),
  fetchPdf: vi.fn(),
}))

// Mock senate-agreement helpers so tests inject session + results directly.
vi.mock('../shared/senate-agreement.ts', () => ({
  acceptSenateAgreement: vi.fn(),
  searchSenateEfpfd: vi.fn(),
}))

import { senateEfpfdPtr } from './senate-efpfd.ts'
import { extractPdfText, fetchPdf } from '../../shared/pdf.ts'
import { acceptSenateAgreement, searchSenateEfpfd } from '../shared/senate-agreement.ts'
import { createSkipCollector } from '../../shared/instrumentation.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const mockedExtractPdfText = vi.mocked(extractPdfText)
const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedAgreement = vi.mocked(acceptSenateAgreement)
const mockedSearch = vi.mocked(searchSenateEfpfd)

const PDF_TEXT_HAPPY =
  'Schedule of Transactions\n03/02/2025 03/16/2025 P NVDA NVIDIA Corp. $50,001 - $100,000'

const SESSION = { csrfToken: 'csrf-token', cookie: 'csrftoken=abc' }

beforeEach(() => {
  mockedExtractPdfText.mockReset()
  mockedFetchPdf.mockReset()
  mockedAgreement.mockReset()
  mockedSearch.mockReset()
})

describe('senate-efpfd-ptr adapter shape', () => {
  it('reports correct slug', () => {
    expect(senateEfpfdPtr.slug).toBe('senate-efpfd-ptr')
  })
})

describe('senate-efpfd-ptr happy path', () => {
  it('emits one NormalizedPtr per parsed trade row with deterministic external_id', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'S1234',
        fullName: 'Senator A',
        reportDate: '2025-04-01',
        pdfUrl: 'https://efdsearch.senate.gov/search/view/ptr/S1234',
      },
    ])
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(PDF_TEXT_HAPPY)

    const rows = await senateEfpfdPtr.fetchTransactions({ year: 2025 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      official_full_name: 'Senator A',
      filing_year: 2025,
      transaction_type: 'purchase',
      asset_ticker: 'NVDA',
      amount_range_low: 50001,
      amount_range_high: 100000,
      external_id: 'senate-ptr-S1234-1',
    })
  })

  it('iterates multiple search results with stable external_id per filing', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'A1',
        fullName: 'Sen A',
        reportDate: '2025-01-01',
        pdfUrl: 'https://example.com/A1.pdf',
      },
      {
        filingId: 'B2',
        fullName: 'Sen B',
        reportDate: '2025-02-01',
        pdfUrl: 'https://example.com/B2.pdf',
      },
    ])
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(PDF_TEXT_HAPPY)

    const rows = await senateEfpfdPtr.fetchTransactions({ year: 2025 })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.external_id).toBe('senate-ptr-A1-1')
    expect(rows[1]?.external_id).toBe('senate-ptr-B2-1')
  })
})

describe('senate-efpfd-ptr slice 22 onSkip instrumentation', () => {
  it('calls onSkip with stage=fetch and returns [] when agreement gate fails', async () => {
    mockedAgreement.mockRejectedValue(new Error('CSRF token not found'))
    const { onSkip, summary } = createSkipCollector()
    const rows = await senateEfpfdPtr.fetchTransactions({ year: 2025, onSkip })
    expect(rows).toEqual([])
    const adapterEntry = summary().byAdapter.get('senate-efpfd-ptr')!
    expect(adapterEntry.byStage.get('fetch')).toBe(1)
    expect(adapterEntry.samples[0]?.reason).toMatch(/agreement gate/i)
  })

  it('calls onSkip with stage=fetch when search throws', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockRejectedValue(new Error('500 server error'))
    const { onSkip, summary } = createSkipCollector()
    const rows = await senateEfpfdPtr.fetchTransactions({ year: 2025, onSkip })
    expect(rows).toEqual([])
    const adapterEntry = summary().byAdapter.get('senate-efpfd-ptr')!
    expect(adapterEntry.byStage.get('fetch')).toBe(1)
    expect(adapterEntry.samples[0]?.reason).toMatch(/search/i)
  })

  it('calls onSkip with stage=fetch when per-filing fetchPdf throws (continues to next)', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'X1',
        fullName: 'Sen X',
        reportDate: '2025-01-01',
        pdfUrl: 'https://example.com/X1.pdf',
      },
      {
        filingId: 'Y2',
        fullName: 'Sen Y',
        reportDate: '2025-02-01',
        pdfUrl: 'https://example.com/Y2.pdf',
      },
    ])
    let n = 0
    mockedFetchPdf.mockImplementation(async () => {
      n += 1
      if (n === 1) throw new Error('404 not found')
      return Buffer.from('fake-pdf')
    })
    mockedExtractPdfText.mockResolvedValue(PDF_TEXT_HAPPY)

    const skips: SkipReason[] = []
    const rows = await senateEfpfdPtr.fetchTransactions({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.external_id).toBe('senate-ptr-Y2-1')
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'senate-efpfd-ptr',
      stage: 'fetch',
      legislator: 'Sen X',
    })
  })

  it('calls onSkip with stage=extract when extractPdfText returns empty', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'Z1',
        fullName: 'Sen Z',
        reportDate: '2025-01-01',
        pdfUrl: 'https://example.com/Z1.pdf',
      },
    ])
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    const skips: SkipReason[] = []
    const rows = await senateEfpfdPtr.fetchTransactions({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'senate-efpfd-ptr',
      stage: 'extract',
      legislator: 'Sen Z',
    })
  })

  it('calls onSkip with stage=parse when parsePtrText finds zero trades', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'P1',
        fullName: 'Sen P',
        reportDate: '2025-01-01',
        pdfUrl: 'https://example.com/P1.pdf',
      },
    ])
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('No transactions here.')

    const skips: SkipReason[] = []
    const rows = await senateEfpfdPtr.fetchTransactions({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'senate-efpfd-ptr',
      stage: 'parse',
      legislator: 'Sen P',
    })
  })
})
