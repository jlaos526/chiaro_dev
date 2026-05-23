# NRA-PVF + Ballotpedia Recalls Production Parsers Implementation Plan (slice 9)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 2 production HTML-scrape parsers replacing slice 5G NRA-PVF + slice 5I Ballotpedia recalls stubs. NRA covers all 50 states; Ballotpedia handles all state-legislator recall events.

**Architecture:** Zero schema work. One new workspace dep (`cheerio`). Both adapters keep their existing stub structure + add a production fetcher path (HTML scrape via cheerio); fixture-injection path stays unchanged so existing tests pass. NRA uses uniform URL pattern `nrapvf.org/grades/<state-name>/`; Ballotpedia uses index + per-year subpages with browser User-Agent (Cloudflare gate). Reuses `resolveOfficialByName` + `Chamber` from slice 8 shared module.

**Tech Stack:** Node.js fetch (built-in), `cheerio` (jQuery-like HTML parser; standard TypeScript dep), TypeScript strict mode, vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-nra-ballotpedia-parsers-design.md`

---

## File structure

**Created (~7):**
```
packages/db/supabase/seed/state-scorecards/
  nra-helpers.ts + .test.ts                    # NEW — STATE_2_TO_NAME, chamber classifier, HTML extractor
packages/db/supabase/seed/state-ethics/events/
  ballotpedia-recalls-helpers.ts + .test.ts    # NEW — outcome mapper, date extractor, name regex
packages/db/supabase/seed/fixtures/state-scorecards/
  nra-ca.html                                  # NEW — sample CA NRA-PVF grades page
  nra-tx.html                                  # NEW — sample TX page (table-shape edge case)
packages/db/supabase/seed/fixtures/state-ethics/
  ballotpedia-recalls-index.html               # NEW — sample /State_legislative_recalls
  ballotpedia-recalls-2024.html                # NEW — sample year-detail page
```

**Modified (~5):**
```
packages/db/package.json                                            # +cheerio dep
packages/db/supabase/seed/state-scorecards/nra.ts                   # production fetcher path
packages/db/supabase/seed/state-scorecards/nra.test.ts              # +production-path cases
packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts        # production fetcher path
packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts   # +production-path cases
CLAUDE.md                                                           # +slice 9 entry + Gotcha #18
```

---

## Task 1: Add cheerio workspace dep

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Install cheerio**

```bash
pnpm --filter @chiaro/db add cheerio
```

- [ ] **Step 2: Verify install**

```bash
grep -E '"cheerio"' packages/db/package.json
pnpm --filter @chiaro/db typecheck 2>&1 | tail -3
```

Expected: `"cheerio": "^1.x.x"` present in `dependencies`; typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json pnpm-lock.yaml
git commit -m "chore(db): add cheerio for HTML scrape parsers (slice 9)

cheerio is a jQuery-like HTML parser used by the slice 9 NRA-PVF +
Ballotpedia recalls production fetchers. Standard TypeScript dep;
backend ingest only — not bundled into web/mobile apps."
```

---

## Task 2: NRA-PVF helpers (STATE_2_TO_NAME + chamber classifier)

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/nra-helpers.ts`
- Create: `packages/db/supabase/seed/state-scorecards/nra-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/db/supabase/seed/state-scorecards/nra-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  STATE_2_TO_NAME,
  STATE_NAME_TO_2,
  inferChamberFromNraTable,
  parseNraGradesHtml,
  type ParsedNraRow,
} from './nra-helpers.ts'

describe('STATE_2_TO_NAME', () => {
  it('maps all 50 states', () => {
    expect(Object.keys(STATE_2_TO_NAME).length).toBe(50)
  })
  it('maps CA → california', () => {
    expect(STATE_2_TO_NAME.CA).toBe('california')
  })
  it('maps NY → new-york (hyphenated)', () => {
    expect(STATE_2_TO_NAME.NY).toBe('new-york')
  })
  it('maps NC → north-carolina', () => {
    expect(STATE_2_TO_NAME.NC).toBe('north-carolina')
  })
})

describe('STATE_NAME_TO_2 (inverse)', () => {
  it('roundtrip: STATE_2_TO_NAME → STATE_NAME_TO_2 → original code', () => {
    for (const [code, name] of Object.entries(STATE_2_TO_NAME)) {
      expect(STATE_NAME_TO_2[name]).toBe(code)
    }
  })
})

describe('inferChamberFromNraTable', () => {
  it('"State Senate" → state_senate', () => {
    expect(inferChamberFromNraTable('State Senate')).toBe('state_senate')
  })
  it('"State House" → state_house', () => {
    expect(inferChamberFromNraTable('State House')).toBe('state_house')
  })
  it('"State Assembly" → state_house', () => {
    expect(inferChamberFromNraTable('State Assembly')).toBe('state_house')
  })
  it('"State House of Representatives" → state_house', () => {
    expect(inferChamberFromNraTable('State House of Representatives')).toBe('state_house')
  })
  it('"U.S. Senate" → federal_senate', () => {
    expect(inferChamberFromNraTable('U.S. Senate')).toBe('federal_senate')
  })
  it('"Senate" (no State prefix) → federal_senate', () => {
    expect(inferChamberFromNraTable('Senate')).toBe('federal_senate')
  })
  it('"U.S. House of Representatives" → federal_house', () => {
    expect(inferChamberFromNraTable('U.S. House of Representatives')).toBe('federal_house')
  })
  it('"House of Representatives" (no State prefix) → federal_house', () => {
    expect(inferChamberFromNraTable('House of Representatives')).toBe('federal_house')
  })
  it('unknown → null', () => {
    expect(inferChamberFromNraTable('Some Other Chamber')).toBeNull()
  })
})

