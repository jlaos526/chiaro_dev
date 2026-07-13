import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const flCoeComplaints: StateEthicsAdapter<NormalizedEthicsComplaint> = {
  slug: 'fl-coe',
  component: 'complaints',
  status: 'stub',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
