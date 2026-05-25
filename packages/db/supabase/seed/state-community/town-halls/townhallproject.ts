import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

/**
 * @deprecated TownHallProject went defunct in 2021 (last commit 2021-07-21;
 * Firebase data stale at 2 events from 2020-2021). Replaced by
 * `./mobilize.ts` (slice 7). Stub retained in the codebase for
 * backwards-compat with existing test imports; never produced data so no
 * DB cleanup needed. Not in `ADAPTERS_DEFAULT` dispatch order anymore.
 */
export const townhallproject: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'townhallproject',
  component: 'halls',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return []
  },
}
