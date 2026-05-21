import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateFinance } from './state-finance-ingest.ts'
import type { StateFinanceAdapter, StateFinanceStats } from './state-finance/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})

afterEach(async () => {
  await client.end()
})

function mkStats(state: StateFinanceStats['state'], overrides: Partial<StateFinanceStats> = {}): StateFinanceStats {
  return {
    state, summariesUpserted: 1, donorsUpserted: 3,
    officialsMatched: 1, officialsUnmatched: [], errors: [],
    ...overrides,
  }
}

function mkAdapter(state: StateFinanceStats['state'], impl: () => Promise<StateFinanceStats>): StateFinanceAdapter {
  return { state, async fetch() { return impl() } }
}

describe('ingestStateFinance', () => {
  it('runs all adapters and aggregates stats', async () => {
    const stats = await ingestStateFinance({
      cycle: '2024',
      client,
      adapters: [
        mkAdapter('CA', async () => mkStats('CA', { summariesUpserted: 2, donorsUpserted: 6 })),
        mkAdapter('NY', async () => mkStats('NY', { summariesUpserted: 1, donorsUpserted: 2 })),
        mkAdapter('FL', async () => mkStats('FL', { summariesUpserted: 1, donorsUpserted: 3 })),
        mkAdapter('TX', async () => mkStats('TX', { summariesUpserted: 1, donorsUpserted: 2 })),
        mkAdapter('MI', async () => mkStats('MI', { summariesUpserted: 1, donorsUpserted: 1 })),
      ],
    })
    expect(stats.statesAttempted).toBe(5)
    expect(stats.statesOk).toBe(5)
    expect(stats.totalSummariesUpserted).toBe(6)
    expect(stats.totalDonorsUpserted).toBe(14)
    expect(stats.byState).toHaveLength(5)
  })

  it('--state filter dispatches only the requested adapter', async () => {
    const calls: string[] = []
    const stats = await ingestStateFinance({
      cycle: '2024', client, state: 'CA',
      adapters: [
        mkAdapter('CA', async () => { calls.push('CA'); return mkStats('CA') }),
        mkAdapter('NY', async () => { calls.push('NY'); return mkStats('NY') }),
      ],
    })
    expect(calls).toEqual(['CA'])
    expect(stats.statesAttempted).toBe(1)
  })

  it('one adapter throwing → others still run with skipOnError', async () => {
    const stats = await ingestStateFinance({
      cycle: '2024', client, skipOnError: true,
      adapters: [
        mkAdapter('CA', async () => { throw new Error('CA blew up') }),
        mkAdapter('NY', async () => mkStats('NY', { summariesUpserted: 1 })),
      ],
    })
    expect(stats.statesOk).toBe(1)
    expect(stats.byState.find(s => s.state === 'CA')!.errors).toContain('CA blew up')
    expect(stats.byState.find(s => s.state === 'NY')!.summariesUpserted).toBe(1)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    await expect(ingestStateFinance({
      cycle: '2024', client,
      adapters: [
        mkAdapter('CA', async () => { throw new Error('CA blew up') }),
        mkAdapter('NY', async () => mkStats('NY')),
      ],
    })).rejects.toThrow(/CA blew up/)
  })

  it('aggregates officialsUnmatched across adapters', async () => {
    const stats = await ingestStateFinance({
      cycle: '2024', client,
      adapters: [
        mkAdapter('CA', async () => mkStats('CA', { officialsUnmatched: ['John Doe', 'Jane Roe'] })),
        mkAdapter('NY', async () => mkStats('NY', { officialsUnmatched: ['Sam Smith'] })),
      ],
    })
    expect(stats.totalOfficialsUnmatched).toBe(3)
  })

  it('--state with unknown state code throws', async () => {
    await expect(ingestStateFinance({
      cycle: '2024', client, state: 'ZZ' as never,
      adapters: [mkAdapter('CA', async () => mkStats('CA'))],
    })).rejects.toThrow(/unknown state code/)
  })
})
