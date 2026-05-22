import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

export const caLeginfoTownHalls: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'halls',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires leginfo.ca.gov member-events scrape.
    return []
  },
}
