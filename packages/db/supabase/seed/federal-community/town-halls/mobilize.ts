import type { Client } from 'pg'
import {
  isFederalLegislatorEvent,
  extractFederalLegislatorName,
  inferFederalChamber,
  type FederalChamber,
} from './mobilize-helpers.ts'
import { deriveFormat } from '../../shared/town-halls-helpers.ts'
import { resolveOfficialByName } from '../../shared/officials.ts'

const MOBILIZE_API_BASE = 'https://api.mobilize.us/v1/events'
const PER_PAGE = 100

// Full state-name → 2-letter code, used as fallback when event.location is null
// (e.g., virtual events). Mirrors slice 7 state mobilize adapter pattern.
const STATE_NAME_TO_CODE: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
}

function extractStateFromText(text: string): string | null {
  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    const re = new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`, 'i')
    if (re.test(text)) return code
  }
  return null
}

interface MobilizeEvent {
  id: number
  title: string
  description?: string
  event_type: string
  is_virtual: boolean
  event_url: string | null
  location: {
    venue?: string
    address_lines?: string[]
    locality?: string
    region?: string
    postal_code?: string
    country?: string
  } | null
  timeslots: Array<{ id: number; start_date: number; end_date: number }>
}

interface MobilizeListResponse {
  data: MobilizeEvent[]
  count: number
  next: string | null
  previous: string | null
}

export interface FederalTownHallRow {
  official_id: string
  legislator_name: string
  chamber: FederalChamber
  event_date: string
  city?: string
  state: string
  format?: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  source_url: string
  source: 'mobilize'
  external_id: string
}

/**
 * Parse Mobilize events into FederalTownHallRow[]. Pure function; one
 * client.query per event for name → official_id resolution. Exported for tests.
 *
 * Returns only events that classify as FEDERAL and successfully resolve to
 * an official via resolveOfficialByName. State-tier events (titles with
 * "State Senator" / "State Rep" / "State Representative") are filtered out
 * via FEDERAL_LEGISLATOR_RE's negative-lookbehind in the helpers module.
 */
export async function parseFederalMobilizeEvents(
  events: MobilizeEvent[],
  client: Client,
): Promise<FederalTownHallRow[]> {
  const out: FederalTownHallRow[] = []
  for (const event of events) {
    const description = event.description ?? ''
    if (!isFederalLegislatorEvent(event.title, description)) continue

    const name = extractFederalLegislatorName(event.title)
      ?? extractFederalLegislatorName(description)
    if (!name) continue

    // Prefer location.region (2-letter code). Fall back to scanning description
    // for full state names — needed for virtual events where location is null.
    let state = event.location?.region
    if (!state || !/^[A-Z]{2}$/.test(state)) {
      state = extractStateFromText(description) ?? extractStateFromText(event.title) ?? undefined
    }
    if (!state || !/^[A-Z]{2}$/.test(state)) continue

    const chamber = inferFederalChamber(event.title) ?? inferFederalChamber(description)
    if (!chamber) continue

    const officialId = await resolveOfficialByName(client, {
      full_name: name, state, chamber,
    })
    if (!officialId) continue

    const startTs = event.timeslots[0]?.start_date
    if (!startTs) continue
    const eventDate = new Date(startTs * 1000).toISOString().slice(0, 10)

    out.push({
      official_id: officialId,
      legislator_name: name,
      chamber,
      event_date: eventDate,
      city: event.location?.locality,
      state,
      format: deriveFormat({
        is_virtual: event.is_virtual,
        event_url: event.event_url,
        location: event.location,
      }),
      source_url: event.event_url ?? `https://www.mobilize.us/events/${event.id}/`,
      source: 'mobilize',
      external_id: `mobilize-${event.id}`,
    })
  }
  return out
}

/**
 * Fetch + paginate Mobilize API; parse to FederalTownHallRow[].
 * Fails-empty on network errors (matches slice 7 stub fallback pattern).
 */
export async function fetchAndNormalizeFederal(client: Client): Promise<FederalTownHallRow[]> {
  const out: FederalTownHallRow[] = []
  let url: string | null = `${MOBILIZE_API_BASE}?event_types=town_hall&per_page=${PER_PAGE}`
  let pageCount = 0
  const MAX_PAGES = 50

  while (url && pageCount < MAX_PAGES) {
    pageCount += 1
    let body: MobilizeListResponse
    try {
      const resp = await fetch(url)
      if (!resp.ok) break
      body = await resp.json() as MobilizeListResponse
    } catch {
      break
    }
    const parsed = await parseFederalMobilizeEvents(body.data ?? [], client)
    out.push(...parsed)
    url = body.next ?? null
  }
  return out
}
