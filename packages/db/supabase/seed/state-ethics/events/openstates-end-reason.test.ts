import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { openstatesEndReason } from './openstates-end-reason.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

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

  describe('onSkip instrumentation (slice 23)', () => {
    afterEach(() => {
      delete process.env.OPENSTATES_PEOPLE_CACHE_DIR
    })

    it('emits fetch-stage skip when cache dir is absent', async () => {
      process.env.OPENSTATES_PEOPLE_CACHE_DIR = '/nonexistent/openstates/path'
      const skips: SkipReason[] = []
      const events = await openstatesEndReason.fetchEvents({
        client: {} as never,
        onSkip: (r: SkipReason) => { skips.push(r) },
      } as never)
      expect(events).toEqual([])
      expect(skips).toHaveLength(1)
      expect(skips[0]).toMatchObject({
        adapter: 'openstates-end-reason',
        stage: 'fetch',
      })
      expect(skips[0]!.reason).toMatch(/cache dir absent/)
    })

    it('emits parse-stage skip when a YAML file is malformed', async () => {
      // Create a temp cache dir with one malformed YAML file.
      const tempDir = await mkdtemp(join(tmpdir(), 'openstates-end-reason-test-'))
      await writeFile(
        join(tempDir, 'broken.yml'),
        '!!!unparseable: : yaml: : :\n  garbage: [unclosed',
        'utf8',
      )
      process.env.OPENSTATES_PEOPLE_CACHE_DIR = tempDir
      const skips: SkipReason[] = []
      const events = await openstatesEndReason.fetchEvents({
        client: {} as never,
        onSkip: (r: SkipReason) => { skips.push(r) },
      } as never)
      expect(events).toEqual([])
      const parseSkips = skips.filter(s => s.stage === 'parse' && s.adapter === 'openstates-end-reason')
      expect(parseSkips.length).toBeGreaterThanOrEqual(1)
      expect(parseSkips[0]!.legislator).toBe('broken.yml')
    })

    it('does NOT emit skip for normal end_reason filter (term ended, etc.)', async () => {
      // The resign/death filter is INTENTIONAL — most roles have end_reason like
      // "term ended" and are skipped silently. No onSkip emission for that case.
      const tempDir = await mkdtemp(join(tmpdir(), 'openstates-end-reason-test-'))
      const yaml = [
        'id: ocd-person/test-1',
        'name: Test Person',
        'roles:',
        '  - type: lower',
        '    jurisdiction: ocd-jurisdiction/country:us/state:ca/government',
        '    end_date: "2025-01-01"',
        '    end_reason: "term ended"',
      ].join('\n')
      await writeFile(join(tempDir, 'test-person.yml'), yaml, 'utf8')
      process.env.OPENSTATES_PEOPLE_CACHE_DIR = tempDir
      const skips: SkipReason[] = []
      const events = await openstatesEndReason.fetchEvents({
        client: {} as never,
        onSkip: (r: SkipReason) => { skips.push(r) },
      } as never)
      expect(events).toEqual([])
      // No skip emitted: filter for resign/death is the normal case.
      const filterSkips = skips.filter(s => s.stage === 'filter')
      expect(filterSkips).toEqual([])
    })

    it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
      process.env.OPENSTATES_PEOPLE_CACHE_DIR = '/another/nonexistent/path'
      // No onSkip passed — must not throw despite cache missing.
      const events = await openstatesEndReason.fetchEvents({ client: {} as never } as never)
      expect(events).toEqual([])
    })
  })
})
