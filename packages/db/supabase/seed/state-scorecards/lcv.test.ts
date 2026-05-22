import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lcv } from './lcv.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-scorecards', 'lcv.json')

describe('lcv adapter', () => {
  it('happy path: fixture ratings normalized', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await lcv.fetchRatings({
      session: '20252026',
      fetcher: async () => fixture.ratings,
    } as never)
    expect(stats.length).toBe(fixture.ratings.length)
    expect(stats[0]!.state).toBe(fixture.ratings[0]!.state)
  })

  it('reports correct slug + issue_area + lean', () => {
    expect(lcv.slug).toBe('lcv')
    expect(lcv.issue_area).toBe('environment')
    expect(lcv.lean).toBe('progressive')
    expect(lcv.scoring_min).toBe(0)
    expect(lcv.scoring_max).toBe(100)
  })

  it('name_template + methodology_url_template per state', () => {
    expect(lcv.name_template('CA')).toMatch(/League of Conservation Voters|LCV/i)
    expect(lcv.methodology_url_template('CA')).toMatch(/^https:\/\//)
  })

  it('covered_states is non-empty array of 2-letter codes', () => {
    expect(lcv.covered_states.length).toBeGreaterThan(0)
    for (const s of lcv.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})
