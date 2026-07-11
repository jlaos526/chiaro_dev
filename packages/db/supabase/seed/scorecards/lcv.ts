import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const lcv: ScorecardAdapter = {
  slug: 'lcv',
  name: 'League of Conservation Voters',
  issue_area: 'environment',
  lean: 'progressive',
  methodology_url: 'https://scorecard.lcv.org/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Annual National Environmental Scorecard. Higher score = more environmentally aligned.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('LCV: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, (b) => `https://scorecard.lcv.org/moc/${b.toLowerCase()}`)
  },
}
