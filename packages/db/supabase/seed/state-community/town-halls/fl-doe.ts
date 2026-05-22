import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

export const flDoeTownHalls: StateCommunityAdapter = {
  slug: 'fl-doe',
  component: 'halls',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires flsenate.gov / myfloridahouse.gov member events.
    return []
  },
}
