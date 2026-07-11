import type { Client } from 'pg'
import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'
import { STATE_2_TO_NAME, inferChamberFromNraTable, parseNraGradesHtml } from './nra-helpers.ts'
import type { Chamber } from '../shared/officials.ts'
import type { SkipReason } from '../shared/instrumentation.ts'

const ALL_STATES = Object.keys(STATE_2_TO_NAME)

const FETCH_TIMEOUT_MS = 5000

// Generated from STATE_2_TO_NAME so name_template covers all 50 states.
// CA → 'California', NY → 'New York', NC → 'North Carolina', etc.
const US_STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_2_TO_NAME).map(([code, slug]) => [
    code,
    slug
      .split('-')
      .map((s) => s[0]!.toUpperCase() + s.slice(1))
      .join(' '),
  ]),
)

/**
 * NRA-PVF grades use letters A-F. Adapter normalizes to numeric on the
 * write side; UI reverse-maps for display via `numericToLetterGrade()`.
 */
export function letterToNumeric(letter: string): number | null {
  const normalized = letter.trim().toUpperCase()
  const map: Record<string, number> = {
    'A+': 100,
    A: 100,
    'A-': 92,
    'B+': 85,
    B: 80,
    'B-': 72,
    'C+': 65,
    C: 60,
    'C-': 52,
    'D+': 45,
    D: 40,
    'D-': 32,
    F: 20,
  }
  return normalized in map ? map[normalized]! : null
}

export function numericToLetterGrade(score: number): string {
  if (score >= 95) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 65) return 'C+'
  if (score >= 55) return 'C'
  if (score >= 45) return 'D+'
  if (score >= 35) return 'D'
  return 'F'
}

/**
 * Resolve full_name + state + chamber → openstates_person_id.
 *
 * The orchestrator (state-scorecards-ingest.ts) keys ratings off
 * openstates_person_id (not officials.id), so the production fetcher
 * resolves directly to that. Returns null if no match (including officials
 * with NULL openstates_person_id — e.g. federal officials).
 */
async function resolveOpenstatesPersonId(
  client: Pick<Client, 'query'>,
  opts: { full_name: string; state: string; chamber: Chamber },
): Promise<string | null> {
  const res = await client.query<{ openstates_person_id: string | null }>(
    `select openstates_person_id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  const row = res.rows[0]
  if (!row || !row.openstates_person_id) return null
  return row.openstates_person_id
}

/**
 * Production fetcher: GET nrapvf.org/grades/<state-name>/ for one state.
 * Returns NormalizedStateRating[] for legislators successfully resolved
 * to an openstates_person_id.
 *
 * Exported for tests + per-state surgical re-runs.
 */
export async function fetchNraRatingsForState(
  state: string,
  client: Pick<Client, 'query'>,
  fetcher?: (state: string) => Promise<string>,
  onSkip?: (reason: SkipReason) => void,
): Promise<NormalizedStateRating[]> {
  const stateName = STATE_2_TO_NAME[state]
  if (!stateName) return []

  const sourceUrl = `https://www.nrapvf.org/grades/${stateName}/`
  let html: string
  try {
    if (fetcher) {
      html = await fetcher(state)
    } else {
      const resp = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!resp.ok) {
        onSkip?.({
          adapter: 'nra',
          stage: 'fetch',
          reason: `grades page fetch returned non-2xx (${state})`,
          detail: `HTTP ${resp.status}`,
        })
        return []
      }
      html = await resp.text()
    }
  } catch (e) {
    onSkip?.({
      adapter: 'nra',
      stage: 'fetch',
      reason: `grades page fetch threw (${state}, Cloudflare gate?)`,
      detail: e instanceof Error ? e.message : String(e),
    })
    return []
  }

  const rows = parseNraGradesHtml(html)
  const out: NormalizedStateRating[] = []

  for (const row of rows) {
    const chamber = inferChamberFromNraTable(row.chamberLabel)
    if (!chamber) {
      onSkip?.({
        adapter: 'nra',
        stage: 'filter',
        legislator: row.name,
        reason: `unknown chamber label (${state}): "${row.chamberLabel}"`,
      })
      continue
    }

    const numeric = letterToNumeric(row.letterGrade)
    if (numeric == null) {
      onSkip?.({
        adapter: 'nra',
        stage: 'parse',
        legislator: row.name,
        reason: `letter-grade parse failed (${state}): "${row.letterGrade}"`,
      })
      continue // skips AQ, blank, unknown
    }

    const openstatesPersonId = await resolveOpenstatesPersonId(client, {
      full_name: row.name,
      state,
      chamber,
    })
    if (!openstatesPersonId) {
      onSkip?.({
        adapter: 'nra',
        stage: 'resolve',
        legislator: row.name,
        reason: `unmatched in officials table (${state}, ${chamber})`,
      })
      continue
    }

    out.push({
      openstates_person_id: openstatesPersonId,
      state,
      score: numeric,
      source_url: sourceUrl,
    })
  }

  return out
}

export const nra: StateScorecardAdapter = {
  slug: 'nra',
  name_template: (s) => `NRA-PVF (${US_STATE_NAMES[s] ?? s})`,
  issue_area: 'second-amendment',
  lean: 'conservative',
  methodology_url_template: () => 'https://www.nrapvf.org/grades/',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'NRA-PVF grades letters A-F (mapped to 0-100; A=100, F=20). UI reverse-maps for display.',
  covered_states: ALL_STATES, // expanded from 6 → 50 in slice 9

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    // Production path: fetch each state (or single state if opts.state set)
    const targetStates = opts.state ? [opts.state] : ALL_STATES
    const allRatings: NormalizedStateRating[] = []
    for (const st of targetStates) {
      const ratings = await fetchNraRatingsForState(st, opts.client, undefined, opts.onSkip)
      allRatings.push(...ratings)
    }
    return allRatings
  },
}
