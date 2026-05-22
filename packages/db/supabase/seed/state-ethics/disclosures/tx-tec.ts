import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const txTecDisclosures: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'disclosures',
  covered_states: ['TX'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
