import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const plannedParenthood: ScorecardAdapter = {
  slug: 'planned-parenthood',
  name: 'Planned Parenthood Action Fund',
  issue_area: 'reproductive-rights',
  lean: 'progressive',
  methodology_url: 'https://www.plannedparenthoodaction.org/elections/congressional-scorecard/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Planned Parenthood Action Fund congressional scorecard. Higher score = more reproductive-rights aligned.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('Planned Parenthood: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, b => `https://www.plannedparenthoodaction.org/scorecard/${b.toLowerCase()}`)
  },
}
