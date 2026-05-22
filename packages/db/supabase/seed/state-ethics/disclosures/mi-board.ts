import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const miBoardDisclosures: StateEthicsAdapter = {
  slug: 'mi-board',
  component: 'disclosures',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
