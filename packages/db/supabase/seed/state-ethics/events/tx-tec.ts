import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const txTecEvents: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'events',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
