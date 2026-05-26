import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nySenateTownHalls, parseNysenateEventsHtml } from './ny-senate.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(__dirname, '..', '..', 'fixtures', 'state-community', 'ny-senate-events.html')

describe('parseNysenateEventsHtml', () => {
  it('extracts 4 events from fixture (skips 1 malformed)', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    // 5 cards in fixture; 1 has no <time> → skipped → 4 emitted
    expect(parsed).toHaveLength(4)
    expect(parsed[0]).toMatchObject({
      full_name: 'Jane Doe',
      event_date: '2026-06-15',
      city: 'Albany',
      format: 'in_person',
      detail_url: 'https://www.nysenate.gov/events/jane-doe-district-coffee-2026-06',
    })
  })

  it('maps "Virtual" format text to virtual enum', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    const virtual = parsed.find(p => p.full_name === 'Alex Smith')
    expect(virtual?.format).toBe('virtual')
  })

  it('maps "Hybrid" format text to hybrid enum', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    const hybrid = parsed.find(p => p.full_name === 'Maria Chen')
    expect(hybrid?.format).toBe('hybrid')
  })

  it('handles missing location (city is undefined)', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    const noLoc = parsed.find(p => p.full_name === 'Bob Jones')
    expect(noLoc?.city).toBeUndefined()
  })

  it('treats single-segment location as venue (city undefined)', () => {
    const html = `
      <article class="event-card">
        <a class="event-link" href="/events/x"><h3>Town Hall</h3></a>
        <p class="byline">Hosted by Senator Test</p>
        <time datetime="2026-08-01">August 1, 2026</time>
        <p class="location">Online via Zoom</p>
        <p class="format">Virtual</p>
      </article>
    `
    const parsed = parseNysenateEventsHtml(html)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.city).toBeUndefined()
  })
})

describe('nySenateTownHalls adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nySenateTownHalls.slug).toBe('ny-senate')
    expect(nySenateTownHalls.component).toBe('halls')
    expect(nySenateTownHalls.covered_states).toEqual(['NY'])
  })

  it('emits NormalizedTownHall[] for fixture events with resolved senators', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ny-' + n }],
          rowCount: 1,
        })
      }),
    }
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      pageFetcher: async () => html,
    } as never)
    // 4 parseable cards × 1 senator each = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      official_openstates_person_id: 'ocd-person/ny-1',
      event_date: '2026-06-15',
      state: 'NY',
      source: 'ny-senate',
      city: 'Albany',
      format: 'in_person',
    })
  })

  it('skips events whose senator cannot be resolved', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      pageFetcher: async () => html,
    } as never)
    expect(rows).toEqual([])
  })
})

describe('nySenateTownHalls onSkip instrumentation (slice 23)', () => {
  it('emits fetch-stage skip when pageFetcher rejects', async () => {
    const client = { query: vi.fn() }
    const skips: SkipReason[] = []
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      pageFetcher: async () => { throw new Error('network down') },
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)
    expect(rows).toEqual([])
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({
      adapter: 'ny-senate',
      stage: 'fetch',
    })
    expect(skips[0]!.detail).toMatch(/network down/)
  })

  it('emits resolve-stage skip per event whose senator is unmatched', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const skips: SkipReason[] = []
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      pageFetcher: async () => html,
      onSkip: (r: SkipReason) => { skips.push(r) },
    } as never)
    expect(rows).toEqual([])
    // 4 parseable events × 1 unresolved senator each = 4 resolve skips
    expect(skips).toHaveLength(4)
    expect(skips.every(s => s.adapter === 'ny-senate' && s.stage === 'resolve')).toBe(true)
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    // No onSkip passed — must not throw despite all senators being unresolved.
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      pageFetcher: async () => html,
    } as never)
    expect(rows).toEqual([])
  })
})
