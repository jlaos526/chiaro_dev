import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aclu } from './aclu.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-scorecards', 'aclu.json')

describe('aclu adapter', () => {
  it('happy path: fixture ratings normalized', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await aclu.fetchRatings({
      session: '20252026',
      fetcher: async () => fixture.ratings,
    } as never)
    expect(stats.length).toBe(fixture.ratings.length)
    expect(stats[0]!.state).toBe(fixture.ratings[0]!.state)
  })

  it('reports correct slug + issue_area + lean', () => {
    expect(aclu.slug).toBe('aclu')
    expect(aclu.issue_area).toBe('civil-liberties')
    expect(aclu.lean).toBe('progressive')
    expect(aclu.scoring_min).toBe(0)
    expect(aclu.scoring_max).toBe(100)
  })

  it('name_template + methodology_url_template per state', () => {
    expect(aclu.name_template('CA')).toMatch(/ACLU.*California|ACLU of CA/i)
    expect(aclu.methodology_url_template('CA')).toMatch(/^https:\/\//)
  })

  it('covered_states is non-empty array of 2-letter codes', () => {
    expect(aclu.covered_states.length).toBeGreaterThan(0)
    for (const s of aclu.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})
