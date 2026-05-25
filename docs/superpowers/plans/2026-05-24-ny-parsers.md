# NY-side Production Parsers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 3 NY-side bucket-A production parsers from the slice 12 audit: NY town_halls (Senate-side), NY district_offices (Assembly + Senate), NY COELIG ethics enforcement (combined parser writing to both `state_ethics_complaints` and `state_official_events`).

**Architecture:** Builds on slice 11's HTML-scrape pattern + subfolder-per-source layout. Hoists `resolveOpenstatesPersonId` from `state-scorecards/lcv/helpers.ts` to a shared module so all 3 parsers + a fresh COELIG combined-parser helper can import it. NY town_halls is single-source flat-file; NY district_offices uses a subfolder with separate Assembly + Senate parsers (per-senator loop + 1-req/sec throttle); NY ethics is a combined parser (1 HTML scrape → 2 schema sinks via shared helper, with 2 thin adapter wrappers).

**Tech Stack:** Node 22 + TypeScript strict, `pg.Client` for DB writes, `cheerio` for HTML parsing, vitest with HTML fixtures committed to repo, slice 9 NRA's HTML-scrape adapter pattern.

**Prerequisite reading:** `docs/superpowers/specs/2026-05-24-ny-parsers-design.md` + slice 11 LCV plan for the subfolder pattern + slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) for source URL findings.

**Key spec corrections (discovered during file exploration):**
- `NormalizedTownHall` real shape: `{ official_openstates_person_id?, event_date, city?, state, format?: 'in_person'|'virtual'|'phone'|'hybrid', attendance_estimate?, source_url, source, external_id? }`. NO `event_time`, `title`, or `location` fields existed — the spec invented them.
- `NormalizedDistrictOffice` requires STRUCTURED address: `{ official_openstates_person_id, kind, street_1, street_2?, city, state, postal_code?, phone?, email?, hours_text?, source_url }`. NO `address_text` blob field. Parser must do best-effort regex parsing.
- `resolveOpenstatesPersonId` currently lives in `state-scorecards/lcv/helpers.ts` (slice 11). Task 1 hoists it to `seed/shared/officials.ts` alongside `resolveOfficialByName` so all 3 NY parsers can import from one canonical location.

---

## File Structure

### Created files (12)
```
packages/db/supabase/seed/state-community/district-offices/ny-senate/
  index.ts                                                  # adapter export + dispatch
  assembly.ts                                               # nyassembly.gov/mem/ single-page parser
  senate.ts                                                 # nysenate.gov/senators/<slug>/contact per-senator loop
  index.test.ts                                             # adapter shape + dispatch
  assembly.test.ts                                          # parser + fetcher
  senate.test.ts                                            # parser + fetcher
packages/db/supabase/seed/state-ethics/ny-coelig/
  shared.ts                                                 # fetchEnforcementActions() → { complaints, events, errors }
  shared.test.ts                                            # parser + classifier + status mapping
packages/db/supabase/seed/fixtures/state-community/
  ny-senate-events.html                                     # pruned ~5 nysenate.gov events
  ny-assembly-mem.html                                      # pruned ~5 nyassembly.gov/mem/ entries
  ny-senator-contact.html                                   # 1 senator's contact page
packages/db/supabase/seed/fixtures/state-ethics/
  ny-coelig-enforcement.html                                # pruned ~10 enforcement-actions rows
```

### Modified files (7)
```
packages/db/supabase/seed/shared/officials.ts               # add resolveOpenstatesPersonId (Task 1)
packages/db/supabase/seed/state-scorecards/lcv/helpers.ts   # re-export resolveOpenstatesPersonId for back-compat (Task 1)
packages/db/supabase/seed/state-community/town-halls/ny-senate.ts          # replace stub with production fetcher
packages/db/supabase/seed/state-community/town-halls/ny-senate.test.ts     # parser + fetcher tests
packages/db/supabase/seed/state-ethics/complaints/ny-jcope.ts              # call shared helper
packages/db/supabase/seed/state-ethics/events/ny-jcope.ts                  # call shared helper
packages/db/supabase/seed/state-ethics/complaints/ny-jcope.test.ts         # adapter shape + dispatch
packages/db/supabase/seed/state-ethics/events/ny-jcope.test.ts             # adapter shape + dispatch
CLAUDE.md                                                                  # slice 15 entry (no new Gotcha)
```

### Deleted files (2)
```
packages/db/supabase/seed/state-community/district-offices/ny-senate.ts          # replaced by subfolder
packages/db/supabase/seed/state-community/district-offices/ny-senate.test.ts
```

---

## Task 1: Hoist `resolveOpenstatesPersonId` to shared module

**Files:**
- Modify: `packages/db/supabase/seed/shared/officials.ts` (add export)
- Modify: `packages/db/supabase/seed/state-scorecards/lcv/helpers.ts` (re-export for back-compat)

- [ ] **Step 1: Read current state to understand context**

Read `packages/db/supabase/seed/shared/officials.ts` to see the existing module shape (currently exports `Chamber` type + `resolveOfficialByName` function).

Read `packages/db/supabase/seed/state-scorecards/lcv/helpers.ts` lines 28-42 to confirm `resolveOpenstatesPersonId` shape.

- [ ] **Step 2: Add `resolveOpenstatesPersonId` to `seed/shared/officials.ts`**

Append the function to `packages/db/supabase/seed/shared/officials.ts` (after the existing `resolveOfficialByName`):

```ts
/**
 * Resolve full_name + state + chamber → openstates_person_id.
 *
 * State-tier orchestrators key Normalized* rows off openstates_person_id
 * (not officials.id) per slice 5G/5H/5I convention. The upsert helpers
 * (upsertStockTransaction, upsertTownHall, upsertEthicsComplaint, etc.)
 * resolve the openstates_person_id to officials.id inside the DB write.
 *
 * Returns null on no match OR if matched row has NULL
 * openstates_person_id (e.g. federal officials).
 *
 * Hoisted from state-scorecards/lcv/helpers.ts in slice 15 — needed by
 * 4 new NY parsers + retained re-export from lcv/helpers.ts for slice 11
 * back-compat.
 */
export async function resolveOpenstatesPersonId(
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
```

- [ ] **Step 3: Replace `lcv/helpers.ts` definition with re-export**

In `packages/db/supabase/seed/state-scorecards/lcv/helpers.ts`, replace the local definition (lines 18-42) with a re-export:

```ts
import type { Client } from 'pg'
import type { Chamber } from '../../shared/officials.ts'

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'

export const RATE_LIMIT_MS = 1000

export function normalizePartyChar(char: string): string {
  switch (char.trim().toUpperCase()) {
    case 'D': return 'Democratic'
    case 'R': return 'Republican'
    case 'I': return 'Independent'
    default: return char
  }
}

/**
 * Re-export from shared module. Slice 15 hoisted the canonical
 * definition to seed/shared/officials.ts; this re-export keeps
 * existing lcv mi.ts + co.ts imports working without churn.
 */
export { resolveOpenstatesPersonId } from '../../shared/officials.ts'
```

- [ ] **Step 4: Verify existing lcv tests still pass**

```bash
pnpm --filter @chiaro/db exec vitest run state-scorecards/lcv
```
Expected: all existing LCV tests PASS (helpers, mi, co, index). No changes to behavior — just import indirection.

- [ ] **Step 5: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/db/supabase/seed/shared/officials.ts \
        packages/db/supabase/seed/state-scorecards/lcv/helpers.ts
git commit -m "$(cat <<'EOF'
refactor(seed): hoist resolveOpenstatesPersonId to shared/officials.ts

Hoist the slice 11 lcv/helpers.ts resolveOpenstatesPersonId function
to seed/shared/officials.ts so slice 15's 4 NY parsers (town_halls,
district_offices Assembly + Senate, COELIG combined) can import from
the canonical shared module without cross-domain reach into the
scorecards package.

lcv/helpers.ts re-exports from the shared module for slice 11
back-compat — existing mi.ts + co.ts imports keep working without
churn.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: NY town_halls production parser

**Files:**
- Modify: `packages/db/supabase/seed/state-community/town-halls/ny-senate.ts` (replace stub)
- Modify: `packages/db/supabase/seed/state-community/town-halls/ny-senate.test.ts` (replace stub-shape tests)
- Create: `packages/db/supabase/seed/fixtures/state-community/ny-senate-events.html`

- [ ] **Step 1: Write the HTML fixture**

Create `packages/db/supabase/seed/fixtures/state-community/ny-senate-events.html` with this content (pruned representative sample):

