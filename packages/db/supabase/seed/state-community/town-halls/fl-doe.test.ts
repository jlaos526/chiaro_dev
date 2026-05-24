import { describe, expect, it } from 'vitest'
import { flDoeTownHalls } from './fl-doe.ts'

describe('flDoeTownHalls adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(flDoeTownHalls.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await flDoeTownHalls.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(flDoeTownHalls.slug).toBe('fl-doe')
  })

  it('component is halls', () => {
    expect(flDoeTownHalls.component).toBe('halls')
  })
})
