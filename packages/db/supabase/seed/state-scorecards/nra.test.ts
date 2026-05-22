import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nra, letterToNumeric, numericToLetterGrade } from './nra.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-scorecards', 'nra.json')

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

  it('covered_states is non-empty array of 2-letter codes', () => {
    expect(nra.covered_states.length).toBeGreaterThan(0)
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
