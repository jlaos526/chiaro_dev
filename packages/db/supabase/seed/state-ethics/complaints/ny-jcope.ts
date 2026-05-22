import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const nyJcopeComplaints: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'complaints',
  covered_states: ['NY'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
