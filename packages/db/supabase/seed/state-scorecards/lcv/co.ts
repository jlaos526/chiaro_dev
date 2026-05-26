import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedStateRating } from '../shared.ts'
import type { Chamber } from '../../shared/officials.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'
import { BROWSER_USER_AGENT, resolveOpenstatesPersonId } from './helpers.ts'

const FETCH_TIMEOUT_MS = 5000

export interface ParsedColoradoLcvRow {
  full_name: string
  party: string
  chamber: Chamber
  district: string
  score_numeric: number
}

const PARTY_DISTRICT_RE = /^([DRI])\s*-\s*(?:HD|SD)\s*(\d+)$/

/**
 * Parse a Colorado LCV /scorecards/<year>-scorecard/<chamber>/ table.
 * Caller passes chamber explicitly because the URL determines it, not
 * the table HTML.
 *
 * Column order (from fixture):
 *   0: Rep/Sen (link), 1: Party-District (e.g. "D - HD 23"),
 *   2: 2025 Score %, 3: Lifetime Score %
 */
export function parseColoradoLcvHtml(
  html: string,
  chamber: Chamber,
): ParsedColoradoLcvRow[] {
  const $ = cheerio.load(html)
  const out: ParsedColoradoLcvRow[] = []

  $('table.scorecard-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 4) return

    const full_name = $(cells[0]).text().trim()
    const partyDistrict = $(cells[1]).text().trim()
    const scoreText = $(cells[2]).text().trim()

    if (!full_name || !scoreText || scoreText === 'N/A') return

    const score_numeric = Number.parseInt(scoreText.replace(/%/g, ''), 10)
    if (!Number.isFinite(score_numeric)) return

    const m = partyDistrict.match(PARTY_DISTRICT_RE)
    if (!m) return
    const party = m[1]!
    const district = m[2]!

    out.push({ full_name, party, chamber, district, score_numeric })
  })

  return out
}

/**
 * Production fetcher: GET both chamber URLs (year templated from opts.session),
 * parse each, concatenate, resolve openstates_person_ids.
 */
export async function fetchColoradoRatings(
  client: Pick<Client, 'query'>,
  opts: {
    session: string
    fetcher?: (url: string) => Promise<string>
    onSkip?: (reason: SkipReason) => void
  },
): Promise<NormalizedStateRating[]> {
  const year = opts.session
  const houseUrl = `https://conservationco.org/scorecards/${year}-scorecard/${year}-house/`
  const senateUrl = `https://conservationco.org/scorecards/${year}-scorecard/${year}-senate/`

  const fetchOne = async (url: string, chamberLabel: string): Promise<string | null> => {
    try {
      if (opts.fetcher) return await opts.fetcher(url)
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': BROWSER_USER_AGENT },
      })
      if (!resp.ok) {
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'fetch',
          reason: `roster fetch returned non-2xx (CO ${chamberLabel})`,
          detail: `HTTP ${resp.status}`,
        })
        return null
      }
      return await resp.text()
    } catch (e) {
      opts.onSkip?.({
        adapter: 'lcv',
        stage: 'fetch',
        reason: `roster fetch threw (CO ${chamberLabel})`,
        detail: e instanceof Error ? e.message : String(e),
      })
      return null
    }
  }

  const out: NormalizedStateRating[] = []

  for (const [url, chamber, chamberLabel] of [
    [houseUrl, 'state_house' as Chamber, 'house'],
    [senateUrl, 'state_senate' as Chamber, 'senate'],
  ] as const) {
    const html = await fetchOne(url, chamberLabel)
    if (html == null) continue

    // Inline parse so we can surface per-row score-parse skips. Mirrors
    // parseColoradoLcvHtml shape but emits skips for the filtered rows.
    const $ = cheerio.load(html)
    const rowCells: { full_name: string; partyDistrict: string; scoreText: string }[] = []
    $('table.scorecard-table tbody tr').each((_, trEl) => {
      const cells = $(trEl).find('td')
      if (cells.length < 4) return
      rowCells.push({
        full_name: $(cells[0]).text().trim(),
        partyDistrict: $(cells[1]).text().trim(),
        scoreText: $(cells[2]).text().trim(),
      })
    })

    for (const cell of rowCells) {
      const { full_name, partyDistrict, scoreText } = cell

      if (!full_name) continue
      if (!scoreText || scoreText === 'N/A') {
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'parse',
          legislator: full_name,
          reason: `missing or N/A score (CO ${chamberLabel})`,
        })
        continue
      }

      const score_numeric = Number.parseInt(scoreText.replace(/%/g, ''), 10)
      if (!Number.isFinite(score_numeric)) {
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'parse',
          legislator: full_name,
          reason: `score parse failed (CO ${chamberLabel}): "${scoreText}"`,
        })
        continue
      }

      const m = partyDistrict.match(PARTY_DISTRICT_RE)
      if (!m) {
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'parse',
          legislator: full_name,
          reason: `party-district parse failed (CO ${chamberLabel}): "${partyDistrict}"`,
        })
        continue
      }

      const openstatesPersonId = await resolveOpenstatesPersonId(client, {
        full_name,
        state: 'CO',
        chamber,
      })
      if (!openstatesPersonId) {
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'resolve',
          legislator: full_name,
          reason: `unmatched in officials table (CO, ${chamber})`,
        })
        continue
      }
      out.push({
        openstates_person_id: openstatesPersonId,
        state: 'CO',
        score: score_numeric,
        source_url: url,
      })
    }
  }

  return out
}
