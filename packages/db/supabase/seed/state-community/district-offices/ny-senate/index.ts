import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchAssemblyOffices } from './assembly.ts'
import { fetchSenateOffices } from './senate.ts'

/**
 * NY state-legislator district offices, combining Assembly (single-page
 * directory at nyassembly.gov/mem/) and Senate (per-senator
 * /contact pages on nysenate.gov).
 *
 * Slug `ny-senate` matches the slice 5H stub naming despite covering BOTH
 * chambers — kept for back-compat with state_community_orgs row continuity.
 */
export const nySenateOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
  slug: 'ny-senate',
  component: 'offices',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    if (opts.fetcher) return opts.fetcher()

    // Assembly uses a single-page directory (no per-member loop) and
    // does not accept onSkip today; only the per-member senate
    // sub-fetcher propagates slice 22 instrumentation.
    const senateOpts = opts.onSkip ? { onSkip: opts.onSkip } : {}
    const [assembly, senate] = await Promise.all([
      fetchAssemblyOffices(opts.client, {}),
      fetchSenateOffices(opts.client, senateOpts),
    ])
    return [...assembly, ...senate]
  },
}
