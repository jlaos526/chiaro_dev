import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const SOURCE_URL = 'https://www.nysenate.gov/events?event-type=town_hall'
const FETCH_TIMEOUT_MS = 5000

/**
 * Derive a stable external_id from an event detail URL (audit C33 vector c).
 * Strip trailing slashes first, then take the last path segment; a detail URL
 * ending in '/' would otherwise yield '' from split('/').pop(), causing the
 * old conditional-spread to OMIT external_id — and NULL external_ids are
 * distinct per Postgres, so every re-ingest inserts a fresh duplicate
 * (Gotcha #13). When the segment is still empty (URL was all slashes) fall
 * back to a deterministic sha1 hash. external_id is NEVER omitted for a row
 * that has a source URL.
 */
export function deriveExternalId(url: string): string {
  const slug = url.replace(/\/+$/, '').split('/').pop() ?? ''
  if (slug) return slug
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 12)
  return `ny-senate-urlhash-${hash}`
}

export interface ParsedNysenateEvent {
  full_name: string         // senator name from byline
  event_date: string        // YYYY-MM-DD
  city?: string             // city extracted from location text (last comma-separated segment before state)
  format: 'in_person' | 'virtual' | 'hybrid'
  detail_url: string        // absolute URL to event detail page
}

/**
 * Parse the nysenate.gov/events filtered town-hall list.
 *
 * Skips rows missing essential fields (no <time> / no byline / no title).
 * Audit-derived structure: <article class="event-card"> with event-link,
 * byline (senator name), <time datetime>, location, format.
 */
export function parseNysenateEventsHtml(html: string): ParsedNysenateEvent[] {
  const $ = cheerio.load(html)
  const out: ParsedNysenateEvent[] = []

  $('article.event-card').each((_, el) => {
    const anchor = $(el).find('a.event-link').first()
    const detailHref = anchor.attr('href') ?? ''
    const title = anchor.find('h3').text().trim()

    const byline = $(el).find('p.byline').text().trim()
    const senatorMatch = byline.match(/Senator\s+(.+?)\s*$/)
    const full_name = senatorMatch ? senatorMatch[1]!.trim() : ''

    const timeEl = $(el).find('time').first()
    const datetime = timeEl.attr('datetime') ?? ''
    const event_date = datetime.split('T')[0] ?? ''

    if (!full_name || !event_date || !title) return  // skip malformed

    const locationText = $(el).find('p.location').text().trim()
    const city = locationText
      ? extractCityFromLocation(locationText)
      : undefined

    const formatText = $(el).find('p.format').text().trim().toLowerCase()
    const format: 'in_person' | 'virtual' | 'hybrid' =
      /hybrid/.test(formatText) ? 'hybrid'
      : /virtual/.test(formatText) ? 'virtual'
      : 'in_person'

    const detail_url = detailHref.startsWith('http')
      ? detailHref
      : `https://www.nysenate.gov${detailHref}`

    out.push({ full_name, event_date, ...(city ? { city } : {}), format, detail_url })
  })

  return out
}

/**
 * Extract city from a location string like "Albany Community Center, Albany, NY".
 * Best-effort: split on commas, look for a segment between venue and state code.
 *
 * Heuristic: if 3+ segments, city is segment[-2]; if 2 segments, city is
 * segment[0]; otherwise undefined.
 */
function extractCityFromLocation(text: string): string | undefined {
  const segments = text.split(',').map(s => s.trim()).filter(Boolean)
  if (segments.length === 0) return undefined
  // Drop final state-abbrev segment if present (e.g. "NY")
  const lastIsStateCode = segments[segments.length - 1]!.length === 2
  const candidates = lastIsStateCode ? segments.slice(0, -1) : segments
  if (candidates.length === 0) return undefined
  // Single-segment input without a trailing state code is a venue-only string
  // (e.g. "Online via Zoom") — don't write that into city.
  if (candidates.length < 2 && !lastIsStateCode) return undefined
  return candidates[candidates.length - 1]
}

export const nySenateTownHalls: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'ny-senate',
  component: 'halls',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedTownHall[]> {
    // Adapter-level fixture injection (returns pre-resolved rows)
    if (opts.fetcher) return opts.fetcher()

    // Page-level fetcher injection (returns HTML for parser tests)
    const pageFetcher = (opts as { pageFetcher?: () => Promise<string> }).pageFetcher
    const onSkip = (opts as { onSkip?: (reason: SkipReason) => void }).onSkip
    let html: string
    try {
      html = pageFetcher
        ? await pageFetcher()
        : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch (e) {
      onSkip?.({
        adapter: 'ny-senate',
        stage: 'fetch',
        reason: 'events listing fetch threw',
        detail: e instanceof Error ? e.message : String(e),
      })
      return []
    }

    const parsed = parseNysenateEventsHtml(html)
    const out: NormalizedTownHall[] = []

    for (const p of parsed) {
      const openstates_person_id = await resolveOpenstatesPersonId(opts.client, {
        full_name: p.full_name,
        state: 'NY',
        chamber: 'state_senate',
        onAmbiguous: () => onSkip?.({
          adapter: 'ny-senate',
          stage: 'resolve_ambiguous',
          legislator: p.full_name,
          reason: 'ambiguous full_name match (2+ in-office officials)',
        }),
      })
      if (!openstates_person_id) {
        onSkip?.({
          adapter: 'ny-senate',
          stage: 'resolve',
          legislator: p.full_name,
          reason: 'unmatched senator in officials table',
        })
        continue
      }

      const row: NormalizedTownHall = {
        official_openstates_person_id: openstates_person_id,
        event_date: p.event_date,
        state: 'NY',
        format: p.format,
        source_url: p.detail_url,
        source: 'ny-senate',
        external_id: deriveExternalId(p.detail_url),
      }
      if (p.city) row.city = p.city
      out.push(row)
    }

    return out
  },
}
