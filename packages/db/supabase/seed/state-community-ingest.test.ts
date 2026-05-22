import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateCommunity } from './state-community-ingest.ts'
import type { StateCommunityAdapter } from './state-community/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})
afterEach(async () => { await client.end() })

function mkAdapter(overrides: Partial<StateCommunityAdapter>): StateCommunityAdapter {
  return {
    slug: 'test',
    component: 'halls',
    covered_states: ['CA'],
    async fetchEvents() { return [] },
    ...overrides,
  }
}

describe('ingestStateCommunity', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', component: 'halls', async fetchEvents() { return [] } }),
      mkAdapter({ slug: 'b', component: 'offices', async fetchEvents() { return [] } }),
    ]
    const stats = await ingestStateCommunity({ client, adapters })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
    expect(stats.byAdapter).toHaveLength(2)
  })

  it('--component filter restricts to that component', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', component: 'halls',   async fetchEvents() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', component: 'offices', async fetchEvents() { calls.push('b'); return [] } }),
    ]
    await ingestStateCommunity({ client, component: 'halls', adapters })
    expect(calls).toEqual(['a'])
  })

  it('--state filter passes state through to adapter and filters covered_states', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({ slug: 'a', covered_states: ['CA'], async fetchEvents(o) { calls.push({ slug: 'a', state: o.state }); return [] } }),
      mkAdapter({ slug: 'b', covered_states: ['NY'], async fetchEvents() { calls.push({ slug: 'b' }); return [] } }),
    ]
    await ingestStateCommunity({ client, state: 'CA', adapters })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('one adapter throwing: others still run with skipOnError', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchEvents() { throw new Error('a broke') } }),
      mkAdapter({ slug: 'b', async fetchEvents() { return [] } }),
    ]
    const stats = await ingestStateCommunity({ client, skipOnError: true, adapters })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byAdapter.find(s => s.adapter_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchEvents() { throw new Error('boom') } }),
      mkAdapter({ slug: 'b', async fetchEvents() { return [] } }),
    ]
    await expect(ingestStateCommunity({ client, adapters })).rejects.toThrow(/boom/)
  })

  it('--component=all runs halls + offices + hearings adapters', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', component: 'halls',    async fetchEvents() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', component: 'offices',  async fetchEvents() { calls.push('b'); return [] } }),
      mkAdapter({ slug: 'c', component: 'hearings', async fetchEvents() { calls.push('c'); return [] } }),
    ]
    await ingestStateCommunity({ client, component: 'all', adapters })
    expect(calls).toEqual(['a', 'b', 'c'])
  })
})
