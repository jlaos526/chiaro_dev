# Mobilize.us + OpenStates YAML Parser Wiring Implementation Plan (slice 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 2 production parsers against existing schema (no migrations): (1) `mobilize` adapter for nationwide state-legislator town halls, (2) fix `openstates-end-reason` adapter's YAML parsing + jurisdiction-format regex.

**Architecture:** Zero schema work; pgTAP stays at 393 plans. Workspace stays at 10 packages. The `mobilize` adapter writes `state_town_halls` via existing slice 5H `(source, external_id)` UNIQUE dedup; replaces dead TownHallProject stub in `state-community-ingest.ts` dispatch order. The OpenStates YAML fix swaps `JSON.parse` → conditional `parseYaml` and adds a `state:XX` regex for OCD jurisdiction-format extraction.

**Tech Stack:** TypeScript strict mode, `pg` Client, `yaml` npm package (already a workspace dep), undici fetch, vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-mobilize-openstates-yaml-design.md`

---

## File structure

**Created (~4):**
```
packages/db/supabase/seed/state-community/town-halls/
  mobilize.ts                       # NEW — production Mobilize.us parser
  mobilize.test.ts                  # NEW — 6 vitest cases
packages/db/supabase/seed/fixtures/state-community/
  mobilize.json                     # NEW — sample Mobilize API response (5-8 events)
packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/
  ocd-person-fx-yaml-ca-1.yml       # NEW — slice 5C-style YAML person file
```

**Modified (~4):**
```
packages/db/supabase/seed/state-community/town-halls/townhallproject.ts   # +@deprecated JSDoc
packages/db/supabase/seed/state-community-ingest.ts                       # swap dispatch order
packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts    # YAML + jurisdiction regex
packages/db/supabase/seed/state-ethics/events/openstates-end-reason.test.ts   # +2 test cases
CLAUDE.md                                                                  # slice 7 entry + Gotcha #16
```

---

## Task 1: Mobilize fixture file

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/mobilize.json`

The fixture mirrors a real `api.mobilize.us/v1/events?event_types=town_hall` response shape. 5 events: 2 state-legislator matches (CA + CO), 1 federal (should skip), 1 vague title (should skip), 1 name-extraction failure (should log unmatched). This gives the adapter's classifier + name-extractor + state-resolver paths real test coverage.

- [ ] **Step 1: Create the fixture**

```json
{
  "data": [
    {
      "id": 100001,
      "title": "Town Hall with State Senator Mike Foote",
      "description": "Join CO State Senator Mike Foote for a community town hall.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://www.mobilize.us/example/event/100001/",
      "location": {
        "venue": "Lafayette Library",
        "address_lines": ["775 W Baseline Rd"],
        "locality": "Lafayette",
        "region": "CO",
        "postal_code": "80026",
        "country": "US"
      },
      "timeslots": [{ "id": 200001, "start_date": 1738800000, "end_date": 1738807200 }]
    },
    {
      "id": 100002,
      "title": "Assemblymember Emily Sirota — Community Town Hall",
      "description": "Constituent town hall in Sacramento.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://us02web.zoom.us/j/123456",
      "location": {
        "venue": "Capitol Conference Room 100",
        "address_lines": ["1315 10th St"],
        "locality": "Sacramento",
        "region": "CA",
        "postal_code": "95814",
        "country": "US"
      },
      "timeslots": [{ "id": 200002, "start_date": 1739404800, "end_date": 1739412000 }]
    },
    {
      "id": 100003,
      "title": "Town Hall with Senator Elizabeth Warren",
      "description": "US Senator town hall.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://www.mobilize.us/example/event/100003/",
      "location": {
        "venue": "Boston Convention Center",
        "locality": "Boston",
        "region": "MA",
        "country": "US"
      },
      "timeslots": [{ "id": 200003, "start_date": 1739491200, "end_date": 1739498400 }]
    },
    {
      "id": 100004,
      "title": "Community Town Hall in Brooklyn",
      "description": "Town hall meeting.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://www.mobilize.us/example/event/100004/",
      "location": {
        "venue": "Brooklyn Public Library",
        "locality": "Brooklyn",
        "region": "NY",
        "country": "US"
      },
      "timeslots": [{ "id": 200004, "start_date": 1739577600, "end_date": 1739584800 }]
    },
    {
      "id": 100005,
      "title": "Delegate Pat Smith Virtual Town Hall",
      "description": "Maryland Delegate Pat Smith virtual town hall.",
      "event_type": "TOWN_HALL",
      "is_virtual": true,
      "event_url": "https://us02web.zoom.us/j/654321",
      "location": null,
      "timeslots": [{ "id": 200005, "start_date": 1739664000, "end_date": 1739671200 }]
    }
  ],
  "count": 5,
  "next": null,
  "previous": null
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/supabase/seed/fixtures/state-community/mobilize.json
git commit -m "feat(seed): mobilize.json fixture for slice 7 parser

5-event fixture mirroring api.mobilize.us/v1/events shape. Exercises
all classifier paths: state senator match (CO), assemblymember match
(CA, hybrid format via zoom URL + venue), federal Senator skip,
vague-title skip, delegate match (MD, virtual format)."
```

