import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const miLegislatureOffices: StateCommunityAdapter = {
  slug: 'mi-legislature',
  component: 'offices',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires legislature.mi.gov member-profile scrape.
    return []
  },
}
