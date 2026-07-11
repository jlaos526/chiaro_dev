import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateScorecards } from './state-scorecards-ingest.ts'
import type { StateScorecardAdapter } from './state-scorecards/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})

afterEach(async () => {
  await client.end()
})

function mkAdapter(overrides: Partial<StateScorecardAdapter>): StateScorecardAdapter {
  return {
    slug: 'test',
    name_template: (s) => `Test ${s}`,
    issue_area: 'test',
    lean: 'centrist',
    methodology_url_template: (s) => `https://test.org/${s}`,
    scoring_min: 0,
    scoring_max: 100,
    covered_states: ['CA'],
    async fetchRatings() {
      return []
    },
    ...overrides,
  }
}

describe('ingestStateScorecards', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchRatings() {
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchRatings() {
          return []
        },
      }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026',
      client,
      adapters,
    })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
    expect(stats.byOrg).toHaveLength(2)
  })

  it('--org filter dispatches only the requested adapter', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchRatings() {
          calls.push('a')
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchRatings() {
          calls.push('b')
          return []
        },
      }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026',
      client,
      org: 'a',
      adapters,
    })
    expect(calls).toEqual(['a'])
    expect(stats.adaptersAttempted).toBe(1)
  })

  it('--state filter restricts adapters to that state', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        covered_states: ['CA', 'NY'],
        async fetchRatings(opts) {
          calls.push({ slug: 'a', ...(opts.state !== undefined ? { state: opts.state } : {}) })
          return []
        },
      }),
    ]
    await ingestStateScorecards({
      session: '20252026',
      client,
      state: 'CA',
      adapters,
    })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('--state filter skips adapter not covering that state', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        covered_states: ['CA'],
        async fetchRatings() {
          calls.push('a')
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        covered_states: ['NY'],
        async fetchRatings() {
          calls.push('b')
          return []
        },
      }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026',
      client,
      state: 'CA',
      adapters,
    })
    expect(calls).toEqual(['a'])
    expect(stats.adaptersAttempted).toBe(1)
  })

  it('one adapter throwing: others still run with skipOnError', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchRatings() {
          throw new Error('a broke')
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchRatings() {
          return []
        },
      }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026',
      client,
      skipOnError: true,
      adapters,
    })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byOrg.find((s) => s.org_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchRatings() {
          throw new Error('boom')
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchRatings() {
          return []
        },
      }),
    ]
    await expect(
      ingestStateScorecards({
        session: '20252026',
        client,
        adapters,
      }),
    ).rejects.toThrow(/boom/)
  })
})
