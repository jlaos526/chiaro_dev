import type { StateEthicsAdapter, NormalizedStockTransaction } from '../shared.ts'

export const nyJcopeStock: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'stock',
  covered_states: ['NY'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStockTransaction[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
