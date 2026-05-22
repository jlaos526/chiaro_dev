import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const caLeginfoOffices: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'offices',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires leginfo.ca.gov member-profile scrape.
    return []
  },
}