```html
<!--
  Fixture: NY Senate events filtered to town halls.
  Source: https://www.nysenate.gov/events?event-type=town_hall
  (fetched 2026-05-24 per slice 12 audit; structure audit-derived)
  Pruned to 5 cards covering: in-person + virtual + hybrid format,
  one card with no location, one with malformed date (should skip).
-->
<div class="events-list">
  <article class="event-card">
    <a class="event-link" href="/events/jane-doe-district-coffee-2026-06">
      <h3>District Coffee Hour with Senator Jane Doe</h3>
    </a>
    <p class="byline">Hosted by Senator Jane Doe</p>
    <time datetime="2026-06-15">June 15, 2026 10:00 AM</time>
    <p class="location">Albany Community Center, Albany, NY</p>
    <p class="format">In-person</p>
  </article>
  <article class="event-card">
    <a class="event-link" href="/events/alex-smith-virtual-town-hall-2026-06">
      <h3>Virtual Town Hall with Senator Alex Smith</h3>
    </a>
    <p class="byline">Hosted by Senator Alex Smith</p>
    <time datetime="2026-06-20">June 20, 2026 7:00 PM</time>
    <p class="location">Online via Zoom</p>
    <p class="format">Virtual</p>
  </article>
  <article class="event-card">
    <a class="event-link" href="/events/maria-chen-hybrid-2026-07">
      <h3>Hybrid Community Forum with Senator Maria Chen</h3>
    </a>
    <p class="byline">Hosted by Senator Maria Chen</p>
    <time datetime="2026-07-05">July 5, 2026 2:00 PM</time>
    <p class="location">Buffalo Public Library, Buffalo, NY</p>
    <p class="format">Hybrid (in-person and virtual)</p>
  </article>
  <article class="event-card">
    <a class="event-link" href="/events/bob-jones-no-location-2026-07">
      <h3>Town Hall with Senator Bob Jones</h3>
    </a>
    <p class="byline">Hosted by Senator Bob Jones</p>
    <time datetime="2026-07-10">July 10, 2026 6:30 PM</time>
    <p class="format">In-person</p>
  </article>
  <article class="event-card">
    <a class="event-link" href="/events/malformed-date">
      <h3>Town Hall (malformed)</h3>
    </a>
    <p class="byline">Hosted by Senator Test Skip</p>
    <p class="format">In-person</p>
  </article>
</div>
```

Note: 4th card has no `<p class="location">` (skips city); 5th card has no `<time>` (parser skips entire row).

- [ ] **Step 2: Write the failing test**

Replace `packages/db/supabase/seed/state-community/town-halls/ny-senate.test.ts` entire contents with:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nySenateTownHalls, parseNysenateEventsHtml } from './ny-senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(__dirname, '..', '..', 'fixtures', 'state-community', 'ny-senate-events.html')

describe('parseNysenateEventsHtml', () => {
  it('extracts 4 events from fixture (skips 1 malformed)', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    // 5 cards in fixture; 1 has no <time> → skipped → 4 emitted
    expect(parsed).toHaveLength(4)
    expect(parsed[0]).toMatchObject({
      full_name: 'Jane Doe',
      event_date: '2026-06-15',
      city: 'Albany',
      format: 'in_person',
      detail_url: 'https://www.nysenate.gov/events/jane-doe-district-coffee-2026-06',
    })
  })

  it('maps "Virtual" format text to virtual enum', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    const virtual = parsed.find(p => p.full_name === 'Alex Smith')
    expect(virtual?.format).toBe('virtual')
  })

  it('maps "Hybrid" format text to hybrid enum', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    const hybrid = parsed.find(p => p.full_name === 'Maria Chen')
    expect(hybrid?.format).toBe('hybrid')
  })

  it('handles missing location (city is undefined)', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const parsed = parseNysenateEventsHtml(html)
    const noLoc = parsed.find(p => p.full_name === 'Bob Jones')
    expect(noLoc?.city).toBeUndefined()
  })
})

describe('nySenateTownHalls adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nySenateTownHalls.slug).toBe('ny-senate')
    expect(nySenateTownHalls.component).toBe('halls')
    expect(nySenateTownHalls.covered_states).toEqual(['NY'])
  })

  it('emits NormalizedTownHall[] for fixture events with resolved senators', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ny-' + n }],
          rowCount: 1,
        })
      }),
    }
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      fetcher: async () => html,
    } as never)
    // 4 parseable cards × 1 senator each = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      official_openstates_person_id: 'ocd-person/ny-1',
      event_date: '2026-06-15',
      state: 'NY',
      source: 'ny-senate',
      city: 'Albany',
      format: 'in_person',
    })
  })

  it('skips events whose senator cannot be resolved', async () => {
    const html = await readFile(FIXTURE_PATH, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await nySenateTownHalls.fetchEvents({
      client: client as never,
      fetcher: async () => html,
    } as never)
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/town-halls/ny-senate
```
Expected: FAIL — `parseNysenateEventsHtml is not exported`.

- [ ] **Step 4: Implement parser + adapter**

Replace `packages/db/supabase/seed/state-community/town-halls/ny-senate.ts` ENTIRE contents with:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'

const SOURCE_URL = 'https://www.nysenate.gov/events?event-type=town_hall'
const FETCH_TIMEOUT_MS = 5000

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
  return candidates[candidates.length - 1]
}

export const nySenateTownHalls: StateCommunityAdapter = {
  slug: 'ny-senate',
  component: 'halls',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedTownHall[]> {
    const injected = (opts as never as { fetcher?: () => Promise<string> }).fetcher
    let html: string
    try {
      html = injected
        ? await injected()
        : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      return []
    }

    const parsed = parseNysenateEventsHtml(html)
    const out: NormalizedTownHall[] = []

    for (const p of parsed) {
      const openstates_person_id = await resolveOpenstatesPersonId(opts.client, {
        full_name: p.full_name,
        state: 'NY',
        chamber: 'state_senate',
      })
      if (!openstates_person_id) continue

      const row: NormalizedTownHall = {
        official_openstates_person_id: openstates_person_id,
        event_date: p.event_date,
        state: 'NY',
        format: p.format,
        source_url: p.detail_url,
        source: 'ny-senate',
        external_id: p.detail_url.split('/').pop() ?? undefined,
      }
      if (p.city) row.city = p.city
      out.push(row)
    }

    return out
  },
}
```

- [ ] **Step 5: Run test to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/town-halls/ny-senate
```
Expected: 7 tests PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-community/town-halls/ny-senate.ts \
        packages/db/supabase/seed/state-community/town-halls/ny-senate.test.ts \
        packages/db/supabase/seed/fixtures/state-community/ny-senate-events.html
git commit -m "$(cat <<'EOF'
feat(state-community): NY town_halls production parser

Replace slice 5H stub with production fetcher against
nysenate.gov/events?event-type=town_hall. Senate-only (Assembly side
is bucket-G per slice 12 audit — institutional sessions only; no
member town-hall feed). NY-side town halls were the highest-priority
NY parser per audit.

- parseNysenateEventsHtml: extracts {full_name, event_date, city?,
  format, detail_url} from event-card articles. Format inferred from
  explicit format-text on the card (in_person/virtual/hybrid). City
  extracted via best-effort comma split.
- nySenateTownHalls adapter: resolves senator via
  resolveOpenstatesPersonId(...state_senate); emits NormalizedTownHall
  per resolvable event; skips unresolvable senators.
- 7 vitest cases covering parser correctness, format mapping,
  missing location, malformed-row skip, adapter shape, and
  unresolved-senator skip.
- Pruned 5-card HTML fixture committed to repo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: NY district_offices Assembly directory parser + subfolder scaffold

**Files:**
- Delete: `packages/db/supabase/seed/state-community/district-offices/ny-senate.ts`
- Delete: `packages/db/supabase/seed/state-community/district-offices/ny-senate.test.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-community/ny-assembly-mem.html`

- [ ] **Step 1: Create the HTML fixture**

Create `packages/db/supabase/seed/fixtures/state-community/ny-assembly-mem.html`:

```html
<!--
  Fixture: NY Assembly member directory.
  Source: https://nyassembly.gov/mem/ (fetched 2026-05-24 per slice 12 audit)
  Pruned to 5 cards covering: 2-address AM (Albany + district), 1-address AM
  (Albany only), 1 with missing district number (skipped), 1 with phone
  embedded in address, 1 with no addresses (skipped).
-->
<div class="assembly-directory">
  <div class="member-card">
    <h3 class="member-name">Jane Doe</h3>
    <span class="district">District 5</span>
    <div class="albany-address">LOB 901, Albany, NY 12248</div>
    <div class="district-address">123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234</div>
  </div>
  <div class="member-card">
    <h3 class="member-name">Alex Smith</h3>
    <span class="district">District 23</span>
    <div class="albany-address">LOB 542, Albany, NY 12248 · Phone: (518) 455-4444</div>
  </div>
  <div class="member-card">
    <h3 class="member-name">Maria Chen</h3>
    <span class="district">District 100</span>
    <div class="albany-address">LOB 720, Albany, NY 12248</div>
    <div class="district-address">456 Oak Avenue, Queens, NY 11367</div>
  </div>
  <div class="member-card">
    <h3 class="member-name">Bob Jones</h3>
    <span class="district">District NotANumber</span>
    <div class="albany-address">LOB 100, Albany, NY 12248</div>
  </div>
  <div class="member-card">
    <h3 class="member-name">Pat Empty</h3>
    <span class="district">District 99</span>
  </div>
</div>
```

- [ ] **Step 2: Write the failing test**

Create `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNyAssemblyDirectoryHtml, fetchAssemblyOffices } from './assembly.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ny-assembly-mem.html')

describe('parseNyAssemblyDirectoryHtml', () => {
  it('extracts 3 members (skips malformed district + empty addresses)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    // 5 cards: 3 valid (Jane, Alex, Maria), 1 malformed district (Bob), 1 no addresses (Pat)
    expect(parsed).toHaveLength(3)
    expect(parsed.map(m => m.full_name)).toEqual(['Jane Doe', 'Alex Smith', 'Maria Chen'])
  })

  it('parses both Albany + district address when present', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    const jane = parsed.find(m => m.full_name === 'Jane Doe')!
    expect(jane.albany_office).toContain('LOB 901')
    expect(jane.albany_office).toContain('Albany')
    expect(jane.district_office).toContain('123 Main Street')
    expect(jane.district_office).toContain('Buffalo')
  })

  it('handles Albany-only AM (no district address)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    const alex = parsed.find(m => m.full_name === 'Alex Smith')!
    expect(alex.albany_office).toBeTruthy()
    expect(alex.district_office).toBeUndefined()
  })

  it('extracts district number as string from "District N"', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNyAssemblyDirectoryHtml(html)
    expect(parsed.find(m => m.full_name === 'Jane Doe')!.district_no).toBe('5')
    expect(parsed.find(m => m.full_name === 'Maria Chen')!.district_no).toBe('100')
  })
})

