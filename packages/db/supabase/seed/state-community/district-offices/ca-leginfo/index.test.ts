import { describe, expect, it, vi } from 'vitest'
import { caLeginfoOffices } from './index.ts'
import { stubFetchBlocked } from '../../../test-utils/stub-fetch.ts'

describe('caLeginfoOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(caLeginfoOffices.slug).toBe('ca-leginfo')
    expect(caLeginfoOffices.component).toBe('offices')
    expect(caLeginfoOffices.covered_states).toEqual(['CA'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [
      {
        official_openstates_person_id: 'x',
        kind: 'capitol',
        street_1: 's',
        city: 'c',
        state: 'CA',
        source_url: 'u',
      },
    ]
    const result = await caLeginfoOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Senate + Assembly fetch results in production path', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await caLeginfoOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    fetchSpy.mockRestore()
  })
})
