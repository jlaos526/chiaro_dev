import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const flDoeOffices: StateCommunityAdapter = {
  slug: 'fl-doe',
  component: 'offices',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires flsenate.gov / myfloridahouse.gov member profile scrape.
    return []
  },
}
