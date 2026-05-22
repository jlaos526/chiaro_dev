import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const caFppcComplaints: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'complaints',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
