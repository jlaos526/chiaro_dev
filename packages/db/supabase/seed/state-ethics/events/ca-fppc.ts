import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const caFppcEvents: StateEthicsAdapter<NormalizedOfficialEvent> = {
  slug: 'ca-fppc',
  component: 'events',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
