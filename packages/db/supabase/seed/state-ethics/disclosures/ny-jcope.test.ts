import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseNyFdsIndexHtml,
  inferChamberFromOfficeText,
  nyJcopeDisclosures,
  fetchAllPages,
} from './ny-jcope.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ny-fds-index.html')

describe('parseNyFdsIndexHtml', () => {
  it('extracts 6 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const { rows, nextPageHref } = parseNyFdsIndexHtml(html)
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
      fetcher: async () => {
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
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
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
      fetcher: async () => {
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
      fetcher: async () => {
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
