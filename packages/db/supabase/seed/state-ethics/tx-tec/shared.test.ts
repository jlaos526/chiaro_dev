import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../../shared/pdf.ts', () => ({
  fetchPdf: vi.fn(),
  extractPdfText: vi.fn(),
}))

import { parseTxTecOrdersHtml, isTexasLegislatorRow, fetchSwornComplaintOrders } from './shared.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const mockedFetchPdf = vi.mocked(fetchPdf)
const mockedExtractPdfText = vi.mocked(extractPdfText)

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'tx-tec-orders.html')

describe('parseTxTecOrdersHtml', () => {
  it('extracts all 8 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseTxTecOrdersHtml(html)
    expect(rows).toHaveLength(8)
  })

  it('extracts order number + pdf URL from anchor', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseTxTecOrdersHtml(html)
    expect(rows[0]!.order_number).toBe('SC-202401-001')
    expect(rows[0]!.source_pdf_url).toBe(
      'https://www.ethics.state.tx.us/data/enforcement/sworn_complaints/2024/SC-202401-001.pdf',
    )
  })

  it('extracts year_filed as integer', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseTxTecOrdersHtml(html)
    expect(rows[0]!.year_filed).toBe(2024)
  })
})

describe('isTexasLegislatorRow', () => {
  it('matches "Texas House of Representatives"', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas House of Representatives' } as never)).toBe(true)
  })
  it('matches "Texas Senate"', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Senate' } as never)).toBe(true)
  })
  it('rejects Comptroller', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Comptroller of Public Accounts' } as never)).toBe(
      false,
    )
  })
  it('rejects state agencies', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Department of Transportation' } as never)).toBe(
      false,
    )
  })
})

describe('fetchSwornComplaintOrders', () => {
  it('emits matched legislator complaints + events (filters non-legislators + unresolved)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({
          rows: [
            { openstates_person_id: `ocd-person/tx-${Math.random().toString(36).slice(2, 6)}` },
          ],
          rowCount: 1,
        })
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })
    // 8 rows: 6 legislators (3 House + 3 Senate) resolve; "Unknown Stranger"
    // (House) doesn't resolve → onSkip emitted (slice 23: errors[] no longer
    // populated for unresolved); Comptroller (1) filtered before resolve.
    // Final: 6 complaints + 6 events; errors[] only populated by fetch failures.
    expect(result.complaints).toHaveLength(6)
    expect(result.events).toHaveLength(6)
    expect(result.errors).toHaveLength(0)
  })

  it('maps TX status text to canonical enum', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })

    // "Agreed Order" → sanctioned (TX-specific lexicon)
    const jane = result.complaints.find((c) => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.status).toBe('sanctioned')
    // "Final Order" → sanctioned
    const alex = result.complaints.find((c) => c.external_id === 'complaint-SC-202405-099')!
    expect(alex.status).toBe('sanctioned')
    // "Resolved" → sanctioned
    const maria = result.complaints.find((c) => c.external_id === 'complaint-SC-202407-150')!
    expect(maria.status).toBe('sanctioned')
    // "Pending" → open
    const bob = result.complaints.find((c) => c.external_id === 'complaint-SC-202409-200')!
    expect(bob.status).toBe('open')
    // "Dismissed" → dismissed
    const lisa = result.complaints.find((c) => c.external_id === 'complaint-SC-202410-205')!
    expect(lisa.status).toBe('dismissed')
  })

  it('infers chamber from agency text (House → state_house, Senate → state_senate)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const seenChambers: string[] = []
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        seenChambers.push(String(params[2]))
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-x' }],
          rowCount: 1,
        })
      }),
    }
    await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })
    expect(seenChambers).toContain('state_house')
    expect(seenChambers).toContain('state_senate')
  })

  it('event_type is always campaign_finance_violation for TX rows', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })
    expect(result.events.every((e) => e.event_type === 'campaign_finance_violation')).toBe(true)
  })

  it('uses external_id prefix to disambiguate dual emission', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })
    expect(result.complaints[0]!.external_id).toBe('complaint-SC-202401-001')
    expect(result.events[0]!.external_id).toBe('event-SC-202401-001')
  })
})

