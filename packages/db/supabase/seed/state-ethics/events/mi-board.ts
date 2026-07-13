import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const miBoardEvents: StateEthicsAdapter<NormalizedOfficialEvent> = {
  slug: 'mi-board',
  component: 'events',
  status: 'stub',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