---

## Task 2: Mobilize helpers (regex + format derivation + chamber inference)

**Files:**
- Create: `packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts`
- Create: `packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.test.ts`

Split helpers into their own file so the main adapter stays focused on orchestration + the parsers are unit-testable in isolation.

- [ ] **Step 1: Write failing tests**

Create `packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  extractLegislatorName,
  inferChamberFromTitle,
  deriveFormat,
  isStateLegislatorEvent,
} from './mobilize-helpers.ts'

describe('isStateLegislatorEvent', () => {
  it('matches "State Senator <Name>"', () => {
    expect(isStateLegislatorEvent('Town Hall with State Senator Mike Foote', '')).toBe(true)
  })
  it('matches "Assemblymember <Name>"', () => {
    expect(isStateLegislatorEvent('Assemblymember Emily Sirota — Community Town Hall', '')).toBe(true)
  })
  it('matches "Delegate <Name>"', () => {
    expect(isStateLegislatorEvent('Delegate Pat Smith Virtual Town Hall', '')).toBe(true)
  })
  it('matches "State Rep. <Name>"', () => {
    expect(isStateLegislatorEvent('State Rep. John Doe', '')).toBe(true)
  })
  it('rejects federal "Senator <Name>" (no "State" prefix)', () => {
    expect(isStateLegislatorEvent('Town Hall with Senator Elizabeth Warren', '')).toBe(false)
  })
  it('rejects vague "Community Town Hall"', () => {
    expect(isStateLegislatorEvent('Community Town Hall in Brooklyn', '')).toBe(false)
  })
  it('falls back to description when title has no match', () => {
    expect(isStateLegislatorEvent('Open Forum', 'Featuring State Senator Jane Roe')).toBe(true)
  })
})

describe('extractLegislatorName', () => {
  it('extracts from "State Senator <Name>"', () => {
    expect(extractLegislatorName('Town Hall with State Senator Mike Foote')).toBe('Mike Foote')
  })
  it('extracts hyphenated last name', () => {
    expect(extractLegislatorName('State Senator Maria Lopez-Garcia')).toBe('Maria Lopez-Garcia')
  })
  it('extracts from "Assemblymember <Name>"', () => {
    expect(extractLegislatorName('Assemblymember Emily Sirota — Community Town Hall')).toBe('Emily Sirota')
  })
  it('extracts from "Delegate <Name>"', () => {
    expect(extractLegislatorName('Delegate Pat Smith Virtual Town Hall')).toBe('Pat Smith')
  })
  it('extracts from "State Rep. <Name>"', () => {
    expect(extractLegislatorName('State Rep. John Doe')).toBe('John Doe')
  })
  it('returns null when no match', () => {
    expect(extractLegislatorName('Community Town Hall in Brooklyn')).toBeNull()
  })
})

describe('inferChamberFromTitle', () => {
  it('"State Senator" → state_senate', () => {
    expect(inferChamberFromTitle('State Senator Mike Foote')).toBe('state_senate')
  })
  it('"Assemblymember" → state_house', () => {
    expect(inferChamberFromTitle('Assemblymember Emily Sirota')).toBe('state_house')
  })
  it('"State Rep." → state_house', () => {
    expect(inferChamberFromTitle('State Rep. John Doe')).toBe('state_house')
  })
  it('"Delegate" → state_house', () => {
    expect(inferChamberFromTitle('Delegate Pat Smith')).toBe('state_house')
  })
  it('"State Representative" → state_house', () => {
    expect(inferChamberFromTitle('State Representative Jane Roe')).toBe('state_house')
  })
  it('returns null for non-match', () => {
    expect(inferChamberFromTitle('Community Town Hall')).toBeNull()
  })
})

describe('deriveFormat', () => {
  it('is_virtual=true → virtual', () => {
    expect(deriveFormat({ is_virtual: true, event_url: null, location: null })).toBe('virtual')
  })
  it('zoom URL + venue → hybrid', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://us02web.zoom.us/j/123',
      location: { venue: 'Capitol Room 100' },
    })).toBe('hybrid')
  })
  it('zoom URL no venue → virtual', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://us02web.zoom.us/j/123',
      location: null,
    })).toBe('virtual')
  })
  it('venue only, no virtual URL → in_person', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://www.mobilize.us/event/123/',
      location: { venue: 'Lafayette Library' },
    })).toBe('in_person')
  })
  it('handles google meet URL as hybrid when venue present', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://meet.google.com/abc-defg-hij',
      location: { venue: 'Capitol' },
    })).toBe('hybrid')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test 'state-community/town-halls/mobilize-helpers'
```

Expected: module not found.

- [ ] **Step 3: Implement helpers**

Create `packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts`:

