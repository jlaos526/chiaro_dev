import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const txCapitolOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
  slug: 'tx-capitol',
  component: 'offices',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    // Production stub: operator wires capitol.texas.gov member-profile scrape.
    return []
  },
}
