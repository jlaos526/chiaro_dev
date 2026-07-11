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

import { senateEfpfdFd } from './senate-efpfd.ts'
import { extractPdfText, fetchPdf } from '../../shared/pdf.ts'
import { acceptSenateAgreement, searchSenateEfpfd } from '../shared/senate-agreement.ts'
import { createSkipCollector } from '../../shared/instrumentation.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const mockedExtractPdfText = vi.mocked(extractPdfText)
const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedAgreement = vi.mocked(acceptSenateAgreement)
const mockedSearch = vi.mocked(searchSenateEfpfd)

const FD_TEXT_MIXED = [
  'Schedule A',
  'NVIDIA Corp. [ST] $50,001 - $100,000',
  'Schedule C',
  'Mortgage Bank Loan $100,001 - $250,000',
  'Schedule H',
  'Industry association gift $1,001 - $15,000',
  'Schedule I',
  'Conference travel SFO-DCA $5,001 - $15,000',
].join('\n')

const FD_TEXT_HOLDING_ONLY = 'Schedule A\nNVIDIA Corp. [ST] $50,001 - $100,000'

const SESSION = { csrfToken: 'csrf-token', cookie: 'csrftoken=abc' }

beforeEach(() => {
  mockedExtractPdfText.mockReset()
  mockedFetchPdf.mockReset()
  mockedAgreement.mockReset()
  mockedSearch.mockReset()
})

describe('senate-efpfd-fd adapter shape', () => {
  it('reports correct slug', () => {
    expect(senateEfpfdFd.slug).toBe('senate-efpfd-fd')
  })
})

describe('senate-efpfd-fd happy path', () => {
  it('emits holdings + other rows from a mixed-schedule filing', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'F4321',
        fullName: 'Senator A',
        reportDate: '2025-05-15',
        pdfUrl: 'https://efdsearch.senate.gov/search/view/annual/F4321',
      },
    ])
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(FD_TEXT_MIXED)

    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({ year: 2025 })
    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      official_full_name: 'Senator A',
      filing_year: 2025,
      external_id: 'senate-fd-F4321-A-1',
    })

    expect(other).toHaveLength(3)
    // External_id schedule-letter mapping: liability=C, gift=H, travel=I.
    // Index suffix is the combined-array position per plan code; schedule
    // letter encodes the category itself.
    const byCategory = new Map(other.map((r) => [r.category, r]))
    expect(byCategory.get('liability')?.external_id).toMatch(/^senate-fd-F4321-C-\d+$/)
    expect(byCategory.get('gift')?.external_id).toMatch(/^senate-fd-F4321-H-\d+$/)
    expect(byCategory.get('travel')?.external_id).toMatch(/^senate-fd-F4321-I-\d+$/)
    for (const row of other) {
      expect(row.official_full_name).toBe('Senator A')
    }
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
    mockedExtractPdfText.mockResolvedValue(FD_TEXT_HOLDING_ONLY)

    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({ year: 2025 })
    expect(holdings).toHaveLength(2)
    expect(holdings[0]?.external_id).toBe('senate-fd-A1-A-1')
    expect(holdings[1]?.external_id).toBe('senate-fd-B2-A-1')
    expect(other).toEqual([])
  })
})

describe('senate-efpfd-fd slice 22 onSkip instrumentation', () => {
  it('calls onSkip with stage=fetch and returns empty when agreement gate fails', async () => {
    mockedAgreement.mockRejectedValue(new Error('CSRF token not found'))
    const { onSkip, summary } = createSkipCollector()
    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({ year: 2025, onSkip })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    const adapterEntry = summary().byAdapter.get('senate-efpfd-fd')!
    expect(adapterEntry.byStage.get('fetch')).toBe(1)
    expect(adapterEntry.samples[0]?.reason).toMatch(/agreement gate/i)
  })

  it('calls onSkip with stage=fetch when search throws', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockRejectedValue(new Error('500 server error'))
    const { onSkip, summary } = createSkipCollector()
    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({ year: 2025, onSkip })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    const adapterEntry = summary().byAdapter.get('senate-efpfd-fd')!
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
    mockedExtractPdfText.mockResolvedValue(FD_TEXT_HOLDING_ONLY)

    const skips: SkipReason[] = []
    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(holdings).toHaveLength(1)
    expect(holdings[0]?.external_id).toBe('senate-fd-Y2-A-1')
    expect(other).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'senate-efpfd-fd',
      stage: 'fetch',
      legislator: 'Sen X',
    })
  })

  it('calls onSkip with stage=extract when extractPdfText throws', async () => {
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
    mockedExtractPdfText.mockRejectedValue(new Error('PDF corrupt'))

    const skips: SkipReason[] = []
    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'senate-efpfd-fd',
      stage: 'extract',
      legislator: 'Sen Z',
    })
    expect(skips[0]?.detail).toMatch(/corrupt/)
  })

  it('calls onSkip with stage=extract when extractPdfText returns empty', async () => {
    mockedAgreement.mockResolvedValue(SESSION)
    mockedSearch.mockResolvedValue([
      {
        filingId: 'E1',
        fullName: 'Sen E',
        reportDate: '2025-01-01',
        pdfUrl: 'https://example.com/E1.pdf',
      },
    ])
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    const skips: SkipReason[] = []
    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'senate-efpfd-fd',
      stage: 'extract',
      legislator: 'Sen E',
    })
  })

  it('returns zero rows without onSkip when parser finds no schedule data (Risk #5)', async () => {
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
    mockedExtractPdfText.mockResolvedValue('Cover sheet only.')

    const { onSkip, summary } = createSkipCollector()
    const { holdings, other } = await senateEfpfdFd.fetchDisclosures({ year: 2025, onSkip })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    expect(summary().grandTotal).toBe(0)
  })
})
