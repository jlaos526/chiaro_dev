import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const flCoeComplaints: StateEthicsAdapter<NormalizedEthicsComplaint> = {
  slug: 'fl-coe',
  component: 'complaints',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
