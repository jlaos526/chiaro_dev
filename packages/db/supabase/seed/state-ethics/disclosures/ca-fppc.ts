import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const caFppcDisclosures: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'disclosures',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
