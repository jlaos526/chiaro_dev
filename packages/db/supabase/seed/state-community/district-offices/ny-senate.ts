import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const nySenateOffices: StateCommunityAdapter = {
  slug: 'ny-senate',
  component: 'offices',
  covered_states: ['NY'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires nysenate.gov member-profile scrape.
    return []
  },
}
