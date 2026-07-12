import { describe, expect, it } from 'vitest'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { fetchOfficialStateVotes } from '../src/queries.ts'

// Minimal PostgREST-builder mock: chainable methods return `this` and RECORD
// their calls (slice 75 — ordering + the row cap moved server-side, so the
// unit contract is the CHAIN SHAPE; end-to-end semantics live in
// queries.integration.test.ts against real PostgREST).
function mockClient(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const builder: Record<string, unknown> = {}
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  builder.select = chain('select')
  builder.eq = chain('eq')
  builder.in = chain('in')
  builder.order = chain('order')
  builder.limit = chain('limit')
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return { client: { from: () => builder } as unknown as ChiaroClient, calls }
}

// Anchored-row fixture (slice 75 shape): state_votes parent + positions array.
function anchoredRow(id: string, vote_date: string | null, position = 'yes') {
  return {
    id,
    bill_id: 'b1',
    state: 'CA',
    session: '20252026',
    chamber: 'state_senate',
    vote_date,
    question: 'On Passage',
    result: 'passed',
    source_url: 'https://x',
    party_vote_split: null,
    created_at: '2025-03-01',
    bill: {
      id: 'b1',
      state: 'CA',
      session: '20252026',
      bill_type: 'SB',
      number: 100,
      title: 'Env',
    },
    positions: [{ position }],
  }
}

describe('fetchOfficialStateVotes (slice 75 anchored shape)', () => {
  it('orders server-side (vote_date desc), caps the fetch, and maps positions[0]', async () => {
    const fixture = [anchoredRow('v1', '2025-03-02'), anchoredRow('v2', '2025-03-01', 'not_voting')]
    const { client, calls } = mockClient({ data: fixture, error: null })
    const result = await fetchOfficialStateVotes(client, 'oid')

    // Chain shape: the ORDER + LIMIT are the server's job now.
    const order = calls.find((c) => c.method === 'order')
    expect(order?.args[0]).toBe('vote_date')
    expect(order?.args[1]).toMatchObject({ ascending: false })
    const limit = calls.find((c) => c.method === 'limit')
    expect(limit?.args[0]).toBe(200)
    const eq = calls.find((c) => c.method === 'eq')
    expect(eq?.args).toEqual(['positions.official_id', 'oid'])

    // Row normalization: positions array → scalar position; vote fields intact.
    expect(result).toHaveLength(2)
    expect(result[0]!.vote.id).toBe('v1')
    expect(result[0]!.position).toBe('yes')
    expect(result[1]!.position).toBe('not_voting')
    expect(result[0]!.vote.bill?.title).toBe('Env')
    // The positions array must not leak onto the vote object.
    expect((result[0]!.vote as unknown as Record<string, unknown>).positions).toBeUndefined()
  })
})