describe('parseNraGradesHtml', () => {
  it('extracts legislator name + chamber + grade from sample HTML', () => {
    const html = `
      <html><body>
        <h2>State Senate</h2>
        <table>
          <tr><td><a href="/grade/123">Jane Doe</a></td><td class="grade">A+</td></tr>
          <tr><td><a href="/grade/456">John Smith</a></td><td class="grade">F</td></tr>
        </table>
        <h2>State House</h2>
        <table>
          <tr><td><a href="/grade/789">Pat Lee</a></td><td class="grade">B+</td></tr>
        </table>
      </body></html>
    `
    const rows = parseNraGradesHtml(html)
    expect(rows.length).toBe(3)
    expect(rows[0]).toEqual({ name: 'Jane Doe',  chamberLabel: 'State Senate', letterGrade: 'A+' } as ParsedNraRow)
    expect(rows[1]).toEqual({ name: 'John Smith', chamberLabel: 'State Senate', letterGrade: 'F' } as ParsedNraRow)
    expect(rows[2]).toEqual({ name: 'Pat Lee',   chamberLabel: 'State House',  letterGrade: 'B+' } as ParsedNraRow)
  })

  it('skips rows with blank grade', () => {
    const html = `
      <html><body>
        <h2>State Senate</h2>
        <table>
          <tr><td><a>No Grade</a></td><td class="grade"></td></tr>
          <tr><td><a>Has Grade</a></td><td class="grade">A</td></tr>
        </table>
      </body></html>
    `
    const rows = parseNraGradesHtml(html)
    expect(rows.length).toBe(1)
    expect(rows[0]!.name).toBe('Has Grade')
  })

  it('handles AQ (Aborted Questionnaire) — keep but caller filters via letterToNumeric', () => {
    const html = `
      <html><body>
        <h2>State Senate</h2>
        <table>
          <tr><td><a>AQ Person</a></td><td class="grade">AQ</td></tr>
        </table>
      </body></html>
    `
    const rows = parseNraGradesHtml(html)
    expect(rows.length).toBe(1)
    expect(rows[0]!.letterGrade).toBe('AQ')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/nra-helpers'
```

Expected: module not found.

- [ ] **Step 3: Implement helpers**

Create `packages/db/supabase/seed/state-scorecards/nra-helpers.ts`:

```ts
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
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/nra-helpers'
pnpm --filter @chiaro/db typecheck
```

Expected: 18 cases pass.

```bash
git add packages/db/supabase/seed/state-scorecards/nra-helpers.ts \
        packages/db/supabase/seed/state-scorecards/nra-helpers.test.ts
git commit -m "feat(seed): nra-helpers — STATE_2_TO_NAME + chamber classifier + HTML extractor

Pure helpers for NRA-PVF production fetcher:
- STATE_2_TO_NAME: 50-entry 2-letter → URL-slug map (CA → california,
  NY → new-york, etc.)
- STATE_NAME_TO_2: auto-inverse map (50 entries; roundtrip-verified)
- inferChamberFromNraTable: maps NRA table heading text to Chamber
  union (state_senate / state_house / federal_senate / federal_house).
  Order matters — state prefix gates the federal classifier.
- parseNraGradesHtml: cheerio-based <h2><table> walker. Each <tr>
  yields { name, chamberLabel, letterGrade }. Skips blank-grade rows.

18 vitest cases."
```

---

## Task 3: NRA-PVF fixtures

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/nra-ca.html`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/nra-tx.html`

- [ ] **Step 1: Create CA fixture**

Create `packages/db/supabase/seed/fixtures/state-scorecards/nra-ca.html`:

```html
<!DOCTYPE html>
<html>
<head><title>NRA-PVF — California</title></head>
<body>
  <h1>NRA-PVF California Grades</h1>

  <h2>U.S. Senate</h2>
  <table>
    <tr><td><a href="/grade/100">Alex Padilla</a></td><td class="grade">F</td></tr>
    <tr><td><a href="/grade/101">Adam Schiff</a></td><td class="grade">F</td></tr>
  </table>

  <h2>U.S. House of Representatives</h2>
  <table>
    <tr><td><a href="/grade/200">Doug LaMalfa</a></td><td class="grade">A+</td></tr>
    <tr><td><a href="/grade/201">Kevin Kiley</a></td><td class="grade">A</td></tr>
  </table>

  <h2>State Senate</h2>
  <table>
    <tr><td><a href="/grade/300">Brian Jones</a></td><td class="grade">A</td></tr>
    <tr><td><a href="/grade/301">Dave Cortese</a></td><td class="grade">F</td></tr>
  </table>

  <h2>State Assembly</h2>
  <table>
    <tr><td><a href="/grade/400">Bill Essayli</a></td><td class="grade">A+</td></tr>
    <tr><td><a href="/grade/401">No Grade Listed</a></td><td class="grade"></td></tr>
    <tr><td><a href="/grade/402">AQ Member</a></td><td class="grade">AQ</td></tr>
  </table>
</body>
</html>
```

10 legislators across 4 chamber sections — covers federal_senate, federal_house, state_senate, state_house (via "State Assembly"); 1 blank-grade skip; 1 AQ row (passes through helper, filtered at adapter layer via letterToNumeric).

- [ ] **Step 2: Create TX fixture (edge case)**

Create `packages/db/supabase/seed/fixtures/state-scorecards/nra-tx.html`:

```html
<!DOCTYPE html>
<html>
<head><title>NRA-PVF — Texas</title></head>
<body>
  <h1>NRA-PVF Texas Grades</h1>

  <h2>State Senate</h2>
  <table>
    <tr><td>Donna Campbell</td><td class="grade">A+</td></tr>
    <tr><td>Sarah Eckhardt</td><td class="grade">F</td></tr>
  </table>

  <h2>State House of Representatives</h2>
  <table>
    <tr><td>Ramon Romero</td><td class="grade">D</td></tr>
    <tr><td>Briscoe Cain</td><td class="grade">A+</td></tr>
  </table>
</body>
</html>
```

Edge case: TX uses "State House of Representatives" (not "State House" / "State Assembly"); helper classifier still maps to `state_house`. Also: no anchor wrappers around names (just text).

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/seed/fixtures/state-scorecards/nra-ca.html \
        packages/db/supabase/seed/fixtures/state-scorecards/nra-tx.html
git commit -m "feat(seed): NRA-PVF fixture HTML — CA (typical) + TX (edge case)

CA fixture: 4 chamber sections (federal_senate, federal_house, state_senate,
State Assembly), 10 legislators total, includes blank-grade skip + AQ
(Aborted Questionnaire) row to exercise letterToNumeric null path.

TX fixture: edge case with 'State House of Representatives' chamber
label (different from CA's 'State Assembly') + plain text cells (no
anchor wrapping). Verifies classifier handles label variants and
extractor handles both <a>-wrapped and plain text cells."
```

---

## Task 4: NRA-PVF production fetcher (replaces stub)

**Files:**
- Modify: `packages/db/supabase/seed/state-scorecards/nra.ts`
- Modify: `packages/db/supabase/seed/state-scorecards/nra.test.ts`

- [ ] **Step 1: Update nra.ts to expand coverage + add production fetcher**

Open `packages/db/supabase/seed/state-scorecards/nra.ts`. The file currently exports `letterToNumeric` + `numericToLetterGrade` + `nra` adapter with `covered_states: ['CA', 'NY', 'FL', 'TX', 'MI', 'WI']` and stub `fetchRatings`.

Replace the bottom of the file (the `nra` adapter export):

```ts
import {
  STATE_2_TO_NAME,
  inferChamberFromNraTable,
  parseNraGradesHtml,
} from './nra-helpers.ts'
import { resolveOfficialByName, type Chamber } from '../shared/officials.ts'
import type { Client } from 'pg'

const ALL_STATES = Object.keys(STATE_2_TO_NAME)

const FETCH_TIMEOUT_MS = 5000

interface FetchOptions {
  client: Client
  state?: string  // 2-letter code; if omitted, fetches all 50 states
  fetcher?: (state: string) => Promise<string>  // returns HTML; test injection
}

/**
 * Production fetcher: GET nrapvf.org/grades/<state-name>/ for each state.
 * Returns normalized NormalizedStateRating[] for legislators successfully
 * resolved to officials.id via resolveOfficialByName (slice 8 shared module).
 *
 * Exported for tests.
 */
export async function fetchNraRatingsForState(
  state: string,
  client: Client,
  fetcher?: (state: string) => Promise<string>,
): Promise<NormalizedStateRating[]> {
  const stateName = STATE_2_TO_NAME[state]
  if (!stateName) return []

  let html: string
  try {
    if (fetcher) {
      html = await fetcher(state)
    } else {
      const url = `https://www.nrapvf.org/grades/${stateName}/`
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!resp.ok) return []
      html = await resp.text()
    }
  } catch {
    return []
  }

  const rows = parseNraGradesHtml(html)
  const out: NormalizedStateRating[] = []

  for (const row of rows) {
    const chamber = inferChamberFromNraTable(row.chamberLabel)
    if (!chamber) continue

    const numeric = letterToNumeric(row.letterGrade)
    if (numeric == null) continue   // skips AQ, blank, unknown

    const officialId = await resolveOfficialByName(client, {
      full_name: row.name,
      state,
      chamber: chamber as Chamber,
    })
    if (!officialId) continue

    out.push({
      official_id: officialId,
      org_slug: 'nra',
      state,
      score: numeric,
      external_id: `nra-${state}-${officialId}`,
      source_url: `https://www.nrapvf.org/grades/${stateName}/`,
    })
  }

  return out
}

