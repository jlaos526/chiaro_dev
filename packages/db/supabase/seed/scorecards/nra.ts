import { readFile } from 'node:fs/promises'
import type { ScorecardAdapter } from './shared.ts'
import { parseBioguideScoreCSV } from './shared.ts'

export const nra: ScorecardAdapter = {
  slug: 'nra',
  name: 'NRA Political Victory Fund',
  issue_area: 'second-amendment',
  lean: 'single-issue',
  methodology_url: 'https://www.nrapvf.org/grades/methodology',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Letter grades (A-F) on Second Amendment positions, normalized to 0-100 (A=100, F=0).',

  async fetchRatings(_congress, opts) {
    if (!opts?.fixturePath) {
      throw new Error('NRA: live download not implemented yet; use fixturePath for slice 4.')
    }
    const csv = await readFile(opts.fixturePath, 'utf8')
    return parseBioguideScoreCSV(csv, (b) => `https://www.nrapvf.org/grades/${b.toLowerCase()}`)
  },
}
