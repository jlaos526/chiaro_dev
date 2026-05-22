import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const miBoardComplaints: StateEthicsAdapter = {
  slug: 'mi-board',
  component: 'complaints',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
