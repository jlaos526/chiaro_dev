import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const nyJcopeEvents: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'events',
  covered_states: ['NY'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
