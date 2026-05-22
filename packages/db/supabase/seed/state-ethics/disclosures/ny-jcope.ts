import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const nyJcopeDisclosures: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'disclosures',
  covered_states: ['NY'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
