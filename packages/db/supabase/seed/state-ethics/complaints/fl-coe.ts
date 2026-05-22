import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const flCoeComplaints: StateEthicsAdapter = {
  slug: 'fl-coe',
  component: 'complaints',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
