import { describe, expect, it, beforeEach, afterEach } from 'vitest'
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

  describe('production path — YAML cache walker', () => {
    const YAML_DIR = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'events-openstates-yaml')

    beforeEach(() => {
      process.env.OPENSTATES_PEOPLE_CACHE_DIR = YAML_DIR
    })

    afterEach(() => {
      delete process.env.OPENSTATES_PEOPLE_CACHE_DIR
    })

    it('parses .yml files and emits resignation events with state extracted from OCD jurisdiction', async () => {
      const events = await openstatesEndReason.fetchEvents({ client: {} as never } as never) as Array<{
        state: string
        event_date: string
        event_type: string
        outcome?: string
      }>
      expect(events.length).toBe(2)
      const ca = events.find(e => e.state === 'CA')
      const ny = events.find(e => e.state === 'NY')
      expect(ca).toBeDefined()
      expect(ny).toBeDefined()
      expect(ca!.event_date).toBe('2025-11-15')
      expect(ca!.event_type).toBe('resignation')
      expect(ny!.event_date).toBe('2025-09-01')
      expect(ny!.outcome).toMatch(/Death/)
    })

    it('--state filter restricts to single state via OCD jurisdiction extraction', async () => {
      const events = await openstatesEndReason.fetchEvents({
        client: {} as never,
        state: 'CA',
      } as never)
      expect(events.length).toBe(1)
      expect(events[0]!.state).toBe('CA')
    })
  })
})
