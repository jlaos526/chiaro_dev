import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

export const miLegislatureTownHalls: StateCommunityAdapter = {
  slug: 'mi-legislature',
  component: 'halls',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires legislature.mi.gov member-events scrape.
    return []
  },
}
