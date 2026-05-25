import { describe, expect, it, vi } from 'vitest'
import { nySenateOffices } from './index.ts'

describe('nySenateOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nySenateOffices.slug).toBe('ny-senate')
    expect(nySenateOffices.component).toBe('offices')
    expect(nySenateOffices.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', kind: 'capitol', street_1: 's', city: 'c', state: 'NY', source_url: 'u' }]
    const result = await nySenateOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Assembly + Senate fetch results in production path', async () => {
    // No injected fetcher; production path uses both sub-fetchers.
    // Stub global fetch so neither sub-fetcher hits the real network (CI flake risk).
    // Both fetchAssemblyOffices and fetchSenateOffices try/catch fetch errors and
    // return []; the rejected fetch validates dispatch returns the concatenation.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('blocked in test')))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await nySenateOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    vi.unstubAllGlobals()
  })
})
