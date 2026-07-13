import { fetchWithRetry as sharedFetchWithRetry } from '../shared/http.ts'

export interface NormalizedRating {
  bioguideId: string
  score: number
  source_url: string
}

export interface ScorecardAdapter {
  slug: string
  name: string
  issue_area: string
  lean: 'progressive' | 'conservative' | 'libertarian' | 'single-issue' | 'centrist'
  methodology_url: string
  scoring_min: number
  scoring_max: number
  notes?: string
  fetchRatings(congress: string, opts?: { fixturePath?: string }): Promise<NormalizedRating[]>
}

/**
 * Since slice 81 (audit C36) a thin wrapper around the canonical
 * `seed/shared/http.ts` fetchWithRetry (name/signature kept for
 * back-compat; `retries` = TOTAL attempts, matching the old loop). Only
 * ok responses are returned; any non-ok outcome throws `<url>: <status>`
 * as before. Observable deltas (no current callers — the 10 scorecard
 * adapters read committed CSV fixtures): non-429 4xx no longer burns the
 * remaining retry attempts before throwing, 5xx exhaustion throws
 * `<url>: <status>` instead of the old `Unreachable: <url>`, and each
 * attempt now has a 15s timeout (was unbounded).
 */
export async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  retries = 3,
): Promise<Response> {
  const res = await sharedFetchWithRetry(url, {
    retries: Math.max(0, retries - 1),
    backoffMs: 1000,
    init: opts,
  })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res
}

// Shared CSV parser: header = first line, expected columns `bioguide,score`.
// Adapters can re-use to keep DRY; or roll their own when the CSV shape differs.
export function parseBioguideScoreCSV(
  csv: string,
  sourceUrlForBioguide: (b: string) => string,
): NormalizedRating[] {
  const lines = csv.trim().split(/\r?\n/).slice(1)
  const out: NormalizedRating[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [bioguide, score] = trimmed.split(',').map((s) => s.trim())
    if (!bioguide || !score) continue
    const n = Number(score)
    if (!Number.isFinite(n)) continue
    out.push({ bioguideId: bioguide, score: n, source_url: sourceUrlForBioguide(bioguide) })
  }
  return out
}
