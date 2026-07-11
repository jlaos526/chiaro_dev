import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const heritageAction: ScorecardAdapter = {
  slug: 'heritage-action',
  name: 'Heritage Action for America',
  issue_area: 'conservative-policy',
  lean: 'conservative',
  methodology_url: 'https://heritageaction.com/scorecard/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Conservative scorecard tracking alignment with limited-government and free-market votes.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error(
        'Heritage Action: live download not implemented yet; use fixturePath for slice 4.',
      )
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(
      csv,
      (b) => `https://heritageaction.com/scorecard/member/${b.toLowerCase()}`,
    )
  },
}
