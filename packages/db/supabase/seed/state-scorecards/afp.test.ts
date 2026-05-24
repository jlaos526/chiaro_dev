import { describe, expect, it } from 'vitest'
import { afp } from './afp.ts'

describe('afp adapter — DEPRECATED (slice 11)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(afp.covered_states).toEqual([])
  })

  it('fetchRatings returns [] regardless of opts', async () => {
    const result = await afp.fetchRatings({ session: '2025' } as never)
    expect(result).toEqual([])
  })

  it('slug preserved for state_scorecard_orgs DB row continuity', () => {
    expect(afp.slug).toBe('afp')
  })

  it('notes documents deprecation status', () => {
    expect(afp.notes).toMatch(/DEPRECATED/)
  })
})
