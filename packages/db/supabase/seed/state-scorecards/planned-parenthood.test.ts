import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plannedParenthood } from './planned-parenthood.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', 'fixtures', 'state-scorecards', 'planned-parenthood.json')

describe('planned-parenthood adapter', () => {
  it('happy path: fixture ratings normalized', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await plannedParenthood.fetchRatings({
      session: '20252026',
      fetcher: async () => fixture.ratings,
    } as never)
    expect(stats.length).toBe(fixture.ratings.length)
    expect(stats[0]!.state).toBe(fixture.ratings[0]!.state)
  })

  it('reports correct slug + issue_area + lean', () => {
    expect(plannedParenthood.slug).toBe('planned-parenthood')
    expect(plannedParenthood.issue_area).toBe('reproductive-rights')
    expect(plannedParenthood.lean).toBe('progressive')
    expect(plannedParenthood.scoring_min).toBe(0)
    expect(plannedParenthood.scoring_max).toBe(100)
  })

  it('name_template + methodology_url_template per state', () => {
    expect(plannedParenthood.name_template('ME')).toMatch(/Planned Parenthood/i)
    expect(plannedParenthood.methodology_url_template('ME')).toMatch(/^https:\/\//)
  })

  it('covered_states is non-empty array of 2-letter codes', () => {
    expect(plannedParenthood.covered_states.length).toBeGreaterThan(0)
    for (const s of plannedParenthood.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})
