import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', TX: 'Texas', MI: 'Michigan',
  IL: 'Illinois',   MA: 'Massachusetts',
}

export const aclu: StateScorecardAdapter = {
  slug: 'aclu',
  name_template: (s) => `ACLU of ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'civil-liberties',
  lean: 'progressive',
  methodology_url_template: (s) => `https://www.aclu${s.toLowerCase()}.org/legislative-scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Per-state ACLU chapters publish independently. Methodology varies.',
  covered_states: ['CA', 'NY', 'TX', 'MI', 'IL', 'MA'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
