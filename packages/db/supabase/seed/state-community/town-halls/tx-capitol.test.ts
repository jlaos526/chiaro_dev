import { describe, expect, it } from 'vitest'
import { txCapitolTownHalls } from './tx-capitol.ts'

describe('txCapitolTownHalls adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(txCapitolTownHalls.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await txCapitolTownHalls.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(txCapitolTownHalls.slug).toBe('tx-capitol')
  })

  it('component is halls', () => {
    expect(txCapitolTownHalls.component).toBe('halls')
  })
})