export const nra: StateScorecardAdapter = {
  slug: 'nra',
  name_template: (s) => `NRA-PVF (${US_STATE_NAMES[s] ?? s})`,
  issue_area: 'second-amendment',
  lean: 'conservative',
  methodology_url_template: () => 'https://www.nrapvf.org/grades/',
  scoring_max: 100,
  notes: 'NRA-PVF grades letters A-F (mapped to 0-100; A=100, F=20). UI reverse-maps for display.',
  covered_states: ALL_STATES,  // expanded from 6 → 50 in slice 9

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    // Production path: fetch each state (or single state if opts.state set)
    const targetStates = opts.state ? [opts.state] : ALL_STATES
    const allRatings: NormalizedStateRating[] = []
    for (const st of targetStates) {
      const ratings = await fetchNraRatingsForState(st, opts.client)
      allRatings.push(...ratings)
    }
    return allRatings
  },
}
```

The existing `letterToNumeric` + `numericToLetterGrade` functions stay unchanged (already in the file from slice 5G; numeric mapping A+=100, F=20).

Update the file header docstring if it claims `covered_states` is 6 states.

Note on `US_STATE_NAMES`: the original 6-state map is now insufficient for `name_template` since coverage expanded. Replace the existing local `US_STATE_NAMES` constant with a generated map derived from `STATE_2_TO_NAME`:

```ts
// At top of nra.ts (after imports), replace existing US_STATE_NAMES:
const US_STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_2_TO_NAME).map(([code, slug]) => [
    code,
    slug.split('-').map(s => s[0]!.toUpperCase() + s.slice(1)).join(' '),
  ])
)
// Result: CA → 'California', NY → 'New York', NC → 'North Carolina', etc.
```

- [ ] **Step 2: Update nra.test.ts with production-path cases**

Open `packages/db/supabase/seed/state-scorecards/nra.test.ts`. Append a new describe block:

```tsx
import { fetchNraRatingsForState } from './nra.ts'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CA_HTML = join(__dirname, '..', 'fixtures', 'state-scorecards', 'nra-ca.html')
const TX_HTML = join(__dirname, '..', 'fixtures', 'state-scorecards', 'nra-tx.html')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(officialId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: officialId ? [{ id: officialId }] : [],
      rowCount: officialId ? 1 : 0,
    }),
  }
}

describe('fetchNraRatingsForState — CA fixture', () => {
  it('emits 8 ratings (10 rows - 1 blank - 1 AQ) when all officials resolve', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    const ratings = await fetchNraRatingsForState('CA', client, async () => html)
    expect(ratings.length).toBe(8)
  })

  it('emits federal + state legislators with correct chambers via resolveOfficialByName', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const calls: Array<{ chamber: string }> = []
    const client = {
      query: vi.fn().mockImplementation((sql, params) => {
        if (params && params[2]) calls.push({ chamber: params[2] })
        return Promise.resolve({ rows: [{ id: 'oid-' + calls.length }], rowCount: 1 })
      }),
    } as never
    await fetchNraRatingsForState('CA', client, async () => html)
    // Expect chambers: 2 federal_senate, 2 federal_house, 2 state_senate, 2 state_house (1 blank, 1 AQ skip)
    expect(calls.filter(c => c.chamber === 'federal_senate').length).toBe(2)
    expect(calls.filter(c => c.chamber === 'federal_house').length).toBe(2)
    expect(calls.filter(c => c.chamber === 'state_senate').length).toBe(2)
    expect(calls.filter(c => c.chamber === 'state_house').length).toBe(2)
  })

  it('skips unresolved officials', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const client = mkClient(null) as never  // no resolution
    const ratings = await fetchNraRatingsForState('CA', client, async () => html)
    expect(ratings.length).toBe(0)
  })

  it('external_id pattern: nra-<state>-<officialId>', async () => {
    const html = await readFile(CA_HTML, 'utf8')
    const client = mkClient('oid-12345') as never
    const ratings = await fetchNraRatingsForState('CA', client, async () => html)
    expect(ratings[0]!.external_id).toBe('nra-CA-oid-12345')
  })
})

describe('fetchNraRatingsForState — TX fixture (edge case)', () => {
  it('handles "State House of Representatives" label + plain text cells', async () => {
    const html = await readFile(TX_HTML, 'utf8')
    const client = mkClient('oid-tx') as never
    const ratings = await fetchNraRatingsForState('TX', client, async () => html)
    expect(ratings.length).toBe(4)
  })
})

describe('fetchNraRatingsForState — production fallback', () => {
  it('returns [] for unknown state code', async () => {
    const client = mkClient('oid-mock') as never
    const ratings = await fetchNraRatingsForState('XX', client)
    expect(ratings).toEqual([])
  })

  it('returns [] on network error', async () => {
    const client = mkClient('oid-mock') as never
    const ratings = await fetchNraRatingsForState('CA', client, async () => {
      throw new Error('network')
    })
    expect(ratings).toEqual([])
  })
})
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/nra'
pnpm --filter @chiaro/db typecheck
```

Expected: existing 4 stub-shape cases + 7 new production-path cases = 11 total in nra.test.ts.

```bash
git add packages/db/supabase/seed/state-scorecards/nra.ts \
        packages/db/supabase/seed/state-scorecards/nra.test.ts
git commit -m "feat(seed): NRA-PVF production fetcher — replaces slice 5G stub

Wires nrapvf.org/grades/<state-name>/ HTML scrape. Per state:
- Fetch with 5s timeout
- cheerio-parse via parseNraGradesHtml
- Infer chamber via inferChamberFromNraTable (state vs federal)
- Letter → numeric via existing slice 5G letterToNumeric (A+=100,
  F=20; AQ/blank → null)
- Resolve official via slice 8 resolveOfficialByName
- Emit NormalizedStateRating with external_id=nra-<state>-<officialId>

Expanded covered_states 6 → 50 (centralized URL pattern). US_STATE_NAMES
regenerated from STATE_2_TO_NAME (50 entries) so name_template covers
all states.

