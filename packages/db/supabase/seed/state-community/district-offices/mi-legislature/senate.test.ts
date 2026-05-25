import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMiSenatorProfileHtml, fetchMiSenateOffices, deriveMiSenatorUrl } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'mi-senator-detail.html')

describe('parseMiSenatorProfileHtml', () => {
  it('extracts Lansing + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseMiSenatorProfileHtml(html)
    expect(parsed.lansing_office).toContain('Farnum Building')
    expect(parsed.lansing_office).toContain('Lansing')
    expect(parsed.district_office).toContain('Main Street')
    expect(parsed.district_office).toContain('Detroit')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseMiSenatorProfileHtml('<div>no sections</div>')
    expect(parsed.lansing_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })

  it('joins multi-paragraph section addresses with comma (Audit Bug 3 fix)', () => {
    const html = `
      <section class="lansing-office">
        <p>Farnum Building, P.O. Box 30036</p>
        <p>Lansing, MI 48909</p>
        <p>Phone: (517) 373-7350</p>
      </section>
    `
    const parsed = parseMiSenatorProfileHtml(html)
    expect(parsed.lansing_office).toBe('Farnum Building, P.O. Box 30036, Lansing, MI 48909, Phone: (517) 373-7350')
  })
})

describe('deriveMiSenatorUrl', () => {
  it('builds URL with firstname-lastname slug', () => {
    expect(deriveMiSenatorUrl('Jane Doe')).toBe('https://senate.michigan.gov/senators/jane-doe/')
  })

  it('handles middle name', () => {
    expect(deriveMiSenatorUrl('Mary Jo Smith')).toBe('https://senate.michigan.gov/senators/mary-jo-smith/')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveMiSenatorUrl("Pat O'Brien")).toBe('https://senate.michigan.gov/senators/pat-obrien/')
  })

  it('preserves accented characters as ASCII transliterations (Audit Bug 1 fix)', () => {
    expect(deriveMiSenatorUrl('José Smith')).toBe('https://senate.michigan.gov/senators/jose-smith/')
  })
})

describe('fetchMiSenateOffices', () => {
  it('iterates over MI senators + parses each profile', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchMiSenateOffices(client as never, { fetcher: async () => html })
    // 2 senators × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no MI senators in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchMiSenateOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips senator on fetcher failure (TLS flake)', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchMiSenateOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('TLS handshake failed')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // first errors, second succeeds → 2 rows
  })
})
