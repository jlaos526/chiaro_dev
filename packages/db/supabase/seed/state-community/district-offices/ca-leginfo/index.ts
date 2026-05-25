import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchCaSenateOffices } from './senate.ts'
import { fetchCaAssemblyOffices } from './assembly.ts'

/**
 * CA state-legislator district offices, combining Senate
 * (senate.ca.gov/senators single-page roster, 40 senators) and
 * Assembly (assembly.ca.gov/assemblymembers/{n} per-member loop, 80 AMs).
 *
 * Slug `ca-leginfo` is the slice 5H stub legacy name (despite the
 * actual source URLs being senate.ca.gov + assembly.ca.gov, not
 * leginfo.legislature.ca.gov). Kept for back-compat with
 * state_community_orgs row continuity.
 */
export const caLeginfoOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
  slug: 'ca-leginfo',
  component: 'offices',
  covered_states: ['CA'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    if (opts.fetcher) return opts.fetcher()

    // Senate uses a single-page roster (no per-member loop) and does not
    // accept onSkip today; only the per-member assembly sub-fetcher
    // propagates slice 22 instrumentation.
    const assemblyOpts = opts.onSkip ? { onSkip: opts.onSkip } : {}
    const [senate, assembly] = await Promise.all([
      fetchCaSenateOffices(opts.client, {}),
      fetchCaAssemblyOffices(opts.client, assemblyOpts),
    ])
    return [...senate, ...assembly]
  },
}
