import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const flCoeEvents: StateEthicsAdapter = {
  slug: 'fl-coe',
  component: 'events',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
