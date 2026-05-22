import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

export const txCapitolTownHalls: StateCommunityAdapter = {
  slug: 'tx-capitol',
  component: 'halls',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires capitol.texas.gov member-events scrape.
    return []
  },
}
