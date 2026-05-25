import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { fetchSwornComplaintOrders } from '../tx-tec/shared.ts'

/**
 * TX campaign-finance-violation events from TEC sworn-complaint orders.
 *
 * Combined-parser pattern (mirror of slice 15 ny-coelig). Recall/expulsion
 * events sourced via slice 9 Ballotpedia nationwide; this adapter emits
 * only event_type='campaign_finance_violation'.
 */
export const txTecEvents: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'events',
  covered_states: ['TX'],
  async fetchEvents(opts): Promise<NormalizedOfficialEvent[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (injected) return injected()
    const { events } = await fetchSwornComplaintOrders(opts.client, {})
    return events
  },
}
