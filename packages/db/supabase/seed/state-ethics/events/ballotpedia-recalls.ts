import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import type { Client } from 'pg'
import {
  BROWSER_USER_AGENT,
  parseRecallYearLinks,
  parseRecallRows,
  mapOutcomeToEventType,
  extractDate,
  parseLegislatorName,
  slugifyName,
} from './ballotpedia-recalls-helpers.ts'
import type { Chamber } from '../../shared/officials.ts'
import { STATE_NAME_TO_2 } from '../../state-scorecards/nra-helpers.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

const ALL_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

const INDEX_URL = 'https://ballotpedia.org/State_legislative_recalls'
const THROTTLE_MS = 1000
const FETCH_TIMEOUT_MS = 5000
const MAX_PAGES = 50

interface FetchFn {
  (url: string): Promise<string>
}

async function defaultFetcher(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`Ballotpedia returned ${resp.status} for ${url}`)
  return resp.text()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Normalize a Ballotpedia state-name cell ("California", "New York") to the
 * lowercase-hyphenated form used as the STATE_NAME_TO_2 key ('california',
 * 'new-york'). The NRA helper map originated for URL slugs so it keys on
 * hyphens; Ballotpedia returns plain text, so we collapse whitespace → `-`.
 */
function normalizeStateName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Resolve full_name + state + chamber → openstates_person_id.
 *
 * The state_official_events table keys events off openstates_person_id (via
 * persistEvent in shared.ts which then joins to officials.id). Returns null
 * if no match (including officials with NULL openstates_person_id — e.g.
 * federal-only officials we'd never want to attribute a state recall to).
 *
 * Mirrors the slice 9 NRA adapter's resolveOpenstatesPersonId pattern.
 */
async function resolveOpenstatesPersonId(
  client: Pick<Client, 'query'>,
  opts: { full_name: string; state: string; chamber: Chamber },
): Promise<string | null> {
  const res = await client.query<{ openstates_person_id: string | null }>(
    `select openstates_person_id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  const row = res.rows[0]
  if (!row || !row.openstates_person_id) return null
  return row.openstates_person_id
}

/**
 * Production fetcher: GET index + per-year subpages + parse recall rows.
 * Exported for tests.
 */
export async function fetchBallotpediaRecallEvents(
  client: Pick<Client, 'query'>,
  fetcher: FetchFn = defaultFetcher,
  onSkip?: (reason: SkipReason) => void,
): Promise<{ events: NormalizedOfficialEvent[]; errors: string[] }> {
  const errors: string[] = []
  const events: NormalizedOfficialEvent[] = []

  let indexHtml: string
  try {
    indexHtml = await fetcher(INDEX_URL)
  } catch (err) {
    onSkip?.({
      adapter: 'ballotpedia-recalls',
      stage: 'fetch',
      reason: 'recalls index page fetch threw (Cloudflare gate?)',
      detail: (err as Error).message,
    })
    return { events, errors }
  }

  const yearLinks = parseRecallYearLinks(indexHtml).slice(0, MAX_PAGES - 1)

  for (const link of yearLinks) {
    await sleep(THROTTLE_MS)
    let yearHtml: string
    try {
      yearHtml = await fetcher(link.url)
    } catch (err) {
      onSkip?.({
        adapter: 'ballotpedia-recalls',
        stage: 'fetch',
        reason: `year ${link.year} subpage fetch threw`,
        detail: (err as Error).message,
      })
      continue
    }
    const rows = parseRecallRows(yearHtml)
    for (const row of rows) {
      const state = STATE_NAME_TO_2[normalizeStateName(row.stateName)]
      if (!state) {
        onSkip?.({
          adapter: 'ballotpedia-recalls',
          stage: 'parse',
          legislator: row.legislatorRaw,
          reason: `unknown state name: ${row.stateName}`,
        })
        continue
      }
      const legi = parseLegislatorName(row.legislatorRaw)
      if (!legi) {
        onSkip?.({
          adapter: 'ballotpedia-recalls',
          stage: 'parse',
          legislator: row.legislatorRaw,
          reason: 'recall row legislator name parse failed (likely federal)',
        })
        continue
      }
      const eventType = mapOutcomeToEventType(row.status)
      if (!eventType) {
        onSkip?.({
          adapter: 'ballotpedia-recalls',
          stage: 'parse',
          legislator: legi.name,
          reason: `unknown status: ${row.status}`,
        })
        continue
      }
      const eventDate = extractDate(row.dateText)
      if (!eventDate) {
        onSkip?.({
          adapter: 'ballotpedia-recalls',
          stage: 'parse',
          legislator: legi.name,
          reason: `unparseable date: ${row.dateText}`,
        })
        continue
      }
      const openstatesPersonId = await resolveOpenstatesPersonId(client, {
        full_name: legi.name,
        state,
        chamber: legi.chamber,
      })
      if (!openstatesPersonId) {
        onSkip?.({
          adapter: 'ballotpedia-recalls',
          stage: 'resolve',
          legislator: legi.name,
          reason: `unmatched in officials (${state}, ${legi.chamber})`,
        })
        continue
      }
      events.push({
        official_openstates_person_id: openstatesPersonId,
        event_type: eventType,
        event_date: eventDate,
        state,
        source: 'ballotpedia',
        external_id: `ballotpedia-${state}-${slugifyName(legi.name)}-${eventDate}`,
        source_url: link.url,
        summary: row.status,
      })
    }
  }

  return { events, errors }
}

export const ballotpediaRecalls: StateEthicsAdapter<NormalizedOfficialEvent> = {
  slug: 'ballotpedia',
  component: 'events',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    // Production path
    const result = await fetchBallotpediaRecallEvents(opts.client, undefined, opts.onSkip)
    return result.events
  },
}
