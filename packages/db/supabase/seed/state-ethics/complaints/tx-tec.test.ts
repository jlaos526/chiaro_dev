import { describe, expect, it, vi } from 'vitest'
import { txTecComplaints } from './tx-tec.ts'
import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'

describe('txTecComplaints adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(txTecComplaints.slug).toBe('tx-tec')
    expect(txTecComplaints.component).toBe('complaints')
    expect(txTecComplaints.covered_states).toEqual(['TX'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', complaint_date: '2024-01-01', status: 'open', summary: 's', state: 'TX', source_url: 'u', source: 'tx-tec' }]
    const result = await txTecComplaints.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchSwornComplaintOrders and returns complaints slice', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await txTecComplaints.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
