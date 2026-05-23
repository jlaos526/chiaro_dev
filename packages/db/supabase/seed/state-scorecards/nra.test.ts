import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nra, letterToNumeric, numericToLetterGrade, fetchNraRatingsForState } from './nra.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-scorecards', 'nra.json')
const CA_HTML = join(__dirname, '..', 'fixtures', 'state-scorecards', 'nra-ca.html')
const TX_HTML = join(__dirname, '..', 'fixtures', 'state-scorecards', 'nra-tx.html')

describe('nra adapter', () => {
  it('happy path: fixture ratings normalized', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await nra.fetchRatings({
      session: '20252026',
      fetcher: async () => fixture.ratings,
    } as never)
    expect(stats.length).toBe(fixture.ratings.length)
    expect(stats[0]!.state).toBe(fixture.ratings[0]!.state)
  })

  it('reports correct slug + issue_area + lean', () => {
    expect(nra.slug).toBe('nra')
    expect(nra.issue_area).toBe('second-amendment')
    expect(nra.lean).toBe('conservative')
    expect(nra.scoring_min).toBe(0)
    expect(nra.scoring_max).toBe(100)
  })

  it('name_template + methodology_url_template per state', () => {
    expect(nra.name_template('CA')).toMatch(/NRA-PVF/i)
    expect(nra.methodology_url_template('CA')).toMatch(/^https:\/\//)
  })

  it('covered_states is non-empty array of 2-letter codes (expanded to 50 in slice 9)', () => {
    expect(nra.covered_states.length).toBe(50)
    for (const s of nra.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})

describe('letterToNumeric', () => {
  it('maps A to 100', () => expect(letterToNumeric('A')).toBe(100))
  it('maps F to 20', () => expect(letterToNumeric('F')).toBe(20))
  it('case-insensitive: "b+" → 85', () => expect(letterToNumeric('b+')).toBe(85))
  it('returns null for unknown', () => expect(letterToNumeric('Z')).toBeNull())
})

describe('numericToLetterGrade', () => {
  it('100 → A', () => expect(numericToLetterGrade(100)).toBe('A'))
  it('82 → B', () => expect(numericToLetterGrade(82)).toBe('B'))
  it('25 → F', () => expect(numericToLetterGrade(25)).toBe('F'))
})

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(openstatesPersonId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: openstatesPersonId ? [{ openstates_person_id: openstatesPersonId }] : [],
      rowCount: openstatesPersonId ? 1 : 0,
    }),
  }
}

describe('fetchNraRatingsForState — CA fixture', () => {
  it('emits 7 ratings (10 rows - 1 blank-skip in parser - 1 AQ-skip in letterToNumeric)', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const client = mkClient('osp-mock') as never
    const ratings = await fetchNraRatingsForState('CA', client, async () => html)
    expect(ratings.length).toBe(7)
  })

  it('emits federal + state legislators with correct chambers via resolve query', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const calls: Array<{ chamber: string }> = []
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        // params: [full_name, state, chamber]
        if (params && typeof params[2] === 'string') calls.push({ chamber: params[2] })
        n += 1
        return Promise.resolve({ rows: [{ openstates_person_id: 'osp-' + n }], rowCount: 1 })
      }),
    } as never
    await fetchNraRatingsForState('CA', client, async () => html)
    // Resolve called only after letterToNumeric passes — AQ filtered before resolve.
    // Expect: 2 federal_senate, 2 federal_house, 2 state_senate, 1 state_house
    // (state_house: Essayli A+ keeps; AQ Member AQ skipped pre-resolve; blank skipped in parser)
    expect(calls.filter(c => c.chamber === 'federal_senate').length).toBe(2)
    expect(calls.filter(c => c.chamber === 'federal_house').length).toBe(2)
    expect(calls.filter(c => c.chamber === 'state_senate').length).toBe(2)
    expect(calls.filter(c => c.chamber === 'state_house').length).toBe(1)
  })

  it('skips unresolved officials', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const client = mkClient(null) as never  // no resolution
    const ratings = await fetchNraRatingsForState('CA', client, async () => html)
    expect(ratings.length).toBe(0)
  })

  it('source_url uses nrapvf.org/grades/<state-name>/ pattern', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const client = mkClient('osp-12345') as never
    const ratings = await fetchNraRatingsForState('CA', client, async () => html)
    expect(ratings[0]!.source_url).toBe('https://www.nrapvf.org/grades/california/')
    expect(ratings[0]!.openstates_person_id).toBe('osp-12345')
    expect(ratings[0]!.state).toBe('CA')
  })
})

describe('fetchNraRatingsForState — TX fixture (edge case)', () => {
  it('handles "State House of Representatives" label + plain text cells', async () => {
    const html = await readFile(TX_HTML, 'utf8')
    const client = mkClient('osp-tx') as never
    const ratings = await fetchNraRatingsForState('TX', client, async () => html)
    expect(ratings.length).toBe(4)
  })
})

describe('fetchNraRatingsForState — production fallback', () => {
  it('returns [] for unknown state code', async () => {
    const client = mkClient('osp-mock') as never
    const ratings = await fetchNraRatingsForState('XX', client)
    expect(ratings).toEqual([])
  })

  it('returns [] on network error', async () => {
    const client = mkClient('osp-mock') as never
    const ratings = await fetchNraRatingsForState('CA', client, async () => {
      throw new Error('network')
    })
    expect(ratings).toEqual([])
  })
})
