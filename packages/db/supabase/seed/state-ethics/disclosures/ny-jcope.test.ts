import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mock the shared/pdf module so slice 20 PDF parse path is testable.
vi.mock('../../shared/pdf.ts', () => ({
  fetchPdf: vi.fn(),
  extractPdfText: vi.fn(),
}))

import {
  parseNyFdsIndexHtml,
  inferChamberFromOfficeText,
  nyJcopeDisclosures,
  fetchAllPages,
} from './ny-jcope.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedExtractPdfText = vi.mocked(extractPdfText)

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ny-fds-index.html')

describe('parseNyFdsIndexHtml', () => {
  it('extracts 6 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows } = parseNyFdsIndexHtml(html)
    expect(rows).toHaveLength(6)
  })

  it('captures filing_id from data-filing-id attribute', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows } = parseNyFdsIndexHtml(html)
    expect(rows[0]!.filing_id).toBe('AM-12345')
  })

  it('captures absolute PDF source URL', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows } = parseNyFdsIndexHtml(html)
    expect(rows[0]!.source_url).toBe('https://ethics.ny.gov/files/fds/2024/AM-12345.pdf')
  })

  it('extracts next-page href when present', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { nextPageHref } = parseNyFdsIndexHtml(html)
    expect(nextPageHref).toBe('https://ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024&page=2')
  })

  it('returns null nextPageHref when missing', () => {
    const { nextPageHref } = parseNyFdsIndexHtml('<div><table class="filings-table"><tbody></tbody></table></div>')
    expect(nextPageHref).toBeNull()
  })
})

describe('inferChamberFromOfficeText', () => {
  it('matches "NYS Assembly Member" → state_house', () => {
    expect(inferChamberFromOfficeText('NYS Assembly Member')).toBe('state_house')
  })
  it('matches "NYS Senator" → state_senate', () => {
    expect(inferChamberFromOfficeText('NYS Senator')).toBe('state_senate')
  })
  it('matches "Member of Assembly" → state_house', () => {
    expect(inferChamberFromOfficeText('Member of Assembly')).toBe('state_house')
  })
  it('returns null for non-legislator office text', () => {
    expect(inferChamberFromOfficeText('NYS Lieutenant Governor')).toBeNull()
  })
})

describe('fetchAllPages', () => {
  it('walks pagination until next-page link absent', async () => {
    const html1 = `<div class="fds-index">
      <table class="filings-table"><tbody>
        <tr><td>Jane Doe</td><td>NYS Assembly Member</td><td>2024</td><td>2024-05-15</td>
        <td><a href="/files/fds/2024/A-1.pdf" data-filing-id="A-1">Download</a></td></tr>
      </tbody></table>
      <nav class="pagination"><a class="next-page" href="/page2">Next</a></nav>
    </div>`
    const html2 = `<div class="fds-index">
      <table class="filings-table"><tbody>
        <tr><td>Alex Smith</td><td>NYS Senator</td><td>2024</td><td>2024-05-20</td>
        <td><a href="/files/fds/2024/B-2.pdf" data-filing-id="B-2">Download</a></td></tr>
      </tbody></table>
    </div>`
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return calls === 1 ? html1 : html2
    }
    const allRows = await fetchAllPages('https://ethics.ny.gov/start', fetcher)
    expect(allRows).toHaveLength(2)
    expect(calls).toBe(2)
  })

  it('respects page cap', async () => {
    // Every page yields a next-page link → infinite loop without cap.
    const html = `<div class="fds-index">
      <table class="filings-table"><tbody>
        <tr><td>Jane Doe</td><td>NYS Assembly Member</td><td>2024</td><td>2024-05-15</td>
        <td><a href="/files/fds/2024/A-1.pdf" data-filing-id="A-1">Download</a></td></tr>
      </tbody></table>
      <nav class="pagination"><a class="next-page" href="/next">Next</a></nav>
    </div>`
    const allRows = await fetchAllPages('https://ethics.ny.gov/start', async () => html, { maxPages: 3 })
    expect(allRows).toHaveLength(3)  // 3 pages × 1 row each = capped at 3
  })
})

