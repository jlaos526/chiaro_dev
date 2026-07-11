import type { Client } from 'pg'
import type { SkipReason } from '../shared/instrumentation.ts'

export type ScorecardLean =
  | 'progressive'
  | 'conservative'
  | 'libertarian'
  | 'single-issue'
  | 'centrist'

export interface NormalizedStateRating {
  openstates_person_id: string
  state: string
  score: number
  source_url: string
}

export interface StateScorecardAdapter {
  slug: string
  name_template: (state: string) => string
  issue_area: string
  lean: ScorecardLean
  methodology_url_template: (state: string) => string
  scoring_min: number
  scoring_max: number
  notes?: string
  covered_states: string[]
  fetchRatings(opts: {
    client: Client
    session: string
    state?: string
    fetcher?: () => Promise<NormalizedStateRating[]> // test injection
    onSkip?: (reason: SkipReason) => void
  }): Promise<NormalizedStateRating[]>
}

export interface StateScorecardStats {
  org_slug: string
  orgsUpserted: number
  ratingsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/**
 * UPSERT the per-state state_scorecard_orgs row for this adapter × state.
 * Returns the org id.
 */
export async function upsertStateScorecardOrg(
  client: Client,
  adapter: StateScorecardAdapter,
  state: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
    insert into public.state_scorecard_orgs (
      slug, state, name, issue_area, lean,
      methodology_url, scoring_min, scoring_max, notes
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (slug, state) do update set
      name            = excluded.name,
      issue_area      = excluded.issue_area,
      lean            = excluded.lean,
      methodology_url = excluded.methodology_url,
      scoring_min     = excluded.scoring_min,
      scoring_max     = excluded.scoring_max,
      notes           = excluded.notes
    returning id
  `,
    [
      adapter.slug,
      state,
      adapter.name_template(state),
      adapter.issue_area,
      adapter.lean,
      adapter.methodology_url_template(state),
      adapter.scoring_min,
      adapter.scoring_max,
      adapter.notes ?? null,
    ],
  )
  return result.rows[0]!.id
}

/**
 * UPSERT a single rating row by (scorecard_id, official_id, session).
 * Returns true if rating was inserted/updated; false if the official is
 * unknown (caller appends openstates_person_id to officialsUnmatched).
 */
export async function upsertStateScorecardRating(
  client: Client,
  scorecardId: string,
  openstates_person_id: string,
  session: string,
  score: number,
  source_url: string,
): Promise<boolean> {
  const off = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [openstates_person_id],
  )
  if (off.rowCount === 0) return false

  await client.query(
    `
    insert into public.state_scorecard_ratings (
      scorecard_id, official_id, session, score, source_url
    ) values ($1, $2, $3, $4, $5)
    on conflict (scorecard_id, official_id, session) do update set
      score       = excluded.score,
      source_url  = excluded.source_url,
      ingested_at = now()
  `,
    [scorecardId, off.rows[0]!.id, session, score, source_url],
  )
  return true
}
