import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const aclu: ScorecardAdapter = {
  slug: 'aclu',
  name: 'American Civil Liberties Union',
  issue_area: 'civil-liberties',
  lean: 'progressive',
  methodology_url: 'https://www.aclu.org/legislative-scorecard/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'ACLU legislative scorecard. Higher score = more civil-liberties aligned.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('ACLU: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, (b) => `https://www.aclu.org/scorecard/${b.toLowerCase()}`)
  },
}