Production path fails-empty on network errors, unknown state codes,
or no resolved officials. Existing fixture-injection path unchanged.

7 new vitest cases (CA + TX fixtures + production fallbacks). 11
total in nra.test.ts."
```

---

## Task 5: NRA-PVF — wire into state-scorecards-ingest orchestrator

**Files:**
- Verify: `packages/db/supabase/seed/state-scorecards-ingest.ts` already imports `nra` adapter (no code change needed if it does).

- [ ] **Step 1: Verify orchestrator wiring**

```bash
grep -n "nra" packages/db/supabase/seed/state-scorecards-ingest.ts
```

Expected: `import { nra } from './state-scorecards/nra.ts'` already present + `nra` in `ADAPTERS_DEFAULT` array.

If missing (defensive check), this task is a no-op. If present, this is just verification — no commit needed. Skip to Task 6.

- [ ] **Step 2: Run existing orchestrator test to confirm nra still listed**

```bash
pnpm --filter @chiaro/db test state-scorecards-ingest
```

Expected: passes including `nra` in the dispatched adapters.

---

## Task 6: Ballotpedia recalls helpers (outcome mapper + date extractor)

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls-helpers.ts`
- Create: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  mapOutcomeToEventType,
  extractDate,
  parseLegislatorName,
  slugifyName,
  BROWSER_USER_AGENT,
  parseRecallYearLinks,
  parseRecallRows,
  type ParsedRecallRow,
} from './ballotpedia-recalls-helpers.ts'

describe('mapOutcomeToEventType', () => {
  it('Recalled → recall_succeeded', () => {
    expect(mapOutcomeToEventType('Recall election: legislator recalled')).toBe('recall_succeeded')
  })
  it('Removed from office → recall_succeeded', () => {
    expect(mapOutcomeToEventType('Removed from office')).toBe('recall_succeeded')
  })
  it('Retained → recall_failed', () => {
    expect(mapOutcomeToEventType('Recall election: legislator retained')).toBe('recall_failed')
  })
  it('Petition failed → recall_failed', () => {
    expect(mapOutcomeToEventType('Petition failed')).toBe('recall_failed')
  })
  it('Insufficient signatures → recall_failed', () => {
    expect(mapOutcomeToEventType('Insufficient signatures')).toBe('recall_failed')
  })
  it('Withdrew → recall_failed', () => {
    expect(mapOutcomeToEventType('Petition withdrew')).toBe('recall_failed')
  })
  it('Active → recall_attempt', () => {
    expect(mapOutcomeToEventType('Active')).toBe('recall_attempt')
  })
  it('Pending → recall_attempt', () => {
    expect(mapOutcomeToEventType('Pending')).toBe('recall_attempt')
  })
  it('Petition filed → recall_attempt', () => {
    expect(mapOutcomeToEventType('Petition filed')).toBe('recall_attempt')
  })
  it('Unknown → null (log + skip)', () => {
    expect(mapOutcomeToEventType('Something weird')).toBeNull()
  })
})

describe('extractDate', () => {
  it('parses "January 15, 2024"', () => {
    expect(extractDate('January 15, 2024')).toBe('2024-01-15')
  })
  it('parses "Jan 15, 2024"', () => {
    expect(extractDate('Jan 15, 2024')).toBe('2024-01-15')
  })
  it('parses ISO "2024-01-15"', () => {
    expect(extractDate('2024-01-15')).toBe('2024-01-15')
  })
  it('returns null for unparseable text', () => {
    expect(extractDate('not a date')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(extractDate('')).toBeNull()
  })
})

describe('parseLegislatorName', () => {
  it('strips "State Sen." prefix', () => {
    expect(parseLegislatorName('State Sen. Jane Doe')).toEqual({ name: 'Jane Doe', chamber: 'state_senate' })
  })
  it('strips "State Rep." prefix', () => {
    expect(parseLegislatorName('State Rep. John Smith')).toEqual({ name: 'John Smith', chamber: 'state_house' })
  })
  it('strips "State Del." prefix → state_house', () => {
    expect(parseLegislatorName('State Del. Pat Lee')).toEqual({ name: 'Pat Lee', chamber: 'state_house' })
  })
  it('strips "State Senator" word', () => {
    expect(parseLegislatorName('State Senator Maria Lopez')).toEqual({ name: 'Maria Lopez', chamber: 'state_senate' })
  })
  it('strips "Assemblymember" → state_house', () => {
    expect(parseLegislatorName('Assemblymember Carlos Reyes')).toEqual({ name: 'Carlos Reyes', chamber: 'state_house' })
  })
  it('returns null for federal title (Senator without "State" prefix)', () => {
    expect(parseLegislatorName('Senator Elizabeth Warren')).toBeNull()
  })
  it('returns null for bare name (no recognized prefix)', () => {
    expect(parseLegislatorName('Just A Name')).toBeNull()
  })
})

describe('slugifyName', () => {
  it('lowercases + hyphenates', () => {
    expect(slugifyName('Jane Doe')).toBe('jane-doe')
  })
  it('handles hyphens in last names', () => {
    expect(slugifyName('Maria Lopez-Garcia')).toBe('maria-lopez-garcia')
  })
  it('strips apostrophes', () => {
    expect(slugifyName("Sean O'Brien")).toBe('sean-obrien')
  })
})

describe('BROWSER_USER_AGENT', () => {
  it('contains Mozilla prefix and ChiaroBot identifier', () => {
    expect(BROWSER_USER_AGENT).toMatch(/^Mozilla\/5\.0/)
    expect(BROWSER_USER_AGENT).toMatch(/ChiaroBot/)
  })
})

describe('parseRecallYearLinks', () => {
  it('extracts per-year URLs from index HTML', () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/State_legislative_recall_efforts,_2024">2024 efforts</a></li>
          <li><a href="/State_legislative_recall_efforts,_2025">2025 efforts</a></li>
          <li><a href="/State_legislative_recall_efforts,_2026">2026 efforts</a></li>
          <li><a href="/Some_other_page">Unrelated</a></li>
        </ul>
      </body></html>
    `
    const links = parseRecallYearLinks(html)
    expect(links).toEqual([
      { year: 2024, url: 'https://ballotpedia.org/State_legislative_recall_efforts,_2024' },
      { year: 2025, url: 'https://ballotpedia.org/State_legislative_recall_efforts,_2025' },
      { year: 2026, url: 'https://ballotpedia.org/State_legislative_recall_efforts,_2026' },
    ])
  })
})

describe('parseRecallRows', () => {
  it('extracts state + legislator + date + status from per-year HTML', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>State</th><th>Legislator</th><th>Date</th><th>Status</th></tr>
          <tr><td>California</td><td>State Sen. Jane Doe</td><td>March 15, 2024</td><td>Petition failed</td></tr>
          <tr><td>Texas</td><td>State Rep. John Smith</td><td>June 1, 2024</td><td>Recalled</td></tr>
        </table>
      </body></html>
    `
    const rows = parseRecallRows(html)
    expect(rows.length).toBe(2)
    expect(rows[0]).toMatchObject({
      stateName: 'California',
      legislatorRaw: 'State Sen. Jane Doe',
      dateText: 'March 15, 2024',
      status: 'Petition failed',
    } as Partial<ParsedRecallRow>)
  })

  it('skips header rows + rows with too few cells', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>State</th><th>Legislator</th></tr>
          <tr><td>California</td></tr>  <!-- 1 cell, skip -->
          <tr><td>Texas</td><td>State Rep. John</td><td>June 1, 2024</td><td>Recalled</td></tr>
        </table>
      </body></html>
    `
    const rows = parseRecallRows(html)
    expect(rows.length).toBe(1)
    expect(rows[0]!.stateName).toBe('Texas')
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test 'state-ethics/events/ballotpedia-recalls-helpers'
```

Expected: module not found.

- [ ] **Step 3: Implement helpers**

Create `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls-helpers.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Chamber } from '../../shared/officials.ts'

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'

type EventType =
  | 'recall_attempt'
  | 'recall_succeeded'
  | 'recall_failed'

const SUCCESS_RE = /\brecalled\b|removed from office/i
const FAILED_RE  = /\bretained\b|petition\s+(?:failed|withdrew)|insufficient signatures|withdrew/i
const ATTEMPT_RE = /\bactive\b|\bpending\b|petition\s+filed|election scheduled/i

export function mapOutcomeToEventType(status: string): EventType | null {
  if (SUCCESS_RE.test(status)) return 'recall_succeeded'
  if (FAILED_RE.test(status))  return 'recall_failed'
  if (ATTEMPT_RE.test(status)) return 'recall_attempt'
  return null
}

export function extractDate(text: string): string | null {
  if (!text || !text.trim()) return null
  const trimmed = text.trim()
  // Try ISO first
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return trimmed
  // Try Date.parse (handles "January 15, 2024" / "Jan 15, 2024" etc)
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

const CHAMBER_PREFIX_RE =
  /^(State\s+Sen\.?|State\s+Senator|State\s+Rep\.?|State\s+Representative|State\s+Del\.?|State\s+Delegate|Assemblymember|Assemblyman|Assemblywoman)\s+/i

export function parseLegislatorName(raw: string): { name: string; chamber: Chamber } | null {
  const m = raw.match(CHAMBER_PREFIX_RE)
  if (!m) return null
  const prefix = m[1]!.toLowerCase()
  const name = raw.slice(m[0]!.length).trim()
  if (!name) return null
  if (/\bsen/.test(prefix)) return { name, chamber: 'state_senate' }
  return { name, chamber: 'state_house' }
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
}

export interface ParsedRecallYearLink {
  year: number
  url: string
}

export function parseRecallYearLinks(html: string): ParsedRecallYearLink[] {
  const $ = cheerio.load(html)
  const out: ParsedRecallYearLink[] = []
  $('a').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/^\/State_legislative_recall_efforts,_(\d{4})$/)
    if (!m) return
    const year = Number.parseInt(m[1]!, 10)
    out.push({
      year,
      url: `https://ballotpedia.org${href}`,
    })
  })
  // Dedupe by year (a single year might appear in multiple link contexts)
  const seen = new Set<number>()
  return out.filter(l => {
    if (seen.has(l.year)) return false
    seen.add(l.year)
    return true
  })
}

