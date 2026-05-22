import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openstatesV3Hearings } from './openstates-v3.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'hearings-openstates.json')

describe('openstatesV3Hearings adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await openstatesV3Hearings.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { openstates_committee_id?: string }).openstates_committee_id)
      .toBe(fixture.events[0].openstates_committee_id)
  })

  it('production stub returns empty array when cache dir absent', async () => {
    process.env.OPENSTATES_COMMITTEES_CACHE_DIR = '/nonexistent/path'
    const events = await openstatesV3Hearings.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
    delete process.env.OPENSTATES_COMMITTEES_CACHE_DIR
  })

  it('reports correct slug + component', () => {
    expect(openstatesV3Hearings.slug).toBe('openstates-v3')
    expect(openstatesV3Hearings.component).toBe('hearings')
  })

  it('covered_states contains all 50', () => {
    expect(openstatesV3Hearings.covered_states.length).toBe(50)
    for (const s of openstatesV3Hearings.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})
