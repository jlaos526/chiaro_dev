import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const usChamber: ScorecardAdapter = {
  slug: 'us-chamber',
  name: 'U.S. Chamber of Commerce',
  issue_area: 'business-policy',
  lean: 'conservative',
  methodology_url: 'https://www.uschamber.com/scorecard/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'How Congress Voted scorecard tracking pro-business / free-enterprise positions.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('US Chamber: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, b => `https://www.uschamber.com/scorecard/${b.toLowerCase()}`)
  },
}
