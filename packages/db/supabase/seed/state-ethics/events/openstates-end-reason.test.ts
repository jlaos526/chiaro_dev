import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openstatesEndReason } from './openstates-end-reason.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'events-openstates.json')

describe('openstatesEndReason adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await openstatesEndReason.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { event_type?: string }).event_type).toBe('resignation')
  })

  it('production stub returns empty array when cache absent', async () => {
    process.env.OPENSTATES_PEOPLE_CACHE_DIR = '/nonexistent/path'
    const events = await openstatesEndReason.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
    delete process.env.OPENSTATES_PEOPLE_CACHE_DIR
  })

  it('reports correct slug + component', () => {
    expect(openstatesEndReason.slug).toBe('openstates-end-reason')
    expect(openstatesEndReason.component).toBe('events')
  })

  it('covered_states contains all 50', () => {
    expect(openstatesEndReason.covered_states.length).toBe(50)
  })
})
