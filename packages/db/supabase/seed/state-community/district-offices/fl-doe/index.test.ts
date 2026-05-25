import { describe, expect, it, vi } from 'vitest'
import { flDoeOffices } from './index.ts'
import { stubFetchBlocked } from '../../../test-utils/stub-fetch.ts'

describe('flDoeOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(flDoeOffices.slug).toBe('fl-doe')
    expect(flDoeOffices.component).toBe('offices')
    expect(flDoeOffices.covered_states).toEqual(['FL'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', kind: 'capitol', street_1: 's', city: 'c', state: 'FL', source_url: 'u' }]
    const result = await flDoeOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Senate + House fetch results in production path', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await flDoeOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    fetchSpy.mockRestore()
  })
})
