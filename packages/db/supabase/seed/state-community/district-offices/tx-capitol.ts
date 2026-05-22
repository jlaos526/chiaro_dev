import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const txCapitolOffices: StateCommunityAdapter = {
  slug: 'tx-capitol',
  component: 'offices',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires capitol.texas.gov member-profile scrape.
    return []
  },
}