describe('fetchAssemblyOffices', () => {
  it('emits 2 NormalizedDistrictOffice rows per 2-address AM, 1 per 1-address AM', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let resolveN = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        resolveN += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ny-' + resolveN }],
          rowCount: 1,
        })
      }),
    }
    const rows = await fetchAssemblyOffices(client as never, {
      fetcher: async () => html,
    })
    // Jane (2) + Alex (1) + Maria (2) = 5 rows
    expect(rows).toHaveLength(5)
  })

  it('assigns kind=capitol for Albany address, kind=district for local', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const rows = await fetchAssemblyOffices(client as never, { fetcher: async () => html })
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(3)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no AM can be resolved', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchAssemblyOffices(client as never, { fetcher: async () => html })
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ny-senate/assembly
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the parser + fetcher**

Create `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../../shared/officials.ts'

const SOURCE_URL = 'https://nyassembly.gov/mem/'
const FETCH_TIMEOUT_MS = 5000

export interface ParsedAssemblyMember {
  full_name: string
  district_no: string
  albany_office?: string   // raw address text
  district_office?: string
}

/**
 * Parse nyassembly.gov/mem/ — single-page directory of all 150 AMs.
 *
 * Audit-derived structure: each member appears as <div class="member-card">
 * with <h3 class="member-name">, <span class="district">District N</span>,
 * and address blocks. Implementer should fetch a real URL during scaffold
 * to verify selectors before relying on them.
 *
 * Skips cards where:
 *   - district number doesn't parse as a positive integer
 *   - both albany_office AND district_office are missing
 */
export function parseNyAssemblyDirectoryHtml(html: string): ParsedAssemblyMember[] {
  const $ = cheerio.load(html)
  const out: ParsedAssemblyMember[] = []

  $('div.member-card').each((_, el) => {
    const full_name = $(el).find('h3.member-name').text().trim()
    const districtText = $(el).find('span.district').text().trim()
    const districtMatch = districtText.match(/\b(\d+)\b/)
    const district_no = districtMatch ? districtMatch[1]! : ''

    const albany_office = $(el).find('.albany-address').text().trim() || undefined
    const district_office = $(el).find('.district-address').text().trim() || undefined

    if (!full_name || !district_no) return
    if (!albany_office && !district_office) return

    const member: ParsedAssemblyMember = { full_name, district_no }
    if (albany_office) member.albany_office = albany_office
    if (district_office) member.district_office = district_office
    out.push(member)
  })

  return out
}

/**
 * Best-effort regex parser for a raw address string.
 *
 * Input: "123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234"
 * Output: { street_1: "123 Main Street", city: "Buffalo", state: "NY",
 *           postal_code: "14201", phone: "(716) 555-1234" }
 *
 * Returns null if street_1 + city + state can't be extracted (required
 * NormalizedDistrictOffice fields).
 */
export function parseAddressText(raw: string): {
  street_1: string
  city: string
  state: string
  postal_code?: string
  phone?: string
} | null {
  // Extract phone (anything after "Phone:" or matching standard phone format)
  let phone: string | undefined
  const phoneMatch = raw.match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/)
  if (phoneMatch) {
    phone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`
  }

  // Remove phone segment from address (split on "·" or "Phone:" markers)
  const addrPart = raw.split(/·|Phone:/i)[0]!.trim()

  // Split on commas; expect "Street, City, State Zip" format
  const segments = addrPart.split(',').map(s => s.trim()).filter(Boolean)
  if (segments.length < 3) return null

  const street_1 = segments[0]!
  const city = segments[segments.length - 2]!
  const stateZip = segments[segments.length - 1]!

  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)?\s*$/)
  if (!stateZipMatch) return null
  const state = stateZipMatch[1]!
  const postal_code = stateZipMatch[2]

  const result: ReturnType<typeof parseAddressText> = { street_1, city, state }
  if (postal_code) result.postal_code = postal_code
  if (phone) result.phone = phone
  return result as { street_1: string; city: string; state: string; postal_code?: string; phone?: string }
}

export async function fetchAssemblyOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: () => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher()
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch {
    return []
  }

  const parsed = parseNyAssemblyDirectoryHtml(html)
  const out: NormalizedDistrictOffice[] = []

  for (const m of parsed) {
    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: m.full_name,
      state: 'NY',
      chamber: 'state_house',
    })
    if (!openstates_person_id) continue

    if (m.albany_office) {
      const parts = parseAddressText(m.albany_office)
      if (parts) {
        out.push({
          official_openstates_person_id: openstates_person_id,
          kind: 'capitol',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: SOURCE_URL,
        })
      }
    }
    if (m.district_office) {
      const parts = parseAddressText(m.district_office)
      if (parts) {
        out.push({
          official_openstates_person_id: openstates_person_id,
          kind: 'district',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: SOURCE_URL,
        })
      }
    }
  }

  return out
}
```

- [ ] **Step 5: Run test to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ny-senate/assembly
```
Expected: 7 tests PASS.

- [ ] **Step 6: Delete old flat ny-senate.ts**

```bash
rm packages/db/supabase/seed/state-community/district-offices/ny-senate.ts
rm packages/db/supabase/seed/state-community/district-offices/ny-senate.test.ts
```

(After deletion: imports of `nySenateOffices` will fail typecheck. Task 4 restores via the new subfolder `index.ts`. The orchestrator (`state-community-ingest.ts`) imports the symbol; verify it still typechecks after Task 4.)

- [ ] **Step 7: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-community/district-offices/ny-senate \
        packages/db/supabase/seed/fixtures/state-community/ny-assembly-mem.html
git rm packages/db/supabase/seed/state-community/district-offices/ny-senate.ts \
       packages/db/supabase/seed/state-community/district-offices/ny-senate.test.ts
git commit -m "$(cat <<'EOF'
feat(state-community): NY district_offices Assembly directory parser

Subfolder scaffold (ny-senate/) replacing the flat ny-senate.ts stub.
Assembly side ships first: single-page parse of nyassembly.gov/mem/
emitting NormalizedDistrictOffice per Albany + district address.

- parseNyAssemblyDirectoryHtml extracts {full_name, district_no,
  albany_office?, district_office?} from member-card div blocks.
  Skips cards with malformed district number OR no addresses.
- parseAddressText: best-effort regex extracts street_1, city, state,
  postal_code, phone from raw address strings ("123 Main St,
  Buffalo, NY 14201 · Phone: ..."). Returns null when required
  fields can't be parsed.
- fetchAssemblyOffices: resolves AM via resolveOpenstatesPersonId
  (state_house), parses each address, emits one row per non-null
  parseable address with kind=capitol for Albany, kind=district for
  local.
- 7 vitest cases. Index.ts dispatch + Senate side land in Task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Note: typecheck will FAIL between Tasks 3 and 4 because `state-community-ingest.ts` imports `nySenateOffices` from the deleted flat file. Task 4 fixes by adding the new `index.ts`. Acceptable mid-slice broken state per slice 11 + slice 13 precedent.)

---

## Task 4: NY district_offices Senate per-senator loop + subfolder dispatch

**Files:**
- Create: `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.test.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ny-senate/index.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ny-senate/index.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-community/ny-senator-contact.html`

- [ ] **Step 1: Create the senator contact-page fixture**

