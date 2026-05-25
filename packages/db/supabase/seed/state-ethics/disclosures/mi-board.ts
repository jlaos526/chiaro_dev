import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const miBoardDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'mi-board',
  component: 'disclosures',
  covered_states: ['MI'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
