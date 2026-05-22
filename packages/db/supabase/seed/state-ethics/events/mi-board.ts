import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const miBoardEvents: StateEthicsAdapter = {
  slug: 'mi-board',
  component: 'events',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
