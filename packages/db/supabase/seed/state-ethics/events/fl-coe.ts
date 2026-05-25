import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const flCoeEvents: StateEthicsAdapter<NormalizedOfficialEvent> = {
  slug: 'fl-coe',
  component: 'events',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
