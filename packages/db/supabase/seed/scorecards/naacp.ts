import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const naacp: ScorecardAdapter = {
  slug: 'naacp',
  name: 'NAACP',
  issue_area: 'civil-rights',
  lean: 'progressive',
  methodology_url: 'https://naacp.org/legislative-report-card/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'NAACP legislative report card. Higher score = more civil-rights aligned.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('NAACP: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, (b) => `https://naacp.org/scorecard/${b.toLowerCase()}`)
  },
}
