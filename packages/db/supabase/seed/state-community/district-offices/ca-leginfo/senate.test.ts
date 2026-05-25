import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCaSenateRosterHtml, fetchCaSenateOffices } from './senate.ts'

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
