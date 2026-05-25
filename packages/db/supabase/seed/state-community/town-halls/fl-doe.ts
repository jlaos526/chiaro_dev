import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * FL does not publish an aggregated member town-hall feed. flsenate.gov
 * calendar shows institutional sessions only; the House lacks even a
 * calendar UI.
 *
 * Mobilize.us (slice 7 nationwide adapter) covers FL state-legislator
 * town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const flDoeTownHalls: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'fl-doe',
  component: 'halls',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