describe('nyJcopeDisclosures adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nyJcopeDisclosures.slug).toBe('ny-jcope')
    expect(nyJcopeDisclosures.component).toBe('disclosures')
    expect(nyJcopeDisclosures.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{
      official_openstates_person_id: 'x',
      filing_year: 2024,
      state: 'NY',
      source_url: 'u',
      source: 'ny-jcope',
    }]
    const result = await nyJcopeDisclosures.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('emits NormalizedFinancialDisclosure[] per resolvable filing; skips non-legislator + unresolved', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({
          rows: [{ openstates_person_id: `ocd-person/ny-${Math.random().toString(36).slice(2, 6)}` }],
          rowCount: 1,
        })
      }),
    }
    // Stub second fetch (page 2) to return empty body to terminate pagination.
    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never)
    // 6 fixture rows: 2 Assembly + 2 Senate resolve = 4; Pat Mystery (Lt Gov) chamber null → skip; Unknown Stranger unresolved → skip.
    // Expect 4 rows emitted.
    expect(result).toHaveLength(4)
  })

  it('production-path fetch leak protected via vi.spyOn', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await nyJcopeDisclosures.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })

  it('external_id derived from filing_id with filing- prefix', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string }>
    expect(result[0]!.external_id).toBe('filing-AM-12345')
  })

  it('placeholder rows leave income fields undefined (PDF parser fills later)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ income_source?: string; income_kind?: string; amount_range_low?: number }>
    expect(result[0]!.income_source).toBeUndefined()
    expect(result[0]!.income_kind).toBeUndefined()
    expect(result[0]!.amount_range_low).toBeUndefined()
  })
})

describe('ny-jcope slice 20 PDF line-item fill', () => {
  beforeEach(() => {
    mockedFetchPdf.mockReset()
    mockedExtractPdfText.mockReset()
  })

  it('emits placeholder + N line-item rows per filing when PDF parses', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({
          rows: [{ openstates_person_id: `ocd-${Math.random().toString(36).slice(2, 6)}` }],
          rowCount: 1,
        })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary, State of New York: $50,000 - $100,000\n2. Consulting fees: $10,000 - $25,000',
    )

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string; income_kind?: string }>

    // Fixture: 4 resolvable filings (LG chamber null + Unknown Stranger
    // unresolved both skipped). Each resolved filing gets:
    //   - 1 placeholder row (filing-{id}, no income fields)
    //   - 2 line-item rows from mocked PDF text (filing-{id}-1 + filing-{id}-2)
    // Total: 4 placeholders + 8 line items = 12 rows
    expect(result).toHaveLength(12)

    // Discriminate placeholder vs line-item by external_id segment count:
    // placeholder = filing-{id} → 3 segments after split('-') (filing + id-parts);
    // line-item = filing-{id}-{lineNo} → 4 segments.
    // (Substring includes('-1') is unsafe — filing IDs contain digits.)
    const placeholders = result.filter(r => /^filing-[A-Z]+-\d+$/.test(r.external_id ?? ''))
    const lineItems = result.filter(r => /^filing-[A-Z]+-\d+-\d+$/.test(r.external_id ?? ''))
    expect(placeholders).toHaveLength(4)
    expect(lineItems).toHaveLength(8)
    expect(lineItems[0]?.income_kind).toBe('salary')
  })

  it('emits only placeholder when fetchPdf rejects (silent skip)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockRejectedValue(new Error('404'))
    mockedExtractPdfText.mockResolvedValue('')  // never reached

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string }>

    // 4 resolvable filings × 1 placeholder each, no line items
    expect(result).toHaveLength(4)
    expect(result.every(r => r.external_id?.match(/^filing-[A-Z]+-\d+$/))).toBe(true)
  })

  it('emits only placeholder when extractPdfText returns empty', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never)

    // 4 placeholders, no line items
    expect(result).toHaveLength(4)
  })

  it('respects maxPdfsPerRun cap (only first N filings get PDF parse)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      maxPdfsPerRun: 2,
    } as never)

    // 4 placeholders total + line items from only the FIRST 2 filings (1 line item each)
    // = 4 + 2 = 6 rows
    expect(result).toHaveLength(6)
    expect(mockedFetchPdf).toHaveBeenCalledTimes(2)
  })

  it('line-item external_id format is filing-{id}-{lineNo}', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )

    let n = 0
    const result = await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
    } as never) as Array<{ external_id?: string }>

    // First filing's line item has external_id = filing-AM-12345-1
    const lineItem = result.find(r => r.external_id?.includes('-1') && r.external_id !== 'filing-AM-12345')
    expect(lineItem?.external_id).toBe('filing-AM-12345-1')
  })

  it('production-path remains [] when network is blocked (slice 17 behavior preserved)', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const result = await nyJcopeDisclosures.fetchEvents({ client: client as never } as never)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})