```ts
export const STATE_LEGISLATOR_RE =
  /\b(State Senator|State Rep\.?|State Representative|Assemblymember|Assemblyman|Assemblywoman|Delegate)\b/i

export const NAME_RE =
  /(?:State Senator|State Rep\.?|State Representative|Assemblymember|Assemblyman|Assemblywoman|Delegate)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,3})/

export function isStateLegislatorEvent(title: string, description: string): boolean {
  return STATE_LEGISLATOR_RE.test(title) || STATE_LEGISLATOR_RE.test(description)
}

export function extractLegislatorName(title: string): string | null {
  const m = title.match(NAME_RE)
  return m ? m[1]! : null
}

export type StateChamber = 'state_house' | 'state_senate' | 'state_legislature'

export function inferChamberFromTitle(title: string): StateChamber | null {
  // Match priority: state_senate (must contain "State Senator") then state_house.
  if (/\bState Senator\b/i.test(title)) return 'state_senate'
  if (/\b(Assemblymember|Assemblyman|Assemblywoman|Delegate|State Rep\.?|State Representative)\b/i.test(title)) {
    return 'state_house'
  }
  return null
}

interface MobilizeEventForFormat {
  is_virtual: boolean
  event_url: string | null
  location: { venue?: string } | null
}

const VIRTUAL_URL_RE = /zoom\.us|meet\.google|teams\.microsoft/i

export function deriveFormat(event: MobilizeEventForFormat): 'in_person' | 'virtual' | 'phone' | 'hybrid' {
  if (event.is_virtual === true) return 'virtual'
  const eventUrl = event.event_url ?? ''
  const hasVirtualLink = VIRTUAL_URL_RE.test(eventUrl)
  const hasPhysicalLocation = !!event.location?.venue
  if (hasVirtualLink && hasPhysicalLocation) return 'hybrid'
  if (hasVirtualLink) return 'virtual'
  return 'in_person'
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community/town-halls/mobilize-helpers'
pnpm --filter @chiaro/db typecheck
```

Expected: 22 cases pass; typecheck clean.

```bash
git add packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts \
        packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.test.ts
git commit -m "feat(seed): mobilize-helpers — regex classifiers + format derivation

Pure helpers for Mobilize.us parser:
- isStateLegislatorEvent(title, description): classifies via STATE_LEGISLATOR_RE
  (matches State Senator/Rep, Assemblymember, Delegate, etc.); skips federal
  events without 'State' prefix
- extractLegislatorName(title): NAME_RE extracts capitalized 1-4-word names
  after the role token
- inferChamberFromTitle(title): maps role token to state_senate / state_house
- deriveFormat(event): virtual/hybrid/in_person via is_virtual flag + URL
  pattern (zoom/meet/teams) + venue presence

22 vitest cases covering all 4 helpers."
```

---

## Task 3: Mobilize adapter + fetcher

**Files:**
- Create: `packages/db/supabase/seed/state-community/town-halls/mobilize.ts`
- Create: `packages/db/supabase/seed/state-community/town-halls/mobilize.test.ts`

This task wires the helpers from Task 2 + the slice 5E `resolveOfficialByName` helper into a full production adapter.

- [ ] **Step 1: Write the failing tests**

Create `packages/db/supabase/seed/state-community/town-halls/mobilize.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mobilize, parseMobilizeEvents } from './mobilize.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'mobilize.json')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(officialId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: officialId ? [{ id: officialId }] : [], rowCount: officialId ? 1 : 0 }),
  }
}

describe('mobilize adapter', () => {
  it('reports correct slug + component + covered_states', () => {
    expect(mobilize.slug).toBe('mobilize')
    expect(mobilize.component).toBe('halls')
    expect(mobilize.covered_states.length).toBe(50)
  })

  it('happy path: fixture injection returns parsed NormalizedTownHall[]', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never  // every name resolves
    const events = await parseMobilizeEvents(fixture.data, client)
    // 5 fixture events: 3 state-legislator (CO/CA/MD) + 1 federal (skip) + 1 vague (skip) = 3 emitted
    expect(events).toHaveLength(3)
    expect(events[0]!.state).toBe('CO')
    expect(events[0]!.source).toBe('mobilize')
    expect(events[0]!.external_id).toBe('mobilize-100001')
  })

  it('classifies CA hybrid event correctly (zoom URL + venue → hybrid)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const ca = events.find(e => e.state === 'CA')
    expect(ca).toBeDefined()
    expect(ca!.format).toBe('hybrid')
  })

  it('classifies MD virtual event correctly (is_virtual=true → virtual)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const md = events.find(e => e.state === 'MD')
    expect(md).toBeDefined()
    expect(md!.format).toBe('virtual')
  })

  it('drops federal event (Senator without State prefix)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-mock') as never
    const events = await parseMobilizeEvents(fixture.data, client)
    const ma = events.find(e => e.state === 'MA')
    expect(ma).toBeUndefined()
  })

  it('drops events with unresolved legislator names', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never  // no name resolves → unmatched
    const events = await parseMobilizeEvents(fixture.data, client)
    expect(events).toHaveLength(0)
  })

  it('production stub gracefully fails-empty when fetcher absent + API not reachable', async () => {
    // Bypass the network fetcher by spying-mocking global fetch to return empty
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as never
    try {
      const events = await mobilize.fetchEvents({
        client: mkClient(null) as never,
      } as never)
      expect(events).toEqual([])
    } finally {
      globalThis.fetch = origFetch
    }
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test 'state-community/town-halls/mobilize.test'
```

