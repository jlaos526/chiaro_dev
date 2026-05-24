import { describe, expect, it } from 'vitest'
import { miLegislatureTownHalls } from './mi-legislature.ts'

describe('miLegislatureTownHalls adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(miLegislatureTownHalls.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await miLegislatureTownHalls.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(miLegislatureTownHalls.slug).toBe('mi-legislature')
  })

  it('component is halls', () => {
    expect(miLegislatureTownHalls.component).toBe('halls')
  })
})
