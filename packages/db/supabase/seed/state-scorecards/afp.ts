import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

/**
 * @deprecated 2026-05-23 (slice 11 discovery audit)
 *
 * Americans for Prosperity publishes only ONE consolidated
 * `americansforprosperity.org/national-scorecard` page (federal scope).
 * AFP state chapter homepages exist but contain no per-state
 * legislative scorecards — the slice 5G assumption of 5 per-state
 * adapters has no data source.
 *
 * Future direction (NOT in slice 11): repoint adapter at the
 * national scorecard for federal-tier ingest. Cross-cuts with slice 8
 * (federal_scorecard_ratings table) if/when added. State-tier coverage
 * is permanently unviable for AFP unless they change publishing strategy.
 *
 * See `docs/superpowers/audits/2026-05-23-scorecard-discovery.md` for
 * the audit + Gotcha #20 in CLAUDE.md for the durable lesson.
 */
export const afp: StateScorecardAdapter = {
  slug: 'afp',
  name_template: (s) => `Americans for Prosperity ${s}`,
  issue_area: 'conservative-policy',
  lean: 'conservative',
  methodology_url_template: () => 'https://americansforprosperity.org/national-scorecard',
  scoring_min: 0,
  scoring_max: 100,
  notes:
    'DEPRECATED 2026-05-23 — AFP publishes only a federal national scorecard. ' +
    'State-chapter scorecards do not exist. See @deprecated JSDoc + audit doc.',
  covered_states: [],

  async fetchRatings(): Promise<NormalizedStateRating[]> {
    return []
  },
}
