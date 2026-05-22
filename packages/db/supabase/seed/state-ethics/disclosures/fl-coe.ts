import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const flCoeDisclosures: StateEthicsAdapter = {
  slug: 'fl-coe',
  component: 'disclosures',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
