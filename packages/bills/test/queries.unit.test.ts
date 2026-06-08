import { describe, expect, it } from 'vitest'
import type { ChiaroClient } from '@chiaro/supabase-client'
import {
  fetchOfficialSponsoredBills,
  fetchOfficialCosponsoredBills,
  fetchOfficialMissedVotes,
} from '../src/queries.ts'

// Minimal mock of the PostgREST query-builder chain. Every chainable method
// returns `this`; awaiting the builder resolves to the configured result.
// `firstResult` answers the FIRST awaited sub-query in each fetcher; any
// later `from(...)` call resolves to `{ data: [], error: null }`.
function mockClient(firstResult: { data: unknown; error: unknown }): ChiaroClient {
  let callIndex = 0
  function makeBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = chain
    builder.eq = chain
    builder.in = chain
    builder.order = chain
    // Thenable: `await builder` yields `result`.
    builder.then = (resolve: (v: unknown) => unknown) => resolve(result)
    return builder
  }
  return {
    from: () => {
      const result = callIndex === 0 ? firstResult : { data: [], error: null }
      callIndex += 1
      return makeBuilder(result)
    },
  } as unknown as ChiaroClient
}

const FIRST_ERROR = { data: null, error: { message: 'boom' } }

describe('B7: first sub-query errors propagate (no swallow)', () => {
  it('fetchOfficialSponsoredBills throws when bill_sponsors lookup errors', async () => {
    await expect(
      fetchOfficialSponsoredBills(mockClient(FIRST_ERROR), 'off1', '119'),
    ).rejects.toMatchObject({ message: 'boom' })
  })

  it('fetchOfficialCosponsoredBills throws when bill_sponsors lookup errors', async () => {
    await expect(
      fetchOfficialCosponsoredBills(mockClient(FIRST_ERROR), 'off1', '119'),
    ).rejects.toMatchObject({ message: 'boom' })
  })

  it('fetchOfficialMissedVotes throws when votes lookup errors', async () => {
    await expect(
      fetchOfficialMissedVotes(mockClient(FIRST_ERROR), 'off1', '119'),
    ).rejects.toMatchObject({ message: 'boom' })
  })
})
