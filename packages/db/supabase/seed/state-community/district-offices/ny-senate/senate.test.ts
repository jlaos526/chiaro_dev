import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNySenatorContactHtml, fetchSenateOffices, deriveSenatorSlug } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ny-senator-contact.html')

describe('parseNySenatorContactHtml', () => {
  it('extracts both Albany + District address blocks from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNySenatorContactHtml(html)
    expect(parsed.albany_office).toBeDefined()
    expect(parsed.albany_office).toContain('Legislative Office Building')
    expect(parsed.albany_office).toContain('Albany, NY 12247')
    expect(parsed.district_office).toBeDefined()
    expect(parsed.district_office).toContain('Manhattan, NY 10001')
  })

  it('returns undefined for missing heading', () => {
    const html = '<div>no headings here</div>'
    const parsed = parseNySenatorContactHtml(html)
    expect(parsed.albany_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveSenatorSlug', () => {
  it('lowercases + hyphenates full name', () => {
    expect(deriveSenatorSlug('Jane Doe')).toBe('jane-doe')
  })

  it('handles middle name', () => {
    expect(deriveSenatorSlug('John Quincy Adams')).toBe('john-quincy-adams')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveSenatorSlug("Mary O'Brien-Smith")).toBe('mary-obrien-smith')
  })

  it('preserves accented characters as ASCII transliterations (Audit Bug 1 fix)', () => {
    expect(deriveSenatorSlug('José Smith')).toBe('jose-smith')
  })
})

describe('fetchSenateOffices', () => {
  it('iterates over NY senators from officials table + parses each contact page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          // returning 2 NY senators
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ny-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/ny-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchSenateOffices(client as never, {
      fetcher: async () => html,
    })
    // 2 senators × 2 addresses each = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)

    const capitolRow = rows.find(r => r.kind === 'capitol')!
    expect(capitolRow.street_1).toBe('Legislative Office Building')
    expect(capitolRow.city).toBe('Albany')
    expect(capitolRow.state).toBe('NY')
    expect(capitolRow.postal_code).toBe('12247')
    expect(capitolRow.phone).toBe('(518) 455-1234')

    const districtRow = rows.find(r => r.kind === 'district')!
    expect(districtRow.street_1).toBe('100 Senator Plaza')
    expect(districtRow.city).toBe('Manhattan')
    expect(districtRow.state).toBe('NY')
    expect(districtRow.postal_code).toBe('10001')
  })

  it('returns [] when no NY senators in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchSenateOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips senator on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ny-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/ny-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchSenateOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    // Senator 1 errors out → 0 rows; Senator 2 succeeds → 2 rows
    expect(rows).toHaveLength(2)
  })
})