describe('ny-jcope slice 22 onSkip instrumentation', () => {
  beforeEach(() => {
    mockedFetchPdf.mockReset()
    mockedExtractPdfText.mockReset()
  })

  it('calls onSkip with filter stage for non-legislator office text', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    // Stub PDF mocks so per-filing PDF pass doesn't generate extra skips.
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )
    const skips: SkipReason[] = []
    let n = 0
    await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)

    // Pat Mystery (Lieutenant Governor) → chamber null → filter skip
    const filterSkip = skips.find(s => s.stage === 'filter' && s.legislator === 'Pat Mystery')
    expect(filterSkip).toBeDefined()
    expect(filterSkip).toMatchObject({
      adapter: 'ny-jcope',
      stage: 'filter',
      legislator: 'Pat Mystery',
    })
    expect(filterSkip!.reason).toMatch(/Lieutenant Governor/i)
  })

  it('calls onSkip with resolve stage for unmatched legislator', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(
      'Sources of Income\n1. Salary: $50,000 - $100,000',
    )
    const skips: SkipReason[] = []
    let n = 0
    await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)

    // Unknown Stranger → resolveOpenstatesPersonId returns null → resolve skip
    const resolveSkip = skips.find(s => s.stage === 'resolve' && s.legislator === 'Unknown Stranger')
    expect(resolveSkip).toBeDefined()
    expect(resolveSkip).toMatchObject({
      adapter: 'ny-jcope',
      stage: 'resolve',
      legislator: 'Unknown Stranger',
    })
  })

  it('calls onSkip with fetch stage for per-filing PDF fetch failure', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockRejectedValue(new Error('PDF gone'))
    const skips: SkipReason[] = []
    let n = 0
    await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)

    // 4 resolvable filings, all fail fetchPdf → 4 fetch skips
    const fetchSkips = skips.filter(s => s.stage === 'fetch')
    expect(fetchSkips.length).toBe(4)
    expect(fetchSkips[0]).toMatchObject({
      adapter: 'ny-jcope',
      stage: 'fetch',
    })
    expect(fetchSkips[0]!.detail).toMatch(/PDF gone/)
  })

  it('calls onSkip with extract stage when extractPdfText returns empty', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')
    const skips: SkipReason[] = []
    let n = 0
    await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)

    const extractSkips = skips.filter(s => s.stage === 'extract')
    expect(extractSkips.length).toBe(4)
    expect(extractSkips[0]).toMatchObject({
      adapter: 'ny-jcope',
      stage: 'extract',
    })
  })

  it('calls onSkip with parse stage when parseNyFdsText returns 0 line items', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    // Text content that does NOT contain recognizable income line patterns.
    mockedExtractPdfText.mockResolvedValue('no income data in this document')
    const skips: SkipReason[] = []
    let n = 0
    await nyJcopeDisclosures.fetchEvents({
      client: client as never,
      pageFetcher: async () => {
        n += 1
        if (n === 1) return html
        return '<div><table class="filings-table"><tbody></tbody></table></div>'
      },
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)

    const parseSkips = skips.filter(s => s.stage === 'parse')
    expect(parseSkips.length).toBe(4)
    expect(parseSkips[0]).toMatchObject({
      adapter: 'ny-jcope',
      stage: 'parse',
    })
  })
})
