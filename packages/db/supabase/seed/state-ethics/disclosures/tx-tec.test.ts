import { describe, expect, it } from 'vitest'
import { txTecDisclosures } from './tx-tec.ts'

describe('txTecDisclosures adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(txTecDisclosures.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await txTecDisclosures.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(txTecDisclosures.slug).toBe('tx-tec')
  })

  it('component is disclosures', () => {
    expect(txTecDisclosures.component).toBe('disclosures')
  })
})
