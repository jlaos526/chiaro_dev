import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlSenatorDetailHtml, fetchFlSenateOffices, deriveFlSenatorUrl } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'fl-senator-detail.html')

describe('parseFlSenatorDetailHtml', () => {
  it('extracts both Tallahassee + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseFlSenatorDetailHtml(html)
    expect(parsed.capitol_office).toContain('404 South Monroe')
    expect(parsed.capitol_office).toContain('Tallahassee')
    expect(parsed.district_office).toContain('Bayshore Drive')
    expect(parsed.district_office).toContain('Miami')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseFlSenatorDetailHtml('<div>no sections</div>')
    expect(parsed.capitol_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })

  it('joins multi-paragraph section addresses with comma (Audit Bug 3 fix)', () => {
    const html = `
      <section class="capitol-office">
        <p>404 South Monroe Street, Suite 318</p>
        <p>Tallahassee, FL 32399</p>
        <p>Phone: (850) 487-5014</p>
      </section>
    `
    const parsed = parseFlSenatorDetailHtml(html)
    expect(parsed.capitol_office).toBe('404 South Monroe Street, Suite 318, Tallahassee, FL 32399, Phone: (850) 487-5014')
  })
})

describe('deriveFlSenatorUrl', () => {
  it('builds URL with s{district} pattern', () => {
    expect(deriveFlSenatorUrl(14)).toBe('https://www.flsenate.gov/Senators/s14')
  })

  it('handles single-digit districts', () => {
    expect(deriveFlSenatorUrl(3)).toBe('https://www.flsenate.gov/Senators/s3')
  })
})

describe('fetchFlSenateOffices', () => {
  it('iterates FL senators from officials table + parses each detail page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-s1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-s2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchFlSenateOffices(client as never, { fetcher: async () => html })
    // 2 senators × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no FL senators in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchFlSenateOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips senator when district_id is missing or unparseable', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-s1', full_name: 'Jane Doe', district_id: null },
              { openstates_person_id: 'ocd-person/fl-s2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchFlSenateOffices(client as never, { fetcher: async () => html })
    expect(rows).toHaveLength(2)  // Only Alex resolves
  })

  it('skips senator on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-s1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-s2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchFlSenateOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // First errors, second succeeds → 2 rows
  })
})
