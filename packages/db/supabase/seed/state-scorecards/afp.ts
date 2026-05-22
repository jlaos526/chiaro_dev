import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  FL: 'Florida', SC: 'South Carolina', MS: 'Mississippi',
  PA: 'Pennsylvania', IN: 'Indiana',
}

export const afp: StateScorecardAdapter = {
  slug: 'afp',
  name_template: (s) => `Americans for Prosperity ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'conservative-policy',
  lean: 'conservative',
  methodology_url_template: (s) => `https://americansforprosperity.org/${s.toLowerCase()}/legislative-scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'AFP state chapters publish legislative scorecards. v1 coverage skews Southern/Midwestern (research-derived: chapter-exists != scorecard-published).',
  covered_states: ['FL', 'SC', 'MS', 'PA', 'IN'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