Expected: module not found.

- [ ] **Step 3: Implement adapter**

Create `packages/db/supabase/seed/state-community/town-halls/mobilize.ts`:

```ts
import type { Client } from 'pg'
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'
import {
  isStateLegislatorEvent,
  extractLegislatorName,
  inferChamberFromTitle,
  deriveFormat,
} from './mobilize-helpers.ts'
import {
  resolveOfficialByName,
  type FinanceState,
} from '../../state-finance/shared.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

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

    const state = event.location?.region
    if (!state || !/^[A-Z]{2}$/.test(state)) continue

    const chamber = inferChamberFromTitle(event.title) ?? inferChamberFromTitle(description)
    if (!chamber) continue

    // Resolve openstates_person_id via slice 5E helper.
    // resolveOfficialByName's signature constrains state to FinanceState (5 states);
    // we cast since the underlying SQL accepts any state code.
    const officialId = await resolveOfficialByName(client, {
      full_name: name,
      state: state as FinanceState,
      chamber,
    })
    if (!officialId) continue

    // Pick the earliest upcoming or most-recent past timeslot.
    const startTs = event.timeslots[0]?.start_date
    if (!startTs) continue
    const eventDate = new Date(startTs * 1000).toISOString().slice(0, 10)

    out.push({
      legislator_name: name,
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

export const mobilize: StateCommunityAdapter = {
  slug: 'mobilize',
  component: 'halls',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    return fetchAndNormalize(opts.client, opts.state)
  },
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community/town-halls/mobilize.test'
pnpm --filter @chiaro/db typecheck
```

Expected: 7 cases pass; typecheck clean.

```bash
git add packages/db/supabase/seed/state-community/town-halls/mobilize.ts \
        packages/db/supabase/seed/state-community/town-halls/mobilize.test.ts
git commit -m "feat(seed): mobilize adapter — production parser for Mobilize.us API

Replaces dead TownHallProject as the nationwide state-legislator town-hall
overlay. Paginated GET https://api.mobilize.us/v1/events?event_types=town_hall
(no auth, ~24 requests for full ~2,400-event coverage); state-vs-federal
classification + name extraction via regex helpers; resolveOfficialByName
from slice 5E for openstates_person_id lookup; format derived from
is_virtual + event_url + location.venue.

External_id: mobilize-\${event.id} for stable dedup via (source, external_id)
UNIQUE on state_town_halls (slice 5H migration 0042).

7 vitest cases (fixture-injected; exported parseMobilizeEvents helper
covers the unit-test surface). Production path fails-empty on network
errors per slice 5xx stub-fallback convention. Hard cap of 50 pages
to avoid pagination runaway."
```

---

## Task 4: Orchestrator dispatch order swap + townhallproject deprecation

**Files:**
- Modify: `packages/db/supabase/seed/state-community-ingest.ts`
- Modify: `packages/db/supabase/seed/state-community/town-halls/townhallproject.ts`

- [ ] **Step 1: Update ADAPTERS_DEFAULT**

Open `packages/db/supabase/seed/state-community-ingest.ts`. Find the import block and add `mobilize`:

```ts
import { mobilize } from './state-community/town-halls/mobilize.ts'
```

Find the `ADAPTERS_DEFAULT` constant. Replace the halls section:

```ts
const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
  // halls first (Mobilize nationwide baseline replaces dead TownHallProject;
  // per-state augment runs after). townhallproject.ts is retained as a
  // no-op stub (file kept for backwards-compat; @deprecated JSDoc).
  mobilize,
  caLeginfoTownHalls, nySenateTownHalls, flDoeTownHalls, txCapitolTownHalls, miLegislatureTownHalls,
  // offices
  caLeginfoOffices, nySenateOffices, flDoeOffices, txCapitolOffices, miLegislatureOffices,
  // hearings
  openstatesV3Hearings,
]
```

Remove the existing `townhallproject` import (now unused in the orchestrator).

- [ ] **Step 2: Deprecate townhallproject.ts**

Open `packages/db/supabase/seed/state-community/town-halls/townhallproject.ts`. Replace the file content:

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

/**
 * @deprecated TownHallProject went defunct in 2021 (last commit 2021-07-21;
 * Firebase data stale at 2 events from 2020-2021). Replaced by
 * `./mobilize.ts` (slice 7). Stub retained in the codebase for
 * backwards-compat with existing test imports; never produced data so no
 * DB cleanup needed. Not in `ADAPTERS_DEFAULT` dispatch order anymore.
 */
