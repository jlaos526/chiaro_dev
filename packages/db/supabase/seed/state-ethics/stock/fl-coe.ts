import type { StateEthicsAdapter, NormalizedStockTransaction } from '../shared.ts'

export const flCoeStock: StateEthicsAdapter = {
  slug: 'fl-coe',
  component: 'stock',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStockTransaction[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
