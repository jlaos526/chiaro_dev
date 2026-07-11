import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Buffer } from 'node:buffer'

// Mock the shared/pdf module so tests inject text directly.
vi.mock('../../shared/pdf.ts', () => ({
  extractPdfText: vi.fn(),
  fetchPdf: vi.fn(),
}))

// Mock the house-zip helper so tests inject manifest directly.
vi.mock('../shared/house-zip.ts', () => ({
  fetchHouseDisclosureZip: vi.fn(),
}))

import { houseEfdPtr } from './house-efd.ts'
import { extractPdfText } from '../../shared/pdf.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { createSkipCollector } from '../../shared/instrumentation.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const mockedExtractPdfText = vi.mocked(extractPdfText)
const mockedFetchHouseZip = vi.mocked(fetchHouseDisclosureZip)

const PDF_TEXT_HAPPY =
  'Schedule of Transactions\n01/05/2025 01/19/2025 P AAPL Apple Inc. $1,001 - $15,000'

const PDF_TEXT_TWO_TRADES =
  'Schedule of Transactions\n01/05/2025 01/19/2025 P AAPL Apple Inc. $1,001 - $15,000\n02/10/2025 02/15/2025 S MSFT Microsoft Corp. $15,001 - $50,000'

beforeEach(() => {
  mockedExtractPdfText.mockReset()
  mockedFetchHouseZip.mockReset()
})

describe('house-efd-ptr adapter shape', () => {
  it('reports correct slug', () => {
    expect(houseEfdPtr.slug).toBe('house-efd-ptr')
  })
})

describe('house-efd-ptr happy path', () => {
  it('emits one NormalizedPtr per parsed trade row with deterministic external_id', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: '20012345',
          bioguideId: 'P000197',
          fullName: 'Nancy Pelosi',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/20012345.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue(PDF_TEXT_TWO_TRADES)

    const rows = await houseEfdPtr.fetchTransactions({ year: 2025 })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      official_bioguide_id: 'P000197',
      official_full_name: 'Nancy Pelosi',
      filing_year: 2025,
      transaction_type: 'purchase',
      amount_range_low: 1001,
      amount_range_high: 15000,
      asset_ticker: 'AAPL',
      external_id: 'house-ptr-20012345-1',
    })
    expect(rows[1]?.external_id).toBe('house-ptr-20012345-2')
    expect(rows[1]?.transaction_type).toBe('sale')
  })

  it('omits official_bioguide_id when manifest entry lacks one', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'X1',
          fullName: 'Unknown Member',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl: 'https://example.com/X1.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue(PDF_TEXT_HAPPY)

    const rows = await houseEfdPtr.fetchTransactions({ year: 2025 })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.official_bioguide_id).toBeUndefined()
    expect(rows[0]?.official_full_name).toBe('Unknown Member')
  })
})

describe('house-efd-ptr slice 22 onSkip instrumentation', () => {
  it('calls onSkip with stage=fetch and returns [] when ZIP fetch throws', async () => {
    mockedFetchHouseZip.mockRejectedValue(new Error('502 bad gateway'))
    const { onSkip, summary } = createSkipCollector()
    const rows = await houseEfdPtr.fetchTransactions({ year: 2025, onSkip })
    expect(rows).toEqual([])
    const s = summary()
    expect(s.grandTotal).toBe(1)
    const adapterEntry = s.byAdapter.get('house-efd-ptr')!
    expect(adapterEntry.byStage.get('fetch')).toBe(1)
    expect(adapterEntry.samples[0]?.detail).toMatch(/502/)
  })

  it('calls onSkip with stage=extract when extractPdfText returns empty', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'F1',
          fullName: 'Jane Doe',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl: 'https://example.com/F1.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue('')
    const skips: SkipReason[] = []
    const rows = await houseEfdPtr.fetchTransactions({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'house-efd-ptr',
      stage: 'extract',
      legislator: 'Jane Doe',
    })
  })

  it('calls onSkip with stage=parse when parsePtrText finds zero trades', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'F2',
          fullName: 'Alex Smith',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl: 'https://example.com/F2.pdf',
        },
      ],
    })
    // Text with no "Schedule of Transactions" header → parsePtrText returns []
    mockedExtractPdfText.mockResolvedValue('No relevant content here.')
    const skips: SkipReason[] = []
    const rows = await houseEfdPtr.fetchTransactions({
      year: 2025,
      onSkip: (r: SkipReason) => {
        skips.push(r)
      },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'house-efd-ptr',
      stage: 'parse',
      legislator: 'Alex Smith',
    })
  })

  it('does NOT call onSkip when row emits successfully', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'F3',
          bioguideId: 'X000001',
          fullName: 'Jane Doe',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl: 'https://example.com/F3.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue(PDF_TEXT_HAPPY)
    const { onSkip, summary } = createSkipCollector()
    const rows = await houseEfdPtr.fetchTransactions({ year: 2025, onSkip })
    expect(rows).toHaveLength(1)
    expect(summary().grandTotal).toBe(0)
  })
})
