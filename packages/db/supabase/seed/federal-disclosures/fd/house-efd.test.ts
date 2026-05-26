import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Buffer } from 'node:buffer'

// Mock the shared/pdf module so tests inject text directly.
vi.mock('../../shared/pdf.ts', () => ({
  extractPdfText: vi.fn(),
  fetchPdf:       vi.fn(),
}))

// Mock the house-zip helper so tests inject manifest directly.
vi.mock('../shared/house-zip.ts', () => ({
  fetchHouseDisclosureZip: vi.fn(),
}))

import { houseEfdFd } from './house-efd.ts'
import { extractPdfText } from '../../shared/pdf.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { createSkipCollector } from '../../shared/instrumentation.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const mockedExtractPdfText = vi.mocked(extractPdfText)
const mockedFetchHouseZip  = vi.mocked(fetchHouseDisclosureZip)

/**
 * Mock FD text covering Schedule A (1 holding) + Schedule C (1 liability)
 * + Schedule H (1 gift) + Schedule I (1 travel). Schedules D/E/F/G are
 * intentionally absent — parseFdText emits nothing for those per Risk #5.
 */
const FD_TEXT_MIXED = [
  'Schedule A',
  'Apple Inc. [ST] $15,001 - $50,000',
  'Schedule C',
  'Big Bank Mortgage $50,001 - $100,000',
  'Schedule H',
  'Acme Corp annual dinner gift $1,001 - $15,000',
  'Schedule I',
  'Trade group fly-in Washington DC $5,001 - $15,000',
].join('\n')

const FD_TEXT_HOLDING_ONLY =
  'Schedule A\nApple Inc. [ST] $15,001 - $50,000'

beforeEach(() => {
  mockedExtractPdfText.mockReset()
  mockedFetchHouseZip.mockReset()
})

describe('house-efd-fd adapter shape', () => {
  it('reports correct slug', () => {
    expect(houseEfdFd.slug).toBe('house-efd-fd')
  })
})

describe('house-efd-fd happy path', () => {
  it('emits holdings + other rows from a mixed-schedule filing', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId:   '90012345',
          bioguideId: 'P000197',
          fullName:   'Nancy Pelosi',
          pdfBytes:   Buffer.from('fake-pdf'),
          pdfUrl:     'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025/90012345.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue(FD_TEXT_MIXED)

    const { holdings, other } = await houseEfdFd.fetchDisclosures({ year: 2025 })

    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      official_bioguide_id: 'P000197',
      official_full_name:   'Nancy Pelosi',
      filing_year:          2025,
      external_id:          'house-fd-90012345-A-1',
    })

    expect(other).toHaveLength(3)
    // External_id schedule-letter mapping: liability=C, gift=H, travel=I.
    // Index suffix uses combined-array position (per plan code lines 1153-1162);
    // schedule letter encodes category, position increments globally.
    const byCategory = new Map(other.map(r => [r.category, r]))
    expect(byCategory.get('liability')?.external_id).toMatch(/^house-fd-90012345-C-\d+$/)
    expect(byCategory.get('gift')?.external_id).toMatch(/^house-fd-90012345-H-\d+$/)
    expect(byCategory.get('travel')?.external_id).toMatch(/^house-fd-90012345-I-\d+$/)
    // Bioguide propagation through to non-stock rows
    for (const row of other) {
      expect(row.official_bioguide_id).toBe('P000197')
      expect(row.official_full_name).toBe('Nancy Pelosi')
    }
  })

  it('returns zero rows without onSkip when parser finds nothing (Risk #5)', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'EMPTY1',
          fullName: 'Some Member',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl:   'https://example.com/EMPTY1.pdf',
        },
      ],
    })
    // Non-empty text that contains no recognizable schedule sections
    mockedExtractPdfText.mockResolvedValue('Cover page only. No schedule data here.')

    const { onSkip, summary } = createSkipCollector()
    const { holdings, other } = await houseEfdFd.fetchDisclosures({ year: 2025, onSkip })

    expect(holdings).toEqual([])
    expect(other).toEqual([])
    // Zero rows from parser is acceptable; no skip recorded
    expect(summary().grandTotal).toBe(0)
  })

  it('omits official_bioguide_id when manifest entry lacks one', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'NOBIO1',
          fullName: 'Unknown Member',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl:   'https://example.com/NOBIO1.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue(FD_TEXT_HOLDING_ONLY)

    const { holdings, other } = await houseEfdFd.fetchDisclosures({ year: 2025 })
    expect(holdings).toHaveLength(1)
    expect(holdings[0]?.official_bioguide_id).toBeUndefined()
    expect(holdings[0]?.official_full_name).toBe('Unknown Member')
    expect(other).toEqual([])
  })
})

describe('house-efd-fd slice 22 onSkip instrumentation', () => {
  it('calls onSkip with stage=fetch and returns empty when ZIP fetch throws', async () => {
    mockedFetchHouseZip.mockRejectedValue(new Error('502 bad gateway'))
    const { onSkip, summary } = createSkipCollector()
    const { holdings, other } = await houseEfdFd.fetchDisclosures({ year: 2025, onSkip })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    const s = summary()
    expect(s.grandTotal).toBe(1)
    const adapterEntry = s.byAdapter.get('house-efd-fd')!
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
          pdfUrl:   'https://example.com/F1.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockResolvedValue('')
    const skips: SkipReason[] = []
    const { holdings, other } = await houseEfdFd.fetchDisclosures({
      year:   2025,
      onSkip: (r: SkipReason) => { skips.push(r) },
    })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter:    'house-efd-fd',
      stage:      'extract',
      legislator: 'Jane Doe',
    })
  })

  it('calls onSkip with stage=extract when extractPdfText throws', async () => {
    mockedFetchHouseZip.mockResolvedValue({
      filings: [
        {
          filingId: 'F2',
          fullName: 'Alex Smith',
          pdfBytes: Buffer.from('fake-pdf'),
          pdfUrl:   'https://example.com/F2.pdf',
        },
      ],
    })
    mockedExtractPdfText.mockRejectedValue(new Error('PDF corrupt'))
    const skips: SkipReason[] = []
    const { holdings, other } = await houseEfdFd.fetchDisclosures({
      year:   2025,
      onSkip: (r: SkipReason) => { skips.push(r) },
    })
    expect(holdings).toEqual([])
    expect(other).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter:    'house-efd-fd',
      stage:      'extract',
      legislator: 'Alex Smith',
    })
    expect(skips[0]?.detail).toMatch(/corrupt/)
  })
})
