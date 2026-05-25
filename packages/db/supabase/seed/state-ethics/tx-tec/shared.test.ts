import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseTxTecOrdersHtml,
  isTexasLegislatorRow,
  fetchSwornComplaintOrders,
} from './shared.ts'

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
    expect(rows[0]!.source_pdf_url).toBe('https://www.ethics.state.tx.us/data/enforcement/sworn_complaints/2024/SC-202401-001.pdf')
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
    expect(isTexasLegislatorRow({ agency: 'Texas Comptroller of Public Accounts' } as never)).toBe(false)
  })
  it('rejects state agencies', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Department of Transportation' } as never)).toBe(false)
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
          rows: [{ openstates_person_id: `ocd-person/tx-${Math.random().toString(36).slice(2, 6)}` }],
          rowCount: 1,
        })
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })
    // 8 rows: 6 legislators (3 House + 3 Senate) resolve; "Unknown Stranger"
    // (House) doesn't resolve → error logged; Comptroller (1) filtered before resolve.
    // Final: 6 complaints + 6 events + at least 1 error
    expect(result.complaints).toHaveLength(6)
    expect(result.events).toHaveLength(6)
    expect(result.errors.length).toBeGreaterThan(0)
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
    const jane = result.complaints.find(c => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.status).toBe('sanctioned')
    // "Final Order" → sanctioned
    const alex = result.complaints.find(c => c.external_id === 'complaint-SC-202405-099')!
    expect(alex.status).toBe('sanctioned')
    // "Resolved" → sanctioned
    const maria = result.complaints.find(c => c.external_id === 'complaint-SC-202407-150')!
    expect(maria.status).toBe('sanctioned')
    // "Pending" → open
    const bob = result.complaints.find(c => c.external_id === 'complaint-SC-202409-200')!
    expect(bob.status).toBe('open')
    // "Dismissed" → dismissed
    const lisa = result.complaints.find(c => c.external_id === 'complaint-SC-202410-205')!
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
    expect(result.events.every(e => e.event_type === 'campaign_finance_violation')).toBe(true)
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
