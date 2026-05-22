import type { StateEthicsAdapter, NormalizedStockTransaction } from '../shared.ts'

export const caFppcStock: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'stock',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStockTransaction[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
