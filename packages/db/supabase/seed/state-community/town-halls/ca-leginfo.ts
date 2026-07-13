import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * CA does not maintain an aggregated state-government town-hall feed.
 * leginfo.ca.gov publishes institutional sessions/hearings only; town
 * halls live on individual senator/AM microsites (sdNN.senate.ca.gov,
 * aXX.asmdc.org) with no central index.
 *
 * Mobilize.us (slice 7 nationwide adapter at
 * state-community/town-halls/mobilize.ts) IS the production source for
 * CA state-legislator town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const caLeginfoTownHalls: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'ca-leginfo',
  component: 'halls',
  status: 'deprecated',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
