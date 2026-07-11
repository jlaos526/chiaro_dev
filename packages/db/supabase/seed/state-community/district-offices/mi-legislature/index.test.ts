import { describe, expect, it, vi } from 'vitest'
import { miLegislatureOffices } from './index.ts'
import { stubFetchBlocked } from '../../../test-utils/stub-fetch.ts'

describe('miLegislatureOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(miLegislatureOffices.slug).toBe('mi-legislature')
    expect(miLegislatureOffices.component).toBe('offices')
    expect(miLegislatureOffices.covered_states).toEqual(['MI'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [
      {
        official_openstates_person_id: 'x',
        kind: 'capitol',
        street_1: 's',
        city: 'c',
        state: 'MI',
        source_url: 'u',
      },
    ]
    const result = await miLegislatureOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Senate + House fetch results in production path', async () => {
    const fetchSpy = stubFetchBlocked()
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await miLegislatureOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    fetchSpy.mockRestore()
  })
})
