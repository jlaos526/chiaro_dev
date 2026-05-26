import type { Client } from 'pg'
import type { StateScorecardAdapter, NormalizedStateRating } from '../shared.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'
import { fetchMichiganRatings } from './mi.ts'
import { fetchColoradoRatings } from './co.ts'

const US_STATE_NAMES: Record<string, string> = {
  MI: 'Michigan', CO: 'Colorado',
}

type LcvFetcher = (
  client: Pick<Client, 'query'>,
  opts: { session: string; onSkip?: (reason: SkipReason) => void },
) => Promise<NormalizedStateRating[]>

const PRODUCTION_FETCHERS: Record<string, LcvFetcher> = {
  MI: fetchMichiganRatings,
  CO: fetchColoradoRatings,
}

export const lcv: StateScorecardAdapter = {
  slug: 'lcv',
  name_template: (s) => `League of Conservation Voters ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'environment',
  lean: 'progressive',
  methodology_url_template: (s) =>
    s === 'MI' ? 'https://www.michiganlcv.org/lawmakers/'
    : s === 'CO' ? 'https://conservationco.org/scorecards/'
    : 'https://www.lcv.org',
  scoring_min: 0,
  scoring_max: 100,
  notes:
    'LCV state affiliates. Coverage limited to states with parseable HTML rosters ' +
    '(audit: docs/superpowers/audits/2026-05-23-scorecard-discovery.md).',
  covered_states: ['MI', 'CO'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const injected = (opts as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (injected) return injected()
    const targetStates = opts.state ? [opts.state] : this.covered_states
    const subOpts: { session: string; onSkip?: (reason: SkipReason) => void } = {
      session: opts.session,
      ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
    }
    const out: NormalizedStateRating[] = []
    for (const state of targetStates) {
      const handler = PRODUCTION_FETCHERS[state]
      if (!handler) continue
      const ratings = await handler(opts.client, subOpts)
      out.push(...ratings)
    }
    return out
  },
}
