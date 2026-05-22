import type { StateEthicsAdapter, NormalizedStockTransaction } from '../shared.ts'

export const miBoardStock: StateEthicsAdapter = {
  slug: 'mi-board',
  component: 'stock',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStockTransaction[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
