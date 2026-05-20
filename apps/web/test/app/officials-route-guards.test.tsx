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

  // Full route redirect-flow tests against real Next routes belong in an e2e
  // suite (Playwright). For the MVP we keep coverage at the predicate level
  // + manual smoke verification.
})
