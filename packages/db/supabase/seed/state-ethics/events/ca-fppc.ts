import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const caFppcEvents: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'events',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
