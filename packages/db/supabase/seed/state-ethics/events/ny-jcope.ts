import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { fetchEnforcementActions } from '../ny-coelig/shared.ts'

/**
 * NY campaign-finance-violation events from COELIG enforcement-actions table.
 *
 * Slug `ny-jcope` is the legacy agency name (see nyJcopeComplaints
 * adapter for explanation). Recall/expulsion events are sourced via
 * slice 9 Ballotpedia nationwide; this adapter emits only
 * event_type='campaign_finance_violation'.
 */
export const nyJcopeEvents: StateEthicsAdapter<NormalizedOfficialEvent> = {
  slug: 'ny-jcope',
  component: 'events',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedOfficialEvent[]> {
    if (opts.fetcher) return opts.fetcher()
    const { events } = await fetchEnforcementActions(opts.client, {})
    return events
  },
}
