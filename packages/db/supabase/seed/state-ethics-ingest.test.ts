import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ADAPTERS_DEFAULT, ingestStateEthics } from './state-ethics-ingest.ts'
import type { StateEthicsAdapter } from './state-ethics/shared.ts'
import { ADAPTER_STATUSES, formatAdapterStatusSummary } from './shared/adapter-status.ts'

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
    status: 'production',
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

// Audit C35: stub/deprecated adapters are registered on purpose (dispatch
// unchanged) but must be visibly annotated so a zero-row "green" run can't
// masquerade as healthy coverage. Counts are pinned — they change ONLY when
// an operator wires a stub to production (or deprecates an adapter).
describe('adapter status registry (C35)', () => {
  it('every registered adapter carries a valid status; summary renders counts + slugs', () => {
    for (const a of ADAPTERS_DEFAULT) {
      expect(ADAPTER_STATUSES).toContain(a.status)
    }
    const summary = formatAdapterStatusSummary(
      ADAPTERS_DEFAULT.map((a) => ({ label: `${a.component}:${a.slug}`, status: a.status })),
    )
    expect(summary).toContain(
      'production 8 · stub 6 · deprecated 3 — stub/deprecated adapters return 0 rows BY DESIGN (audit C35)',
    )
    expect(summary).toContain(
      'stub: disclosures:fl-coe, complaints:ca-fppc, complaints:fl-coe, events:ca-fppc, events:fl-coe, events:mi-board',
    )
    expect(summary).toContain(
      'deprecated: disclosures:ca-fppc, disclosures:tx-tec, complaints:mi-board',
    )
  })
})
