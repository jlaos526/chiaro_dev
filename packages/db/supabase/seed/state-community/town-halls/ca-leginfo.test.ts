import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { caLeginfoTownHalls } from './ca-leginfo.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'halls-ca.json')

describe('ca-leginfo town-halls adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await caLeginfoTownHalls.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { state: string }).state).toBe(fixture.events[0].state)
  })

  it('production stub returns empty array', async () => {
    const events = await caLeginfoTownHalls.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(caLeginfoTownHalls.slug).toBe('ca-leginfo')
    expect(caLeginfoTownHalls.component).toBe('halls')
  })

  it('covered_states valid', () => {
    expect(caLeginfoTownHalls.covered_states.length).toBeGreaterThan(0)
    for (const s of caLeginfoTownHalls.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
    expect(caLeginfoTownHalls.covered_states).toEqual(['CA'])
  })
})