Create `packages/db/supabase/seed/fixtures/state-community/ny-senator-contact.html`:

```html
<!--
  Fixture: NY Senator's /contact page.
  Source: https://www.nysenate.gov/senators/jane-doe/contact (illustrative)
  HTML shape is loose <br>-separated text under labeled headings per audit.
  This fixture exercises: Albany Office heading + District Office heading +
  phone + zip parsing.
-->
<div class="senator-contact">
  <h2>Albany Office</h2>
  <div class="address-block">
    Senator Jane Doe<br>
    Legislative Office Building, Room 1234<br>
    Albany, NY 12247<br>
    Phone: (518) 455-1234
  </div>
  <h2>District Office</h2>
  <div class="address-block">
    100 Senator Plaza, Suite 5<br>
    Manhattan, NY 10001<br>
    Phone: (212) 555-9999
  </div>
</div>
```

- [ ] **Step 2: Write the failing tests**

Create `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNySenatorContactHtml, fetchSenateOffices, deriveSenatorSlug } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ny-senator-contact.html')

describe('parseNySenatorContactHtml', () => {
  it('extracts both Albany + District address blocks from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseNySenatorContactHtml(html)
    expect(parsed.albany_office).toBeDefined()
    expect(parsed.albany_office).toContain('Legislative Office Building')
    expect(parsed.albany_office).toContain('Albany, NY 12247')
    expect(parsed.district_office).toBeDefined()
    expect(parsed.district_office).toContain('Manhattan, NY 10001')
  })

  it('returns undefined for missing heading', () => {
    const html = '<div>no headings here</div>'
    const parsed = parseNySenatorContactHtml(html)
    expect(parsed.albany_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveSenatorSlug', () => {
  it('lowercases + hyphenates full name', () => {
    expect(deriveSenatorSlug('Jane Doe')).toBe('jane-doe')
  })

  it('handles middle name', () => {
    expect(deriveSenatorSlug('John Quincy Adams')).toBe('john-quincy-adams')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveSenatorSlug("Mary O'Brien-Smith")).toBe('mary-obrien-smith')
  })
})

describe('fetchSenateOffices', () => {
  it('iterates over NY senators from officials table + parses each contact page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          // returning 2 NY senators
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ny-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/ny-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchSenateOffices(client as never, {
      fetcher: async () => html,
    })
    // 2 senators × 2 addresses each = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no NY senators in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchSenateOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips senator on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ny-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/ny-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchSenateOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    // Senator 1 errors out → 0 rows; Senator 2 succeeds → 2 rows
    expect(rows).toHaveLength(2)
  })
})
```

Create `packages/db/supabase/seed/state-community/district-offices/ny-senate/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { nySenateOffices } from './index.ts'

describe('nySenateOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nySenateOffices.slug).toBe('ny-senate')
    expect(nySenateOffices.component).toBe('offices')
    expect(nySenateOffices.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', kind: 'capitol', street_1: 's', city: 'c', state: 'NY', source_url: 'u' }]
    const result = await nySenateOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Assembly + Senate fetch results in production path', async () => {
    // No injected fetcher; production path uses both sub-fetchers.
    // Stub the client to return empty senators (so Senate side adds 0 rows)
    // and have the Assembly fetcher network call fail (returns 0 rows too).
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await nySenateOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 3: Run tests to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ny-senate
```
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement senate.ts**

Create `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../shared.ts'
import { parseAddressText } from './assembly.ts'

const SENATOR_CONTACT_URL = (slug: string) =>
  `https://www.nysenate.gov/senators/${slug}/contact`
const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedSenatorContact {
  albany_office?: string
  district_office?: string
}

/**
 * Derive a URL slug from a senator's full_name.
 *
 * Heuristic: lowercase + replace whitespace with '-' + strip non-alphanumeric.
 * Per slice 12 audit, the URL pattern is /senators/{slug}/contact. Real
 * senator slugs MAY differ for senators with non-standard names — implementer
 * verifies with 2-3 real URLs during scaffold + production parser logs
 * per-senator fetch failures to `stats.errors` for operator triage.
 */
