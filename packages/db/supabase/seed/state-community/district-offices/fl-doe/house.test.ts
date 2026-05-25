import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlRepDetailHtml, fetchFlHouseOffices, deriveFlRepUrl } from './house.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'fl-rep-detail.html')

describe('parseFlRepDetailHtml', () => {
  it('extracts both Tallahassee + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseFlRepDetailHtml(html)
    expect(parsed.capitol_office).toContain('1102 The Capitol')
    expect(parsed.capitol_office).toContain('Tallahassee')
    expect(parsed.district_office).toContain('Beach Drive')
    expect(parsed.district_office).toContain('St. Petersburg')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseFlRepDetailHtml('<div>no sections</div>')
    expect(parsed.capitol_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })

  it('joins multi-paragraph section addresses with comma (Audit Bug 3 fix)', () => {
    const html = `
      <section class="capitol-office">
        <p>1102 The Capitol, 402 South Monroe Street</p>
        <p>Tallahassee, FL 32399</p>
        <p>Phone: (850) 717-5014</p>
      </section>
    `
    const parsed = parseFlRepDetailHtml(html)
    expect(parsed.capitol_office).toBe('1102 The Capitol, 402 South Monroe Street, Tallahassee, FL 32399, Phone: (850) 717-5014')
  })
})

describe('deriveFlRepUrl', () => {
  it('builds URL with MemberId query param', () => {
    expect(deriveFlRepUrl(4814)).toBe('https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId=4814')
  })

  it('handles single-digit MemberIds', () => {
    expect(deriveFlRepUrl(3)).toBe('https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId=3')
  })
})

describe('fetchFlHouseOffices', () => {
  it('iterates FL reps + parses each detail page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-h1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-h2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchFlHouseOffices(client as never, { fetcher: async () => html })
    expect(rows).toHaveLength(4)
  })

  it('silently skips rep on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/fl-h1', full_name: 'Jane Doe', district_id: 'FL-14' },
              { openstates_person_id: 'ocd-person/fl-h2', full_name: 'Alex Smith', district_id: 'FL-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchFlHouseOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // First errors, second succeeds → 2 rows
  })
})
