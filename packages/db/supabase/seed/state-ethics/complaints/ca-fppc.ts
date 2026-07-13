import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const caFppcComplaints: StateEthicsAdapter<NormalizedEthicsComplaint> = {
  slug: 'ca-fppc',
  component: 'complaints',
  status: 'stub',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