export const townhallproject: StateCommunityAdapter = {
  slug: 'townhallproject',
  component: 'halls',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

The existing `townhallproject.test.ts` continues to pass — the adapter still exists, still has `slug='townhallproject'`, still has `covered_states.length === 50`, still returns `[]` from production path.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community'
pnpm --filter @chiaro/db typecheck
```

Expected: all state-community tests pass (townhallproject test still green; mobilize tests still green; orchestrator tests still green — orchestrator test uses synthetic adapters via `mkAdapter` so the swap doesn't affect them).

```bash
git add packages/db/supabase/seed/state-community-ingest.ts \
        packages/db/supabase/seed/state-community/town-halls/townhallproject.ts
git commit -m "refactor(seed): swap townhallproject for mobilize in dispatch order

state-community-ingest's ADAPTERS_DEFAULT halls section now starts with
mobilize (replacing dead townhallproject as the nationwide overlay),
then per-state augment adapters.

townhallproject.ts is retained as a no-op stub with @deprecated JSDoc.
Existing test file unchanged. No DB cleanup needed — stub never
produced data."
```

---

## Task 5: OpenStates YAML parser fix

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts`

- [ ] **Step 1: Add yaml import + jurisdiction regex helper**

Open `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts`. Add to imports:

```ts
import { parse as parseYaml } from 'yaml'
```

Add a jurisdiction-extraction helper near the existing regex constants:

```ts
const JURISDICTION_RE = /state:([a-z]{2})\//i

function extractStateFromJurisdiction(jurisdiction: string | undefined): string | null {
  if (!jurisdiction) return null
  // Handle full OCD-jurisdiction format: ocd-jurisdiction/country:us/state:ca/government
  const m = jurisdiction.match(JURISDICTION_RE)
  if (m) return m[1]!.toUpperCase()
  // Fallback: handle plain 2-letter code (defensive)
  if (/^[A-Z]{2}$/.test(jurisdiction)) return jurisdiction
  return null
}
```

- [ ] **Step 2: Update file-extension filter + parser dispatch**

Find the for-loop walking `files`. Change the extension filter to include `.yaml`:

```ts
for (const file of files) {
  if (!file.endsWith('.json') && !file.endsWith('.yml') && !file.endsWith('.yaml')) continue
```

Change the parser-dispatch block:

```ts
let person: OpenStatesPerson
try {
  const raw = await readFile(join(dir, file), 'utf8')
  if (file.endsWith('.yml') || file.endsWith('.yaml')) {
    person = parseYaml(raw) as OpenStatesPerson
  } else {
    person = JSON.parse(raw) as OpenStatesPerson
  }
} catch {
  continue
}
```

- [ ] **Step 3: Update jurisdiction state-extraction**

Find the existing state-extraction block:

```ts
if (opts.state && role.jurisdiction !== opts.state) continue
// ...
const stateMatch = role.jurisdiction?.match(/^[A-Z]{2}$/)
const state = stateMatch ? role.jurisdiction! : opts.state ?? ''
if (!state) continue
```

Replace with:

```ts
const roleState = extractStateFromJurisdiction(role.jurisdiction)
if (opts.state && roleState !== opts.state) continue

const state = roleState ?? opts.state ?? ''
if (!state) continue
```

- [ ] **Step 4: Update the JSDoc NOTE**

Replace the stale `NOTE:` block at the top of the adapter export with:

```ts
/**
 * Reads slice 5C cached OpenStates people files (`.json` / `.yml` / `.yaml`)
 * and emits resignation events for any role with end_reason matching
 * /resign/i or /(death|died|deceased)/i.
 *
 * Returns [] when cache dir absent (v1 stub fallback).
 *
 * State extraction handles both formats:
 *   - OCD-jurisdiction: `ocd-jurisdiction/country:us/state:ca/government`
 *     (slice 5C format) → extracts `CA` via JURISDICTION_RE
 *   - Plain 2-letter: `CA` → passes through unchanged
 */
```

- [ ] **Step 5: Commit (tests in next task)**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: typecheck clean (existing fixture-injected tests still pass; YAML parsing path is exercised in Task 6).

```bash
git add packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts
git commit -m "fix(seed): openstates-end-reason — YAML parser + OCD-jurisdiction regex

Two bugs fixed:

1. YAML parsing: slice 5C cache uses .yml / .yaml files via parseYaml
   from yaml npm package (already a workspace dep). Previously
   JSON.parse failed silently on YAML files in the try/catch, returning
   [] regardless of cache content.

2. Jurisdiction format: slice 5C YAML files have role.jurisdiction in
   OCD-jurisdiction format (ocd-jurisdiction/country:us/state:ca/
   government), not plain 2-letter codes. JURISDICTION_RE extracts the
   state code from the OCD format; falls through to plain 2-letter
   match for defensive compat.

Updated JSDoc to reflect both fixes. Fixture-injected tests unaffected
(they bypass the file walker). Production-path tests added in next
commit (YAML fixture + walker case)."
```

---

## Task 6: OpenStates YAML fixture + production-path test

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/ocd-person-fx-yaml-ca-1.yml`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/ocd-person-fx-yaml-ny-1.yml`
- Modify: `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.test.ts`

- [ ] **Step 1: Create YAML fixture files**

`packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/ocd-person-fx-yaml-ca-1.yml`:

```yaml
id: ocd-person/fx-yaml-ca-1
name: Test YAML CA1
roles:
  - type: lower
    jurisdiction: ocd-jurisdiction/country:us/state:ca/government
    start_date: '2023-01-03'
    end_date: '2025-11-15'
    end_reason: resigned
```

`packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/ocd-person-fx-yaml-ny-1.yml`:

```yaml
id: ocd-person/fx-yaml-ny-1
name: Test YAML NY1
roles:
  - type: upper
    jurisdiction: ocd-jurisdiction/country:us/state:ny/government
    start_date: '2021-01-01'
    end_date: '2025-09-01'
    end_reason: died in office
```

- [ ] **Step 2: Update test file**

Open `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.test.ts`. Add 2 new test cases at the end of the `describe` block:

```tsx
describe('production path — YAML cache walker', () => {
  const YAML_DIR = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'events-openstates-yaml')

  beforeEach(() => {
    process.env.OPENSTATES_PEOPLE_CACHE_DIR = YAML_DIR
  })

  afterEach(() => {
    delete process.env.OPENSTATES_PEOPLE_CACHE_DIR
  })

  it('parses .yml files and emits resignation events with state extracted from OCD jurisdiction', async () => {
    const events = await openstatesEndReason.fetchEvents({ client: {} as never } as never)
    expect(events.length).toBe(2)
    const ca = events.find(e => e.state === 'CA')
    const ny = events.find(e => e.state === 'NY')
    expect(ca).toBeDefined()
    expect(ny).toBeDefined()
    expect(ca!.event_date).toBe('2025-11-15')
    expect(ca!.event_type).toBe('resignation')
    expect(ny!.event_date).toBe('2025-09-01')
    expect(ny!.outcome).toMatch(/Death/)
  })

  it('--state filter restricts to single state via OCD jurisdiction extraction', async () => {
    const events = await openstatesEndReason.fetchEvents({
      client: {} as never,
      state: 'CA',
    } as never)
    expect(events.length).toBe(1)
    expect(events[0]!.state).toBe('CA')
  })
})
```

Add the necessary imports at top of the test file (if not already present):

```ts
import { beforeEach, afterEach } from 'vitest'
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/events/openstates-end-reason'
pnpm --filter @chiaro/db typecheck
```

Expected: existing 4 cases pass + 2 new cases pass = 6 total.

```bash
git add packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/ \
        packages/db/supabase/seed/state-ethics/events/openstates-end-reason.test.ts
git commit -m "test(seed): openstates-end-reason YAML production-path coverage

2 new vitest cases exercising the YAML walker + OCD-jurisdiction regex:
- Walks 2 .yml fixture files; emits 2 resignation events (one resigned,
  one died-in-office); state codes extracted from OCD-jurisdiction
  format via JURISDICTION_RE
- --state filter respects extracted state code from OCD format

Fixtures live under packages/db/supabase/seed/fixtures/state-ethics/
events-openstates-yaml/ matching slice 5C's actual YAML schema
(jurisdiction is full ocd-jurisdiction/country:us/state:XX/government
string, not bare 2-letter code)."
```

---

## Task 7: Workspace verify + CLAUDE.md slice 7 entry + Gotcha #16

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db test
pnpm --filter @chiaro/web build 2>&1 | tail -5
```

Expected:
- All 10 packages typecheck clean
- `@chiaro/db` tests: existing + 22 mobilize-helpers + 7 mobilize + 2 new openstates-end-reason cases all pass
- Web build clean

- [ ] **Step 2: Add slice 7 entry to CLAUDE.md**

In `## Slices delivered`, after slice 6 entry, append:

```markdown
- **Slice 7 — Mobilize.us + OpenStates YAML parser wiring** (2026-05-22): first 2 production parsers wired against slices 5H + 5I stub adapters. `mobilize` adapter (NEW) writes `state_town_halls` from `api.mobilize.us/v1/events?event_types=town_hall` (no auth, paginated, nationwide). `townhallproject` removed from dispatch order (TownHallProject defunct since 2021); file retained with `@deprecated` JSDoc. `openstates-end-reason` (slice 5I) fixed: 2 bugs in 1 commit — YAML parsing via `parseYaml` for `.yml`/`.yaml` files + OCD-jurisdiction regex (`state:XX/`) for slice 5C's actual format. Zero schema work; pgTAP unchanged at 393 plans. Validates the slice 5xx stub-shipping pattern end-to-end as a template for the remaining 35 production parsers.
```

- [ ] **Step 3: Add Gotcha #16 to CLAUDE.md**

In `## Gotchas`, after current #15, append:

```markdown
16. **Mobilize.us API: state-vs-federal classification is regex-based, not structured.** `event.event_type` is just `"TOWN_HALL"` — federal Senator events vs state-legislator events are distinguishable only via title regex against `\b(State Senator|State Rep\.?|Assemblymember|Delegate)\b`. Name extraction is also regex-based (`NAME_RE` in `state-community/town-halls/mobilize-helpers.ts`). Operator monitors `stats.officialsUnmatched[]` rate to detect title-pattern drift; if Mobilize changes title conventions or new patterns emerge (e.g., "Councilmember", "Commissioner"), extend `STATE_LEGISLATOR_RE` accordingly. Chamber inference also from title — "State Senator" → `state_senate`, "Assemblymember/Delegate/State Rep" → `state_house`. Nebraska unicameral edge case not yet handled — NE legislators would currently classify as `state_senate` (acceptable since NE chamber type is `state_legislature`-or-`state_senate` in our schema per slice 5C).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 7 entry + Gotcha #16 (Mobilize regex heuristics)

Slice 7 ships 2 production parsers: mobilize + openstates-end-reason
YAML fix. Gotcha #16 documents the regex-heuristic nature of Mobilize
state-vs-federal classification + name extraction (titles drift; operator
monitors officialsUnmatched[] rate). Chamber inference + NE unicameral
edge case noted."
```

---

## Task 8: Memory + branch handoff

**Files:**
- None (memory writes only)

- [ ] **Step 1: Final branch state**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: ~8 commits on `slice-7-parser-wiring` ahead of master (1 spec + 1 plan + 6 implementation).

- [ ] **Step 2: Write slice 7 durable-lessons memory**

Write `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice7_parser_wiring.md`:

```markdown
---
name: project-chiaro-slice7-parser-wiring
description: Slice 7 — first 2 production parsers (mobilize + OpenStates YAML fix) validate the slice 5xx stub pattern
metadata:
  node_type: memory
  type: project
---

Slice 7 shipped 2026-05-22 — squash SHA TBD (fill in after merge). 8 commits on `slice-7-parser-wiring` branch (1 spec + 1 plan + 6 implementation/docs). Spec at `docs/superpowers/specs/2026-05-22-mobilize-openstates-yaml-design.md`, plan at `docs/superpowers/plans/2026-05-22-mobilize-openstates-yaml.md` (~1500 lines).

**Validates the slice 5xx stub-shipping pattern end-to-end** with 2 real parsers, providing the template for the remaining 35 stub adapters.

**What shipped:**

- `mobilize` adapter (NEW) at `packages/db/supabase/seed/state-community/town-halls/mobilize.ts` — paginated GET against `api.mobilize.us/v1/events?event_types=town_hall`. State-vs-federal classification via `STATE_LEGISLATOR_RE`; name extraction via `NAME_RE`; chamber inference via title regex; format derivation from `is_virtual` + URL pattern + venue presence; external_id `mobilize-${event.id}` for stable dedup
- `mobilize-helpers.ts` with 4 pure helpers — 22 vitest cases
- Orchestrator dispatch order updated: `mobilize` replaces `townhallproject` as halls nationwide overlay (FIRST in dispatch). `townhallproject` removed from `ADAPTERS_DEFAULT`; file retained with `@deprecated` JSDoc.
- `openstates-end-reason` adapter (slice 5I) fixed: YAML parsing + OCD-jurisdiction regex
- 2 new YAML fixture files under `fixtures/state-ethics/events-openstates-yaml/` + 2 new vitest cases for production-path walker

**Durable Chiaro-specific lessons:**

1. **TownHallProject defunct since 2021.** Last commit 2021-07-21; Firebase data stale at 2 events from 2020-2021. Mobilize.us is the live replacement. Slice 5H's `townhallproject` stub was always going to be dead code.

2. **Mobilize state-vs-federal classification is regex-based.** `event.event_type` is just `"TOWN_HALL"` — federal vs state distinguishable only via title pattern matching. Operator monitors `officialsUnmatched[]` rate for title-drift signals. NE unicameral edge case: legislators currently classify as `state_senate` (acceptable since chamber enum from slice 5C accepts both `state_legislature` and `state_senate` for NE).

3. **Chamber inference from title.** Mobilize doesn't structure chamber — `inferChamberFromTitle()` does the mapping: "State Senator" → `state_senate`; "Assemblymember/Delegate/State Rep" → `state_house`. Order of regex tests matters: senate match must come FIRST (otherwise "State Rep" subsumes "State Senator" — they share the "State" prefix).

4. **`resolveOfficialByName` cross-domain reuse.** Slice 5E's helper in `state-finance/shared.ts` was reused by `mobilize.ts` in `state-community/`. Cast `state as FinanceState` since the helper's TypeScript type is constrained to 5 states; the underlying SQL accepts any state code. Future cleanup: move `resolveOfficialByName` to a general `seed/shared/officials.ts` module so cross-domain reuse doesn't require the type cast.

5. **`yaml` package was already a workspace dep** via slice 5C's `openstates-yaml-loader.ts`. The slice 5I adapter could have shipped with YAML support from day 1 — operator-follow-up convention bit us here. Future production-parser slices should default to "include the realistic parser" rather than "ship JSON.parse stub".

6. **OCD-jurisdiction format = `ocd-jurisdiction/country:us/state:XX/government`.** Slice 5C's actual YAML format. Slice 5I assumed plain 2-letter codes which never matched the cache. `JURISDICTION_RE = /state:([a-z]{2})\//i` extracts the state code; defensive fallback for plain 2-letter codes preserved.

7. **External_id stable per event.** `mobilize-${event.id}` works because Mobilize event IDs are stable across pagination + re-fetches. `(source, external_id)` UNIQUE on `state_town_halls` (slice 5H migration 0042) handles dedup transparently.

8. **Hard-cap pagination at 50 pages** to prevent runaway fetches. ~50 × 100 = 5000 events; well above current Mobilize ~2,400 actual events. Increase if Mobilize grows.

9. **No CI validation of real Mobilize fetches.** Operator runs `pnpm seed:state-community --component=halls` manually post-merge to verify real-data flow. Network calls are out of CI scope.

10. **Stub-shipping pattern validated.** 5G/5H/5I shipped 37 stub adapters. Slice 7 wired 1 substantive + 1 bug fix in ~8 commits. Remaining 35 parsers can follow the same pattern — operator picks high-value targets (e.g., NRA-PVF nationwide, Ballotpedia recalls, per-state CA FPPC scrapers) and follows the slice 7 template.

**Active follow-ups (operator):**

- Remaining 35 stub adapters across 5G/5H/5I — operator wires highest-value targets first
- `resolveOfficialByName` move to `seed/shared/officials.ts` general module (eliminates `as FinanceState` cast)
- 7-day on-disk cache for Mobilize (slice 5D pattern) if rate-limited
- Federal `town_halls` (migration 0022) source/external_id columns + multi-adapter dedup (5H pattern parity)
- `@chiaro/officials-ui` shared package extraction (still pending from slice 6 closure notes)
- Mobile DoD on-device smoke (deferred since slice 5)
- `@chiaro/location` GeocodIO env var fix for CI test-stability

**Master state at slice 7 closure:** HEAD = `<squash-SHA-after-merge>`. 10 workspace packages unchanged. Migrations 0001-0050. 393 pgTAP plans across 29 files. Web + mobile UI unified across federal + state (slice 6). 2 production parsers live (mobilize + openstates-end-reason).

**Cross-links:** [[project-chiaro-slice5h-community-presence]] [[project-chiaro-slice5i-ethics-accountability]] [[project-chiaro-slice6-federal-redesign]]
```

- [ ] **Step 3: Update MEMORY.md index**

Append to `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`:

```markdown
- [Chiaro slice 7 parser wiring](project_chiaro_slice7_parser_wiring.md) — first 2 production parsers shipped 2026-05-22 (squash TBD). mobilize.us API replaces dead TownHallProject (defunct 2021) as halls nationwide overlay; classifies state-vs-federal via regex on event title; reuses slice 5E resolveOfficialByName. openstates-end-reason (slice 5I) fixed: YAML parsing + OCD-jurisdiction state:XX regex. Validates stub-shipping pattern; 35 remaining stub adapters can follow this template.
```

- [ ] **Step 4: Hand off via finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch`. Recommended: option 1 (squash merge to master locally), matching prior 10 sub-slices.

---

## Verification Checklist (post-Task 8)

- [ ] `mobilize.ts` + helpers compiled + tested + first in halls dispatch order
- [ ] `townhallproject` removed from `ADAPTERS_DEFAULT`; file retained with `@deprecated` JSDoc
- [ ] `openstates-end-reason` handles YAML files; OCD-jurisdiction regex extracts state code
- [ ] CLAUDE.md slice 7 entry + Gotcha #16 added
- [ ] Workspace typecheck clean across all 10 packages
- [ ] Next 15 build clean
- [ ] pgTAP unchanged at 393 plans across 29 files
- [ ] No new env vars required
- [ ] No new migrations
- [ ] Workspace stays at 10 packages

## Known v1 limitations carried over from spec

1. Mobilize name-extraction is regex-heuristic; operator monitors `officialsUnmatched[]` for title drift
2. Federal-vs-state classification depends on title text; vague titles ("Town Hall with Mike Foote") won't classify
3. No caching layer for Mobilize fetches; ~24 requests per full run
4. Mobilize has no documented rate limits as of 2026-05-22
5. `townhallproject` stub remains in codebase for backwards-compat
6. OpenStates YAML fix doesn't add new test fixtures for JSON path (existing covers it)
7. No production-data validation in CI; operator runs manually
8. Mobilize event-count cap absent at v1
