import * as cheerio from 'cheerio'
import type { Chamber } from '../shared/officials.ts'

export const STATE_2_TO_NAME: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas',
  CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware',
  FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho',
  IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas',
  KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada',
  NH: 'new-hampshire', NJ: 'new-jersey', NM: 'new-mexico', NY: 'new-york',
  NC: 'north-carolina', ND: 'north-dakota', OH: 'ohio', OK: 'oklahoma',
  OR: 'oregon', PA: 'pennsylvania', RI: 'rhode-island', SC: 'south-carolina',
  SD: 'south-dakota', TN: 'tennessee', TX: 'texas', UT: 'utah',
  VT: 'vermont', VA: 'virginia', WA: 'washington', WV: 'west-virginia',
  WI: 'wisconsin', WY: 'wyoming',
}

export const STATE_NAME_TO_2: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_2_TO_NAME).map(([code, name]) => [name, code])
)

export function inferChamberFromNraTable(label: string): Chamber | null {
  // Order: federal-senate match must NOT collide with state-senate (state prefix gates it).
  if (/\bState\s+Senate\b/i.test(label)) return 'state_senate'
  if (/\bState\s+(House|Assembly)/i.test(label)) return 'state_house'
  if (/^U\.S\.?\s+Senate$|^Senate$/i.test(label.trim())) return 'federal_senate'
  if (/U\.S\.?\s+House\s+of\s+Representatives|^House\s+of\s+Representatives$/i.test(label.trim())) {
    return 'federal_house'
  }
  return null
}

export interface ParsedNraRow {
  name: string
  chamberLabel: string
  letterGrade: string
}

/**
 * Parse NRA-PVF /grades/<state>/ HTML. Returns one row per graded legislator.
 *
 * Assumes structure: <h2>{chamber label}</h2> followed by <table> of legislators.
 * Each <tr> has 2 cells: name (in <a> or text) + grade.
 * Skips rows with blank grade (legislator listed but ungraded).
 */
export function parseNraGradesHtml(html: string): ParsedNraRow[] {
  const $ = cheerio.load(html)
  const rows: ParsedNraRow[] = []

  // Walk the document; each h2 starts a chamber section followed by a table.
  $('h2').each((_, h2El) => {
    const chamberLabel = $(h2El).text().trim()
    // Find next <table> sibling (skipping non-table nodes)
    let next = $(h2El).next()
    while (next.length > 0 && !next.is('table')) {
      next = next.next()
    }
    if (next.length === 0) return

    next.find('tr').each((_, trEl) => {
      const cells = $(trEl).find('td')
      if (cells.length < 2) return
      const name = $(cells[0]).text().trim()
      const grade = $(cells[1]).text().trim()
      if (!name || !grade) return
      rows.push({ name, chamberLabel, letterGrade: grade })
    })
  })

  return rows
}
