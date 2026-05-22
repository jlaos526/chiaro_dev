import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

export const nySenateTownHalls: StateCommunityAdapter = {
  slug: 'ny-senate',
  component: 'halls',
  covered_states: ['NY'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires nysenate.gov member-events scrape.
    return []
  },
}
