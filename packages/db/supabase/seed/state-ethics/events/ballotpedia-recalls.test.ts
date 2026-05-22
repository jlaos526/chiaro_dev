import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ballotpediaRecalls } from './ballotpedia-recalls.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'events-ballotpedia.json')

describe('ballotpedia adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await ballotpediaRecalls.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })

  it('production stub returns empty array', async () => {
    const events = await ballotpediaRecalls.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(ballotpediaRecalls.slug).toBe('ballotpedia')
    expect(ballotpediaRecalls.component).toBe('events')
  })

  it('covered_states contains all 50', () => {
    expect(ballotpediaRecalls.covered_states.length).toBe(50)
    for (const s of ballotpediaRecalls.covered_states) expect(s).toMatch(/^[A-Z]{2}$/)
  })
})
