import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', MI: 'Michigan',
  CO: 'Colorado',   OR: 'Oregon',
}

export const lcv: StateScorecardAdapter = {
  slug: 'lcv',
  name_template: (s) => `League of Conservation Voters ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'environment',
  lean: 'progressive',
  methodology_url_template: (s) => `https://www.lcv.org/scorecard/${s.toLowerCase()}-state`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'LCV state affiliates publish annual environmental scorecards.',
  covered_states: ['CA', 'NY', 'MI', 'CO', 'OR'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
