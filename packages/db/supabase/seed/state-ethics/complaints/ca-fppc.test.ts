import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { caFppcComplaints } from './ca-fppc.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'complaints-ca.json')

describe('ca-fppc complaints adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await caFppcComplaints.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })

  it('production stub returns empty array', async () => {
    const events = await caFppcComplaints.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(caFppcComplaints.slug).toBe('ca-fppc')
    expect(caFppcComplaints.component).toBe('complaints')
  })

  it('covered_states valid', () => {
    expect(caFppcComplaints.covered_states.length).toBeGreaterThan(0)
    for (const s of caFppcComplaints.covered_states) expect(s).toMatch(/^[A-Z]{2}$/)
  })
})
