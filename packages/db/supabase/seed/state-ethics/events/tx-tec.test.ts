import { describe, expect, it, vi } from 'vitest'
import { txTecEvents } from './tx-tec.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'

describe('txTecEvents adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(txTecEvents.slug).toBe('tx-tec')
    expect(txTecEvents.component).toBe('events')
    expect(txTecEvents.covered_states).toEqual(['TX'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [
      {
        official_openstates_person_id: 'x',
        event_date: '2024-01-01',
        event_type: 'campaign_finance_violation',
        summary: 's',
        state: 'TX',
        source_url: 'u',
        source: 'tx-tec',
      },
    ]
    const result = await txTecEvents.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchSwornComplaintOrders and returns events slice', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await txTecEvents.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
