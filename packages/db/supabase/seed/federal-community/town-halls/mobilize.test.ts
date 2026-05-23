import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFederalMobilizeEvents, type FederalTownHallRow } from './mobilize.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'federal-community', 'mobilize.json')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(officialId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: officialId ? [{ id: officialId }] : [],
      rowCount: officialId ? 1 : 0,
    }),
  }
}

describe('federal mobilize adapter', () => {
  it('happy path: fixture returns federal events; rejects state + vague', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    // 5 fixture events: 3 federal (MA senator, OH rep, virtual congresswoman) + 1 state senator REJECT + 1 vague REJECT = 3 emitted
    expect(events).toHaveLength(3)
  })

  it('classifies MA hybrid (zoom + venue → hybrid)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const ma = events.find(e => e.state === 'MA')
    expect(ma).toBeDefined()
    expect(ma!.format).toBe('hybrid')
  })

  it('OH rep event has chamber inferred as federal_house', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const oh = events.find(e => e.state === 'OH')
    expect(oh).toBeDefined()
    // chamber field exists on FederalTownHallRow
    expect((oh as FederalTownHallRow).chamber).toBe('federal_house')
  })

  it('REJECTS state senator event (CO)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const co = events.find(e => e.state === 'CO')
    expect(co).toBeUndefined()
  })

  it('REJECTS vague title (NY)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const ny = events.find(e => e.state === 'NY')
    expect(ny).toBeUndefined()
  })

  it('drops events with unresolved legislator names', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never  // every name → unresolved
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    expect(events).toHaveLength(0)
  })

  it('sets source=mobilize + external_id=mobilize-{id}', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    expect(events[0]!.source).toBe('mobilize')
    expect(events[0]!.external_id).toMatch(/^mobilize-/)
  })
})