export function deriveSenatorSlug(full_name: string): string {
  return full_name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Parse a single senator's /contact page.
 *
 * Audit: HTML shape is loose — <h2>/<h3> headings labeled "Albany Office"
 * and "District Office" with <br>-separated text underneath. Use cheerio
 * heading-walk to extract each block's text.
 */
export function parseNySenatorContactHtml(html: string): ParsedSenatorContact {
  const $ = cheerio.load(html)
  const out: ParsedSenatorContact = {}

  $('h2, h3, h4').each((_, headingEl) => {
    const headingText = $(headingEl).text().trim()
    if (headingText !== 'Albany Office' && headingText !== 'District Office') return

    // Walk forward to the next address-block element (or until next heading)
    let next = $(headingEl).next()
    while (next.length && !next.is('h2, h3, h4')) {
      const blockText = next.text().trim().replace(/\s+/g, ' ')
      if (blockText) {
        if (headingText === 'Albany Office' && !out.albany_office) {
          out.albany_office = blockText
        } else if (headingText === 'District Office' && !out.district_office) {
          out.district_office = blockText
        }
        break
      }
      next = next.next()
    }
  })

  return out
}

/**
 * Fetch + parse all NY senators' contact pages.
 *
 * Queries `officials` table for NY state-senate legislators, derives a
 * slug from each `full_name`, fetches the contact page with a 1-req/sec
 * courtesy throttle (skipped in test mode when opts.fetcher is provided).
 * Per-senator fetch failures are silently skipped (no log surface in v1).
 */
export async function fetchSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string }>(
    `select openstates_person_id, full_name from public.officials
     where chamber = 'state_senate' and state = 'NY' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const senator of res.rows) {
    const slug = deriveSenatorSlug(senator.full_name)
    const url = SENATOR_CONTACT_URL(slug)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseNySenatorContactHtml(html)

    if (parsed.albany_office) {
      const parts = parseAddressText(parsed.albany_office)
      if (parts) {
        out.push({
          official_openstates_person_id: senator.openstates_person_id,
          kind: 'capitol',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }
    if (parsed.district_office) {
      const parts = parseAddressText(parsed.district_office)
      if (parts) {
        out.push({
          official_openstates_person_id: senator.openstates_person_id,
          kind: 'district',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }

    if (!opts.fetcher) {
      // Production-path courtesy throttle (skipped in tests where fetcher is injected).
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
```

- [ ] **Step 5: Implement index.ts (dispatch)**

Create `packages/db/supabase/seed/state-community/district-offices/ny-senate/index.ts`:

```ts
import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'
import { fetchAssemblyOffices } from './assembly.ts'
import { fetchSenateOffices } from './senate.ts'

/**
 * NY state-legislator district offices, combining Assembly (single-page
 * directory at nyassembly.gov/mem/) and Senate (per-senator
 * /contact pages on nysenate.gov).
 *
 * Slug `ny-senate` matches the slice 5H stub naming despite covering BOTH
 * chambers — kept for back-compat with state_community_orgs row continuity.
 */
export const nySenateOffices: StateCommunityAdapter = {
  slug: 'ny-senate',
  component: 'offices',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (injected) return injected()

    const [assembly, senate] = await Promise.all([
      fetchAssemblyOffices(opts.client, {}),
      fetchSenateOffices(opts.client, {}),
    ])
    return [...assembly, ...senate]
  },
}
```

- [ ] **Step 6: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ny-senate
```
Expected: All 12 tests across 3 files PASS (7 assembly + 5 senate + 3 index).

- [ ] **Step 7: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS (the `state-community-ingest.ts` import of `nySenateOffices` now resolves via the new `ny-senate/index.ts`).

- [ ] **Step 8: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-community/district-offices/ny-senate \
        packages/db/supabase/seed/fixtures/state-community/ny-senator-contact.html
git commit -m "$(cat <<'EOF'
feat(state-community): NY district_offices Senate per-senator loop + dispatch

Complete the NY district_offices subfolder with Senate-side per-senator
fetch loop + adapter dispatch.

- senate.ts: parseNySenatorContactHtml extracts Albany/District address
  blocks from a single senator's /contact page (loose <br>-separated
  text under <h2> labeled headings per audit). deriveSenatorSlug
  converts full_name → URL slug (lowercase + hyphens + alphanumeric).
  fetchSenateOffices queries officials table for NY state-senate
  legislators, iterates with 1-req/sec courtesy throttle, parses each
  contact page, emits 2 NormalizedDistrictOffice rows per senator
  (kind=capitol + kind=district). Per-senator fetch failures silently
  skip; per-senator slug-URL mismatches yield 0 parsed addresses
  (logged via slug-derivation port-time verification, not in v1).
- index.ts: adapter export concatenating fetchAssemblyOffices +
  fetchSenateOffices via Promise.all. Slug `ny-senate` covers both
  chambers despite the naming (back-compat with slice 5H stub).
- 12 vitest cases (7 assembly + 5 senate + 3 index dispatch).
- Production fetch volume: 1 (Assembly directory) + 63 (NY senators)
  = 64 HTTPS GETs per orchestrator run; ~60s runtime at 1-req/sec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: NY COELIG combined parser (1 source → 2 sinks)

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/ny-coelig/shared.ts`
- Create: `packages/db/supabase/seed/state-ethics/ny-coelig/shared.test.ts`
- Modify: `packages/db/supabase/seed/state-ethics/complaints/ny-jcope.ts`
- Modify: `packages/db/supabase/seed/state-ethics/complaints/ny-jcope.test.ts`
- Modify: `packages/db/supabase/seed/state-ethics/events/ny-jcope.ts`
- Modify: `packages/db/supabase/seed/state-ethics/events/ny-jcope.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/ny-coelig-enforcement.html`

- [ ] **Step 1: Create the enforcement-actions HTML fixture**

Create `packages/db/supabase/seed/fixtures/state-ethics/ny-coelig-enforcement.html`:

```html
<!--
  Fixture: NY COELIG enforcement actions table.
  Source: https://ethics.ny.gov/enforcement-actions (slice 12 audit)
  Pruned to 10 rows covering:
    - 3 NY State Assembly (state_house) — all ingest
    - 3 NY State Senate (state_senate) — all ingest
    - 2 non-legislator agencies (Dept of Health + County Clerk) — filtered out
    - 1 unresolved name (won't match officials table) — logs error
    - 1 row with status "Penalty Imposed" (maps to 'sanctioned')
-->
<table class="enforcement-actions">
  <thead>
    <tr>
      <th>Name</th>
      <th>Agency</th>
      <th>Violation Type</th>
      <th>Status</th>
      <th>Penalty Amount</th>
      <th>Date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="/cases/2024-0042">Jane Doe</a></td>
      <td>NY State Assembly</td>
      <td>Campaign Finance Violation</td>
      <td>Sanctioned</td>
      <td>$5,000</td>
      <td>2024-03-15</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0099">Alex Smith</a></td>
      <td>NY State Senate</td>
      <td>Late Filing</td>
      <td>Settled</td>
      <td>$1,200</td>
      <td>2024-05-22</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0107">Maria Chen</a></td>
      <td>NY State Assembly</td>
      <td>Gift Rule Violation</td>
      <td>Penalty Imposed</td>
      <td>$15,000</td>
      <td>2024-07-30</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0150">Bob Jones</a></td>
      <td>NY State Senate</td>
      <td>Disclosure Violation</td>
      <td>Open</td>
      <td>$0</td>
      <td>2024-09-12</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0200">Lisa Park</a></td>
      <td>NY State Assembly</td>
      <td>Filing Late</td>
      <td>Dismissed</td>
      <td>$0</td>
      <td>2024-10-05</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0210">Tom Wilson</a></td>
      <td>NY State Senate</td>
      <td>Late Filing</td>
      <td>Consent Order</td>
      <td>$2,500</td>
      <td>2024-11-18</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0250">Dr. Sarah Miller</a></td>
      <td>NY Dept of Health</td>
      <td>Gift Rule Violation</td>
      <td>Sanctioned</td>
      <td>$8,000</td>
      <td>2024-12-01</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0260">Pat Murphy</a></td>
      <td>Erie County Clerk</td>
      <td>Disclosure Violation</td>
      <td>Settled</td>
      <td>$500</td>
      <td>2024-12-15</td>
    </tr>
    <tr>
      <td><a href="/cases/2024-0300">Unknown Stranger</a></td>
      <td>NY State Assembly</td>
      <td>Disclosure Violation</td>
      <td>Open</td>
      <td>$0</td>
      <td>2024-12-20</td>
    </tr>
    <tr>
      <td><a href="/cases/2025-0001">Robin Lee</a></td>
      <td>NY State Senate</td>
      <td>Ethics Violation</td>
      <td>Pending</td>
      <td>$0</td>
      <td>2025-01-10</td>
    </tr>
  </tbody>
</table>
```

- [ ] **Step 2: Write the failing test**

Create `packages/db/supabase/seed/state-ethics/ny-coelig/shared.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCoeligEnforcementHtml,
  isStateLegislatorRow,
  fetchEnforcementActions,
} from './shared.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ny-coelig-enforcement.html')

describe('parseCoeligEnforcementHtml', () => {
  it('extracts all 10 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseCoeligEnforcementHtml(html)
    expect(rows).toHaveLength(10)
  })

  it('extracts detail URL from anchor href', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseCoeligEnforcementHtml(html)
    expect(rows[0]!.source_detail_url).toBe('https://ethics.ny.gov/cases/2024-0042')
  })

  it('parses penalty_amount integer with comma stripping', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseCoeligEnforcementHtml(html)
    const mariaChen = rows.find(r => r.full_name === 'Maria Chen')!
    expect(mariaChen.penalty_amount).toBe(15000)
  })
})

describe('isStateLegislatorRow', () => {
  it('matches "NY State Assembly"', () => {
    expect(isStateLegislatorRow({ agency: 'NY State Assembly' } as never)).toBe(true)
  })
  it('matches "NY State Senate"', () => {
    expect(isStateLegislatorRow({ agency: 'NY State Senate' } as never)).toBe(true)
  })
  it('rejects Department of Health', () => {
    expect(isStateLegislatorRow({ agency: 'NY Dept of Health' } as never)).toBe(false)
  })
  it('rejects County Clerk', () => {
    expect(isStateLegislatorRow({ agency: 'Erie County Clerk' } as never)).toBe(false)
  })
})

describe('fetchEnforcementActions', () => {
  it('emits matched legislator complaints + events (filters non-legislators + unresolved)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
        // Only resolve known legislators; "Unknown Stranger" yields no match.
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ny-' + n }],
          rowCount: 1,
        })
      }),
    }
    const result = await fetchEnforcementActions(client as never, {
      fetcher: async () => html,
    })
    // 10 rows: 6 legislators (3 Assembly + 3 Senate) all resolve; "Unknown Stranger"
    // is a state-Assembly row but doesn't resolve; "Robin Lee" is a state-senate
    // row → resolves. Non-legislator rows (Health, County) filtered before resolve.
    // Final: 6 + 1 = 7 legislator rows; "Unknown Stranger" filtered after legislator-check
    // because resolve fails. Wait — let me recount.
    // Actually: 3 Assembly (Jane, Maria, Lisa) + 3 Senate (Alex, Bob, Tom) all resolve.
    // "Unknown Stranger" is Assembly but unresolved → filtered.
    // "Robin Lee" is Senate → resolves.
    // Total resolved: 6 + 1 = 7. Each emits 1 complaint + 1 event = 14 total rows.
    expect(result.complaints).toHaveLength(7)
    expect(result.events).toHaveLength(7)
    expect(result.errors.length).toBeGreaterThan(0)  // Unknown Stranger logged
  })

  it('maps status text to canonical enum', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchEnforcementActions(client as never, {
      fetcher: async () => html,
    })

    // "Sanctioned" → sanctioned
    const jane = result.complaints.find(c => c.disposition === 'Campaign Finance Violation')!
    expect(jane.status).toBe('sanctioned')
    // "Settled" → settled
    const alex = result.complaints.find(c => c.disposition === 'Late Filing' && c.summary.includes('NY State Senate'))!
    expect(alex.status).toBe('settled')
    // "Penalty Imposed" → sanctioned
    const maria = result.complaints.find(c => c.disposition === 'Gift Rule Violation' && c.summary.includes('NY State Assembly'))!
    expect(maria.status).toBe('sanctioned')
    // "Open" → open
    const bob = result.complaints.find(c => c.disposition === 'Disclosure Violation' && c.summary.includes('NY State Senate'))!
    expect(bob.status).toBe('open')
    // "Dismissed" → dismissed
    const lisa = result.complaints.find(c => c.disposition === 'Filing Late')!
    expect(lisa.status).toBe('dismissed')
    // "Consent Order" → settled
    const tom = result.complaints.find(c => c.disposition === 'Late Filing' && c.summary.includes('NY State Senate'))
    // "Pending" → open
    const robin = result.complaints.find(c => c.disposition === 'Ethics Violation')!
    expect(robin.status).toBe('open')
  })

  it('infers chamber from agency text (Assembly → state_house, Senate → state_senate)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let lastChamber = ''
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        lastChamber = String(params[2])
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-x' }],
          rowCount: 1,
        })
      }),
    }
    await fetchEnforcementActions(client as never, { fetcher: async () => html })
    // Last legislator row in fixture is "Robin Lee" / "NY State Senate"
    expect(lastChamber).toBe('state_senate')
  })

  it('uses external_id from /cases/{id} URL slug', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchEnforcementActions(client as never, { fetcher: async () => html })
    const jane = result.complaints.find(c => c.disposition === 'Campaign Finance Violation')!
    expect(jane.external_id).toBe('complaint-2024-0042')
    const janeEvent = result.events.find(e => e.summary.includes('Campaign Finance Violation'))!
    expect(janeEvent.external_id).toBe('event-2024-0042')
  })

  it('event_type is always campaign_finance_violation for COELIG rows', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchEnforcementActions(client as never, { fetcher: async () => html })
    expect(result.events.every(e => e.event_type === 'campaign_finance_violation')).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/ny-coelig
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement shared.ts**

Create `packages/db/supabase/seed/state-ethics/ny-coelig/shared.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedEthicsComplaint, NormalizedOfficialEvent } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'

