import { describe, expect, it } from 'vitest'
import { caLeginfoTownHalls } from './ca-leginfo.ts'

describe('caLeginfoTownHalls adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(caLeginfoTownHalls.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await caLeginfoTownHalls.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(caLeginfoTownHalls.slug).toBe('ca-leginfo')
  })

  it('component is halls', () => {
    expect(caLeginfoTownHalls.component).toBe('halls')
  })
})
