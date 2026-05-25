import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mock the shared/pdf module so tests inject text directly.
vi.mock('../../shared/pdf.ts', () => ({
  fetchPdf: vi.fn(),
  extractPdfText: vi.fn(),
}))

import { miBoardDisclosures } from './mi-board.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'

const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedExtractPdfText = vi.mocked(extractPdfText)

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'disclosures-mi.json')

// Reset mocks between tests (vitest auto-resets when vi.mock is
// hoisted but explicit resets keep cross-test isolation deterministic).
beforeEach(() => {
  mockedFetchPdf.mockReset()
  mockedExtractPdfText.mockReset()
})

describe('mi-board adapter shape', () => {
  it('reports correct slug + component', () => {
    expect(miBoardDisclosures.slug).toBe('mi-board')
    expect(miBoardDisclosures.component).toBe('disclosures')
  })

  it('covered_states valid', () => {
    expect(miBoardDisclosures.covered_states).toEqual(['MI'])
  })
})

describe('mi-board fetcher injection (back-compat from slice 5I stub fixture)', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await miBoardDisclosures.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })
})

describe('mi-board production-path PDF flow', () => {
  it('production-path returns [] when network is blocked', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })

  it('emits one NormalizedFinancialDisclosure per parsed line item, per legislator', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith' },
        ],
        rowCount: 2,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText
      .mockResolvedValueOnce(
        'Sources of Income\n1. Salary from State of Michigan: $50,000 - $100,000',
      )
      .mockResolvedValueOnce(
        'Sources of Income\n1. Consulting fees: $10,000 - $50,000\n2. Rental income: $1,000 - $10,000',
      )

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    // Jane: 1 line; Alex: 2 lines = 3 rows total
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      official_openstates_person_id: 'ocd-1',
      filing_year: 2024,
      income_kind: 'salary',
      amount_range_low: 50000,
      amount_range_high: 100000,
      state: 'MI',
      source: 'mi-board',
    })
    expect(result[0]?.external_id).toMatch(/^mi-pfd-Doe-Jane-2024-1$/)
    expect(result[1]?.external_id).toMatch(/^mi-pfd-Smith-Alex-2024-1$/)
    expect(result[2]?.external_id).toMatch(/^mi-pfd-Smith-Alex-2024-2$/)
  })

  it('skips legislator on fetchPdf rejection (silent skip)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith' },
        ],
        rowCount: 2,
      }),
    }
    let n = 0
    mockedFetchPdf.mockImplementation(async () => {
      n += 1
      if (n === 1) throw new Error('404')
      return Buffer.from('fake-pdf')
    })
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    // Jane skipped on fetch failure; Alex parses → 1 row
    expect(result).toHaveLength(1)
    expect(result[0]?.official_openstates_person_id).toBe('ocd-2')
  })

  it('emits 0 rows for legislator with empty PDF text', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-1', full_name: 'Jane Doe' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toEqual([])
  })

  it('skips legislators with single-name full_name (deriveMiPfdUrl returns empty)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Singleton' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith' },
        ],
        rowCount: 2,
      }),
    }
    // Only one fetchPdf call expected (Alex); Singleton URL is empty → no fetch
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    const result = await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toHaveLength(1)
    expect(result[0]?.official_openstates_person_id).toBe('ocd-2')
    expect(mockedFetchPdf).toHaveBeenCalledTimes(1)
  })

  it('queries officials for MI state_house AND state_senate', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    await miBoardDisclosures.fetchEvents({ client: client as never } as never)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/chamber\s+in\s+\('state_house'\s*,\s*'state_senate'\)/i),
      expect.arrayContaining(['MI']),
    )
  })
})