export interface ParsedRecallRow {
  stateName: string
  legislatorRaw: string
  dateText: string
  status: string
}

export function parseRecallRows(html: string): ParsedRecallRow[] {
  const $ = cheerio.load(html)
  const out: ParsedRecallRow[] = []
  $('table tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 4) return
    const stateName = $(cells[0]).text().trim()
    const legislatorRaw = $(cells[1]).text().trim()
    const dateText = $(cells[2]).text().trim()
    const status = $(cells[3]).text().trim()
    if (!stateName || !legislatorRaw) return
    out.push({ stateName, legislatorRaw, dateText, status })
  })
  return out
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/events/ballotpedia-recalls-helpers'
pnpm --filter @chiaro/db typecheck
```

Expected: 25 cases pass.

```bash
git add packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls-helpers.ts \
        packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls-helpers.test.ts
git commit -m "feat(seed): ballotpedia-recalls-helpers — outcome mapper + parsers

Pure helpers for Ballotpedia production fetcher:
- mapOutcomeToEventType: regex-based status → event_type
  (Recalled/Removed → succeeded; Retained/Failed/Withdrew/
  Insufficient → failed; Active/Pending/Filed → attempt; unknown
  → null/skip+log)
- extractDate: ISO format first, then Date.parse fallback for
  'January 15, 2024' / 'Jan 15, 2024' variants
- parseLegislatorName: regex-strips State Sen./Rep./Del./Senator/
  Representative/Delegate/Assemblymember/Assemblyman/woman prefix;
  returns { name, chamber }; federal titles (no 'State' prefix)
  return null
- slugifyName: lowercase + hyphenate + strip apostrophes
- BROWSER_USER_AGENT: Mozilla-prefixed ChiaroBot UA for Cloudflare
- parseRecallYearLinks: cheerio extracts /State_legislative_recall_
  efforts,_<YEAR> URLs from index HTML
- parseRecallRows: cheerio extracts state/legislator/date/status
  from per-year tables; skips header + short rows

25 vitest cases."
```

---

## Task 7: Ballotpedia fixtures

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-ethics/ballotpedia-recalls-index.html`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/ballotpedia-recalls-2024.html`

- [ ] **Step 1: Create index fixture**

Create `packages/db/supabase/seed/fixtures/state-ethics/ballotpedia-recalls-index.html`:

```html
<!DOCTYPE html>
<html>
<head><title>State legislative recalls — Ballotpedia</title></head>
<body>
  <h1>State legislative recalls</h1>
  <p>This page covers recall efforts by year.</p>
  <h2>By year</h2>
  <ul>
    <li><a href="/State_legislative_recall_efforts,_2023">2023 efforts</a></li>
    <li><a href="/State_legislative_recall_efforts,_2024">2024 efforts</a></li>
    <li><a href="/State_legislative_recall_efforts,_2025">2025 efforts</a></li>
    <li><a href="/State_legislative_recall_efforts,_2026">2026 efforts</a></li>
    <li><a href="/State_legislative_recall_efforts,_2024">2024 efforts (duplicate)</a></li>
    <li><a href="/Recall_campaigns_in_California">CA campaigns (unrelated)</a></li>
  </ul>
</body>
</html>
```

Includes a duplicate 2024 link (parser dedupes) + an unrelated link (parser ignores).

- [ ] **Step 2: Create per-year fixture**

Create `packages/db/supabase/seed/fixtures/state-ethics/ballotpedia-recalls-2024.html`:

```html
<!DOCTYPE html>
<html>
<head><title>State legislative recall efforts, 2024 — Ballotpedia</title></head>
<body>
  <h1>2024 state legislative recall efforts</h1>
  <table>
    <tr>
      <th>State</th>
      <th>Legislator</th>
      <th>Date filed</th>
      <th>Status</th>
    </tr>
    <tr>
      <td>California</td>
      <td>State Sen. Jane Doe</td>
      <td>March 15, 2024</td>
      <td>Petition failed</td>
    </tr>
    <tr>
      <td>Texas</td>
      <td>State Rep. John Smith</td>
      <td>June 1, 2024</td>
      <td>Recalled</td>
    </tr>
    <tr>
      <td>New York</td>
      <td>State Sen. Maria Lopez</td>
      <td>September 10, 2024</td>
      <td>Retained</td>
    </tr>
    <tr>
      <td>Florida</td>
      <td>State Rep. Carlos Reyes</td>
      <td>2024-10-05</td>
      <td>Active</td>
    </tr>
    <tr>
      <td>Maryland</td>
      <td>State Del. Pat Lee</td>
      <td>Nov 20, 2024</td>
      <td>Some weird status</td>
    </tr>
  </table>
