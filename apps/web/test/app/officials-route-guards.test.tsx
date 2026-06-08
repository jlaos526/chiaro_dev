import { describe, expect, it } from 'vitest'

describe('chamber-based route guards', () => {
  it('isStateLevel correctly classifies all 5 chambers', async () => {
    const { isStateLevel } = await import('@chiaro/officials')
    expect(isStateLevel('federal_house')).toBe(false)
    expect(isStateLevel('federal_senate')).toBe(false)
    expect(isStateLevel('state_house')).toBe(true)
    expect(isStateLevel('state_senate')).toBe(true)
    expect(isStateLevel('state_legislature')).toBe(true)
  })

  // The page-level cross-route redirect flows (state↔federal mismatch and the
  // not-found → '/' guard) are exercised directly against the async server
  // components in `officials-detail-page.test.tsx` +
  // `state-officials-detail-page.test.tsx`. This file keeps the predicate-level
  // coverage that those page tests build on.
})