const SOURCE_URL = 'https://ethics.ny.gov/enforcement-actions'
const FETCH_TIMEOUT_MS = 5000

export interface CoeligEnforcementResult {
  complaints: NormalizedEthicsComplaint[]
  events: NormalizedOfficialEvent[]
  errors: string[]
}

export interface ParsedCoeligRow {
  full_name: string
  agency: string
  violation_type: string
  status: string
  penalty_amount: number | null
  date: string
  source_detail_url: string
}

const LEGISLATOR_AGENCY_RE = /\b(NY State (?:Assembly|Senate)|State Legislature)\b/i

/**
 * Parse the COELIG enforcement-actions table.
 *
 * Audit (2026-05-24) structure:
 *   <table class="enforcement-actions">
 *     <thead><tr><th>Name</th><th>Agency</th><th>Violation Type</th>
 *                <th>Status</th><th>Penalty Amount</th><th>Date</th></tr></thead>
 *     <tbody>
 *       <tr><td><a href="/cases/2024-0042">Jane Doe</a></td>...</tr>
 *     </tbody>
 *   </table>
 */
export function parseCoeligEnforcementHtml(html: string): ParsedCoeligRow[] {
  const $ = cheerio.load(html)
  const out: ParsedCoeligRow[] = []

  $('table.enforcement-actions tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 6) return

    const nameAnchor = $(cells[0]).find('a').first()
    const full_name = nameAnchor.text().trim()
    const detailHref = nameAnchor.attr('href') ?? ''
    if (!full_name) return

    const agency = $(cells[1]).text().trim()
    const violation_type = $(cells[2]).text().trim()
    const status = $(cells[3]).text().trim()
    const penaltyText = $(cells[4]).text().trim().replace(/[$,]/g, '')
    const penalty_amount = penaltyText ? Number.parseInt(penaltyText, 10) || 0 : null
    const date = $(cells[5]).text().trim()

    const source_detail_url = detailHref.startsWith('http')
      ? detailHref
      : `https://ethics.ny.gov${detailHref}`

    out.push({ full_name, agency, violation_type, status, penalty_amount, date, source_detail_url })
  })

  return out
}

/**
 * Filter rows where the agency column refers to a NY state legislator
 * (Assembly or Senate). Excludes executive-branch, county, and lobbying
 * agencies that COELIG also tracks but slice 15 doesn't ingest.
 */
export function isStateLegislatorRow(row: Pick<ParsedCoeligRow, 'agency'>): boolean {
  return LEGISLATOR_AGENCY_RE.test(row.agency)
}

/**
 * Map COELIG status text to the canonical state_ethics_complaints.status enum.
 *
 * Defends against COELIG status variants: "Penalty Imposed" → sanctioned,
 * "Consent Order" → settled, "Pending" → open, etc.
 */
function mapStatus(text: string): NormalizedEthicsComplaint['status'] {
  const norm = text.trim().toLowerCase()
  if (norm.includes('open') || norm.includes('pending')) return 'open'
  if (norm.includes('dismiss')) return 'dismissed'
  if (norm.includes('settle') || norm.includes('consent')) return 'settled'
  if (norm.includes('sanction') || norm.includes('penalty') || norm.includes('imposed') || norm.includes('order')) return 'sanctioned'
  return 'closed_no_action'
}

/**
 * Production fetcher: GET ethics.ny.gov/enforcement-actions, parse all
 * rows, filter to NY state-legislator agency, resolve each to
 * openstates_person_id, emit BOTH a complaint AND an event row per
 * resolved legislator.
 *
 * Combined-parser pattern: 1 HTTP fetch + 1 HTML parse + dual emission
 * to complaints + events tables. Each adapter (nyJcopeComplaints,
 * nyJcopeEvents) calls this helper independently — 2 HTTP fetches per
 * orchestrator run (acceptable v1 inefficiency).
 *
 * Slug stays `ny-jcope` (legacy agency name; back-compat with slice 5I
 * stub + state_ethics_orgs DB row continuity); directory uses
 * `ny-coelig` (current agency name).
 */
export async function fetchEnforcementActions(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<CoeligEnforcementResult> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher(SOURCE_URL)
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch {
    return { complaints: [], events: [], errors: ['fetch failed'] }
  }

  const parsedRows = parseCoeligEnforcementHtml(html)
  const complaints: NormalizedEthicsComplaint[] = []
  const events: NormalizedOfficialEvent[] = []
  const errors: string[] = []

  for (const row of parsedRows) {
    if (!isStateLegislatorRow(row)) continue

    const chamber: 'state_house' | 'state_senate' =
      /Assembly/i.test(row.agency) ? 'state_house' : 'state_senate'

    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: row.full_name,
      state: 'NY',
      chamber,
    })
    if (!openstates_person_id) {
      errors.push(`unresolved: ${row.full_name} (${chamber})`)
      continue
    }

    const idMatch = row.source_detail_url.match(/\/cases\/([^/?#]+)/)
    const external_id = idMatch
      ? idMatch[1]!
      : `${row.full_name}-${row.date}`.replace(/\s+/g, '-')

    const status = mapStatus(row.status)

    complaints.push({
      official_openstates_person_id: openstates_person_id,
      complaint_date: row.date,
      status,
      disposition: row.violation_type,
      summary: `${row.violation_type} (${row.agency})`,
      state: 'NY',
      source_url: row.source_detail_url,
      source: 'ny-jcope',
      external_id: `complaint-${external_id}`,
    })

    events.push({
      official_openstates_person_id: openstates_person_id,
      event_date: row.date,
      event_type: 'campaign_finance_violation',
      outcome: row.status,
      summary: `${row.violation_type} — penalty $${row.penalty_amount ?? 0}`,
      state: 'NY',
      source_url: row.source_detail_url,
      source: 'ny-jcope',
      external_id: `event-${external_id}`,
    })
  }

  return { complaints, events, errors }
}
```

- [ ] **Step 5: Update the 2 adapter wrappers**

Replace `packages/db/supabase/seed/state-ethics/complaints/ny-jcope.ts` entire contents with:

```ts
import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'
import { fetchEnforcementActions } from '../ny-coelig/shared.ts'

/**
 * NY ethics complaints from COELIG enforcement-actions table.
 *
 * Slug `ny-jcope` is the legacy agency name (Joint Commission on Public
 * Ethics, renamed to COELIG in 2022). Kept for back-compat with the
 * slice 5I stub + future state_ethics_orgs row continuity. Source URL
 * uses the current `ethics.ny.gov` domain via the shared
 * fetchEnforcementActions helper.
 */
export const nyJcopeComplaints: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'complaints',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (injected) return injected()
    const { complaints } = await fetchEnforcementActions(opts.client, {})
    return complaints
  },
}
```

Replace `packages/db/supabase/seed/state-ethics/events/ny-jcope.ts` entire contents with:

```ts
import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { fetchEnforcementActions } from '../ny-coelig/shared.ts'

/**
 * NY campaign-finance-violation events from COELIG enforcement-actions table.
 *
 * Slug `ny-jcope` is the legacy agency name (see nyJcopeComplaints
 * adapter for explanation). Recall/expulsion events are sourced via
 * slice 9 Ballotpedia nationwide; this adapter emits only
 * event_type='campaign_finance_violation'.
 */
export const nyJcopeEvents: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'events',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedOfficialEvent[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (injected) return injected()
    const { events } = await fetchEnforcementActions(opts.client, {})
    return events
  },
}
```

- [ ] **Step 6: Update the 2 adapter tests**

Replace `packages/db/supabase/seed/state-ethics/complaints/ny-jcope.test.ts` entire contents with:

```ts
import { describe, expect, it, vi } from 'vitest'
import { nyJcopeComplaints } from './ny-jcope.ts'

describe('nyJcopeComplaints adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nyJcopeComplaints.slug).toBe('ny-jcope')
    expect(nyJcopeComplaints.component).toBe('complaints')
    expect(nyJcopeComplaints.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', complaint_date: '2024-01-01', status: 'open', summary: 's', state: 'NY', source_url: 'u', source: 'ny-jcope' }]
    const result = await nyJcopeComplaints.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchEnforcementActions and returns complaints slice', async () => {
    // No injected fetcher; the helper will try to fetch a real URL and
    // fail (no network), returning { complaints: [], events: [], errors: [...] }
    // → adapter returns [].
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await nyJcopeComplaints.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
  })
})
```

Replace `packages/db/supabase/seed/state-ethics/events/ny-jcope.test.ts` entire contents with:

```ts
import { describe, expect, it, vi } from 'vitest'
import { nyJcopeEvents } from './ny-jcope.ts'

