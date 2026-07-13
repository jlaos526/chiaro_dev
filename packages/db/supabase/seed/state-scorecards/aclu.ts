import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

/**
 * @deprecated 2026-05-23 (slice 11 discovery audit)
 *
 * ACLU state chapters publish bill-position trackers (e.g.
 * aclum.org/en/legislation), NOT legislator scorecards. The
 * per-state-affiliate URL template assumed by slice 5G does not
 * match the published data shape.
 *
 * Future direction (NOT in slice 11): repurpose to ingest ACLU bill
 * positions and cross-correlate with state_votes via the slice 5G
 * `useOfficialStateVotesOnSubject` pattern to derive inferred per-
 * legislator alignment scores.
 *
 * See `docs/superpowers/audits/2026-05-23-scorecard-discovery.md` for
 * the audit + Gotcha #20 in CLAUDE.md for the durable lesson.
 *
 * Adapter retained for back-compat with state_scorecard_orgs table
 * (slug 'aclu' may already have DB rows from slice 5G/8 seeds).
 * Empty covered_states means orchestrator iteration is a no-op.
 */
export const aclu: StateScorecardAdapter = {
  slug: 'aclu',
  status: 'deprecated',
  name_template: (s) => `ACLU of ${s}`,
  issue_area: 'civil-liberties',
  lean: 'progressive',
  methodology_url_template: () => 'https://www.aclu.org',
  scoring_min: 0,
  scoring_max: 100,
  notes:
    'DEPRECATED 2026-05-23 — ACLU chapters publish bill-position trackers, ' +
    'not legislator scorecards. See @deprecated JSDoc + audit doc.',
  covered_states: [],

  async fetchRatings(): Promise<NormalizedStateRating[]> {
    return []
  },
}
