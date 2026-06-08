import { describe, expect, it } from 'vitest'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { fetchOfficialStateVotes } from '../src/queries.ts'

// Minimal PostgREST-builder mock: chainable methods return `this`; awaiting
// the builder resolves to the configured result.
function mockClient(result: { data: unknown; error: unknown }): ChiaroClient {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.in = chain
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return { from: () => builder } as unknown as ChiaroClient
}

function voteRow(id: string, vote_date: string | null) {
  return {
    position: 'yes',
    vote: {
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
      bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'Env' },
    },
  }
}

describe('B8: fetchOfficialStateVotes sort is transitive + null-safe', () => {
  it('orders newest first, equal dates stable, null date last, no throw', async () => {
    // Two equal dates + one null date. Sort must not throw and must place
    // the null-date row last.
    const fixture = [
      voteRow('older', '2025-01-01'),
      voteRow('equalA', '2025-03-01'),
      voteRow('nullDate', null),
      voteRow('equalB', '2025-03-01'),
    ]
    const result = await fetchOfficialStateVotes(
      mockClient({ data: fixture, error: null }),
      'oid',
    )

    const ids = result.map(r => r.vote.id)
    // Newest (equal) dates come first (their relative order is stable for
    // localeCompare === 0), then the older date, then the null-date row last.
    expect(ids).toEqual(['equalA', 'equalB', 'older', 'nullDate'])
    expect(result[result.length - 1]!.vote.vote_date).toBeNull()
  })
})
