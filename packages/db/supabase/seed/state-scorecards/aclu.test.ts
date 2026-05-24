import { describe, expect, it } from 'vitest'
import { aclu } from './aclu.ts'

describe('aclu adapter — DEPRECATED (slice 11)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(aclu.covered_states).toEqual([])
  })

  it('fetchRatings returns [] regardless of opts', async () => {
    const result = await aclu.fetchRatings({ session: '2025' } as never)
    expect(result).toEqual([])
  })

  it('slug preserved for state_scorecard_orgs DB row continuity', () => {
    expect(aclu.slug).toBe('aclu')
  })

  it('notes documents deprecation status', () => {
    expect(aclu.notes).toMatch(/DEPRECATED/)
  })
})
