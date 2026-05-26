import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNyAssemblyDirectoryHtml, fetchAssemblyOffices } from './assembly.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ny-assembly-mem.html')

describe('parseNyAssemblyDirectoryHtml', () => {
  it('extracts 3 members (skips malformed district + empty addresses)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    // 5 cards: 3 valid (Jane, Alex, Maria), 1 malformed district (Bob), 1 no addresses (Pat)
    expect(parsed).toHaveLength(3)
    expect(parsed.map(m => m.full_name)).toEqual(['Jane Doe', 'Alex Smith', 'Maria Chen'])
  })

  it('parses both Albany + district address when present', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    const jane = parsed.find(m => m.full_name === 'Jane Doe')!
    expect(jane.albany_office).toContain('LOB 901')
    expect(jane.albany_office).toContain('Albany')
    expect(jane.district_office).toContain('123 Main Street')
    expect(jane.district_office).toContain('Buffalo')
  })

  it('handles Albany-only AM (no district address)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    const alex = parsed.find(m => m.full_name === 'Alex Smith')!
    expect(alex.albany_office).toBeTruthy()
    expect(alex.district_office).toBeUndefined()
  })

  it('extracts district number as string from "District N"', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    expect(parsed.find(m => m.full_name === 'Jane Doe')!.district_no).toBe('5')
    expect(parsed.find(m => m.full_name === 'Maria Chen')!.district_no).toBe('100')
  })
})

describe('fetchAssemblyOffices', () => {
  it('emits 2 NormalizedDistrictOffice rows per 2-address AM, 1 per 1-address AM', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let resolveN = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        resolveN += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ny-' + resolveN }],
          rowCount: 1,
        })
      }),
    }
    const rows = await fetchAssemblyOffices(client as never, {
      fetcher: async () => html,
    })
    // Jane (2) + Alex (1) + Maria (2) = 5 rows
    expect(rows).toHaveLength(5)
  })

  it('assigns kind=capitol for Albany address, kind=district for local', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const rows = await fetchAssemblyOffices(client as never, { fetcher: async () => html })
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(3)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no AM can be resolved', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchAssemblyOffices(client as never, { fetcher: async () => html })
    expect(rows).toEqual([])
  })
})

describe('fetchAssemblyOffices onSkip instrumentation (slice 23)', () => {
  it('emits fetch-stage skip when fetcher rejects', async () => {
    const client = { query: vi.fn() }
    const skips: SkipReason[] = []
    const rows = await fetchAssemblyOffices(client as never, {
      fetcher: async () => { throw new Error('directory unreachable') },
      onSkip: (r) => { skips.push(r) },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'ny-senate',
      stage: 'fetch',
    })
    expect(skips[0]!.detail).toMatch(/directory unreachable/)
  })

  it('emits resolve-stage skip per AM with no officials match', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const skips: SkipReason[] = []
    const rows = await fetchAssemblyOffices(client as never, {
      fetcher: async () => html,
      onSkip: (r) => { skips.push(r) },
    })
    expect(rows).toEqual([])
    // Fixture parses 3 valid members (Jane, Alex, Maria) — all unresolved.
    expect(skips).toHaveLength(3)
    expect(skips.every(s => s.adapter === 'ny-senate' && s.stage === 'resolve')).toBe(true)
    expect(skips.map(s => s.legislator)).toEqual(['Jane Doe', 'Alex Smith', 'Maria Chen'])
  })

  it('emits parse-stage skip when parseAddressText returns null for albany office', async () => {
    // Inject a custom HTML card whose albany_office is intentionally malformed
    // (no commas) so parseAddressText returns null → parse skip on the
    // capitol branch.
    const badHtml = `
      <div class="member-card">
        <h3 class="member-name">Garbled Member</h3>
        <span class="district">District 7</span>
        <div class="albany-address">malformed no commas</div>
      </div>
    `
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/ny-1' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    const rows = await fetchAssemblyOffices(client as never, {
      fetcher: async () => badHtml,
      onSkip: (r) => { skips.push(r) },
    })
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'ny-senate',
      stage: 'parse',
      legislator: 'Garbled Member',
    })
    expect(skips[0]!.reason).toMatch(/albany/)
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    // No onSkip passed — must not throw despite all AMs being unresolved.
    const rows = await fetchAssemblyOffices(client as never, { fetcher: async () => html })
    expect(rows).toEqual([])
  })
})