</body>
</html>
```

5 events covering all 4 outcome categories + 1 unknown (Maryland row should skip + log).

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/seed/fixtures/state-ethics/ballotpedia-recalls-index.html \
        packages/db/supabase/seed/fixtures/state-ethics/ballotpedia-recalls-2024.html
git commit -m "feat(seed): Ballotpedia recall fixtures — index + 2024 detail

Index fixture: 4 valid year-links (2023-2026) + 1 duplicate (parser
dedupes) + 1 unrelated link (parser ignores).

2024 detail fixture: 5 events covering all 4 outcome categories
(Petition failed/Recalled/Retained/Active) + 1 unknown status
('Some weird status') that should skip + log to stats.errors.
Includes mixed date formats: March 15, 2024 / June 1, 2024 / ISO
2024-10-05 / Nov 20, 2024."
```

---

## Task 8: Ballotpedia production fetcher (replaces stub)

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts`
- Modify: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts`

- [ ] **Step 1: Update ballotpedia-recalls.ts with production fetcher**

Open `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts`. Replace the entire file content (keep the `ballotpediaRecalls` adapter shape):

```ts
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
import { resolveOfficialByName } from '../../shared/officials.ts'
import { STATE_NAME_TO_2 } from '../../state-scorecards/nra-helpers.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

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
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Production fetcher: GET index + per-year subpages + parse recall rows.
 * Exported for tests.
 */
export async function fetchBallotpediaRecallEvents(
  client: Client,
  fetcher: FetchFn = defaultFetcher,
): Promise<{ events: NormalizedOfficialEvent[]; errors: string[] }> {
  const errors: string[] = []
  const events: NormalizedOfficialEvent[] = []

  let indexHtml: string
  try {
    indexHtml = await fetcher(INDEX_URL)
  } catch (err) {
    errors.push(`Index fetch failed: ${(err as Error).message}`)
    return { events, errors }
  }

  const yearLinks = parseRecallYearLinks(indexHtml).slice(0, MAX_PAGES - 1)

  for (const link of yearLinks) {
    await sleep(THROTTLE_MS)
    let yearHtml: string
    try {
      yearHtml = await fetcher(link.url)
    } catch (err) {
      errors.push(`Year ${link.year} fetch failed: ${(err as Error).message}`)
      continue
    }
    const rows = parseRecallRows(yearHtml)
    for (const row of rows) {
      const state = STATE_NAME_TO_2[row.stateName.toLowerCase()]
      if (!state) {
        errors.push(`Unknown state name: ${row.stateName}`)
        continue
      }
      const legi = parseLegislatorName(row.legislatorRaw)
      if (!legi) {
        errors.push(`Unparseable legislator (likely federal): ${row.legislatorRaw}`)
        continue
      }
      const eventType = mapOutcomeToEventType(row.status)
      if (!eventType) {
        errors.push(`Unknown status: ${row.status} (${row.legislatorRaw})`)
        continue
      }
      const eventDate = extractDate(row.dateText)
      if (!eventDate) {
        errors.push(`Unparseable date: ${row.dateText} (${row.legislatorRaw})`)
        continue
      }
      const officialId = await resolveOfficialByName(client, {
        full_name: legi.name,
        state,
        chamber: legi.chamber,
      })
      if (!officialId) {
        errors.push(`Unresolved: ${legi.name} (${state}, ${legi.chamber})`)
        continue
      }
      events.push({
        official_id: officialId,
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

export const ballotpediaRecalls: StateEthicsAdapter = {
  slug: 'ballotpedia',
  component: 'events',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    // Production path
    const result = await fetchBallotpediaRecallEvents(opts.client)
    return result.events
  },
}
```

- [ ] **Step 2: Update tests with production-path cases**

Open `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts`. Append:

```ts
import { fetchBallotpediaRecallEvents } from './ballotpedia-recalls.ts'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INDEX_HTML = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ballotpedia-recalls-index.html')
const YEAR_2024_HTML = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'ballotpedia-recalls-2024.html')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(officialId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: officialId ? [{ id: officialId }] : [],
      rowCount: officialId ? 1 : 0,
    }),
  }
}

describe('fetchBallotpediaRecallEvents — production path', () => {
  it('emits 3 valid events (5 rows - 1 unknown status - 1 unresolved would-be)', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    // Index → 4 year links (2023/2024/2025/2026 after dedup). Only fixture for 2024;
    // other years return empty HTML.
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'  // empty per-year fixture
    }
    const result = await fetchBallotpediaRecallEvents(client, fetcher)
    // 5 fixture rows: CA succeeded? no — "Petition failed" → failed.
    // CA: Petition failed → failed
    // TX: Recalled → succeeded
    // NY: Retained → failed
    // FL: Active → attempt
    // MD: 'Some weird status' → null → skip + log to errors
    expect(result.events.length).toBe(4)
    expect(result.errors.length).toBe(1)  // MD weird status
    expect(result.errors[0]).toMatch(/Unknown status/)
  })

  it('outcome → event_type mapping matches fixture statuses', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'
    }
    const { events } = await fetchBallotpediaRecallEvents(client, fetcher)
    const byState = Object.fromEntries(events.map(e => [e.state, e.event_type]))
    expect(byState.CA).toBe('recall_failed')
    expect(byState.TX).toBe('recall_succeeded')
    expect(byState.NY).toBe('recall_failed')
    expect(byState.FL).toBe('recall_attempt')
  })

  it('external_id pattern: ballotpedia-<state>-<slug>-<date>', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient('oid-mock') as never
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'
    }
    const { events } = await fetchBallotpediaRecallEvents(client, fetcher)
    const ca = events.find(e => e.state === 'CA')!
    expect(ca.external_id).toBe('ballotpedia-CA-jane-doe-2024-03-15')
  })

  it('skips unresolved officials with log entry', async () => {
    const indexHtml = await readFile(INDEX_HTML, 'utf8')
    const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
    const client = mkClient(null) as never  // every resolveOfficialByName returns null
    const fetcher = async (url: string) => {
      if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
      if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
      return '<html><body><table></table></body></html>'
    }
    const { events, errors } = await fetchBallotpediaRecallEvents(client, fetcher)
    expect(events.length).toBe(0)
    // 4 well-formed rows + 1 unknown status = 4 unresolved + 1 unknown = 5 errors
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })

  it('returns empty + errors-with-msg when index fetch throws', async () => {
    const client = mkClient('oid-mock') as never
    const result = await fetchBallotpediaRecallEvents(client, async () => {
      throw new Error('network down')
    })
    expect(result.events).toEqual([])
    expect(result.errors[0]).toMatch(/Index fetch failed/)
  })
})
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/events/ballotpedia-recalls'
pnpm --filter @chiaro/db typecheck
```

