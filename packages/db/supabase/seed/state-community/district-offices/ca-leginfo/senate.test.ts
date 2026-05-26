import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCaSenateRosterHtml, fetchCaSenateOffices } from './senate.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ca-senate-roster.html')

describe('parseCaSenateRosterHtml', () => {
  it('extracts 4 senators (skips Bob with malformed district number)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    // 5 cards; Bob's district "NaN" parses to NaN → skip → 4 emitted
    expect(parsed).toHaveLength(4)
    expect(parsed.map(s => s.full_name)).toEqual(['Jane Doe', 'Alex Smith', 'Maria Chen', 'Pat Skip'])
  })

  it('captures both capitol_office + district_office when present', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    const jane = parsed.find(s => s.full_name === 'Jane Doe')!
    expect(jane.capitol_office).toContain('1021 O Street')
    expect(jane.district_office).toContain('100 Main Street')
  })

  it('handles capitol-only senator (no district_office field)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    const alex = parsed.find(s => s.full_name === 'Alex Smith')!
    expect(alex.capitol_office).toBeTruthy()
    expect(alex.district_office).toBeUndefined()
  })

  it('handles district-only senator (no capitol_office field)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    const maria = parsed.find(s => s.full_name === 'Maria Chen')!
    expect(maria.capitol_office).toBeUndefined()
    expect(maria.district_office).toBeTruthy()
  })
})

describe('fetchCaSenateOffices', () => {
  it('emits 2 rows per 2-office senator, 1 per 1-office senator', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ca-' + n }],
          rowCount: 1,
        })
      }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    // Jane (2) + Alex (1) + Maria (1) + Pat (malformed addr, 0) = 4 rows
    expect(rows).toHaveLength(4)
  })

  it('assigns kind=capitol for Sacramento address, kind=district for local', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    expect(rows.filter(r => r.kind === 'capitol').length).toBeGreaterThanOrEqual(2)
    expect(rows.filter(r => r.kind === 'district').length).toBeGreaterThanOrEqual(2)
  })

  it('returns [] when no senators resolve', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    expect(rows).toEqual([])
  })

  it('extracts structured address fields (street_1, city, state, postal_code, phone)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    const capitolRow = rows.find(r => r.kind === 'capitol')!
    expect(capitolRow.city).toBe('Sacramento')
    expect(capitolRow.state).toBe('CA')
    expect(capitolRow.postal_code).toBe('95814')
    expect(capitolRow.phone).toMatch(/\(\d{3}\) \d{3}-\d{4}/)
  })
})

describe('fetchCaSenateOffices onSkip instrumentation (slice 23)', () => {
  it('emits fetch-stage skip when fetcher rejects', async () => {
    const client = { query: vi.fn() }
    const skips: SkipReason[] = []
    const rows = await fetchCaSenateOffices(client as never, {
      fetcher: async () => { throw new Error('network down') },
      onSkip: (r) => { skips.push(r) },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'ca-leginfo',
      stage: 'fetch',
    })
    expect(skips[0]!.detail).toMatch(/network down/)
  })

  it('emits resolve-stage skip per senator with no officials match', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const skips: SkipReason[] = []
    const rows = await fetchCaSenateOffices(client as never, {
      fetcher: async () => html,
      onSkip: (r) => { skips.push(r) },
    })
    expect(rows).toEqual([])
    // Fixture has 4 parseable senators (Jane, Alex, Maria, Pat); all unresolved.
    expect(skips).toHaveLength(4)
    expect(skips.every(s => s.adapter === 'ca-leginfo' && s.stage === 'resolve')).toBe(true)
    expect(skips.map(s => s.legislator)).toEqual(['Jane Doe', 'Alex Smith', 'Maria Chen', 'Pat Skip'])
  })

  it('emits parse-stage skip when parseAddressText returns null for capitol office', async () => {
    // Pat Skip (last fixture card) has "malformed no commas" capitol_office —
    // parseAddressText returns null → parse skip.
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchCaSenateOffices(client as never, {
      fetcher: async () => html,
      onSkip: (r) => { skips.push(r) },
    })
    const patParseSkip = skips.find(s => s.legislator === 'Pat Skip' && s.stage === 'parse')
    expect(patParseSkip).toBeDefined()
    expect(patParseSkip).toMatchObject({
      adapter: 'ca-leginfo',
      stage: 'parse',
      legislator: 'Pat Skip',
    })
    expect(patParseSkip!.reason).toMatch(/capitol/)
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    const html = await readFile(FIXTURE, 'utf8')
    // No onSkip passed — must not throw despite all senators being unresolved.
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    expect(rows).toEqual([])
  })
})
