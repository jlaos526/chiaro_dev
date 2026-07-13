import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * MI does not publish an aggregated member town-hall feed.
 * Senator-by-senator coffee-hour pages exist on senate.michigan.gov +
 * house.mi.gov but with no central index.
 *
 * Mobilize.us (slice 7 nationwide adapter) covers MI state-legislator
 * town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const miLegislatureTownHalls: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'mi-legislature',
  component: 'halls',
  status: 'deprecated',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
