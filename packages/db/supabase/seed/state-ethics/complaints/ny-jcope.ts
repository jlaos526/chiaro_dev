import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'
import { fetchEnforcementActions } from '../ny-coelig/shared.ts'

/**
 * NY ethics complaints from COELIG enforcement-actions table.
 *
 * Slug `ny-jcope` is the legacy agency name (Joint Commission on Public
 * Ethics, renamed to COELIG in 2022). Kept for back-compat with the
 * slice 5I stub + future state_ethics_orgs row continuity. Source URL
 * uses the current `ethics.ny.gov` domain via the shared
 * fetchEnforcementActions helper.
 */
export const nyJcopeComplaints: StateEthicsAdapter<NormalizedEthicsComplaint> = {
  slug: 'ny-jcope',
  component: 'complaints',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
    if (opts.fetcher) return opts.fetcher()
    const { complaints } = await fetchEnforcementActions(opts.client, {})
    return complaints
  },
}
