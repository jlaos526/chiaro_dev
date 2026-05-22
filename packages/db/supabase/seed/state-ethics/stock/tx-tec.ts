import type { StateEthicsAdapter, NormalizedStockTransaction } from '../shared.ts'

export const txTecStock: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'stock',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStockTransaction[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
