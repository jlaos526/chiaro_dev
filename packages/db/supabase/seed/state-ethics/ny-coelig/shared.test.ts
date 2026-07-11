import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCoeligEnforcementHtml,
  isStateLegislatorRow,
  fetchEnforcementActions,
} from './shared.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'state-ethics',
  'ny-coelig-enforcement.html',
)

describe('parseCoeligEnforcementHtml', () => {
  it('extracts all 10 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseCoeligEnforcementHtml(html)
    expect(rows).toHaveLength(10)
  })

  it('extracts detail URL from anchor href', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseCoeligEnforcementHtml(html)
    expect(rows[0]!.source_detail_url).toBe('https://ethics.ny.gov/cases/2024-0042')
  })

  it('parses penalty_amount integer with comma stripping', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseCoeligEnforcementHtml(html)
    const mariaChen = rows.find((r) => r.full_name === 'Maria Chen')!
    expect(mariaChen.penalty_amount).toBe(15000)
  })
})

describe('isStateLegislatorRow', () => {
  it('matches "NY State Assembly"', () => {
    expect(isStateLegislatorRow({ agency: 'NY State Assembly' } as never)).toBe(true)
  })
  it('matches "NY State Senate"', () => {
    expect(isStateLegislatorRow({ agency: 'NY State Senate' } as never)).toBe(true)
  })
  it('rejects Department of Health', () => {
    expect(isStateLegislatorRow({ agency: 'NY Dept of Health' } as never)).toBe(false)
  })
  it('rejects County Clerk', () => {
    expect(isStateLegislatorRow({ agency: 'Erie County Clerk' } as never)).toBe(false)
  })
})

describe('fetchEnforcementActions', () => {
  it('emits matched legislator complaints + events (filters non-legislators + unresolved)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
        // Only resolve known legislators; "Unknown Stranger" yields no match.
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ny-' + n }],
          rowCount: 1,
        })
      }),
    }
    const result = await fetchEnforcementActions(client as never, {
      fetcher: async () => html,
    })
    // 10 rows: 6 legislators (3 Assembly + 3 Senate) all resolve; "Unknown Stranger"
    // is a state-Assembly row but doesn't resolve; "Robin Lee" is a state-senate
    // row → resolves. Non-legislator rows (Health, County) filtered before resolve.
    // Final: 6 + 1 = 7 legislator rows; "Unknown Stranger" filtered after legislator-check
    // because resolve fails. Wait — let me recount.
    // Actually: 3 Assembly (Jane, Maria, Lisa) + 3 Senate (Alex, Bob, Tom) all resolve.
    // "Unknown Stranger" is Assembly but unresolved → filtered.
    // "Robin Lee" is Senate → resolves.
    // Total resolved: 6 + 1 = 7. Each emits 1 complaint + 1 event = 14 total rows.
    expect(result.complaints).toHaveLength(7)
    expect(result.events).toHaveLength(7)
    expect(result.errors.length).toBeGreaterThan(0) // Unknown Stranger logged
  })

  it('maps status text to canonical enum', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchEnforcementActions(client as never, {
      fetcher: async () => html,
    })

    // "Sanctioned" → sanctioned
    const jane = result.complaints.find((c) => c.disposition === 'Campaign Finance Violation')!
    expect(jane.status).toBe('sanctioned')
    // "Settled" → settled
    const alex = result.complaints.find(
      (c) => c.disposition === 'Late Filing' && c.summary.includes('NY State Senate'),
    )!
    expect(alex.status).toBe('settled')
    // "Penalty Imposed" → sanctioned
    const maria = result.complaints.find(
      (c) => c.disposition === 'Gift Rule Violation' && c.summary.includes('NY State Assembly'),
    )!
    expect(maria.status).toBe('sanctioned')
    // "Open" → open
    const bob = result.complaints.find(
      (c) => c.disposition === 'Disclosure Violation' && c.summary.includes('NY State Senate'),
    )!
    expect(bob.status).toBe('open')
    // "Dismissed" → dismissed
    const lisa = result.complaints.find((c) => c.disposition === 'Filing Late')!
    expect(lisa.status).toBe('dismissed')
    // "Pending" → open
    const robin = result.complaints.find((c) => c.disposition === 'Ethics Violation')!
    expect(robin.status).toBe('open')
  })

  it('infers chamber from agency text (Assembly → state_house, Senate → state_senate)', async () => {
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
    await fetchEnforcementActions(client as never, { fetcher: async () => html })
    expect(seenChambers).toContain('state_house')
    expect(seenChambers).toContain('state_senate')
  })

  it('uses external_id from /cases/{id} URL slug', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchEnforcementActions(client as never, { fetcher: async () => html })
    const jane = result.complaints.find((c) => c.disposition === 'Campaign Finance Violation')!
    expect(jane.external_id).toBe('complaint-2024-0042')
    const janeEvent = result.events.find((e) => e.summary.includes('Campaign Finance Violation'))!
    expect(janeEvent.external_id).toBe('event-2024-0042')
  })

  it('event_type is always campaign_finance_violation for COELIG rows', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchEnforcementActions(client as never, { fetcher: async () => html })
    expect(result.events.every((e) => e.event_type === 'campaign_finance_violation')).toBe(true)
  })
})
