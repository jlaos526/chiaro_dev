import { describe, expect, it } from 'vitest'
import { miBoardComplaints } from './mi-board.ts'

describe('miBoardComplaints adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(miBoardComplaints.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await miBoardComplaints.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(miBoardComplaints.slug).toBe('mi-board')
  })

  it('component is complaints', () => {
    expect(miBoardComplaints.component).toBe('complaints')
  })
})
