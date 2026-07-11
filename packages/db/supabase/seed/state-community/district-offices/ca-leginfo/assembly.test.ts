import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCaAssemblymemberDetailHtml,
  fetchCaAssemblyOffices,
  deriveAmDistrictUrl,
} from './assembly.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'state-community',
  'ca-assemblymember-detail.html',
)

describe('parseCaAssemblymemberDetailHtml', () => {
  it('extracts both capitol + district address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaAssemblymemberDetailHtml(html)
    expect(parsed.capitol_office).toContain('1021 O Street')
    expect(parsed.capitol_office).toContain('Sacramento')
    expect(parsed.district_office).toContain('1515 Clay Street')
    expect(parsed.district_office).toContain('Oakland')
  })

  it('returns undefined fields for missing sections', () => {
    const parsed = parseCaAssemblymemberDetailHtml('<div>no sections</div>')
    expect(parsed.capitol_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })

  it('joins multi-paragraph section addresses with comma (Audit Bug 3 fix)', () => {
    const html = `
      <section class="capitol-office">
        <p>1021 O Street, Suite 5350</p>
        <p>Sacramento, CA 95814</p>
        <p>Phone: (916) 319-2014</p>
      </section>
    `
    const parsed = parseCaAssemblymemberDetailHtml(html)
    expect(parsed.capitol_office).toBe(
      '1021 O Street, Suite 5350, Sacramento, CA 95814, Phone: (916) 319-2014',
    )
  })
})

describe('deriveAmDistrictUrl', () => {
  it('returns assembly.ca.gov URL pattern with district number', () => {
    expect(deriveAmDistrictUrl(14)).toBe('https://www.assembly.ca.gov/assemblymembers/14')
  })
})

describe('fetchCaAssemblyOffices', () => {
  it('iterates over CA Assembly members from officials table + parses each detail page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              {
                openstates_person_id: 'ocd-person/ca-a1',
                full_name: 'Jane Doe',
                district_id: 'CA-14',
              },
              {
                openstates_person_id: 'ocd-person/ca-a2',
                full_name: 'Alex Smith',
                district_id: 'CA-23',
              },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchCaAssemblyOffices(client as never, { fetcher: async () => html })
    // 2 AMs × 2 addresses each = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter((r) => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter((r) => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no AMs in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchCaAssemblyOffices(client as never, {
      fetcher: async () => '<html></html>',
    })
    expect(rows).toEqual([])
  })

  it('skips AM when district_id is missing or unparseable', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              {
                openstates_person_id: 'ocd-person/ca-a1',
                full_name: 'Jane Doe',
                district_id: null,
              },
              {
                openstates_person_id: 'ocd-person/ca-a2',
                full_name: 'Alex Smith',
                district_id: 'CA-23',
              },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchCaAssemblyOffices(client as never, { fetcher: async () => html })
    // Only Alex resolves (Jane skipped due to null district_id) → 2 rows
    expect(rows).toHaveLength(2)
  })

  it('skips AM on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              {
                openstates_person_id: 'ocd-person/ca-a1',
                full_name: 'Jane Doe',
                district_id: 'CA-14',
              },
              {
                openstates_person_id: 'ocd-person/ca-a2',
                full_name: 'Alex Smith',
                district_id: 'CA-23',
              },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchCaAssemblyOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2) // first AM errors, second succeeds → 2 rows
  })
})