describe('tx-tec slice 20 PDF enrichment', () => {
  beforeEach(() => {
    mockedFetchPdf.mockReset()
    mockedExtractPdfText.mockReset()
  })

  it('enriches summary + outcome from parsed PDF text', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(`
VIOLATION:
Failed to file annual personal financial statement.

CIVIL PENALTY: $1,500

DISPOSITION:
Resolved by Agreed Order.
`)

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    // Pick the first legislator-row's complaint (Jane Doe per fixture)
    const jane = result.complaints.find((c) => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Failed to file annual/)
    expect(jane.disposition).toMatch(/Resolved by Agreed Order/)

    const janeEvent = result.events.find((e) => e.external_id === 'event-SC-202401-001')!
    expect(janeEvent.summary).toMatch(/Failed to file annual/)
    expect(janeEvent.outcome).toMatch(/Resolved by Agreed Order/)
  })

  it('falls back to slice 16 generic summary when fetchPdf rejects', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockRejectedValue(new Error('404'))

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    const jane = result.complaints.find((c) => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Sworn complaint order SC-202401-001/) // slice 16 stub format
  })

  it('falls back to slice 16 generic summary when extractPdfText returns empty', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('')

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    const jane = result.complaints.find((c) => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Sworn complaint order/)
  })

  it('partial parse: only violation_summary present → summary enriched, disposition unchanged', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(`
VIOLATION:
Failed to register lobbyist.
`)

    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })

    const jane = result.complaints.find((c) => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.summary).toMatch(/Failed to register lobbyist/)
    expect(jane.disposition).toMatch(/Agreed Order/) // slice 16 fallback (from row.status)
  })

  it('respects maxPdfsPerRun cap (only first N rows enriched)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue(`
VIOLATION:
Test violation.
`)

    const result = await fetchSwornComplaintOrders(
      client as never,
      {
        fetcher: async () => html,
        maxPdfsPerRun: 2,
      } as never,
    )

    // Fixture has 6 legislator rows (3 Assembly + 3 Senate per slice 16 fixture).
    // First 2 get PDF-enriched; rest get slice 16 fallback summary.
    expect(mockedFetchPdf).toHaveBeenCalledTimes(2)

    // First 2 complaints have enriched summary
    expect(result.complaints[0]?.summary).toMatch(/Test violation/)
    expect(result.complaints[1]?.summary).toMatch(/Test violation/)
    // Rest have slice 16 stub format
    expect(result.complaints[2]?.summary).toMatch(/Sworn complaint order/)
  })

  it('production-path returns empty result when HTML fetch fails (slice 16 behavior preserved)', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const result = await fetchSwornComplaintOrders(client as never, {})
    expect(result.complaints).toEqual([])
    expect(result.events).toEqual([])
    fetchSpy.mockRestore()
  })
})

describe('tx-tec slice 22 onSkip instrumentation', () => {
  beforeEach(() => {
    mockedFetchPdf.mockReset()
    mockedExtractPdfText.mockReset()
  })

  it('calls onSkip with filter stage for non-legislator agency row', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('VIOLATION:\nFoo.\n')
    const skips: SkipReason[] = []
    await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
      onSkip: (r) => {
        skips.push(r)
      },
    })

    // Dr. Sarah Miller is Texas Comptroller (not legislator) → filter skip
    const filterSkip = skips.find(
      (s) => s.stage === 'filter' && s.legislator === 'Dr. Sarah Miller',
    )
    expect(filterSkip).toBeDefined()
    expect(filterSkip).toMatchObject({
      adapter: 'tx-tec',
      stage: 'filter',
      legislator: 'Dr. Sarah Miller',
    })
    expect(filterSkip!.reason).toMatch(/Comptroller/i)
  })

  it('emits resolve skip for unresolved legislator (single channel)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockResolvedValue(Buffer.from('fake-pdf'))
    mockedExtractPdfText.mockResolvedValue('VIOLATION:\nFoo.\n')
    const skips: SkipReason[] = []
    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
      onSkip: (r) => {
        skips.push(r)
      },
    })

    // Slice 23 contract: unresolved legislator emits onSkip ONLY; errors[] is
    // no longer populated for the unresolved case (only `fetch failed`).
    const resolveSkip = skips.find(
      (s) => s.stage === 'resolve' && s.legislator === 'Unknown Stranger',
    )
    expect(resolveSkip).toBeDefined()
    expect(resolveSkip).toMatchObject({
      adapter: 'tx-tec',
      stage: 'resolve',
      legislator: 'Unknown Stranger',
    })
    expect(resolveSkip!.reason).toMatch(/unmatched/i)
    expect(result.errors.some((e) => e.includes('Unknown Stranger'))).toBe(false)
  })

  it('calls onSkip with fetch stage when per-case PDF fetchPdf rejects', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({ rows: [{ openstates_person_id: 'ocd-x' }], rowCount: 1 })
      }),
    }
    mockedFetchPdf.mockRejectedValue(new Error('PDF unavailable'))
    const skips: SkipReason[] = []
    await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
      onSkip: (r) => {
        skips.push(r)
      },
    })

    // 6 resolved legislator rows → 6 fetchPdf attempts → 6 fetch skips
    const fetchSkips = skips.filter((s) => s.stage === 'fetch')
    expect(fetchSkips.length).toBe(6)
    expect(fetchSkips[0]).toMatchObject({
      adapter: 'tx-tec',
      stage: 'fetch',
    })
    expect(fetchSkips[0]!.detail).toMatch(/PDF unavailable/)
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
    await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
      onSkip: (r) => {
        skips.push(r)
      },
    })

    const extractSkips = skips.filter((s) => s.stage === 'extract')
    expect(extractSkips.length).toBe(6)
    expect(extractSkips[0]).toMatchObject({
      adapter: 'tx-tec',
      stage: 'extract',
    })
  })
})