Expected: existing 4 stub-shape cases + 5 new production-path cases = 9 total in ballotpedia-recalls.test.ts.

```bash
git add packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts \
        packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts
git commit -m "feat(seed): Ballotpedia recalls production fetcher — replaces slice 5I stub

Index page (ballotpedia.org/State_legislative_recalls) + per-year
subpages (State_legislative_recall_efforts,_YYYY). Browser User-Agent
header bypasses Cloudflare gate.

Per-row pipeline:
- State name → 2-letter via STATE_NAME_TO_2 (slice 9 nra-helpers)
- Legislator prefix parse → name + chamber (state_senate / state_house)
- Status → event_type (recall_succeeded / recall_failed / recall_attempt)
- Date extraction (ISO / Date.parse fallback)
- resolveOfficialByName (slice 8) → official_id
- external_id: ballotpedia-<state>-<slug>-<event-date>

1-req/sec throttle between page fetches; 5s per-fetch timeout;
50-page hard cap. Fails-empty on index fetch failure; per-year
failures logged + continue (per-adapter isolation).

5 new vitest cases (fixture-injected production path) — 9 total in
ballotpedia-recalls.test.ts."
```

---

## Task 9: Verify orchestrator integration

**Files:**
- Verify: `packages/db/supabase/seed/state-ethics-ingest.ts` already imports `ballotpediaRecalls` (no code change needed if so).

- [ ] **Step 1: Verify orchestrator wiring**

```bash
grep -n "ballotpedia" packages/db/supabase/seed/state-ethics-ingest.ts
```

Expected: `import { ballotpediaRecalls } from './state-ethics/events/ballotpedia-recalls.ts'` already present + `ballotpediaRecalls` in `ADAPTERS_DEFAULT` array (added in slice 5I).

- [ ] **Step 2: Run existing orchestrator test**

```bash
pnpm --filter @chiaro/db test state-ethics-ingest
```

Expected: passes including ballotpediaRecalls in dispatched adapters.

If both `nra` (Task 5) and `ballotpediaRecalls` (Task 9) are already wired in their orchestrators (which they should be from slices 5G + 5I), this slice doesn't need to touch the orchestrators. The stub→production swap is invisible to the orchestrators since the adapter export shape is unchanged.

---

## Task 10: CLAUDE.md slice 9 entry + Gotcha #18

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Slice 9 entry**

In `## Slices delivered`, after the slice 8 entry, append:

```markdown
- **Slice 9 — NRA-PVF + Ballotpedia recalls production parsers** (2026-05-22): replaces 2 stub adapters with HTML-scrape production fetchers. NRA-PVF (`seed/state-scorecards/nra.ts`) expands coverage 6 → 50 states via `nrapvf.org/grades/<state-name>/` URL pattern + cheerio HTML parsing + existing `letterToNumeric()` helper. Ballotpedia (`seed/state-ethics/events/ballotpedia-recalls.ts`) scrapes `ballotpedia.org/State_legislative_recalls` index + per-year subpages with browser User-Agent (Cloudflare gate) + 1-req/sec courtesy throttle. Both reuse `resolveOfficialByName` + `Chamber` from slice 8 shared module. One new workspace dep (`cheerio`). Zero schema work; pgTAP unchanged at 409 plans. **Validates HTML-scrape variant of the production parser pattern** as template for the remaining 33 stub adapters across 5G/5H/5I.
```

- [ ] **Step 2: Gotcha #18**

In `## Gotchas`, after current #17, append:

```markdown
18. **HTML scrape adapters have 3 site-specific constraints documented in slice 9.** (a) NRA-PVF URL pattern is `nrapvf.org/grades/<state-name-lowercase-hyphenated>/` — use the `STATE_2_TO_NAME` map at `seed/state-scorecards/nra-helpers.ts` (50 entries) not 2-letter codes. (b) Ballotpedia returns HTTP 403 without a browser-style `User-Agent` header — both adapters use `Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)` constant exported as `BROWSER_USER_AGENT` from `seed/state-ethics/events/ballotpedia-recalls-helpers.ts`. (c) Chamber inference for NRA tables differs federal-vs-state by header text: state-tier rows have "State" prefix ("State Senate" / "State House" / "State Assembly" / "State House of Representatives" — TX uses the last variant); federal-tier rows don't ("U.S. Senate" / "Senate" alone). Helper `inferChamberFromNraTable` handles all variants. Ballotpedia chamber prefixes come BEFORE legislator names ("State Sen.", "State Rep.", "State Del.", "Assemblymember") — `parseLegislatorName` regex strips them. `cheerio` HTML parser is a new workspace dep (`packages/db/package.json`) for these adapters; not bundled into web/mobile.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 9 entry + Gotcha #18 (HTML scrape constraints)

Slice 9 ships 2 HTML-scrape production parsers (NRA-PVF + Ballotpedia).
Gotcha #18 documents 3 site-specific constraints (NRA URL pattern,
Ballotpedia Cloudflare UA gating, chamber inference asymmetry between
NRA federal-vs-state tables) + cheerio workspace dep."
```

---

## Task 11: Workspace verify + memory + branch handoff

**Files:**
- None (verification + memory writes only)

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db test
pnpm --filter @chiaro/web build 2>&1 | tail -5
pnpm db:reset
pnpm db:test 2>&1 | tail -10
```

Expected:
- All 10 packages typecheck clean
- `@chiaro/db` tests pass (+18 nra-helpers + 7 nra production + 25 ballotpedia-helpers + 5 ballotpedia production = 55 new cases)
- Web build clean
- pgTAP unchanged at 409 plans across 31 files (TIGER 4-failures expected per gotcha #6)
- All migrations 0001-0052 apply

- [ ] **Step 2: Branch state**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: ~10 commits on `slice-9-nra-ballotpedia` ahead of master (1 spec + 1 plan + 8 implementation/docs).

- [ ] **Step 3: Write slice 9 durable-lessons memory**

Create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice9_nra_ballotpedia.md`:

