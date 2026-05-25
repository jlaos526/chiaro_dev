import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchFlSenateOffices } from './senate.ts'
import { fetchFlHouseOffices } from './house.ts'

/**
 * FL state-legislator district offices, combining Senate
 * (flsenate.gov/Senators/s{n} per-senator) and House
 * (flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}
 * per-rep).
 *
 * Slug `fl-doe` is the slice 5H stub legacy name (despite the actual
 * source URLs being flsenate.gov + flhouse.gov, not floridadoe.gov).
 * Kept for back-compat with state_community_orgs row continuity.
 */
export const flDoeOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
  slug: 'fl-doe',
  component: 'offices',
  covered_states: ['FL'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    if (opts.fetcher) return opts.fetcher()

    const subOpts = opts.onSkip ? { onSkip: opts.onSkip } : {}
    const [senate, house] = await Promise.all([
      fetchFlSenateOffices(opts.client, subOpts),
      fetchFlHouseOffices(opts.client, subOpts),
    ])
    return [...senate, ...house]
  },
}
