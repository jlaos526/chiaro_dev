import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const caFppcDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'ca-fppc',
  component: 'disclosures',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
