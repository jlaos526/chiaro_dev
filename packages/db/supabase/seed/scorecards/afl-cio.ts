import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const aflCio: ScorecardAdapter = {
  slug: 'afl-cio',
  name: 'AFL-CIO',
  issue_area: 'labor',
  lean: 'single-issue',
  methodology_url: 'https://aflcio.org/scorecard/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Labor scorecard ranking members on votes affecting working families and unions.',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('AFL-CIO: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, b => `https://aflcio.org/scorecard/${b.toLowerCase()}`)
  },
}
