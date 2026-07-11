import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMichiganRatings, parseMichiganLcvHtml } from './mi.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

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
    expect(rows.find((r) => r.full_name === 'Sam Lee')).toBeUndefined()
  })

  it('maps "House" → state_house and "Senate" → state_senate', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const rows = parseMichiganLcvHtml(html)
    expect(rows.filter((r) => r.chamber === 'state_house')).toHaveLength(2)
    expect(rows.filter((r) => r.chamber === 'state_senate')).toHaveLength(2)
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
    const ratings = await fetchMichiganRatings(
      client as never,
      {
        session: '2025-2026',
        fetcher: async () => html,
      } as never,
    )
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
    const ratings = await fetchMichiganRatings(
      client as never,
      {
        session: '2025-2026',
        fetcher: async () => html,
      } as never,
    )
    expect(ratings).toEqual([])
  })

  it('returns [] on network error (production path)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const ratings = await fetchMichiganRatings(
      client as never,
      {
        session: '2025-2026',
        fetcher: async () => {
          throw new Error('network')
        },
      } as never,
    )
    expect(ratings).toEqual([])
  })
})

describe('fetchMichiganRatings onSkip instrumentation (slice 23)', () => {
  it('emits fetch-stage skip when fetcher rejects', async () => {
    const client = { query: vi.fn() }
    const skips: SkipReason[] = []
    const ratings = await fetchMichiganRatings(client as never, {
      session: '2025-2026',
      fetcher: async () => {
        throw new Error('connection refused')
      },
      onSkip: (r) => {
        skips.push(r)
      },
    })
    expect(ratings).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'lcv',
      stage: 'fetch',
    })
    expect(skips[0]!.detail).toMatch(/connection refused/)
  })

  it('emits resolve-stage skip per unmatched legislator', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const skips: SkipReason[] = []
    const ratings = await fetchMichiganRatings(client as never, {
      session: '2025-2026',
      fetcher: async () => html,
      onSkip: (r) => {
        skips.push(r)
      },
    })
    expect(ratings).toEqual([])
    // Fixture has 4 parseable legislators with scores (Sam Lee filtered as parse-skip)
    const resolveSkips = skips.filter((s) => s.stage === 'resolve')
    expect(resolveSkips).toHaveLength(4)
    expect(resolveSkips.every((s) => s.adapter === 'lcv')).toBe(true)
    expect(resolveSkips.map((s) => s.legislator).sort()).toEqual([
      'Alex Rivera',
      'Jane Doe',
      'John Smith',
      'Pat Chen',
    ])
  })

  it('emits parse-stage skip for empty score cell (Sam Lee)', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'osp-x' }],
        rowCount: 1,
      }),
    }
    const skips: SkipReason[] = []
    await fetchMichiganRatings(client as never, {
      session: '2025-2026',
      fetcher: async () => html,
      onSkip: (r) => {
        skips.push(r)
      },
    })
    const samParseSkip = skips.find((s) => s.legislator === 'Sam Lee' && s.stage === 'parse')
    expect(samParseSkip).toBeDefined()
    expect(samParseSkip).toMatchObject({
      adapter: 'lcv',
      stage: 'parse',
      legislator: 'Sam Lee',
    })
    expect(samParseSkip!.reason).toMatch(/score|empty/i)
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const html = await readFile(MI_HTML, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    // No onSkip — must not throw
    const ratings = await fetchMichiganRatings(
      client as never,
      {
        session: '2025-2026',
        fetcher: async () => html,
      } as never,
    )
    expect(ratings).toEqual([])
  })
})
