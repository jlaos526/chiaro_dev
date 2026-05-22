import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flDoeOffices } from './fl-doe.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'offices-fl.json')

describe('fl-doe district-offices adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await flDoeOffices.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { state: string }).state).toBe(fixture.events[0].state)
  })

  it('production stub returns empty array', async () => {
    const events = await flDoeOffices.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(flDoeOffices.slug).toBe('fl-doe')
    expect(flDoeOffices.component).toBe('offices')
  })

  it('covered_states valid', () => {
    expect(flDoeOffices.covered_states.length).toBeGreaterThan(0)
    for (const s of flDoeOffices.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
    expect(flDoeOffices.covered_states).toEqual(['FL'])
  })
})
