import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  ME: 'Maine',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  MA: 'Massachusetts',
  NY: 'New York',
}

export const plannedParenthood: StateScorecardAdapter = {
  slug: 'planned-parenthood',
  status: 'stub',
  name_template: (s) => `Planned Parenthood Action Fund ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'reproductive-rights',
  lean: 'progressive',
  methodology_url_template: (s) =>
    `https://plannedparenthoodaction.org/${s.toLowerCase()}/legislative-scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  notes:
    'Per-state PPAF affiliates publish advocacy scorecards. v1 coverage skews Northeast (research-derived).',
  covered_states: ['ME', 'NH', 'NJ', 'MA', 'NY'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
