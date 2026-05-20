import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateBillsEnrich } from './state-bills-enrich.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})

afterEach(async () => {
  await client.end()
})

describe('ingestStateBillsEnrich', () => {
  it('returns stats from all 5 adapters', async () => {
    delete process.env.NY_SENATE_API_KEY
    const stats = await ingestStateBillsEnrich({
      session: '20252026',
      client,
      adapters: [
        { state: 'CA', async enrich() { return { state: 'CA', billsUpdated: 2, errors: [] } } },
        { state: 'NY', async enrich() { return { state: 'NY', billsUpdated: 0, errors: [], skipped: true, skipReason: 'no key' } } },
        { state: 'FL', async enrich() { return { state: 'FL', billsUpdated: 1, errors: [] } } },
        { state: 'TX', async enrich() { return { state: 'TX', billsUpdated: 0, errors: [] } } },
        { state: 'MI', async enrich() { return { state: 'MI', billsUpdated: 3, errors: [] } } },
      ] as never,
    })
    expect(stats.totalBillsUpdated).toBe(6)
    expect(stats.byState).toHaveLength(5)
    expect(stats.byState.find(s => s.state === 'NY')!.skipped).toBe(true)
  })

  it('one adapter throwing → others still run; error captured', async () => {
    const stats = await ingestStateBillsEnrich({
      session: '20252026',
      client,
      adapters: [
        { state: 'CA', async enrich() { throw new Error('CA broke') } },
        { state: 'NY', async enrich() { return { state: 'NY', billsUpdated: 1, errors: [] } } },
      ] as never,
    })
    expect(stats.totalBillsUpdated).toBe(1)
    expect(stats.byState.find(s => s.state === 'CA')!.errors).toContain('CA broke')
    expect(stats.byState.find(s => s.state === 'NY')!.billsUpdated).toBe(1)
  })

  it('aggregates errors across all adapters', async () => {
    const stats = await ingestStateBillsEnrich({
      session: '20252026',
      client,
      adapters: [
        { state: 'CA', async enrich() { return { state: 'CA', billsUpdated: 0, errors: ['CA err 1', 'CA err 2'] } } },
        { state: 'FL', async enrich() { return { state: 'FL', billsUpdated: 0, errors: ['FL err'] } } },
      ] as never,
    })
    expect(stats.totalErrors).toBe(3)
  })
})
