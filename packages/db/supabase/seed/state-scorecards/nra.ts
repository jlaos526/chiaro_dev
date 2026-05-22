import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', FL: 'Florida', TX: 'Texas',
  MI: 'Michigan',   WI: 'Wisconsin',
}

/**
 * NRA-PVF grades use letters A-F. Adapter normalizes to numeric on the
 * write side; UI reverse-maps for display via `numericToLetterGrade()`.
 */
export function letterToNumeric(letter: string): number | null {
  const normalized = letter.trim().toUpperCase()
  const map: Record<string, number> = {
    'A+': 100, 'A': 100, 'A-': 92,
    'B+':  85, 'B':  80, 'B-': 72,
    'C+':  65, 'C':  60, 'C-': 52,
    'D+':  45, 'D':  40, 'D-': 32,
    'F':   20,
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

export const nra: StateScorecardAdapter = {
  slug: 'nra',
  name_template: (s) => `NRA-PVF (${US_STATE_NAMES[s] ?? s})`,
  issue_area: 'second-amendment',
  lean: 'conservative',
  methodology_url_template: () => 'https://www.nrapvf.org/grades/',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'NRA-PVF grades letters A-F (mapped to 0-100; A=100, F=20). UI reverse-maps for display.',
  covered_states: ['CA', 'NY', 'FL', 'TX', 'MI', 'WI'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
