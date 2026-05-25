import { describe, expect, it, vi } from 'vitest'
import { nyJcopeComplaints } from './ny-jcope.ts'

describe('nyJcopeComplaints adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nyJcopeComplaints.slug).toBe('ny-jcope')
    expect(nyJcopeComplaints.component).toBe('complaints')
    expect(nyJcopeComplaints.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', complaint_date: '2024-01-01', status: 'open', summary: 's', state: 'NY', source_url: 'u', source: 'ny-jcope' }]
    const result = await nyJcopeComplaints.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchEnforcementActions and returns complaints slice', async () => {
    // No injected fetcher; stub global fetch to prevent network leak.
    // The helper catches the rejection and returns { complaints: [], events: [], errors: [...] }
    // → adapter returns [].
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await nyJcopeComplaints.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
