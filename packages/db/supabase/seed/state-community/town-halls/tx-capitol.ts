import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * Member calendars are not a feature of the Texas Capitol site;
 * capitol.texas.gov also has fragile uptime (slice 8/9/11 precedent —
 * 503/ECONNREFUSED during slice 12 audit window).
 *
 * Mobilize.us (slice 7 nationwide adapter) covers TX state-legislator
 * town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const txCapitolTownHalls: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'tx-capitol',
  component: 'halls',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
