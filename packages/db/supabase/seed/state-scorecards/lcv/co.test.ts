import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchColoradoRatings, parseColoradoLcvHtml } from './co.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOUSE_HTML = join(__dirname, '..', '..', 'fixtures', 'state-scorecards', 'lcv-co-house.html')
const SENATE_HTML = join(__dirname, '..', '..', 'fixtures', 'state-scorecards', 'lcv-co-senate.html')

describe('parseColoradoLcvHtml — House', () => {
  it('extracts 4 rows from fixture (5 - 1 N/A score)', async () => {
    const html = await readFile(HOUSE_HTML, 'utf8')
    const rows = parseColoradoLcvHtml(html, 'state_house')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      full_name: 'Maria Perez',
      party: 'D',
      chamber: 'state_house',
      district: '23',
      score_numeric: 92,
    })
  })

  it('skips rows with N/A score', async () => {
    const html = await readFile(HOUSE_HTML, 'utf8')
    const rows = parseColoradoLcvHtml(html, 'state_house')
    expect(rows.find(r => r.full_name === 'Dana Howe')).toBeUndefined()
  })

  it('Party-District regex extracts party + district correctly', async () => {
    const html = await readFile(HOUSE_HTML, 'utf8')
    const rows = parseColoradoLcvHtml(html, 'state_house')
    expect(rows.find(r => r.full_name === 'Morgan Flynn')).toMatchObject({
      party: 'I',
      district: '50',
    })
  })

  it('strips % from score percentages', async () => {
    const html = await readFile(HOUSE_HTML, 'utf8')
    const rows = parseColoradoLcvHtml(html, 'state_house')
    for (const row of rows) {
      expect(typeof row.score_numeric).toBe('number')
      expect(Number.isInteger(row.score_numeric)).toBe(true)
    }
  })
})

describe('parseColoradoLcvHtml — Senate', () => {
  it('extracts 3 rows from fixture with chamber=state_senate', async () => {
    const html = await readFile(SENATE_HTML, 'utf8')
    const rows = parseColoradoLcvHtml(html, 'state_senate')
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.chamber).toBe('state_senate')
    }
    expect(rows[0]).toMatchObject({
      full_name: 'Sarah Kim',
      party: 'D',
      district: '12',
      score_numeric: 88,
    })
  })
})

describe('fetchColoradoRatings', () => {
  it('fetches both house + senate URLs and concatenates ratings', async () => {
    const houseHtml = await readFile(HOUSE_HTML, 'utf8')
    const senateHtml = await readFile(SENATE_HTML, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'osp-co-' + n }],
          rowCount: 1,
        })
      }),
    }
    const ratings = await fetchColoradoRatings(client as never, {
      session: '2025',
      fetcher: async (url: string) =>
        url.includes('-house/') ? houseHtml : senateHtml,
    } as never)
    // 4 House + 3 Senate = 7
    expect(ratings).toHaveLength(7)
    expect(ratings.every(r => r.state === 'CO')).toBe(true)
  })

  it('templates year into URL from opts.session', async () => {
    const fetched: string[] = []
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    await fetchColoradoRatings(client as never, {
      session: '2024',
      fetcher: async (url: string) => {
        fetched.push(url)
        return '<html></html>'
      },
    } as never)
    expect(fetched).toContain('https://conservationco.org/scorecards/2024-scorecard/2024-house/')
    expect(fetched).toContain('https://conservationco.org/scorecards/2024-scorecard/2024-senate/')
  })

  it('returns [] on network error for both chambers', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const ratings = await fetchColoradoRatings(client as never, {
      session: '2025',
      fetcher: async () => { throw new Error('network') },
    } as never)
    expect(ratings).toEqual([])
  })
})
