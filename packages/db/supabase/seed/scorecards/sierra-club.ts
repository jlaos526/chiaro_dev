import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const sierraClub: ScorecardAdapter = {
  slug: 'sierra-club',
  name: 'Sierra Club',
  issue_area: 'environment',
  lean: 'progressive',
  methodology_url: 'https://www.sierraclub.org/political/scorecard/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Sierra Club congressional scorecard. Higher score = more environmentally aligned.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error(
        'Sierra Club: live download not implemented yet; use fixturePath for slice 4.',
      )
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, (b) => `https://www.sierraclub.org/political/scorecard/${b}`)
  },
}