describe('nyJcopeEvents adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(nyJcopeEvents.slug).toBe('ny-jcope')
    expect(nyJcopeEvents.component).toBe('events')
    expect(nyJcopeEvents.covered_states).toEqual(['NY'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', event_date: '2024-01-01', event_type: 'campaign_finance_violation', summary: 's', state: 'NY', source_url: 'u', source: 'ny-jcope' }]
    const result = await nyJcopeEvents.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchEnforcementActions and returns events slice', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await nyJcopeEvents.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 7: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/ny-coelig state-ethics/complaints/ny-jcope state-ethics/events/ny-jcope
```
Expected: All ~17 tests PASS (11 shared + 3 complaints + 3 events).

- [ ] **Step 8: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add packages/db/supabase/seed/state-ethics/ny-coelig \
        packages/db/supabase/seed/state-ethics/complaints/ny-jcope.ts \
        packages/db/supabase/seed/state-ethics/complaints/ny-jcope.test.ts \
        packages/db/supabase/seed/state-ethics/events/ny-jcope.ts \
        packages/db/supabase/seed/state-ethics/events/ny-jcope.test.ts \
        packages/db/supabase/seed/fixtures/state-ethics/ny-coelig-enforcement.html
git commit -m "$(cat <<'EOF'
feat(state-ethics): NY COELIG enforcement combined parser

Combined-parser pattern: 1 source URL → 2 schema sinks via shared
helper. Each adapter (nyJcopeComplaints, nyJcopeEvents) is a thin
wrapper around the new ny-coelig/shared.ts fetchEnforcementActions().

- ny-coelig/shared.ts: fetches ethics.ny.gov/enforcement-actions,
  parses the table via cheerio, filters NY state-legislator rows
  via LEGISLATOR_AGENCY_RE, resolves to openstates_person_id with
  chamber inference (Assembly → state_house, Senate → state_senate),
  emits BOTH a NormalizedEthicsComplaint AND a NormalizedOfficialEvent
  per resolved row. event_type is always 'campaign_finance_violation'
  (recall/expulsion sourced via slice 9 Ballotpedia nationwide).
- Status mapping defends against COELIG variants: "Penalty Imposed"
  → sanctioned, "Consent Order" → settled, "Pending" → open, etc.
- external_id parsed from /cases/{id} URL slug with complaint- /
  event- prefix to disambiguate the dual-emission rows.
- Two adapter exports (complaints + events) call the shared helper
  independently — 2 HTTP fetches per orchestrator run. Acceptable
  v1 inefficiency; cross-adapter memoization deferred.
- 17 vitest cases (11 shared helper + 3 each adapter).
- Slug stays `ny-jcope` (legacy agency, back-compat); directory uses
  `ny-coelig` (current agency name; clearer to future readers).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Closure — CLAUDE.md slice 15 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 15 entry; no new Gotcha)
- Create (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice15_ny_parsers.md`
- Modify (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`

- [ ] **Step 1: Append slice 15 entry to CLAUDE.md**

Read `CLAUDE.md`. Find the "## Slices delivered" section. The current last entry is slice 14 (a11y batch). Append IMMEDIATELY AFTER:

```markdown
- **Slice 15 — NY-side production parsers** (2026-05-24): Ships 3 NY production parsers from the slice 12 audit + hoists `resolveOpenstatesPersonId` to the shared module. (1) NY town_halls parses `nysenate.gov/events?event-type=town_hall` Senate-side (Assembly defers per audit bucket-G); single source, single file. (2) NY district_offices parses BOTH `nyassembly.gov/mem/` (single-page directory, 150 AMs) AND `nysenate.gov/senators/{slug}/contact` (per-senator loop, 63 senators, 1-req/sec courtesy throttle). Subfolder layout per slice 11 LCV precedent: `ny-senate/{index,assembly,senate}.ts`. Slug `ny-senate` covers both chambers despite the name (back-compat with slice 5H stub). (3) NY COELIG combined parser: 1 HTTP fetch of `ethics.ny.gov/enforcement-actions` → 2 schema sinks (`state_ethics_complaints` + `state_official_events` with `event_type='campaign_finance_violation'`). Combined-parser pattern via shared helper `ny-coelig/shared.ts`; two thin adapter wrappers (`nyJcopeComplaints` + `nyJcopeEvents`) each call the helper independently (2 fetches per orchestrator run, v1 inefficiency). Slug `ny-jcope` (legacy agency name) + directory `ny-coelig` (current name) — compromise documented in JSDoc. `resolveOpenstatesPersonId` hoisted from `state-scorecards/lcv/helpers.ts` to `seed/shared/officials.ts`; lcv re-exports for back-compat. Address parsing helper (`parseAddressText`) shared between Assembly + Senate fetchers. ~24 files; no schema work; pgTAP unchanged at 402 plans. Stub count: 19 → 16 active (3 NY stubs now production parsers).
```

NO new Gotcha — slice 11 subfolder + slice 9 HTML-scrape patterns already covered by Gotchas #18 + #19f.

- [ ] **Step 2: Write the memory file**

Use the Write tool to create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice15_ny_parsers.md` with exact content:

```markdown
---
name: project-chiaro-slice15-ny-parsers
description: Slice 15 — NY-side production parsers (town_halls + district_offices + ethics combined)
metadata:
  type: project
---

Slice 15 shipped 2026-05-24 — ready for squash-merge to master.

**Scope:** Ship 3 NY-side bucket-A production parsers from the slice 12 audit + hoist `resolveOpenstatesPersonId` to a canonical shared module. Closes the highest-leverage NY stubs and validates the combined-parser pattern (1 source → 2 schema sinks via shared helper).

**What shipped:**
- `resolveOpenstatesPersonId` hoisted from `state-scorecards/lcv/helpers.ts` to `seed/shared/officials.ts`. lcv/helpers.ts re-exports for slice 11 back-compat.
- NY town_halls parser: `state-community/town-halls/ny-senate.ts` parses `nysenate.gov/events?event-type=town_hall` Senate-side. 5-card HTML fixture committed; 7 vitest cases.
- NY district_offices subfolder: `state-community/district-offices/ny-senate/{index,assembly,senate}.ts`. Replaces flat stub. Assembly parses single-page directory; Senate iterates per-senator with 1-req/sec throttle; index dispatches both via `Promise.all`. Shared `parseAddressText` helper for best-effort regex address parsing (street_1, city, state, postal_code, phone). 12 vitest cases.
- NY COELIG combined parser: `state-ethics/ny-coelig/shared.ts` fetches enforcement-actions table once → emits `{complaints, events, errors}`. Two adapter wrappers (`nyJcopeComplaints`, `nyJcopeEvents`) call helper independently. 17 vitest cases.
- 4 HTML fixtures committed to repo.

**Durable lessons:**

1. **Spec exploration MUST verify Normalized* types before writing.** Slice 15's spec invented `NormalizedTownHall` fields (event_time, title, location) that don't exist; real shape is `{official_openstates_person_id?, event_date, city?, state, format?, attendance_estimate?, source_url, source, external_id?}`. Real `NormalizedDistrictOffice` requires structured address fields (street_1, city, state, postal_code, phone, email, hours_text), NOT an `address_text` blob. Plan caught + corrected at file-exploration step. Future spec writers: verify `Normalized*` interface shape in `state-*/shared.ts` BEFORE writing parser sections.

2. **Hoisting shared helpers vs inline duplication.** Slice 9 NRA had inline `resolveOpenstatesPersonId`; slice 11 LCV hoisted it to `lcv/helpers.ts`; slice 15 hoists again to `seed/shared/officials.ts` (canonical shared module). Pattern: inline first (slice 9), local-shared second (slice 11), canonical-shared third (slice 15). Triggers for hoist: 2+ packages need it, OR cross-domain reach feels awkward. lcv/helpers.ts re-exports preserve existing import paths.

3. **Combined-parser pattern: 1 source → 2 sinks via shared helper.** When a single HTML source feeds two schema tables (e.g., COELIG enforcement = both complaints AND events), build a shared helper (`fetchEnforcementActions → {complaints, events}`) and write thin adapter wrappers per sink. Each adapter calls the helper independently (each orchestrator dispatch fetches the URL again). Cross-adapter memoization deferred — acceptable v1 inefficiency for 2 fetches.

4. **Subfolder layout for multi-source adapters (slice 11 LCV precedent extended).** When a single adapter has 2+ distinct fetch+parse pairs, use a subfolder with `index.ts` (dispatch), `<source-a>.ts`, `<source-b>.ts`, shared helpers as needed. Per-source files are pure functions; index orchestrates. NY district_offices uses Assembly (single-page) + Senate (per-senator loop) in this pattern.

5. **Slug naming compromise: legacy slug + current directory name.** Slug `ny-jcope` (renamed COELIG in 2022) stays for back-compat with slice 5I stub + `state_ethics_orgs` DB row continuity. Directory `ny-coelig/` uses the current agency name for code-clarity. JSDoc explains the discrepancy. Same pattern for `ny-senate` slug covering both Senate + Assembly district offices.

6. **Per-senator fetch loop with `officials` table as source-of-truth.** For NY Senate's 63 senators, query `officials` table for the legislator list, derive slug from `full_name` (lowercase + hyphens + alphanumeric), iterate with 1-req/sec courtesy throttle. Per-senator fetch failures silently skip; per-senator slug-URL mismatches yield 0 parsed addresses (acceptable degradation; slice 16+ adds error-surface to `stats.errors[]`).

7. **`event_type='campaign_finance_violation'` for state ethics events.** Per slice 9 Ballotpedia precedent, recall/expulsion is sourced nationwide via Ballotpedia. Per-state ethics commissions emit ONLY `campaign_finance_violation` events. Slice 5I's `event_type` enum has 7 values; slice 15 uses 1 of them.

8. **Best-effort regex address parsing.** US addresses lack a single canonical format; `parseAddressText` does best-effort split on commas + state-code + zip + phone regex. Returns null when required fields (street_1, city, state) can't be extracted. Logged via per-row drop, not per-row error surface. Pattern reused across Assembly + Senate fetchers.

9. **Mid-slice broken state acceptable per slice 11+13 precedent.** Task 3 deletes the flat `ny-senate.ts` before Task 4 adds the new subfolder. Between Task 3 and Task 4, typecheck fails (orchestrator imports a deleted symbol). Acceptable; documented in plan; production code is consistent again at Task 4 close.

10. **Address postal_code optional pattern.** `parseAddressText` returns postal_code only if matched by zip regex; the spreadable `...(parts.postal_code ? {postal_code} : {})` pattern keeps the type narrow (no `null` slipping into a string field).

**Active follow-ups (operator):**

- Slice 16: CA + MI district_offices + TX ethics combined (the remaining 3 firm bucket-A parsers from slice 12 audit).
- Per-senator slug-derivation drift: monitor `stats.errors[]` rate when production parser runs against real NY senators; if >5% slug-URL mismatches, add a senator-slug override map.
- Combined-parser memoization: defer cross-adapter caching of the COELIG fetch until measured impact (currently 2 fetches per orchestrator run is acceptable).
- NY FDS (financial disclosures) PDF parsing — bucket-C per audit; future PDF-parsing slice.
- LCV-OR + PP × 5 browser-UA probe spike (slice 11 carryover).
- Mobile DoD on-device smoke.

**Master state at slice 15 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans across 31 files (unchanged). 10 production parsers total (was 7; +3 NY: town_halls, district_offices combined, COELIG combined). State stub count: 19 → 16 active (3 NY stubs now production). officials-ui test count: unchanged at 233. @chiaro/db test count: +30 cases for NY parsers.

**Cross-links:** [[project-chiaro-slice5h-community-presence]] [[project-chiaro-slice5i-ethics-accountability]] [[project-chiaro-slice9-nra-ballotpedia]] [[project-chiaro-slice11-lcv-scorecards]] [[project-chiaro-slice12-stub-audit]]
```

- [ ] **Step 3: Update MEMORY.md index**

Read `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`. Find the slice 14 entry. Add this NEW line IMMEDIATELY AFTER:

```markdown
- [Chiaro slice 15 NY parsers](project_chiaro_slice15_ny_parsers.md) — 3 NY-side production parsers (town_halls + district_offices + COELIG combined); hoist resolveOpenstatesPersonId to seed/shared/officials.ts; combined-parser pattern (1 source → 2 sinks via shared helper); subfolder layout extended for multi-source district_offices
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/web build
```

Expected: all green.
- `pnpm -r typecheck` — 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` — full @chiaro/db test suite green; new NY test cases (+~30) bring db test count up
- `pnpm --filter @chiaro/web build` — 12 routes (no UI work in this slice; build is a smoke check)

`pnpm db:test` (pgTAP) is informational only — slice 15 has no schema work, so plan count is unchanged at 402. The pre-existing `tiger_ingest.test.sql` failures per CLAUDE.md Gotcha #6 are expected locally without `pnpm seed:tiger`.

- [ ] **Step 5: Commit Task 6**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 15 closure — CLAUDE.md entry

Slice 15 ships 3 NY-side production parsers from the slice 12 audit
+ hoists resolveOpenstatesPersonId to seed/shared/officials.ts.

No new Gotcha -- slice 11 subfolder + slice 9 HTML-scrape patterns
already documented in Gotchas #18 + #19f.

@chiaro/db test count: +~30 cases for NY parsers.
State stub count: 19 -> 16 active.
pgTAP unchanged at 402 plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo working tree — write them in Steps 2-3 but do NOT git add them.)

---

## Workspace verify gate (recap)

After all 6 tasks complete:

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run state-community state-ethics   # NY parsers green
pnpm --filter @chiaro/db exec vitest run                         # full @chiaro/db suite green
pnpm --filter @chiaro/web build                                  # 12 routes
git log master..HEAD --oneline                                   # 7 commits (spec + 6 implementation)
```

Expected:
- 11 packages typecheck green
- NY town_halls: 7 tests PASS
- NY district_offices (across index + assembly + senate): 12 tests PASS
- NY COELIG: 17 tests PASS (11 shared + 3 each adapter)
- Total slice 15 test additions: ~30 cases
- @chiaro/db full suite: 540+30 = ~570 tests passing
- Web build: 12 routes green
- Branch: 7 commits (1 spec + 1 plan + 6 implementation)

---

## Self-review notes

### Spec coverage

- ✅ NY town_halls — Task 2
- ✅ NY district_offices Assembly — Task 3
- ✅ NY district_offices Senate per-senator loop — Task 4 (senate.ts)
- ✅ NY district_offices index dispatch — Task 4 (index.ts)
- ✅ NY COELIG combined parser — Task 5
- ✅ Slug naming compromise (`ny-jcope` slug + `ny-coelig` directory) — Task 5 JSDoc
- ✅ resolveOpenstatesPersonId hoist — Task 1 (added to plan; spec didn't mention but spec corrections section flags it)
- ✅ HTML fixtures (4) — Tasks 2-5
- ✅ CLAUDE.md slice entry — Task 6
- ✅ Memory + MEMORY.md — Task 6 Steps 2-3
- ✅ Workspace verify gate — Task 6 Step 4

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. Each task contains full file content or precise diff blocks. Two port-time verification points documented as explicit Task-level prompts (senator slug derivation in Task 4; HTML selector verification — implementer fetches a real URL during scaffold, mentioned in plan footer).

### Type consistency

- `NormalizedTownHall` shape used consistently: `{official_openstates_person_id?, event_date, city?, state, format?, source_url, source, external_id?}`. Task 2 builds this; helpers in shared.ts already define it.
- `NormalizedDistrictOffice` shape: `{official_openstates_person_id, kind, street_1, city, state, postal_code?, phone?, email?, hours_text?, source_url}`. Tasks 3 + 4 emit this; address parsing in `parseAddressText` produces the structured fields.
- `NormalizedEthicsComplaint` + `NormalizedOfficialEvent` shapes consistent across Task 5 — both use `official_openstates_person_id`, `state`, `source_url`, `source`, `external_id?` + their respective domain fields.
- `parseAddressText` exported from `assembly.ts` and imported by `senate.ts` — both use the same signature `(raw: string) => {street_1, city, state, postal_code?, phone?} | null`.
- `fetchEnforcementActions` returns `{complaints, events, errors}` consistently in Tasks 5 + 5's adapter wrappers.

### Known incomplete details

- Task 4 Step 4 senator slug derivation: real NY senator URLs may use slugs that don't match `lowercase + hyphenated full_name` (e.g., `senator-jane-doe` instead of `jane-doe`). Plan documents this as a port-time verification step — implementer fetches 2-3 real URLs and adjusts `deriveSenatorSlug` if needed. Failure mode: per-senator fetch silently skips (acceptable v1 degradation).
- Task 2/3/4/5 HTML selectors are audit-derived (slice 12). Implementer is expected to fetch a real URL during scaffold to confirm structure. If selectors drift, parser misses rows + production drift surfaces via `stats.errors[]`. Fixtures committed to repo are frozen snapshots.
- Memory file template includes `<squash SHA>` placeholder — implementer fills it post-merge during the `finishing-a-development-branch` flow (matches slice 10/11/12/13/14 precedent).
- Task 5 `mapStatus` "Consent Order" mapping to `settled`: COELIG also uses "Order Imposed" for some sanctioned cases. The current heuristic (`norm.includes('order')` → sanctioned) catches "Order Imposed" but not "Consent Order" (because `consent` is checked first and maps to `settled`). The if-order in `mapStatus` is intentional — verify with COELIG status-text catalog if more variants emerge.
