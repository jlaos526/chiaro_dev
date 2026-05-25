import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMiRepProfileHtml, fetchMiHouseOffices, deriveMiRepUrl } from './house.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'mi-rep-detail.html')

describe('parseMiRepProfileHtml', () => {
  it('extracts Lansing + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseMiRepProfileHtml(html)
    expect(parsed.lansing_office).toContain('House Office Building')
    expect(parsed.lansing_office).toContain('Lansing')
    expect(parsed.district_office).toContain('Oak Avenue')
    expect(parsed.district_office).toContain('Grand Rapids')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseMiRepProfileHtml('<div>no sections</div>')
    expect(parsed.lansing_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })

  it('joins multi-paragraph section addresses with comma (Audit Bug 3 fix)', () => {
    const html = `
      <section class="lansing-office">
        <p>House Office Building, P.O. Box 30014</p>
        <p>Lansing, MI 48909</p>
        <p>Phone: (517) 373-0001</p>
      </section>
    `
    const parsed = parseMiRepProfileHtml(html)
    expect(parsed.lansing_office).toBe('House Office Building, P.O. Box 30014, Lansing, MI 48909, Phone: (517) 373-0001')
  })
})

describe('deriveMiRepUrl', () => {
  it('builds URL with representative- prefix + firstname-lastname slug', () => {
    expect(deriveMiRepUrl('Jane Doe')).toBe('https://house.mi.gov/representative-jane-doe')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveMiRepUrl("Pat O'Brien")).toBe('https://house.mi.gov/representative-pat-obrien')
  })

  it('preserves accented characters as ASCII transliterations (Audit Bug 1 fix)', () => {
    expect(deriveMiRepUrl('José Smith')).toBe('https://house.mi.gov/representative-jose-smith')
  })
})

describe('fetchMiHouseOffices', () => {
  it('iterates over MI reps + parses each profile', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-h1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-h2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchMiHouseOffices(client as never, { fetcher: async () => html })
    // 2 reps × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
  })

  it('silently skips rep on TLS handshake failure (audit-flagged risk)', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-h1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-h2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchMiHouseOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('TLS handshake failed')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // first TLS-flakes, second succeeds → 2 rows
  })
})
