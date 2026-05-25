import { describe, expect, it, vi } from 'vitest'
import { nyJcopeEvents } from './ny-jcope.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'

describe('nyJcopeEvents adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nyJcopeEvents.slug).toBe('ny-jcope')
    expect(nyJcopeEvents.component).toBe('events')
    expect(nyJcopeEvents.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', event_date: '2024-01-01', event_type: 'campaign_finance_violation', summary: 's', state: 'NY', source_url: 'u', source: 'ny-jcope' }]
    const result = await nyJcopeEvents.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchEnforcementActions and returns events slice', async () => {
    // No injected fetcher; stub global fetch to prevent network leak.
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await nyJcopeEvents.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
