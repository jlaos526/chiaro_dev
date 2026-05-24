import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedStateRating } from '../shared.ts'
import type { Chamber } from '../../shared/officials.ts'
import { BROWSER_USER_AGENT, resolveOpenstatesPersonId } from './helpers.ts'

const FETCH_TIMEOUT_MS = 5000
const SOURCE_URL = 'https://www.michiganlcv.org/lawmakers/'

export interface ParsedMichiganLcvRow {
  full_name: string
  party: string
  chamber: Chamber
  district: string
  score_numeric: number
}

/**
 * Parse the michiganlcv.org/lawmakers/ table. Returns one row per legislator
 * with a non-empty 2025-2026 score.
 *
 * Table column order (from fixture):
 *   0: Name (link), 1: Party, 2: Lifetime Score, 3: Chamber,
 *   4: District, 5: Corp Utility Donations, 6: 2025-2026 Score
 */
export function parseMichiganLcvHtml(html: string): ParsedMichiganLcvRow[] {
  const $ = cheerio.load(html)
  const out: ParsedMichiganLcvRow[] = []

  $('table.lawmaker-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 7) return

    const full_name = $(cells[0]).text().trim()
    const party = $(cells[1]).text().trim()
    const chamberLabel = $(cells[3]).text().trim()
    const district = $(cells[4]).text().trim()
    const scoreText = $(cells[6]).text().trim()

    if (!full_name || !scoreText) return

    const score_numeric = Number.parseInt(scoreText.replace(/%/g, ''), 10)
    if (!Number.isFinite(score_numeric)) return

    const chamber: Chamber | null =
      chamberLabel === 'House' ? 'state_house'
      : chamberLabel === 'Senate' ? 'state_senate'
      : null
    if (!chamber) return

    out.push({ full_name, party, chamber, district, score_numeric })
  })

  return out
}

/**
 * Production fetcher: GET michiganlcv.org/lawmakers/, parse, resolve to
 * openstates_person_id, return ratings. Exported for test injection via
 * opts.fetcher.
 */
export async function fetchMichiganRatings(
  client: Pick<Client, 'query'>,
  opts: { session: string; fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedStateRating[]> {
  let html: string
  try {
    if (opts.fetcher) {
      html = await opts.fetcher(SOURCE_URL)
    } else {
      const resp = await fetch(SOURCE_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': BROWSER_USER_AGENT },
      })
      if (!resp.ok) return []
      html = await resp.text()
    }
  } catch {
    return []
  }

  const rows = parseMichiganLcvHtml(html)
  const out: NormalizedStateRating[] = []

  for (const row of rows) {
    const openstatesPersonId = await resolveOpenstatesPersonId(client, {
      full_name: row.full_name,
      state: 'MI',
      chamber: row.chamber,
    })
    if (!openstatesPersonId) continue
    out.push({
      openstates_person_id: openstatesPersonId,
      state: 'MI',
      score: row.score_numeric,
      source_url: SOURCE_URL,
    })
  }

  return out
}