```markdown
---
name: project-chiaro-slice9-nra-ballotpedia
description: Slice 9 — NRA-PVF + Ballotpedia recalls HTML scrape production parsers
metadata:
  node_type: memory
  type: project
---

Slice 9 shipped 2026-05-22 — squash SHA TBD (fill in after merge). ~10 commits on `slice-9-nra-ballotpedia` branch (1 spec + 1 plan + 8 implementation/cleanup/docs).

**Validates HTML-scrape variant of production parser pattern.** Slice 7+8 used JSON APIs (Mobilize, OpenStates YAML); slice 9 adds HTML-scrape template for the remaining ~33 stub adapters across 5G/5H/5I.

**What shipped:**

- `cheerio` workspace dep added to `@chiaro/db`
- `nra-helpers.ts` (NEW): `STATE_2_TO_NAME` (50 entries), `STATE_NAME_TO_2` inverse, `inferChamberFromNraTable`, `parseNraGradesHtml`
- `nra.ts` MODIFIED: expanded `covered_states` 6 → 50; added `fetchNraRatingsForState` production fetcher; `US_STATE_NAMES` regenerated from `STATE_2_TO_NAME`
- `ballotpedia-recalls-helpers.ts` (NEW): `mapOutcomeToEventType`, `extractDate`, `parseLegislatorName`, `slugifyName`, `BROWSER_USER_AGENT`, `parseRecallYearLinks`, `parseRecallRows`
- `ballotpedia-recalls.ts` MODIFIED: production fetcher with browser UA, 1-req/sec throttle, 50-page hard cap, per-row error logging
- 4 fixture HTML files (CA + TX NRA-PVF; index + 2024 Ballotpedia)
- 55 new vitest cases

**Durable Chiaro-specific lessons:**

1. **NRA-PVF URL pattern is `<state-name>` not `<XX>`.** `STATE_2_TO_NAME` map provides 2-letter → URL-slug conversion (50 entries: CA → california, NY → new-york, NC → north-carolina, etc.). Inverse `STATE_NAME_TO_2` enables Ballotpedia state-name → 2-letter lookup. Both exported from `nra-helpers.ts`; Ballotpedia helper imports `STATE_NAME_TO_2` cross-domain.

2. **NRA chamber labels vary per state.** CA uses "State Assembly" for lower chamber; TX uses "State House of Representatives". `inferChamberFromNraTable` regex handles both variants. Federal labels: "U.S. Senate" or just "Senate" (alone, no State prefix) → federal_senate.

3. **Ballotpedia requires browser User-Agent or returns 403.** Cloudflare gate. Adapter uses `BROWSER_USER_AGENT = 'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'` — Mozilla prefix bypasses the gate while ChiaroBot identifier disambiguates from real browsers.

4. **Ballotpedia chamber prefixes precede names.** Tables list "State Sen. Jane Doe" / "State Rep. John Smith" / "State Del. Pat Lee" / "Assemblymember Carlos Reyes". `parseLegislatorName` regex strips the prefix + returns `{ name, chamber }`. Federal titles (Senator / Representative without "State") return null and are filtered out (federal recalls extremely rare).

5. **`extractDate` falls back to `Date.parse`** for "January 15, 2024" / "Jan 15, 2024" / ISO "2024-01-15". Unparseable text → null → skip row + log to errors.

6. **AQ (Aborted Questionnaire) entries** in NRA tables: helper extracts them but `letterToNumeric` returns null for "AQ" → adapter skips emission. Documented in slice 5G letterToNumeric; reaffirmed in slice 9 fixture.

7. **1-req/sec courtesy throttle** between Ballotpedia page fetches. Hard cap of 50 pages per run. Ballotpedia doesn't document rate limits but is moderately scrape-friendly; throttle is courtesy.

8. **Per-row error logging** to `stats.errors` for: unknown state name, unparseable legislator, unknown status, unparseable date, unresolved official. Each row failure logs + continues; only index-fetch failure short-circuits.

9. **Production fetcher path is exported** (`fetchNraRatingsForState`, `fetchBallotpediaRecallEvents`) for fixture-injected testing. The adapter's `fetchEvents`/`fetchRatings` checks for `opts.fetcher` injection first; production path is the fallback. Existing stub-shape tests still pass unchanged.

10. **Slice 5G `letterToNumeric` mapping is canonical.** Slice 9 spec drafted alternative numbers (A=95, F=50) but plan corrected to existing mapping (A+=100, F=20). Future parsers should reuse existing helpers without re-spec'ing the numeric scale.

**Active follow-ups (operator):**

- Remaining ~33 stub adapters across 5G/5H/5I (per-state ethics commissions, individual scorecard chapters, state-leg websites)
- Federal stock_transactions production parser — defer until community JSON sources revive or paid aggregator viable
- 7-day cache layer for NRA + Ballotpedia (add if rate-limited)
- Ballotpedia per-year list expansion (currently 2023-2026; older years deferred)
- @chiaro/officials-ui shared package extraction (still pending from slice 6 closure)
- Mobile DoD on-device smoke (deferred since slice 5)

**Master state at slice 9 closure:** HEAD = `<squash-SHA-after-merge>`. 10 workspace packages unchanged (cheerio is a dep, not a workspace package). Migrations 0001-0052. 409 pgTAP plans across 31 files. 5 production parsers live (Mobilize state/federal, OpenStates YAML, NRA-PVF, Ballotpedia recalls).

**Cross-links:** [[project-chiaro-slice5g-state-scorecards]] [[project-chiaro-slice5i-ethics-accountability]] [[project-chiaro-slice7-parser-wiring]] [[project-chiaro-slice8-federal-parity]]
```

- [ ] **Step 4: Update MEMORY.md index**

Append to `MEMORY.md`:

```markdown
- [Chiaro slice 9 NRA + Ballotpedia parsers](project_chiaro_slice9_nra_ballotpedia.md) — 2 HTML-scrape production parsers shipped 2026-05-22 (squash TBD). NRA-PVF expanded coverage 6 → 50 states via centralized URL pattern. Ballotpedia recalls scraped with browser User-Agent (Cloudflare gate) + 1-req/sec throttle. cheerio new workspace dep. Reuses slice 8 shared resolveOfficialByName. Gotcha #18 documents 3 HTML-scrape constraints. Validates HTML-scrape pattern as template for remaining 33 stub adapters.
```

- [ ] **Step 5: Hand off via finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch`. Recommended: option 1 (squash merge to master locally), matching prior 12 sub-slices.

---

## Verification Checklist (post-Task 11)

- [ ] cheerio dep added to packages/db; pnpm install clean
- [ ] NRA-PVF coverage expanded 6 → 50 states; URL pattern via STATE_2_TO_NAME
- [ ] NRA-PVF chamber classifier handles state + federal tier variants
- [ ] NRA-PVF letter → numeric via existing slice 5G letterToNumeric (A+=100, F=20, AQ → null)
- [ ] Ballotpedia uses browser User-Agent + 1-req/sec throttle + 50-page cap
- [ ] Ballotpedia outcome → event_type mapping covers all 4 categories
- [ ] Ballotpedia date extractor handles 3+ formats (ISO, "January 15, 2024", "Jan 15, 2024")
- [ ] Both adapters export production fetcher for fixture-injected testing
- [ ] resolveOfficialByName + Chamber reused from slice 8 shared module
- [ ] Workspace typecheck clean across all 10 packages
- [ ] pgTAP unchanged at 409 plans across 31 files
- [ ] CLAUDE.md slice 9 + Gotcha #18 added

## Known v1 limitations carried over from spec

1. NRA-PVF coverage varies by state (smaller states have fewer graded legislators)
2. Ballotpedia recall data lags real-time events
3. Both adapters HTML-scrape fragile
4. No 7-day cache
5. Ballotpedia year list hardcoded (2023-2026)
6. Federal recall events ignored (state-tier only)
7. cheerio SSR-only
8. NRA political sensitivity acknowledged
