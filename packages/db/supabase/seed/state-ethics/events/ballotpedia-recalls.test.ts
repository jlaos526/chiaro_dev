import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ballotpediaRecalls, fetchBallotpediaRecallEvents } from './ballotpedia-recalls.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'events-ballotpedia.json')
const INDEX_HTML = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ballotpedia-recalls-index.html')
const YEAR_2024_HTML = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ballotpedia-recalls-2024.html')

describe('ballotpedia adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await ballotpediaRecalls.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })

  it('reports correct slug + component', () => {
    expect(ballotpediaRecalls.slug).toBe('ballotpedia')
    expect(ballotpediaRecalls.component).toBe('events')
  })

  it('covered_states contains all 50', () => {
    expect(ballotpediaRecalls.covered_states.length).toBe(50)
    for (const s of ballotpediaRecalls.covered_states) expect(s).toMatch(/^[A-Z]{2}$/)
  })
})

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(openstatesPersonId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: openstatesPersonId
        ? [{ openstates_person_id: openstatesPersonId }]
        : [],
      rowCount: openstatesPersonId ? 1 : 0,
    }),
  }
}

describe('fetchBallotpediaRecallEvents — production path', () => {
  it('emits 4 valid events (5 rows - 1 unknown status)', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    // Index → 4 year links (2023/2024/2025/2026 after dedup). Only fixture for 2024;
    // other years return empty HTML.
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'  // empty per-year fixture
    }
    const result = await fetchBallotpediaRecallEvents(client, fetcher)
    // 5 fixture rows: CA Petition failed → failed; TX Recalled → succeeded;
    // NY Retained → failed; FL Active → attempt; MD weird → null (skip + log).
    expect(result.events.length).toBe(4)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toMatch(/Unknown status/)
  })

  it('outcome → event_type mapping matches fixture statuses', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'
    }
    const { events } = await fetchBallotpediaRecallEvents(client, fetcher)
    const byState = Object.fromEntries(events.map(e => [e.state, e.event_type]))
    expect(byState.CA).toBe('recall_failed')
    expect(byState.TX).toBe('recall_succeeded')
    expect(byState.NY).toBe('recall_failed')
    expect(byState.FL).toBe('recall_attempt')
  })

  it('external_id pattern: ballotpedia-<state>-<slug>-<date>', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'
    }
    const { events } = await fetchBallotpediaRecallEvents(client, fetcher)
    const ca = events.find(e => e.state === 'CA')!
    expect(ca.external_id).toBe('ballotpedia-CA-jane-doe-2024-03-15')
  })

  it('skips unresolved officials with log entry', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient(null) as never  // every resolveOpenstatesPersonId returns null
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'
    }
    const { events, errors } = await fetchBallotpediaRecallEvents(client, fetcher)
    expect(events.length).toBe(0)
    // 4 well-formed rows unresolved + 1 unknown-status row = 5 errors
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })

  it('returns empty + errors-with-msg when index fetch throws', async () => {
    const client = mkClient('oid-mock') as never
    const result = await fetchBallotpediaRecallEvents(client, async () => {
      throw new Error('network down')
    })
    expect(result.events).toEqual([])
    expect(result.errors[0]).toMatch(/Index fetch failed/)
  })
})
