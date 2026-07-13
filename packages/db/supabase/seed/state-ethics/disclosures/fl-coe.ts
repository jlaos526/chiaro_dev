import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const flCoeDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'fl-coe',
  component: 'disclosures',
  status: 'stub',
  covered_states: ['FL'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
