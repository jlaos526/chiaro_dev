import { describe, expect, it, vi } from 'vitest'
import { fetchOpenStatesV3All } from './openstates-v3-fetch-all.ts'
import type { FetchOpenStatesV3Stats } from './openstates-v3-fetch.ts'

function mkStats(
  state: string,
  overrides: Partial<FetchOpenStatesV3Stats> = {},
): FetchOpenStatesV3Stats {
  return {
    state,
    session: 'whatever',
    pagesFetched: 1,
    billsCached: 0,
    billsSkippedFresh: 0,
    votesCached: 0,
    votesSkippedFresh: 0,
    errors: [],
    ...overrides,
  }
}

describe('fetchOpenStatesV3All', () => {
  it('fetches all states in the year map (default 2025)', async () => {
    const calls: Array<[string, string]> = []
    const stats = await fetchOpenStatesV3All({
      year: 2025,
      runFetch: async (state, session) => {
        calls.push([state, session])
        return mkStats(state, { billsCached: 3 })
      },
    })
    // Sorted alphabetically: CA, FL, MI, NY, TX
    expect(calls).toEqual([
      ['CA', '20252026'],
      ['FL', '2025'],
      ['MI', '2025-2026'],
      ['NY', '2025'],
      ['TX', '89R'],
    ])
    expect(stats.statesAttempted).toBe(5)
    expect(stats.statesOk).toBe(5)
    expect(stats.totalBillsCached).toBe(15)
  })

  it('aggregates per-state stats', async () => {
    const map: Record<string, [number, number]> = {
      CA: [4, 1],
      NY: [2, 3],
    }
    const stats = await fetchOpenStatesV3All({
      year: 2025,
      sessionMap: { CA: 's1', NY: 's2' },
      runFetch: async (state) => {
        const [cached, skipped] = map[state]!
        return mkStats(state, { billsCached: cached, billsSkippedFresh: skipped })
      },
    })
    expect(stats.totalBillsCached).toBe(6)
    expect(stats.totalBillsSkippedFresh).toBe(4)
  })

  it('--skip-on-error: continues past failing state', async () => {
    const stats = await fetchOpenStatesV3All({
      year: 2025,
      sessionMap: { CA: 's1', NY: 's2', FL: 's3' },
      skipOnError: true,
      runFetch: async (state) => {
        if (state === 'NY') throw new Error('NY blew up')
        return mkStats(state, { billsCached: 2 })
      },
    })
    expect(stats.statesAttempted).toBe(3)
    expect(stats.statesOk).toBe(2)
    expect(stats.statesErrored).toEqual([{ state: 'NY', error: 'NY blew up' }])
    expect(stats.totalBillsCached).toBe(4) // CA + FL
  })

  it('default (no skip-on-error): aborts on first thrown error', async () => {
    await expect(
      fetchOpenStatesV3All({
        year: 2025,
        sessionMap: { CA: 's1', NY: 's2', FL: 's3' },
        runFetch: async (state) => {
          if (state === 'NY') throw new Error('NY blew up')
          return mkStats(state)
        },
      }),
    ).rejects.toThrow(/NY blew up/)
  })

  it('per-state stats.errors counted toward errored states (no skip)', async () => {
    await expect(
      fetchOpenStatesV3All({
        year: 2025,
        sessionMap: { CA: 's1' },
        runFetch: async (state) => mkStats(state, { errors: ['ratelimit'] }),
      }),
    ).rejects.toThrow(/CA reported errors/)
  })

  it('per-state stats.errors counted but flow continues with skip-on-error', async () => {
    const stats = await fetchOpenStatesV3All({
      year: 2025,
      sessionMap: { CA: 's1', NY: 's2' },
      skipOnError: true,
      runFetch: async (state) =>
        mkStats(state, {
          billsCached: 1,
          errors: state === 'CA' ? ['some 429'] : [],
        }),
    })
    expect(stats.statesErrored).toEqual([{ state: 'CA', error: 'some 429' }])
    expect(stats.statesOk).toBe(1)
    expect(stats.totalBillsCached).toBe(2) // both states attempted, both wrote 1 bill
  })

  it('unknown year throws when no override supplied', async () => {
    await expect(
      fetchOpenStatesV3All({
        year: 9999,
        runFetch: vi.fn() as never,
      }),
    ).rejects.toThrow(/no session map for year 9999/)
  })

  it('unknown year + custom sessionMap works', async () => {
    const calls: string[] = []
    const stats = await fetchOpenStatesV3All({
      year: 9999,
      sessionMap: { WY: 'AL' },
      runFetch: async (state, session) => {
        calls.push(`${state}:${session}`)
        return mkStats(state, { billsCached: 1 })
      },
    })
    expect(calls).toEqual(['WY:AL'])
    expect(stats.statesOk).toBe(1)
  })
})
