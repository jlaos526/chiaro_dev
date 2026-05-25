import type { Client } from 'pg'
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'
import {
  isStateLegislatorEvent,
  extractLegislatorName,
  inferChamberFromTitle,
  deriveFormat,
} from './mobilize-helpers.ts'
import { resolveOfficialByName, type Chamber } from '../../shared/officials.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

// Full state-name → 2-letter code, used as fallback when event.location is null
// (e.g., virtual events). Detection scans description for the first state name.
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

const MOBILIZE_API_BASE = 'https://api.mobilize.us/v1/events'
const PER_PAGE = 100

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

/**
 * Parse a batch of MobilizeEvent[] into NormalizedTownHall[]. Pure function;
 * makes one client.query per event for name-resolution. Exported for tests.
 */
export async function parseMobilizeEvents(
  events: MobilizeEvent[],
  client: Client,
): Promise<NormalizedTownHall[]> {
  const out: NormalizedTownHall[] = []
  for (const event of events) {
    const description = event.description ?? ''
    if (!isStateLegislatorEvent(event.title, description)) continue

    const name = extractLegislatorName(event.title)
      ?? extractLegislatorName(description)
    if (!name) continue

    // Prefer location.region (2-letter code). Fall back to scanning description
    // for full state names — needed for virtual events where location is null.
    let state = event.location?.region
    if (!state || !/^[A-Z]{2}$/.test(state)) {
      state = extractStateFromText(description) ?? extractStateFromText(event.title) ?? undefined
    }
    if (!state || !/^[A-Z]{2}$/.test(state)) continue

    const chamber = inferChamberFromTitle(event.title) ?? inferChamberFromTitle(description)
    if (!chamber) continue

    // Resolve openstates_person_id via shared helper.
    const officialId = await resolveOfficialByName(client, {
      full_name: name,
      state,
      chamber,
    })
    if (!officialId) continue

    // Pick the earliest upcoming or most-recent past timeslot.
    const startTs = event.timeslots[0]?.start_date
    if (!startTs) continue
    const eventDate = new Date(startTs * 1000).toISOString().slice(0, 10)

    const city = event.location?.locality
    out.push({
      legislator_name: name,
      event_date: eventDate,
      ...(city !== undefined ? { city } : {}),
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
 * Fetches paginated Mobilize API + parses to NormalizedTownHall[].
 * Returns [] on any network/parse error (matches slice 5xx stub fallback pattern).
 */
async function fetchAndNormalize(client: Client, _state?: string): Promise<NormalizedTownHall[]> {
  const out: NormalizedTownHall[] = []
  let url: string | null = `${MOBILIZE_API_BASE}?event_types=town_hall&per_page=${PER_PAGE}`
  let pageCount = 0
  const MAX_PAGES = 50  // hard cap to avoid runaway pagination

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
    const parsed = await parseMobilizeEvents(body.data ?? [], client)
    out.push(...parsed)
    url = body.next ?? null
  }
  return out
}

export const mobilize: StateCommunityAdapter<NormalizedTownHall> = {
  slug: 'mobilize',
  component: 'halls',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    if (opts.fetcher) return opts.fetcher()
    return fetchAndNormalize(opts.client, opts.state)
  },
}
