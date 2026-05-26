import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mobilize, parseMobilizeEvents } from './mobilize.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'mobilize.json')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(officialId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: officialId ? [{ id: officialId }] : [], rowCount: officialId ? 1 : 0 }),
  }
}

describe('mobilize adapter', () => {
  it('reports correct slug + component + covered_states', () => {
    expect(mobilize.slug).toBe('mobilize')
    expect(mobilize.component).toBe('halls')
    expect(mobilize.covered_states.length).toBe(50)
  })

  it('happy path: fixture injection returns parsed NormalizedTownHall[]', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never  // every name resolves
    const events = await parseMobilizeEvents(fixture.data, client)
    // 5 fixture events: 3 state-legislator (CO/CA/MD) + 1 federal (skip) + 1 vague (skip) = 3 emitted
    expect(events).toHaveLength(3)
    expect(events[0]!.state).toBe('CO')
    expect(events[0]!.source).toBe('mobilize')
    expect(events[0]!.external_id).toBe('mobilize-100001')
  })

  it('classifies CA hybrid event correctly (zoom URL + venue → hybrid)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const ca = events.find(e => e.state === 'CA')
    expect(ca).toBeDefined()
    expect(ca!.format).toBe('hybrid')
  })

  it('classifies MD virtual event correctly (is_virtual=true → virtual)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const md = events.find(e => e.state === 'MD')
    expect(md).toBeDefined()
    expect(md!.format).toBe('virtual')
  })

  it('drops federal event (Senator without State prefix)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const ma = events.find(e => e.state === 'MA')
    expect(ma).toBeUndefined()
  })

  it('drops events with unresolved legislator names', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never  // no name resolves → unmatched
    const events = await parseMobilizeEvents(fixture.data, client)
    expect(events).toHaveLength(0)
  })

  it('production stub gracefully fails-empty when fetcher absent + API not reachable', async () => {
    // Bypass the network fetcher by spying-mocking global fetch to return empty
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as never
    try {
      const events = await mobilize.fetchEvents({
        client: mkClient(null) as never,
      } as never)
      expect(events).toEqual([])
    } finally {
      globalThis.fetch = origFetch
    }
  })
})

describe('mobilize onSkip instrumentation (slice 23)', () => {
  it('emits fetch-stage skip when Mobilize API rejects', async () => {
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as never
    const skips: SkipReason[] = []
    try {
      const events = await mobilize.fetchEvents({
        client: mkClient(null) as never,
        onSkip: (r: SkipReason) => { skips.push(r) },
      } as never)
      expect(events).toEqual([])
      // At least one fetch-stage skip emitted before the pagination loop breaks.
      const fetchSkips = skips.filter(s => s.stage === 'fetch')
      expect(fetchSkips.length).toBeGreaterThanOrEqual(1)
      expect(fetchSkips[0]).toMatchObject({
        adapter: 'mobilize',
        stage: 'fetch',
      })
      expect(fetchSkips[0]!.detail).toMatch(/network down/)
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('emits filter-stage skip when title does not match state-legislator pattern', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const skips: SkipReason[] = []
    await parseMobilizeEvents(fixture.data, client, (r: SkipReason) => { skips.push(r) })
    // Fixture has 5 events: 3 state-legislator (CO/CA/MD) + 1 federal Senator (MA) + 1 vague.
    // The federal + vague rows fire filter-stage skips.
    const filterSkips = skips.filter(s => s.stage === 'filter' && s.adapter === 'mobilize')
    expect(filterSkips.length).toBeGreaterThanOrEqual(2)
  })

  it('emits resolve-stage skip per event whose legislator is unmatched', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never  // no name resolves
    const skips: SkipReason[] = []
    const events = await parseMobilizeEvents(fixture.data, client, (r: SkipReason) => { skips.push(r) })
    expect(events).toEqual([])
    const resolveSkips = skips.filter(s => s.stage === 'resolve' && s.adapter === 'mobilize')
    // 3 state-legislator events (CO/CA/MD); all unresolved → 3 resolve skips
    expect(resolveSkips).toHaveLength(3)
    expect(resolveSkips.every(s => s.legislator)).toBe(true)
  })

  it('omitting onSkip preserves silent-skip behavior (back-compat)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never
    // No onSkip passed — must not throw.
    const events = await parseMobilizeEvents(fixture.data, client)
    expect(events).toEqual([])
  })
})
