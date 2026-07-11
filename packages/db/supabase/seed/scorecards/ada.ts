import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const ada: ScorecardAdapter = {
  slug: 'ada',
  name: 'Americans for Democratic Action',
  issue_area: 'liberal-policy',
  lean: 'progressive',
  methodology_url: 'https://adaction.org/voting-records/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Annual Liberal Quotient (LQ) measuring liberal voting alignment across 20 key votes.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('ADA: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, (b) => `https://adaction.org/scorecard/${b.toLowerCase()}`)
  },
}
