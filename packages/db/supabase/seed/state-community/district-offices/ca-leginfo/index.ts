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
export const caLeginfoOffices: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'offices',
  covered_states: ['CA'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (injected) return injected()

    const [senate, assembly] = await Promise.all([
      fetchCaSenateOffices(opts.client, {}),
      fetchCaAssemblyOffices(opts.client, {}),
    ])
    return [...senate, ...assembly]
  },
}
