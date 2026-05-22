import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flCoeDisclosures } from './fl-coe.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'disclosures-fl.json')

describe('fl-coe disclosures adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await flCoeDisclosures.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })

  it('production stub returns empty array', async () => {
    const events = await flCoeDisclosures.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(flCoeDisclosures.slug).toBe('fl-coe')
    expect(flCoeDisclosures.component).toBe('disclosures')
  })

  it('covered_states valid', () => {
    expect(flCoeDisclosures.covered_states.length).toBeGreaterThan(0)
    for (const s of flCoeDisclosures.covered_states) expect(s).toMatch(/^[A-Z]{2}$/)
  })
})
