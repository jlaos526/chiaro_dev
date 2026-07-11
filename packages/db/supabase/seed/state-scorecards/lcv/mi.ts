import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedStateRating } from '../shared.ts'
import type { Chamber } from '../../shared/officials.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'
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
      chamberLabel === 'House' ? 'state_house' : chamberLabel === 'Senate' ? 'state_senate' : null
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
  opts: {
    session: string
    fetcher?: (url: string) => Promise<string>
    onSkip?: (reason: SkipReason) => void
  },
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
      if (!resp.ok) {
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'fetch',
          reason: `roster fetch returned non-2xx (MI)`,
          detail: `HTTP ${resp.status}`,
        })
        return []
      }
      html = await resp.text()
    }
  } catch (e) {
    opts.onSkip?.({
      adapter: 'lcv',
      stage: 'fetch',
      reason: 'roster fetch threw (MI)',
      detail: e instanceof Error ? e.message : String(e),
    })
    return []
  }

  // Inline parse so we can surface per-row score-parse skips. Mirrors
  // parseMichiganLcvHtml shape but emits skips for the filtered rows.
  const $ = cheerio.load(html)
  const out: NormalizedStateRating[] = []

  const cellTexts: {
    full_name: string
    party: string
    chamberLabel: string
    district: string
    scoreText: string
  }[] = []
  $('table.lawmaker-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 7) return
    cellTexts.push({
      full_name: $(cells[0]).text().trim(),
      party: $(cells[1]).text().trim(),
      chamberLabel: $(cells[3]).text().trim(),
      district: $(cells[4]).text().trim(),
      scoreText: $(cells[6]).text().trim(),
    })
  })

  for (const cell of cellTexts) {
    const { full_name, chamberLabel, scoreText } = cell

    if (!full_name) continue
    if (!scoreText) {
      opts.onSkip?.({
        adapter: 'lcv',
        stage: 'parse',
        legislator: full_name,
        reason: 'empty 2025-2026 score cell (MI)',
      })
      continue
    }

    const score_numeric = Number.parseInt(scoreText.replace(/%/g, ''), 10)
    if (!Number.isFinite(score_numeric)) {
      opts.onSkip?.({
        adapter: 'lcv',
        stage: 'parse',
        legislator: full_name,
        reason: `score parse failed (MI): "${scoreText}"`,
      })
      continue
    }

    const chamber: Chamber | null =
      chamberLabel === 'House' ? 'state_house' : chamberLabel === 'Senate' ? 'state_senate' : null
    if (!chamber) {
      opts.onSkip?.({
        adapter: 'lcv',
        stage: 'parse',
        legislator: full_name,
        reason: `unknown chamber label (MI): "${chamberLabel}"`,
      })
      continue
    }

    const openstatesPersonId = await resolveOpenstatesPersonId(client, {
      full_name,
      state: 'MI',
      chamber,
      onAmbiguous: () =>
        opts.onSkip?.({
          adapter: 'lcv',
          stage: 'resolve_ambiguous',
          legislator: full_name,
          reason: 'ambiguous full_name match (2+ in-office officials)',
        }),
    })
    if (!openstatesPersonId) {
      opts.onSkip?.({
        adapter: 'lcv',
        stage: 'resolve',
        legislator: full_name,
        reason: `unmatched in officials table (MI, ${chamber})`,
      })
      continue
    }
    out.push({
      openstates_person_id: openstatesPersonId,
      state: 'MI',
      score: score_numeric,
      source_url: SOURCE_URL,
    })
  }

  return out
}
