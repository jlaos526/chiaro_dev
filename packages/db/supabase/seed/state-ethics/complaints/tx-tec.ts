import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const txTecComplaints: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'complaints',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
