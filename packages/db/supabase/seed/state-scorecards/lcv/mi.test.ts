import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMichiganRatings, parseMichiganLcvHtml } from './mi.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MI_HTML = join(__dirname, '..', '..', 'fixtures', 'state-scorecards', 'lcv-mi.html')

describe('parseMichiganLcvHtml', () => {
  it('extracts rows with name + party + chamber + district + score from fixture', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const rows = parseMichiganLcvHtml(html)
    // 5 rows in fixture - 1 missing-score row = 4 emitted
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      full_name: 'Jane Doe',
      party: 'D',
      chamber: 'state_house',
      district: '23',
      score_numeric: 95,
    })
  })

  it('skips rows with empty 2025-2026 score', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const rows = parseMichiganLcvHtml(html)
    expect(rows.find(r => r.full_name === 'Sam Lee')).toBeUndefined()
  })

  it('maps "House" → state_house and "Senate" → state_senate', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const rows = parseMichiganLcvHtml(html)
    expect(rows.filter(r => r.chamber === 'state_house')).toHaveLength(2)
    expect(rows.filter(r => r.chamber === 'state_senate')).toHaveLength(2)
  })

  it('preserves numeric score as integer 0-100', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const rows = parseMichiganLcvHtml(html)
    for (const row of rows) {
      expect(row.score_numeric).toBeGreaterThanOrEqual(0)
      expect(row.score_numeric).toBeLessThanOrEqual(100)
      expect(Number.isInteger(row.score_numeric)).toBe(true)
    }
  })
})

describe('fetchMichiganRatings', () => {
  it('returns NormalizedStateRating[] for resolved officials', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'osp-mi-' + n }],
          rowCount: 1,
        })
      }),
    }
    const ratings = await fetchMichiganRatings(client as never, {
      session: '2025-2026',
      fetcher: async () => html,
    } as never)
    expect(ratings).toHaveLength(4)
    expect(ratings[0]).toMatchObject({
      openstates_person_id: 'osp-mi-1',
      state: 'MI',
      score: 95,
      source_url: 'https://www.michiganlcv.org/lawmakers/',
    })
  })

  it('skips unresolved officials', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const ratings = await fetchMichiganRatings(client as never, {
      session: '2025-2026',
      fetcher: async () => html,
    } as never)
    expect(ratings).toEqual([])
  })

  it('returns [] on network error (production path)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const ratings = await fetchMichiganRatings(client as never, {
      session: '2025-2026',
      fetcher: async () => { throw new Error('network') },
    } as never)
    expect(ratings).toEqual([])
  })
})
