import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateEthics } from './state-ethics-ingest.ts'
import type { StateEthicsAdapter } from './state-ethics/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})
afterEach(async () => {
  await client.end()
})

function mkAdapter(overrides: Partial<StateEthicsAdapter>): StateEthicsAdapter {
  return {
    slug: 'test',
    component: 'disclosures',
    covered_states: ['CA'],
    async fetchEvents() {
      return []
    },
    ...overrides,
  }
}

describe('ingestStateEthics', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', component: 'disclosures' }),
      mkAdapter({ slug: 'b', component: 'complaints' }),
    ]
    const stats = await ingestStateEthics({ client, adapters })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
  })

  it('--component filter restricts', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        component: 'disclosures',
        async fetchEvents() {
          calls.push('a')
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        component: 'complaints',
        async fetchEvents() {
          calls.push('b')
          return []
        },
      }),
    ]
    await ingestStateEthics({ client, component: 'disclosures', adapters })
    expect(calls).toEqual(['a'])
  })

  it('--state filter passes state + filters covered_states', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        covered_states: ['CA'],
        async fetchEvents(o) {
          calls.push({ slug: 'a', ...(o.state !== undefined ? { state: o.state } : {}) })
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        covered_states: ['NY'],
        async fetchEvents() {
          calls.push({ slug: 'b' })
          return []
        },
      }),
    ]
    await ingestStateEthics({ client, state: 'CA', adapters })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('skipOnError: one throws, others run', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchEvents() {
          throw new Error('a broke')
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchEvents() {
          return []
        },
      }),
    ]
    const stats = await ingestStateEthics({ client, skipOnError: true, adapters })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byAdapter.find((s) => s.adapter_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default: throw aborts', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchEvents() {
          throw new Error('boom')
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchEvents() {
          return []
        },
      }),
    ]
    await expect(ingestStateEthics({ client, adapters })).rejects.toThrow(/boom/)
  })

  it('--component=all runs all 3 components', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        component: 'disclosures',
        async fetchEvents() {
          calls.push('a')
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        component: 'complaints',
        async fetchEvents() {
          calls.push('b')
          return []
        },
      }),
      mkAdapter({
        slug: 'c',
        component: 'events',
        async fetchEvents() {
          calls.push('c')
          return []
        },
      }),
    ]
    await ingestStateEthics({ client, component: 'all', adapters })
    expect(calls).toEqual(['a', 'b', 'c'])
  })
})
