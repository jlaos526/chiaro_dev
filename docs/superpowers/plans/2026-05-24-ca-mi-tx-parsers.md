# CA + MI district_offices + TX ethics combined — slice 16 plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 3 production parsers (CA + MI district_offices subfolders + TX ethics combined) from the slice 12 audit, validating slice 15 patterns across non-NY states. Hoist `parseAddressText` to a district-office-scoped shared module.

**Architecture:** CA + MI each get a subfolder with 2 sub-parsers (single-page roster + per-member loop OR per-senator-loop + per-rep-loop) plus `index.ts` dispatching both via `Promise.all`. TX gets a combined parser (1 HTML fetch → `{complaints, events, errors}` shared helper) mirroring slice 15 `ny-coelig/`. Slice 15 NY files update to re-import `parseAddressText` from the hoisted location.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler resolution. `cheerio` for HTML parsing (workspace dep since slice 9). `pg.Client` for DB queries. `vitest` + jsdom for tests with HTML fixtures committed to repo.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-24-ca-mi-tx-parsers-design.md` (slice 16 spec)
- `docs/superpowers/plans/2026-05-24-ny-parsers.md` (slice 15 plan — code patterns reused throughout)
- Slice 15 lessons in memory (`project_chiaro_slice15_ny_parsers.md`) — especially Lessons 11 (tsconfig include gap), 12 (vi.spyOn fetch stubbing), 13 (`<br>`-aware text extraction), 15 (subagent review caught 6 issues)

**Mid-slice broken-state avoidance:** Slice 15 left the orchestrator's import of `nySenateOffices` broken between Tasks 3 + 4 (flat stub deleted before subfolder index.ts existed); required a fix commit. Slice 16 avoids this trap: Tasks 2 + 4 create the subfolder skeleton WITHOUT deleting the flat stub. Tasks 3 + 5 delete the flat stub + update the orchestrator + add `index.ts` in a single commit each, never leaving the orchestrator broken.

---

## File Structure

### Created files (~22)
```
packages/db/supabase/seed/state-community/district-offices/_shared.ts
packages/db/supabase/seed/state-community/district-offices/ca-leginfo/
  index.ts
  senate.ts
  senate.test.ts
  assembly.ts
  assembly.test.ts
  index.test.ts
packages/db/supabase/seed/state-community/district-offices/mi-legislature/
  index.ts
  senate.ts
  senate.test.ts
  house.ts
  house.test.ts
  index.test.ts
packages/db/supabase/seed/state-ethics/tx-tec/
  shared.ts
  shared.test.ts
packages/db/supabase/seed/fixtures/state-community/
  ca-senate-roster.html
  ca-assemblymember-detail.html
  mi-senator-detail.html
  mi-rep-detail.html
packages/db/supabase/seed/fixtures/state-ethics/
  tx-tec-orders.html
```

### Modified files (7)
```
packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts      # remove local parseAddressText, import from _shared.ts
packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts         # update parseAddressText import path
packages/db/supabase/seed/state-community-ingest.ts                                    # 2 import paths updated (CA + MI subfolders)
packages/db/supabase/seed/state-ethics/complaints/tx-tec.ts                            # replace stub with shared-helper wrapper
packages/db/supabase/seed/state-ethics/complaints/tx-tec.test.ts                       # replace stub tests with wrapper tests
packages/db/supabase/seed/state-ethics/events/tx-tec.ts                                # replace stub with shared-helper wrapper
packages/db/supabase/seed/state-ethics/events/tx-tec.test.ts                           # replace stub tests with wrapper tests
CLAUDE.md                                                                              # slice 16 entry
```

### Deleted files (4)
```
packages/db/supabase/seed/state-community/district-offices/ca-leginfo.ts
packages/db/supabase/seed/state-community/district-offices/ca-leginfo.test.ts
packages/db/supabase/seed/state-community/district-offices/mi-legislature.ts
packages/db/supabase/seed/state-community/district-offices/mi-legislature.test.ts
```

---

## Task 1: Hoist `parseAddressText` to `_shared.ts`

**Files:**
- Create: `packages/db/supabase/seed/state-community/district-offices/_shared.ts`
- Modify: `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts`
- Modify: `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts`

- [ ] **Step 1: Read current `parseAddressText` location**

Read `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts` to find the `parseAddressText` function (currently lines ~50-97). The function will be moved verbatim to `_shared.ts`.

- [ ] **Step 2: Create `_shared.ts`**

Use Write tool to create `packages/db/supabase/seed/state-community/district-offices/_shared.ts`:

```ts
/**
 * Best-effort regex parser for a raw US legislator-office address string.
 *
 * Input: "123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234"
 * Output: { street_1: "123 Main Street", city: "Buffalo", state: "NY",
 *           postal_code: "14201", phone: "(716) 555-1234" }
 *
 * Returns null if street_1 + city + state can't be extracted (required
 * NormalizedDistrictOffice fields).
 *
 * Hoisted from slice 15 ny-senate/assembly.ts in slice 16 — needed by
 * 5 callers (NY assembly + senate, CA senate + assembly, MI senate +
 * house = 6 total). Slice 15 callers (ny-senate/{assembly,senate}.ts)
 * re-import from this canonical location.
 *
 * Underscore prefix on filename signals package-internal helper.
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

  const result: { street_1: string; city: string; state: string; postal_code?: string; phone?: string } = {
    street_1, city, state,
  }
  if (postal_code) result.postal_code = postal_code
  if (phone) result.phone = phone
  return result
}
```

(Note: removed the `as ReturnType<...>` cast that slice 15 Task 3's code-quality reviewer flagged as nit — the explicit object-type literal narrows correctly without it. Behavior identical.)

- [ ] **Step 3: Update `ny-senate/assembly.ts`**

Use Edit tool to remove the local `parseAddressText` function (the ~35-line block including JSDoc + body) from `ny-senate/assembly.ts`. Replace with an import statement near the top of the file:

```ts
import { parseAddressText } from '../_shared.ts'
```

Add this import alongside the existing imports (after the other `import` lines, before the local function definitions). Then DELETE the `parseAddressText` export block (JSDoc + function definition, currently lines ~50-97 — match the exact range when editing).

Verify after edit: `assembly.ts` no longer defines `parseAddressText` locally; it imports it. Other functions (`parseNyAssemblyDirectoryHtml`, `fetchAssemblyOffices`) stay in place.

- [ ] **Step 4: Update `ny-senate/senate.ts`**

Use Edit tool to change the import path in `ny-senate/senate.ts` line 4:
```diff
-import { parseAddressText } from './assembly.ts'
+import { parseAddressText } from '../_shared.ts'
```

- [ ] **Step 5: Run slice 15 NY tests to verify zero behavior change**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ny-senate
```
Expected: 18 tests PASS (same as slice 15 close).

- [ ] **Step 6: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-community/district-offices/_shared.ts \
        packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts \
        packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts
git commit -m "$(cat <<'EOF'
refactor(seed): hoist parseAddressText to district-offices/_shared.ts

Hoist the slice 15 parseAddressText helper from
ny-senate/assembly.ts to district-offices/_shared.ts so slice 16's
new CA + MI parsers can import from one canonical location. Slice 15
ny-senate/{assembly,senate}.ts updated to re-import from the shared
module.

Also drops the slice 15 Task 3 code-quality nit (unnecessary
ReturnType<> cast at the end of the function); behavior identical.

Underscore prefix on _shared.ts filename signals package-internal
helper. Distinct from state-community/shared.ts (interface defs)
and from seed/shared/officials.ts (cross-domain shared helpers).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: CA district_offices Senate roster parser (subfolder skeleton)

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/ca-senate-roster.html`
- Create: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.test.ts`

**Note:** Task 2 creates the subfolder skeleton WITHOUT deleting the flat `ca-leginfo.ts` stub. Both can coexist temporarily (the flat file resolves explicitly via `.ts` extension; the subfolder is a separate directory). Task 3 wires the subfolder, deletes the flat stub, and updates the orchestrator in a single commit — avoiding the slice 15 broken-state trap.

- [ ] **Step 1: Write the HTML fixture**

Create `packages/db/supabase/seed/fixtures/state-community/ca-senate-roster.html`:

```html
<!--
  Fixture: CA Senate roster page (slice 12 audit "best-in-class" find).
  Source: https://www.senate.ca.gov/senators (fetched 2026-05-24 per audit)
  Pruned to 5 senator cards covering: capitol + district office both
  present, capitol-only, district-only, missing district number (skip),
  malformed address (skip).
-->
<div class="senators-list">
  <article class="senator-card">
    <h3 class="senator-name">Senator Jane Doe</h3>
    <span class="district-number">District 5</span>
    <div class="capitol-office">1021 O Street, Suite 5101, Sacramento, CA 95814 · Phone: (916) 651-4005</div>
    <div class="district-office">100 Main Street, Suite 200, Oakland, CA 94612 · Phone: (510) 555-1234</div>
  </article>
  <article class="senator-card">
    <h3 class="senator-name">Senator Alex Smith</h3>
    <span class="district-number">District 12</span>
    <div class="capitol-office">1021 O Street, Suite 7110, Sacramento, CA 95814 · Phone: (916) 651-4012</div>
  </article>
  <article class="senator-card">
    <h3 class="senator-name">Senator Maria Chen</h3>
    <span class="district-number">District 23</span>
    <div class="district-office">200 Oak Avenue, San Diego, CA 92101 · Phone: (619) 555-9999</div>
  </article>
  <article class="senator-card">
    <h3 class="senator-name">Senator Bob Jones</h3>
    <span class="district-number">District NaN</span>
    <div class="capitol-office">1021 O Street, Suite 100, Sacramento, CA 95814</div>
  </article>
  <article class="senator-card">
    <h3 class="senator-name">Senator Pat Skip</h3>
    <span class="district-number">District 99</span>
    <div class="capitol-office">malformed no commas</div>
  </article>
</div>
```

- [ ] **Step 2: Write the failing test**

Create `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCaSenateRosterHtml, fetchCaSenateOffices } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ca-senate-roster.html')

describe('parseCaSenateRosterHtml', () => {
  it('extracts 4 senators (skips Bob with malformed district number)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    // 5 cards; Bob's district "NaN" parses to NaN → skip → 4 emitted
    expect(parsed).toHaveLength(4)
    expect(parsed.map(s => s.full_name)).toEqual(['Jane Doe', 'Alex Smith', 'Maria Chen', 'Pat Skip'])
  })

  it('captures both capitol_office + district_office when present', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    const jane = parsed.find(s => s.full_name === 'Jane Doe')!
    expect(jane.capitol_office).toContain('1021 O Street')
    expect(jane.district_office).toContain('100 Main Street')
  })

  it('handles capitol-only senator (no district_office field)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    const alex = parsed.find(s => s.full_name === 'Alex Smith')!
    expect(alex.capitol_office).toBeTruthy()
    expect(alex.district_office).toBeUndefined()
  })

  it('handles district-only senator (no capitol_office field)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaSenateRosterHtml(html)
    const maria = parsed.find(s => s.full_name === 'Maria Chen')!
    expect(maria.capitol_office).toBeUndefined()
    expect(maria.district_office).toBeTruthy()
  })
})

describe('fetchCaSenateOffices', () => {
  it('emits 2 rows per 2-office senator, 1 per 1-office senator', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    let n = 0
    const client = {
      query: vi.fn().mockImplementation(() => {
        n += 1
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-person/ca-' + n }],
          rowCount: 1,
        })
      }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    // Jane (2) + Alex (1) + Maria (1) + Pat (malformed addr, 0) = 4 rows
    expect(rows).toHaveLength(4)
  })

  it('assigns kind=capitol for Sacramento address, kind=district for local', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    expect(rows.filter(r => r.kind === 'capitol').length).toBeGreaterThanOrEqual(2)
    expect(rows.filter(r => r.kind === 'district').length).toBeGreaterThanOrEqual(2)
  })

  it('returns [] when no senators resolve', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    expect(rows).toEqual([])
  })

  it('extracts structured address fields (street_1, city, state, postal_code, phone)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-person/x' }],
        rowCount: 1,
      }),
    }
    const rows = await fetchCaSenateOffices(client as never, { fetcher: async () => html })
    const capitolRow = rows.find(r => r.kind === 'capitol')!
    expect(capitolRow.city).toBe('Sacramento')
    expect(capitolRow.state).toBe('CA')
    expect(capitolRow.postal_code).toBe('95814')
    expect(capitolRow.phone).toMatch(/\(\d{3}\) \d{3}-\d{4}/)
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ca-leginfo/senate
```
Expected: FAIL — module `./senate.ts` not found.

- [ ] **Step 4: Implement senate.ts**

Create `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'
import { resolveOpenstatesPersonId } from '../../../shared/officials.ts'

const SOURCE_URL = 'https://www.senate.ca.gov/senators'
const FETCH_TIMEOUT_MS = 5000

export interface ParsedCaSenator {
  full_name: string
  district_no: string
  capitol_office?: string
  district_office?: string
}

/**
 * Parse senate.ca.gov/senators — single-page roster of all 40 CA senators
 * (slice 12 audit "best-in-class" find).
 *
 * Audit-derived structure: each senator appears as <article
 * class="senator-card"> with senator-name (h3), district-number (span),
 * capitol-office (div), district-office (div). Implementer should fetch
 * a real URL during scaffold to verify selectors.
 *
 * Skips cards where:
 *   - district_no doesn't parse as a positive integer
 *   - both capitol_office AND district_office are missing
 */
export function parseCaSenateRosterHtml(html: string): ParsedCaSenator[] {
  const $ = cheerio.load(html)
  const out: ParsedCaSenator[] = []

  $('article.senator-card').each((_, el) => {
    const nameText = $(el).find('h3.senator-name').text().trim()
    const full_name = nameText.replace(/^Senator\s+/i, '').trim()

    const districtText = $(el).find('span.district-number').text().trim()
    const districtMatch = districtText.match(/\b(\d+)\b/)
    const district_no = districtMatch ? districtMatch[1]! : ''

    const capitol_office = $(el).find('.capitol-office').text().trim() || undefined
    const district_office = $(el).find('.district-office').text().trim() || undefined

    if (!full_name || !district_no) return
    if (!capitol_office && !district_office) return

    const senator: ParsedCaSenator = { full_name, district_no }
    if (capitol_office) senator.capitol_office = capitol_office
    if (district_office) senator.district_office = district_office
    out.push(senator)
  })

  return out
}

export async function fetchCaSenateOffices(
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

  const parsed = parseCaSenateRosterHtml(html)
  const out: NormalizedDistrictOffice[] = []

  for (const s of parsed) {
    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: s.full_name,
      state: 'CA',
      chamber: 'state_senate',
    })
    if (!openstates_person_id) continue

    if (s.capitol_office) {
      const parts = parseAddressText(s.capitol_office)
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
    if (s.district_office) {
      const parts = parseAddressText(s.district_office)
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

- [ ] **Step 5: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ca-leginfo/senate
```
Expected: 8 tests PASS (4 parser + 4 fetcher).

- [ ] **Step 6: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS. The flat `ca-leginfo.ts` still exists; orchestrator still works.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.ts \
        packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.test.ts \
        packages/db/supabase/seed/fixtures/state-community/ca-senate-roster.html
git commit -m "$(cat <<'EOF'
feat(state-community): CA district_offices Senate roster parser (subfolder skeleton)

First sub-parser of the new ca-leginfo/ subfolder replacing the
slice 5H stub. senate.ca.gov/senators is the "best-in-class" CA
roster from slice 12 audit — all 40 senators' Capitol + district
addresses on a single HTML page.

- parseCaSenateRosterHtml: extracts {full_name, district_no,
  capitol_office?, district_office?} from senator-card articles.
  Strips "Senator " prefix from name. Skips cards with malformed
  district number OR no addresses.
- fetchCaSenateOffices: resolves senator via
  resolveOpenstatesPersonId (state_senate), parses each address via
  shared parseAddressText helper, emits 1-2 NormalizedDistrictOffice
  per resolved senator (kind=capitol for Sacramento, kind=district
  for local).
- 8 vitest cases.

Flat ca-leginfo.ts stub kept untouched in this commit; Task 3 wires
the subfolder + deletes the flat stub + updates the orchestrator
in a single commit to avoid the slice 15 mid-slice broken-state
trap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: CA district_offices Assembly + dispatch + flat-stub deletion

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/ca-assemblymember-detail.html`
- Create: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/assembly.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/assembly.test.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/index.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/index.test.ts`
- Modify: `packages/db/supabase/seed/state-community-ingest.ts` (line 19 import path)
- Delete: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo.ts`
- Delete: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo.test.ts`

- [ ] **Step 1: Write the assemblymember detail-page fixture**

Create `packages/db/supabase/seed/fixtures/state-community/ca-assemblymember-detail.html`:

```html
<!--
  Fixture: CA Assemblymember detail page.
  Source: https://www.assembly.ca.gov/assemblymembers/{n} (audit-derived)
  Pruned to 1 AM with both Capitol + district office.
-->
<div class="assemblymember-detail">
  <h1>Assemblymember Jane Doe</h1>
  <span class="district">District 14</span>
  <section class="capitol-office">
    <h2>Capitol Office</h2>
    <p>1021 O Street, Suite 6310, Sacramento, CA 95814 · Phone: (916) 319-2014</p>
  </section>
  <section class="district-office">
    <h2>District Office</h2>
    <p>1515 Clay Street, Suite 2204, Oakland, CA 94612 · Phone: (510) 286-1670</p>
  </section>
</div>
```

- [ ] **Step 2: Write the failing tests (assembly.test.ts + index.test.ts)**

Create `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/assembly.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCaAssemblymemberDetailHtml, fetchCaAssemblyOffices, deriveAmDistrictUrl } from './assembly.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'ca-assemblymember-detail.html')

describe('parseCaAssemblymemberDetailHtml', () => {
  it('extracts both capitol + district address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseCaAssemblymemberDetailHtml(html)
    expect(parsed.capitol_office).toContain('1021 O Street')
    expect(parsed.capitol_office).toContain('Sacramento')
    expect(parsed.district_office).toContain('1515 Clay Street')
    expect(parsed.district_office).toContain('Oakland')
  })

  it('returns undefined fields for missing sections', () => {
    const parsed = parseCaAssemblymemberDetailHtml('<div>no sections</div>')
    expect(parsed.capitol_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveAmDistrictUrl', () => {
  it('returns assembly.ca.gov URL pattern with district number', () => {
    expect(deriveAmDistrictUrl(14)).toBe('https://www.assembly.ca.gov/assemblymembers/14')
  })
})

describe('fetchCaAssemblyOffices', () => {
  it('iterates over CA Assembly members from officials table + parses each detail page', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ca-a1', full_name: 'Jane Doe', district_id: 'CA-14' },
              { openstates_person_id: 'ocd-person/ca-a2', full_name: 'Alex Smith', district_id: 'CA-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchCaAssemblyOffices(client as never, { fetcher: async () => html })
    // 2 AMs × 2 addresses each = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no AMs in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchCaAssemblyOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips AM when district_id is missing or unparseable', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ca-a1', full_name: 'Jane Doe', district_id: null },
              { openstates_person_id: 'ocd-person/ca-a2', full_name: 'Alex Smith', district_id: 'CA-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchCaAssemblyOffices(client as never, { fetcher: async () => html })
    // Only Alex resolves (Jane skipped due to null district_id) → 2 rows
    expect(rows).toHaveLength(2)
  })

  it('skips AM on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/ca-a1', full_name: 'Jane Doe', district_id: 'CA-14' },
              { openstates_person_id: 'ocd-person/ca-a2', full_name: 'Alex Smith', district_id: 'CA-23' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchCaAssemblyOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('network')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // first AM errors, second succeeds → 2 rows
  })
})
```

Create `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { caLeginfoOffices } from './index.ts'

describe('caLeginfoOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(caLeginfoOffices.slug).toBe('ca-leginfo')
    expect(caLeginfoOffices.component).toBe('offices')
    expect(caLeginfoOffices.covered_states).toEqual(['CA'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', kind: 'capitol', street_1: 's', city: 'c', state: 'CA', source_url: 'u' }]
    const result = await caLeginfoOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Senate + Assembly fetch results in production path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await caLeginfoOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run tests to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ca-leginfo
```
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement assembly.ts**

Create `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/assembly.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedCaAssemblymember {
  capitol_office?: string
  district_office?: string
}

/**
 * Derive AM detail-page URL from district number.
 *
 * Per slice 12 audit: assembly.ca.gov/assemblymembers/{district_number}.
 * Implementer verifies against 2-3 real URLs during scaffold.
 */
export function deriveAmDistrictUrl(district_number: number): string {
  return `https://www.assembly.ca.gov/assemblymembers/${district_number}`
}

/**
 * Parse a single CA Assemblymember detail page.
 *
 * Audit-derived structure: <section class="capitol-office"> and
 * <section class="district-office"> contain <p>-wrapped address text.
 * Each section's text is captured for downstream parseAddressText.
 */
export function parseCaAssemblymemberDetailHtml(html: string): ParsedCaAssemblymember {
  const $ = cheerio.load(html)
  const out: ParsedCaAssemblymember = {}

  const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
  if (capitolText) out.capitol_office = capitolText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

/**
 * Fetch + parse all CA Assemblymember detail pages.
 *
 * Queries officials table for CA state_house legislators, extracts district
 * number from district_id (format "CA-14"), fetches each detail page with
 * a 1-req/sec courtesy throttle (skipped in test mode), parses address
 * blocks, emits NormalizedDistrictOffice rows per parsed address.
 *
 * Per-AM fetch failures silently skip; per-AM URL-pattern mismatches
 * yield 0 parsed rows for that AM.
 */
export async function fetchCaAssemblyOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string; district_id: string | null }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = 'state_house' and state = 'CA' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const am of res.rows) {
    if (!am.district_id) continue
    const districtMatch = am.district_id.match(/^CA-(\d+)$/)
    if (!districtMatch) continue
    const district_number = Number.parseInt(districtMatch[1]!, 10)
    if (!Number.isFinite(district_number)) continue

    const url = deriveAmDistrictUrl(district_number)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseCaAssemblymemberDetailHtml(html)

    if (parsed.capitol_office) {
      const parts = parseAddressText(parsed.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: am.openstates_person_id,
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
          official_openstates_person_id: am.openstates_person_id,
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
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
```

- [ ] **Step 5: Implement index.ts (dispatch)**

Create `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/index.ts`:

```ts
import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchCaSenateOffices } from './senate.ts'
import { fetchCaAssemblyOffices } from './assembly.ts'

/**
 * CA state-legislator district offices, combining Senate
 * (senate.ca.gov/senators single-page roster, 40 senators) and
 * Assembly (assembly.ca.gov/assemblymembers/{n} per-member loop, 80 AMs).
 *
 * Slug `ca-leginfo` is the slice 5H stub legacy name (despite the
 * actual source URLs being senate.ca.gov + assembly.ca.gov, not
 * leginfo.legislature.ca.gov). Kept for back-compat with
 * state_community_orgs row continuity.
 */
export const caLeginfoOffices: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'offices',
  covered_states: ['CA'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (injected) return injected()

    const [senate, assembly] = await Promise.all([
      fetchCaSenateOffices(opts.client, {}),
      fetchCaAssemblyOffices(opts.client, {}),
    ])
    return [...senate, ...assembly]
  },
}
```

- [ ] **Step 6: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ca-leginfo
```
Expected: All ~16 tests PASS across 3 files (8 senate + 5 assembly + 3 index).

- [ ] **Step 7: Update orchestrator + delete flat stub**

Use Edit tool to update `packages/db/supabase/seed/state-community-ingest.ts` line 19:
```diff
-import { caLeginfoOffices }       from './state-community/district-offices/ca-leginfo.ts'
+import { caLeginfoOffices }       from './state-community/district-offices/ca-leginfo/index.ts'
```

Then delete the flat stub files via Bash:
```bash
rm packages/db/supabase/seed/state-community/district-offices/ca-leginfo.ts \
   packages/db/supabase/seed/state-community/district-offices/ca-leginfo.test.ts
```

- [ ] **Step 8: Verify full @chiaro/db test suite (catches broken-import regression)**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: All ~580+ tests PASS. Critically — this catches the orchestrator-import issue that slice 15 missed (typecheck alone doesn't catch broken seed-tree imports per Lesson 11).

- [ ] **Step 9: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-community/district-offices/ca-leginfo \
        packages/db/supabase/seed/fixtures/state-community/ca-assemblymember-detail.html \
        packages/db/supabase/seed/state-community-ingest.ts
git rm packages/db/supabase/seed/state-community/district-offices/ca-leginfo.ts \
       packages/db/supabase/seed/state-community/district-offices/ca-leginfo.test.ts
git commit -m "$(cat <<'EOF'
feat(state-community): CA district_offices Assembly per-member loop + dispatch

Complete the CA district_offices subfolder with Assembly per-member
fetch loop + adapter dispatch. Replaces the flat ca-leginfo.ts slice
5H stub and wires the new subfolder into the orchestrator.

- assembly.ts: parseCaAssemblymemberDetailHtml extracts capitol +
  district address blocks from a single AM detail page (section-based
  HTML). deriveAmDistrictUrl builds assembly.ca.gov/assemblymembers/{n}
  URL from district number. fetchCaAssemblyOffices queries officials
  table for CA state-house legislators (80 AMs), iterates with
  1-req/sec courtesy throttle, parses each detail page, emits 1-2
  NormalizedDistrictOffice rows per AM. Per-AM fetch failures + URL
  pattern mismatches silently skip.
- index.ts: adapter export concatenating Senate + Assembly via
  Promise.all. Slug stays `ca-leginfo` (back-compat with slice 5H
  stub naming despite covering both chambers).
- state-community-ingest.ts: import path updated to point at the new
  subfolder index. Flat ca-leginfo.ts + test deleted in same commit
  to avoid the slice 15 mid-slice broken-state trap.
- 8 vitest cases (5 assembly + 3 index dispatch). Total CA subfolder
  test count: ~16.
- Production fetch volume: 1 (Senate roster) + 80 (Assembly) = 81
  HTTPS GETs per orchestrator run; ~80s runtime at 1-req/sec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: MI district_offices Senate per-senator parser (subfolder skeleton)

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/mi-senator-detail.html`
- Create: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.test.ts`

Same pattern as Task 2 (creates subfolder skeleton; flat `mi-legislature.ts` stub stays until Task 5).

- [ ] **Step 1: Write the MI senator detail-page fixture**

Create `packages/db/supabase/seed/fixtures/state-community/mi-senator-detail.html`:

```html
<!--
  Fixture: MI Senator profile page.
  Source: https://senate.michigan.gov/senators/{slug}/ (audit-derived)
  Pruned to 1 senator with both Lansing + district office.
-->
<div class="senator-profile">
  <h1>Senator Jane Doe</h1>
  <span class="district">District 7</span>
  <section class="lansing-office">
    <h2>Lansing Office</h2>
    <p>Farnum Building, P.O. Box 30036, Lansing, MI 48909 · Phone: (517) 373-7350</p>
  </section>
  <section class="district-office">
    <h2>District Office</h2>
    <p>123 Main Street, Detroit, MI 48201 · Phone: (313) 555-9999</p>
  </section>
</div>
```

- [ ] **Step 2: Write the failing test**

Create `packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMiSenatorProfileHtml, fetchMiSenateOffices, deriveMiSenatorUrl } from './senate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'mi-senator-detail.html')

describe('parseMiSenatorProfileHtml', () => {
  it('extracts Lansing + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseMiSenatorProfileHtml(html)
    expect(parsed.lansing_office).toContain('Farnum Building')
    expect(parsed.lansing_office).toContain('Lansing')
    expect(parsed.district_office).toContain('Main Street')
    expect(parsed.district_office).toContain('Detroit')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseMiSenatorProfileHtml('<div>no sections</div>')
    expect(parsed.lansing_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveMiSenatorUrl', () => {
  it('builds URL with firstname-lastname slug', () => {
    expect(deriveMiSenatorUrl('Jane Doe')).toBe('https://senate.michigan.gov/senators/jane-doe/')
  })

  it('handles middle name', () => {
    expect(deriveMiSenatorUrl('Mary Jo Smith')).toBe('https://senate.michigan.gov/senators/mary-jo-smith/')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveMiSenatorUrl("Pat O'Brien")).toBe('https://senate.michigan.gov/senators/pat-obrien/')
  })
})

describe('fetchMiSenateOffices', () => {
  it('iterates over MI senators + parses each profile', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchMiSenateOffices(client as never, { fetcher: async () => html })
    // 2 senators × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('returns [] when no MI senators in officials table', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await fetchMiSenateOffices(client as never, { fetcher: async () => '<html></html>' })
    expect(rows).toEqual([])
  })

  it('skips senator on fetcher failure (TLS flake)', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-s1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-s2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchMiSenateOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('TLS handshake failed')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // first errors, second succeeds → 2 rows
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/mi-legislature/senate
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement senate.ts**

Create `packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedMiSenatorProfile {
  lansing_office?: string
  district_office?: string
}

/**
 * Derive a senator profile URL from a full_name.
 *
 * Per slice 12 audit: senate.michigan.gov/senators/{slug}/ where slug
 * is lowercase firstname-lastname. Implementer should verify against
 * 2-3 real URLs during scaffold.
 */
export function deriveMiSenatorUrl(full_name: string): string {
  const slug = full_name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `https://senate.michigan.gov/senators/${slug}/`
}

/**
 * Parse a single MI Senator profile page.
 *
 * Audit-derived structure: <section class="lansing-office"> and
 * <section class="district-office"> with <p>-wrapped address text.
 */
export function parseMiSenatorProfileHtml(html: string): ParsedMiSenatorProfile {
  const $ = cheerio.load(html)
  const out: ParsedMiSenatorProfile = {}

  const lansingText = $('section.lansing-office p').first().text().trim().replace(/\s+/g, ' ')
  if (lansingText) out.lansing_office = lansingText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchMiSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string }>(
    `select openstates_person_id, full_name from public.officials
     where chamber = 'state_senate' and state = 'MI' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const senator of res.rows) {
    const url = deriveMiSenatorUrl(senator.full_name)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseMiSenatorProfileHtml(html)

    if (parsed.lansing_office) {
      const parts = parseAddressText(parsed.lansing_office)
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
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
```

- [ ] **Step 5: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/mi-legislature/senate
```
Expected: 8 tests PASS (2 parser + 3 deriveUrl + 3 fetcher).

- [ ] **Step 6: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.ts \
        packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.test.ts \
        packages/db/supabase/seed/fixtures/state-community/mi-senator-detail.html
git commit -m "$(cat <<'EOF'
feat(state-community): MI district_offices Senate per-senator parser (subfolder skeleton)

First sub-parser of the new mi-legislature/ subfolder. Per-senator
fetch loop against senate.michigan.gov/senators/{slug}/ (38 senators
at 1-req/sec).

- parseMiSenatorProfileHtml: extracts Lansing + District address
  blocks from section-based HTML.
- deriveMiSenatorUrl: builds URL via lowercase firstname-lastname
  slug from full_name (mirroring slice 15 deriveSenatorSlug).
- fetchMiSenateOffices: queries officials for MI state-senate (38),
  iterates with 1-req/sec courtesy throttle, parses each profile,
  emits 1-2 NormalizedDistrictOffice rows per senator. Per-senator
  fetch failures + TLS flakes silently skip.
- 8 vitest cases.

Flat mi-legislature.ts stub kept untouched; Task 5 wires the
subfolder + deletes the flat stub + updates the orchestrator in a
single commit (avoiding slice 15 broken-state trap).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: MI district_offices House + dispatch + flat-stub deletion

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-community/mi-rep-detail.html`
- Create: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/house.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/house.test.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/index.ts`
- Create: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/index.test.ts`
- Modify: `packages/db/supabase/seed/state-community-ingest.ts` (line 23 import path)
- Delete: `packages/db/supabase/seed/state-community/district-offices/mi-legislature.ts`
- Delete: `packages/db/supabase/seed/state-community/district-offices/mi-legislature.test.ts`

- [ ] **Step 1: Write the MI rep detail-page fixture**

Create `packages/db/supabase/seed/fixtures/state-community/mi-rep-detail.html`:

```html
<!--
  Fixture: MI Representative profile page.
  Source: https://house.mi.gov/representative-{slug} (audit-derived;
  audit noted TLS flake risk)
  Pruned to 1 rep with both Lansing + district office.
-->
<div class="rep-profile">
  <h1>Representative Jane Doe</h1>
  <span class="district">District 14</span>
  <section class="lansing-office">
    <h2>Lansing Office</h2>
    <p>S-1185 House Office Building, P.O. Box 30014, Lansing, MI 48909 · Phone: (517) 373-0826</p>
  </section>
  <section class="district-office">
    <h2>District Office</h2>
    <p>456 Oak Avenue, Grand Rapids, MI 49503 · Phone: (616) 555-1234</p>
  </section>
</div>
```

- [ ] **Step 2: Write the failing tests (house.test.ts + index.test.ts)**

Create `packages/db/supabase/seed/state-community/district-offices/mi-legislature/house.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMiRepProfileHtml, fetchMiHouseOffices, deriveMiRepUrl } from './house.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', '..', 'fixtures', 'state-community', 'mi-rep-detail.html')

describe('parseMiRepProfileHtml', () => {
  it('extracts Lansing + District address blocks', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const parsed = parseMiRepProfileHtml(html)
    expect(parsed.lansing_office).toContain('House Office Building')
    expect(parsed.lansing_office).toContain('Lansing')
    expect(parsed.district_office).toContain('Oak Avenue')
    expect(parsed.district_office).toContain('Grand Rapids')
  })

  it('returns undefined for missing sections', () => {
    const parsed = parseMiRepProfileHtml('<div>no sections</div>')
    expect(parsed.lansing_office).toBeUndefined()
    expect(parsed.district_office).toBeUndefined()
  })
})

describe('deriveMiRepUrl', () => {
  it('builds URL with representative- prefix + firstname-lastname slug', () => {
    expect(deriveMiRepUrl('Jane Doe')).toBe('https://house.mi.gov/representative-jane-doe')
  })

  it('strips non-alphanumeric characters', () => {
    expect(deriveMiRepUrl("Pat O'Brien")).toBe('https://house.mi.gov/representative-pat-obrien')
  })
})

describe('fetchMiHouseOffices', () => {
  it('iterates over MI reps + parses each profile', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-h1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-h2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const rows = await fetchMiHouseOffices(client as never, { fetcher: async () => html })
    // 2 reps × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
  })

  it('silently skips rep on TLS handshake failure (audit-flagged risk)', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('from public.officials')) {
          return Promise.resolve({
            rows: [
              { openstates_person_id: 'ocd-person/mi-h1', full_name: 'Jane Doe' },
              { openstates_person_id: 'ocd-person/mi-h2', full_name: 'Alex Smith' },
            ],
            rowCount: 2,
          })
        }
        return Promise.resolve({ rows: [], rowCount: 0 })
      }),
    }
    const fixtureHtml = await readFile(FIXTURE, 'utf8')
    const rows = await fetchMiHouseOffices(client as never, {
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('TLS handshake failed')
        return fixtureHtml
      },
    })
    expect(rows).toHaveLength(2)  // first TLS-flakes, second succeeds → 2 rows
  })
})
```

Create `packages/db/supabase/seed/state-community/district-offices/mi-legislature/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { miLegislatureOffices } from './index.ts'

describe('miLegislatureOffices adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(miLegislatureOffices.slug).toBe('mi-legislature')
    expect(miLegislatureOffices.component).toBe('offices')
    expect(miLegislatureOffices.covered_states).toEqual(['MI'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', kind: 'capitol', street_1: 's', city: 'c', state: 'MI', source_url: 'u' }]
    const result = await miLegislatureOffices.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('concatenates Senate + House fetch results in production path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const rows = await miLegislatureOffices.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run tests to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/mi-legislature
```
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement house.ts**

Create `packages/db/supabase/seed/state-community/district-offices/mi-legislature/house.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedMiRepProfile {
  lansing_office?: string
  district_office?: string
}

/**
 * Derive a representative profile URL from a full_name.
 *
 * Per slice 12 audit: house.mi.gov/representative-{slug} where slug
 * is lowercase firstname-lastname. Audit flagged TLS-handshake flake
 * risk on house.mi.gov — production fetch failures land in the
 * try/catch silent-skip path.
 */
export function deriveMiRepUrl(full_name: string): string {
  const slug = full_name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `https://house.mi.gov/representative-${slug}`
}

export function parseMiRepProfileHtml(html: string): ParsedMiRepProfile {
  const $ = cheerio.load(html)
  const out: ParsedMiRepProfile = {}

  const lansingText = $('section.lansing-office p').first().text().trim().replace(/\s+/g, ' ')
  if (lansingText) out.lansing_office = lansingText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchMiHouseOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string }>(
    `select openstates_person_id, full_name from public.officials
     where chamber = 'state_house' and state = 'MI' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const rep of res.rows) {
    const url = deriveMiRepUrl(rep.full_name)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseMiRepProfileHtml(html)

    if (parsed.lansing_office) {
      const parts = parseAddressText(parsed.lansing_office)
      if (parts) {
        out.push({
          official_openstates_person_id: rep.openstates_person_id,
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
          official_openstates_person_id: rep.openstates_person_id,
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
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
```

- [ ] **Step 5: Implement index.ts**

Create `packages/db/supabase/seed/state-community/district-offices/mi-legislature/index.ts`:

```ts
import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
import { fetchMiSenateOffices } from './senate.ts'
import { fetchMiHouseOffices } from './house.ts'

/**
 * MI state-legislator district offices, combining Senate
 * (senate.michigan.gov per-senator) and House
 * (house.mi.gov per-rep with TLS-flake tolerance).
 *
 * Slug `mi-legislature` is the slice 5H stub legacy name. Kept
 * for back-compat with state_community_orgs row continuity.
 */
export const miLegislatureOffices: StateCommunityAdapter = {
  slug: 'mi-legislature',
  component: 'offices',
  covered_states: ['MI'],
  async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (injected) return injected()

    const [senate, house] = await Promise.all([
      fetchMiSenateOffices(opts.client, {}),
      fetchMiHouseOffices(opts.client, {}),
    ])
    return [...senate, ...house]
  },
}
```

- [ ] **Step 6: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/mi-legislature
```
Expected: ~14 tests PASS across 3 files (8 senate + 6 house + 3 index — wait, recount: house.test.ts has 2 parse + 2 deriveUrl + 2 fetcher = 6; index.test.ts 3; senate.test.ts already at 8 from Task 4. Total 17.)

- [ ] **Step 7: Update orchestrator + delete flat stub**

Use Edit tool to update `state-community-ingest.ts` line 23:
```diff
-import { miLegislatureOffices }   from './state-community/district-offices/mi-legislature.ts'
+import { miLegislatureOffices }   from './state-community/district-offices/mi-legislature/index.ts'
```

Delete flat stub:
```bash
rm packages/db/supabase/seed/state-community/district-offices/mi-legislature.ts \
   packages/db/supabase/seed/state-community/district-offices/mi-legislature.test.ts
```

- [ ] **Step 8: Verify full @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: All ~600+ tests PASS.

- [ ] **Step 9: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 10: Commit Task 5**

```bash
git add packages/db/supabase/seed/state-community/district-offices/mi-legislature \
        packages/db/supabase/seed/fixtures/state-community/mi-rep-detail.html \
        packages/db/supabase/seed/state-community-ingest.ts
git rm packages/db/supabase/seed/state-community/district-offices/mi-legislature.ts \
       packages/db/supabase/seed/state-community/district-offices/mi-legislature.test.ts
git commit -m "$(cat <<'EOF'
feat(state-community): MI district_offices House per-rep loop + dispatch

Complete the MI district_offices subfolder with House per-rep fetch
loop + adapter dispatch. Replaces flat mi-legislature.ts slice 5H
stub and wires the subfolder into the orchestrator.

- house.ts: parseMiRepProfileHtml + deriveMiRepUrl + fetchMiHouseOffices.
  Queries officials table for MI state-house legislators (110 reps),
  iterates with 1-req/sec courtesy throttle. Audit flagged TLS-flake
  risk on house.mi.gov — production failures land in the try/catch
  silent-skip path (no special retry helper added in v1; slice 17
  decides based on production pass rate).
- index.ts: adapter export concatenating Senate + House via
  Promise.all. Slug stays `mi-legislature` (back-compat).
- state-community-ingest.ts: import path updated to subfolder index.
  Flat mi-legislature.ts + test deleted in same commit.
- 9 vitest cases (6 house + 3 index dispatch). Total MI subfolder
  test count: ~17.
- Production fetch volume: 38 (Senate) + 110 (House) = 148 HTTPS
  GETs per orchestrator run; ~148s runtime at 1-req/sec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: TX ethics combined parser (1 source → 2 sinks)

**Files:**
- Create: `packages/db/supabase/seed/fixtures/state-ethics/tx-tec-orders.html`
- Create: `packages/db/supabase/seed/state-ethics/tx-tec/shared.ts`
- Create: `packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts`
- Modify: `packages/db/supabase/seed/state-ethics/complaints/tx-tec.ts` (replace stub)
- Modify: `packages/db/supabase/seed/state-ethics/complaints/tx-tec.test.ts`
- Modify: `packages/db/supabase/seed/state-ethics/events/tx-tec.ts` (replace stub)
- Modify: `packages/db/supabase/seed/state-ethics/events/tx-tec.test.ts`

Mirror of slice 15 `ny-coelig/`.

- [ ] **Step 1: Write the TX TEC orders fixture**

Create `packages/db/supabase/seed/fixtures/state-ethics/tx-tec-orders.html`:

```html
<!--
  Fixture: TX TEC sworn-complaint orders search results table.
  Source: https://www.ethics.state.tx.us/enforcement/sworn_complaints/orders/search/
  Pruned to 8 rows covering:
    - 3 Texas House legislators (state_house)
    - 3 Texas Senate legislators (state_senate)
    - 1 non-legislator agency (Texas Comptroller) — filtered out
    - 1 unresolved name — logs error
  Status variants: Resolved / Agreed Order / Final Order / Pending / Dismissed
-->
<table class="orders-table">
  <thead>
    <tr>
      <th>Order #</th>
      <th>Respondent</th>
      <th>Date Issued</th>
      <th>Year Filed</th>
      <th>Agency</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202401-001.pdf">SC-202401-001</a></td>
      <td>Jane Doe</td>
      <td>2024-03-15</td>
      <td>2024</td>
      <td>Texas House of Representatives</td>
      <td>Agreed Order</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202405-099.pdf">SC-202405-099</a></td>
      <td>Alex Smith</td>
      <td>2024-05-22</td>
      <td>2024</td>
      <td>Texas Senate</td>
      <td>Final Order</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202407-150.pdf">SC-202407-150</a></td>
      <td>Maria Chen</td>
      <td>2024-07-30</td>
      <td>2024</td>
      <td>Texas House of Representatives</td>
      <td>Resolved</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202409-200.pdf">SC-202409-200</a></td>
      <td>Bob Jones</td>
      <td>2024-09-12</td>
      <td>2024</td>
      <td>Texas Senate</td>
      <td>Pending</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202410-205.pdf">SC-202410-205</a></td>
      <td>Lisa Park</td>
      <td>2024-10-05</td>
      <td>2024</td>
      <td>Texas House of Representatives</td>
      <td>Dismissed</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202411-250.pdf">SC-202411-250</a></td>
      <td>Tom Wilson</td>
      <td>2024-11-18</td>
      <td>2024</td>
      <td>Texas Senate</td>
      <td>Agreed Order</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202412-300.pdf">SC-202412-300</a></td>
      <td>Dr. Sarah Miller</td>
      <td>2024-12-01</td>
      <td>2024</td>
      <td>Texas Comptroller of Public Accounts</td>
      <td>Final Order</td>
    </tr>
    <tr>
      <td><a href="/data/enforcement/sworn_complaints/2024/SC-202412-350.pdf">SC-202412-350</a></td>
      <td>Unknown Stranger</td>
      <td>2024-12-20</td>
      <td>2024</td>
      <td>Texas House of Representatives</td>
      <td>Pending</td>
    </tr>
  </tbody>
</table>
```

- [ ] **Step 2: Write the failing test**

Create `packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseTxTecOrdersHtml,
  isTexasLegislatorRow,
  fetchSwornComplaintOrders,
} from './shared.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'tx-tec-orders.html')

describe('parseTxTecOrdersHtml', () => {
  it('extracts all 8 rows from fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseTxTecOrdersHtml(html)
    expect(rows).toHaveLength(8)
  })

  it('extracts order number + pdf URL from anchor', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseTxTecOrdersHtml(html)
    expect(rows[0]!.order_number).toBe('SC-202401-001')
    expect(rows[0]!.source_pdf_url).toBe('https://www.ethics.state.tx.us/data/enforcement/sworn_complaints/2024/SC-202401-001.pdf')
  })

  it('extracts year_filed as integer', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const rows = parseTxTecOrdersHtml(html)
    expect(rows[0]!.year_filed).toBe(2024)
  })
})

describe('isTexasLegislatorRow', () => {
  it('matches "Texas House of Representatives"', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas House of Representatives' } as never)).toBe(true)
  })
  it('matches "Texas Senate"', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Senate' } as never)).toBe(true)
  })
  it('rejects Comptroller', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Comptroller of Public Accounts' } as never)).toBe(false)
  })
  it('rejects state agencies', () => {
    expect(isTexasLegislatorRow({ agency: 'Texas Department of Transportation' } as never)).toBe(false)
  })
})

describe('fetchSwornComplaintOrders', () => {
  it('emits matched legislator complaints + events (filters non-legislators + unresolved)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        const name = String(params[0]).toLowerCase()
        if (name.includes('unknown')) return Promise.resolve({ rows: [], rowCount: 0 })
        return Promise.resolve({
          rows: [{ openstates_person_id: `ocd-person/tx-${Math.random().toString(36).slice(2, 6)}` }],
          rowCount: 1,
        })
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, {
      fetcher: async () => html,
    })
    // 8 rows: 6 legislators (3 House + 3 Senate) resolve; "Unknown Stranger"
    // (House) doesn't resolve → error logged; Comptroller (1) filtered before resolve.
    // Final: 6 complaints + 6 events + at least 1 error
    expect(result.complaints).toHaveLength(6)
    expect(result.events).toHaveLength(6)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('maps TX status text to canonical enum', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })

    // "Agreed Order" → sanctioned (TX-specific lexicon)
    const jane = result.complaints.find(c => c.external_id === 'complaint-SC-202401-001')!
    expect(jane.status).toBe('sanctioned')
    // "Final Order" → sanctioned
    const alex = result.complaints.find(c => c.external_id === 'complaint-SC-202405-099')!
    expect(alex.status).toBe('sanctioned')
    // "Resolved" → sanctioned
    const maria = result.complaints.find(c => c.external_id === 'complaint-SC-202407-150')!
    expect(maria.status).toBe('sanctioned')
    // "Pending" → open
    const bob = result.complaints.find(c => c.external_id === 'complaint-SC-202409-200')!
    expect(bob.status).toBe('open')
    // "Dismissed" → dismissed
    const lisa = result.complaints.find(c => c.external_id === 'complaint-SC-202410-205')!
    expect(lisa.status).toBe('dismissed')
  })

  it('infers chamber from agency text (House → state_house, Senate → state_senate)', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const seenChambers: string[] = []
    const client = {
      query: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        seenChambers.push(String(params[2]))
        return Promise.resolve({
          rows: [{ openstates_person_id: 'ocd-x' }],
          rowCount: 1,
        })
      }),
    }
    await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })
    expect(seenChambers).toContain('state_house')
    expect(seenChambers).toContain('state_senate')
  })

  it('event_type is always campaign_finance_violation for TX rows', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })
    expect(result.events.every(e => e.event_type === 'campaign_finance_violation')).toBe(true)
  })

  it('uses external_id prefix to disambiguate dual emission', async () => {
    const html = await readFile(FIXTURE, 'utf8')
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ openstates_person_id: 'ocd-x' }],
        rowCount: 1,
      }),
    }
    const result = await fetchSwornComplaintOrders(client as never, { fetcher: async () => html })
    expect(result.complaints[0]!.external_id).toBe('complaint-SC-202401-001')
    expect(result.events[0]!.external_id).toBe('event-SC-202401-001')
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement shared.ts**

Create `packages/db/supabase/seed/state-ethics/tx-tec/shared.ts`:

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedEthicsComplaint, NormalizedOfficialEvent } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'

const SOURCE_URL = 'https://www.ethics.state.tx.us/enforcement/sworn_complaints/orders/search/'
const FETCH_TIMEOUT_MS = 5000

export interface TxTecOrdersResult {
  complaints: NormalizedEthicsComplaint[]
  events: NormalizedOfficialEvent[]
  errors: string[]
}

export interface ParsedTxTecRow {
  order_number: string
  respondent: string
  date_issued: string
  year_filed: number
  agency: string
  status: string
  source_pdf_url: string
}

const LEGISLATOR_AGENCY_RE = /\b(Texas (?:House(?:\s+of\s+Representatives)?|Senate|Legislature))\b/i

/**
 * Parse the TX TEC sworn-complaint orders table.
 *
 * Audit (2026-05-24) structure:
 *   <table class="orders-table">
 *     <thead><tr><th>Order #</th><th>Respondent</th><th>Date Issued</th>
 *                <th>Year Filed</th><th>Agency</th><th>Status</th></tr></thead>
 *     <tbody>
 *       <tr><td><a href="/data/.../SC-XXX.pdf">SC-XXX</a></td>...</tr>
 *     </tbody>
 *   </table>
 *
 * Per-case PDFs deferred to a future slice; this parser uses the HTML
 * table data only (Order #, Respondent, Date Issued, Year Filed, Agency,
 * Status all available inline).
 */
export function parseTxTecOrdersHtml(html: string): ParsedTxTecRow[] {
  const $ = cheerio.load(html)
  const out: ParsedTxTecRow[] = []

  $('table.orders-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 6) return

    const orderAnchor = $(cells[0]).find('a').first()
    const order_number = orderAnchor.text().trim()
    const pdfHref = orderAnchor.attr('href') ?? ''
    if (!order_number) return

    const respondent = $(cells[1]).text().trim()
    const date_issued = $(cells[2]).text().trim()
    const yearText = $(cells[3]).text().trim()
    const year_filed = Number.parseInt(yearText, 10) || 0
    const agency = $(cells[4]).text().trim()
    const status = $(cells[5]).text().trim()

    const source_pdf_url = pdfHref.startsWith('http')
      ? pdfHref
      : `https://www.ethics.state.tx.us${pdfHref}`

    out.push({ order_number, respondent, date_issued, year_filed, agency, status, source_pdf_url })
  })

  return out
}

/**
 * Filter rows where the agency column refers to a Texas state legislator
 * (House or Senate). Excludes state-agency executives, Comptroller, etc.
 */
export function isTexasLegislatorRow(row: Pick<ParsedTxTecRow, 'agency'>): boolean {
  return LEGISLATOR_AGENCY_RE.test(row.agency)
}

/**
 * Map TX TEC status text to the canonical state_ethics_complaints.status enum.
 *
 * TX lexicon (different from NY COELIG):
 *   - "Resolved" / "Final Order" / "Agreed Order" / "Penalty Order" → sanctioned
 *   - "Pending" → open
 *   - "Dismissed" → dismissed
 *   - Unknown → closed_no_action (with explicit no-action branch)
 */
function mapStatus(text: string): NormalizedEthicsComplaint['status'] {
  const norm = text.trim().toLowerCase()
  if (norm.includes('pending') || norm.includes('open')) return 'open'
  if (norm.includes('dismiss')) return 'dismissed'
  if (norm.includes('settle')) return 'settled'
  if (
    norm.includes('resolved')
    || norm.includes('final order')
    || norm.includes('agreed order')
    || norm.includes('penalty order')
    || norm.includes('sanction')
  ) return 'sanctioned'
  if (norm.includes('closed') || norm.includes('no action')) return 'closed_no_action'
  return 'closed_no_action'
}

/**
 * Production fetcher: GET ethics.state.tx.us/enforcement/sworn_complaints/orders/search/,
 * parse all rows, filter to Texas state-legislator agencies, resolve each to
 * openstates_person_id, emit BOTH a complaint AND an event row per resolved
 * respondent.
 *
 * Combined-parser pattern (mirror of slice 15 ny-coelig). Each adapter
 * (txTecComplaints, txTecEvents) calls this helper independently — 2 HTTP
 * fetches per orchestrator run. v1 inefficiency accepted per slice 15
 * precedent.
 */
export async function fetchSwornComplaintOrders(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<TxTecOrdersResult> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher(SOURCE_URL)
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch {
    return { complaints: [], events: [], errors: ['fetch failed'] }
  }

  const parsedRows = parseTxTecOrdersHtml(html)
  const complaints: NormalizedEthicsComplaint[] = []
  const events: NormalizedOfficialEvent[] = []
  const errors: string[] = []

  for (const row of parsedRows) {
    if (!isTexasLegislatorRow(row)) continue

    const chamber: 'state_house' | 'state_senate' =
      /House/i.test(row.agency) ? 'state_house' : 'state_senate'

    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: row.respondent,
      state: 'TX',
      chamber,
    })
    if (!openstates_person_id) {
      errors.push(`unresolved: ${row.respondent} (${chamber})`)
      continue
    }

    const status = mapStatus(row.status)

    complaints.push({
      official_openstates_person_id: openstates_person_id,
      complaint_date: row.date_issued,
      status,
      disposition: row.status,
      summary: `Sworn complaint order ${row.order_number} (${row.agency})`,
      state: 'TX',
      source_url: row.source_pdf_url,
      source: 'tx-tec',
      external_id: `complaint-${row.order_number}`,
    })

    events.push({
      official_openstates_person_id: openstates_person_id,
      event_date: row.date_issued,
      event_type: 'campaign_finance_violation',
      outcome: row.status,
      summary: `TEC sworn complaint ${row.order_number}`,
      state: 'TX',
      source_url: row.source_pdf_url,
      source: 'tx-tec',
      external_id: `event-${row.order_number}`,
    })
  }

  return { complaints, events, errors }
}
```

- [ ] **Step 5: Update the 2 adapter wrappers**

Replace `packages/db/supabase/seed/state-ethics/complaints/tx-tec.ts` entire contents:

```ts
import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'
import { fetchSwornComplaintOrders } from '../tx-tec/shared.ts'

/**
 * TX ethics complaints from TEC sworn-complaint orders table.
 *
 * Combined-parser pattern (mirror of slice 15 ny-coelig). Shared
 * helper at ../tx-tec/shared.ts fetches the orders table and emits
 * BOTH complaints + events; this wrapper returns only the complaints
 * slice.
 *
 * HTML-only; per-case PDFs at
 * ethics.state.tx.us/data/enforcement/sworn_complaints/<year>/<id>.pdf
 * deferred to a future PDF-parsing slice.
 */
export const txTecComplaints: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'complaints',
  covered_states: ['TX'],
  async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (injected) return injected()
    const { complaints } = await fetchSwornComplaintOrders(opts.client, {})
    return complaints
  },
}
```

Replace `packages/db/supabase/seed/state-ethics/events/tx-tec.ts` entire contents:

```ts
import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { fetchSwornComplaintOrders } from '../tx-tec/shared.ts'

/**
 * TX campaign-finance-violation events from TEC sworn-complaint orders.
 *
 * Combined-parser pattern (mirror of slice 15 ny-coelig). Recall/expulsion
 * events sourced via slice 9 Ballotpedia nationwide; this adapter emits
 * only event_type='campaign_finance_violation'.
 */
export const txTecEvents: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'events',
  covered_states: ['TX'],
  async fetchEvents(opts): Promise<NormalizedOfficialEvent[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (injected) return injected()
    const { events } = await fetchSwornComplaintOrders(opts.client, {})
    return events
  },
}
```

- [ ] **Step 6: Update the 2 adapter test files**

Replace `packages/db/supabase/seed/state-ethics/complaints/tx-tec.test.ts` entire contents:

```ts
import { describe, expect, it, vi } from 'vitest'
import { txTecComplaints } from './tx-tec.ts'

describe('txTecComplaints adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(txTecComplaints.slug).toBe('tx-tec')
    expect(txTecComplaints.component).toBe('complaints')
    expect(txTecComplaints.covered_states).toEqual(['TX'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', complaint_date: '2024-01-01', status: 'open', summary: 's', state: 'TX', source_url: 'u', source: 'tx-tec' }]
    const result = await txTecComplaints.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchSwornComplaintOrders and returns complaints slice', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await txTecComplaints.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

Replace `packages/db/supabase/seed/state-ethics/events/tx-tec.test.ts` entire contents:

```ts
import { describe, expect, it, vi } from 'vitest'
import { txTecEvents } from './tx-tec.ts'

describe('txTecEvents adapter', () => {
  it('has correct slug/component/covered_states', () => {
    expect(txTecEvents.slug).toBe('tx-tec')
    expect(txTecEvents.component).toBe('events')
    expect(txTecEvents.covered_states).toEqual(['TX'])
  })

  it('injected fetcher short-circuits adapter dispatch', async () => {
    const fixture = [{ official_openstates_person_id: 'x', event_date: '2024-01-01', event_type: 'campaign_finance_violation', summary: 's', state: 'TX', source_url: 'u', source: 'tx-tec' }]
    const result = await txTecEvents.fetchEvents({
      fetcher: async () => fixture as never,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('production path calls fetchSwornComplaintOrders and returns events slice', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    const result = await txTecEvents.fetchEvents({ client: client as never } as never)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
    fetchSpy.mockRestore()
  })
})
```

- [ ] **Step 7: Run tests to verify PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec state-ethics/complaints/tx-tec state-ethics/events/tx-tec
```
Expected: All ~16 tests PASS (10 shared + 3 complaints + 3 events).

- [ ] **Step 8: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 9: Commit Task 6**

```bash
git add packages/db/supabase/seed/state-ethics/tx-tec \
        packages/db/supabase/seed/state-ethics/complaints/tx-tec.ts \
        packages/db/supabase/seed/state-ethics/complaints/tx-tec.test.ts \
        packages/db/supabase/seed/state-ethics/events/tx-tec.ts \
        packages/db/supabase/seed/state-ethics/events/tx-tec.test.ts \
        packages/db/supabase/seed/fixtures/state-ethics/tx-tec-orders.html
git commit -m "$(cat <<'EOF'
feat(state-ethics): TX TEC sworn-complaint orders combined parser

Combined-parser pattern (mirror of slice 15 ny-coelig). 1 HTML source
→ 2 schema sinks (state_ethics_complaints + state_official_events).
Each adapter (txTecComplaints, txTecEvents) is a thin wrapper around
the new tx-tec/shared.ts fetchSwornComplaintOrders().

- tx-tec/shared.ts: fetches
  ethics.state.tx.us/enforcement/sworn_complaints/orders/search/,
  parses the orders table via cheerio, filters Texas state-legislator
  rows via LEGISLATOR_AGENCY_RE, resolves to openstates_person_id with
  chamber inference (House → state_house, Senate → state_senate),
  emits NormalizedEthicsComplaint AND NormalizedOfficialEvent per
  resolved row. event_type always 'campaign_finance_violation'
  (recall/expulsion via slice 9 Ballotpedia nationwide).
- Status mapping TX-specific lexicon: "Resolved" / "Final Order" /
  "Agreed Order" / "Penalty Order" → sanctioned; "Pending" → open;
  "Dismissed" → dismissed. Explicit closed/no-action branch before
  catch-all per slice 15 review pattern.
- external_id derived from TEC Order # (SC-YYYYMM-NNN) with
  complaint-/event- prefix.
- HTML-only; per-case PDFs at /data/enforcement/sworn_complaints/
  <year>/<id>.pdf deferred to a future PDF-parsing slice.
- 16 vitest cases (10 shared + 3 each adapter).

Slug stays `tx-tec` (back-compat with slice 5I stubs).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Closure — CLAUDE.md slice 16 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 16 entry; no new Gotcha)
- Create (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice16_ca_mi_tx_parsers.md`
- Modify (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`

- [ ] **Step 1: Append slice 16 entry to CLAUDE.md**

Read `CLAUDE.md`. Find the `## Slices delivered` section + the slice 15 entry. Append IMMEDIATELY AFTER:

```markdown
- **Slice 16 — CA + MI district_offices + TX ethics combined** (2026-05-24): Three production parsers extending slice 15 patterns across non-NY states (closes 3 of 6 remaining bucket-A audit ship candidates). (1) **CA district_offices** (`ca-leginfo/` subfolder): `senate.ca.gov/senators` single-page roster (40 senators, single fetch) + `assembly.ca.gov/assemblymembers/{n}` per-member loop (80 AMs at 1-req/sec). Total CA production fetch: 81 GETs / ~80s. (2) **MI district_offices** (`mi-legislature/` subfolder): `senate.michigan.gov/senators/{slug}/` per-senator (38) + `house.mi.gov/representative-{slug}` per-rep (110). Total MI production fetch: 148 GETs / ~148s. Relies on existing try/catch+silent-skip for MI House TLS-handshake flake (audit Lesson 4) — no special retry helper added in v1. (3) **TX ethics combined** (`tx-tec/`): mirror of slice 15 ny-coelig. 1 HTML fetch of `ethics.state.tx.us/enforcement/sworn_complaints/orders/search/` → `{complaints, events, errors}`. TX-specific status lexicon ("Resolved" / "Final Order" / "Agreed Order" / "Penalty Order" → sanctioned). HTML-only; per-case PDFs deferred. Also hoisted `parseAddressText` from slice 15 `ny-senate/assembly.ts` to district-office-scoped `_shared.ts` (6 callers now share). Slice 15 NY files re-import from new location. Slugs stay legacy (`ca-leginfo`, `mi-legislature`, `tx-tec`) for back-compat. **Mid-slice-broken-state avoidance:** Tasks 3+5 each delete the flat stub + update the orchestrator + add `index.ts` in a single commit (slice 15 missed this and needed a follow-up fix commit). ~31 files touched; no schema work; pgTAP unchanged at 402 plans. State stub count: 4 more adapters → production (ca-leginfo offices, mi-legislature offices, tx-tec complaints, tx-tec events).
```

No new Gotcha — slice 15 patterns covered by existing Gotchas + slice 15 lessons.

- [ ] **Step 2: Write the memory file**

Use the Write tool to create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice16_ca_mi_tx_parsers.md`:

```markdown
---
name: project-chiaro-slice16-ca-mi-tx-parsers
description: Slice 16 — CA + MI district_offices + TX ethics combined; extends slice 15 patterns across non-NY states
metadata:
  type: project
---

Slice 16 shipped 2026-05-24 — merged locally to master as squash `<squash SHA>`. Feature branch `slice-16-ca-mi-tx-parsers` deleted post-merge.

**Scope:** Three production parsers extending slice 15 patterns across non-NY states. Closes 3 of 6 remaining bucket-A ship candidates from slice 12 audit. Hoists `parseAddressText` to a district-office-scoped shared module (6 callers now).

**What shipped:**
- `parseAddressText` hoisted from slice 15 `ny-senate/assembly.ts` to `state-community/district-offices/_shared.ts`. Slice 15 NY files re-import.
- CA district_offices subfolder (`ca-leginfo/`): senate single-page roster + assembly per-member loop. ~16 vitest cases.
- MI district_offices subfolder (`mi-legislature/`): per-senator + per-rep loops. ~17 vitest cases.
- TX ethics combined parser (`tx-tec/`): mirror of slice 15 ny-coelig. ~16 vitest cases.
- 5 HTML fixtures committed.
- Orchestrator `state-community-ingest.ts` updated to point at new subfolder index.ts paths.

**Durable lessons:**

1. **Mid-slice broken-state avoidance pattern.** Slice 15 deleted the flat stub before adding the subfolder index.ts → required a fix commit. Slice 16 inverts: Tasks 3 + 5 delete the flat stub + add the index.ts + update the orchestrator in a single commit. Result: no commit on the branch leaves the orchestrator broken. Pattern: when migrating a flat-file adapter to a subfolder, the "completes the subfolder" commit MUST also delete the flat file AND update consumer imports — bundle all three changes.

2. **`parseAddressText` hoist trigger threshold = 6 callers.** Slice 15 had 2 callers, was OK to keep local to assembly.ts. Slice 16 adds 4 more (CA senate, CA assembly, MI senate, MI house) → trigger met for canonical hoist. New file `_shared.ts` (underscore-prefixed signals package-internal helper). Distinct from `state-community/shared.ts` (interface defs) and `seed/shared/officials.ts` (cross-domain shared helpers).

3. **TX TEC status lexicon ≠ NY COELIG lexicon.** "Resolved" / "Final Order" / "Agreed Order" / "Penalty Order" are TX-specific (NY uses "Sanctioned" / "Settled" / "Consent Order"). Each state's status mapping needs its own catalog; copy-pasting `mapStatus` from `ny-coelig` would mismap real TX rows. Lesson: per-state combined parsers MUST audit the status lexicon from real source data, not inherit it.

4. **CA Assembly URL slug-derivation differs from MI/NY pattern.** CA Assembly uses district NUMBER (`assembly.ca.gov/assemblymembers/14`); MI + NY use firstname-lastname slug. URL derivation must be source-specific — abstracting a single `deriveSlug` helper across states would over-generalize.

5. **MI House TLS-flake silently tolerated.** Audit Lesson 4 flagged `house.mi.gov` TLS-handshake flake. Slice 16 relies on the existing try/catch silent-skip in `fetchMiHouseOffices` — no special retry helper added. Production pass rate observation deferred to slice 17. If <50%, add explicit retry with exponential backoff.

6. **`_shared.ts` filename convention.** Underscore prefix on filename = package-internal helper, not for cross-domain import. Distinct from sibling `shared.ts` (no underscore, interface definitions). Filename pattern emerged from slice 16 needing a 3rd category of shared module (cross-cutting helper, not interface). Future shared helpers in `state-community/` or `state-ethics/` should follow this convention when they're not exporting interface types.

7. **Slug-vs-source-URL drift is intentional and back-compat-driven.** `ca-leginfo` slug points at `senate.ca.gov` + `assembly.ca.gov` (not `leginfo.legislature.ca.gov`). `mi-legislature` slug points at `senate.michigan.gov` + `house.mi.gov` (not `legislature.mi.gov`). `tx-tec` slug points at `ethics.state.tx.us` (TEC = Texas Ethics Commission). Justification: slice 5H/5I `state_community_orgs` + `state_ethics_orgs` rows reference these slugs; changing them would break DB row continuity. JSDoc on each `index.ts` explains the discrepancy. Pattern: slugs are stable identifiers; source URLs are operational details.

8. **Combined-parser pattern proven for 2nd state (TX).** Slice 15 established the pattern (1 HTML → 2 sinks via shared helper + 2 thin adapter wrappers). Slice 16 reproduces it verbatim for TX. Confirms: combined-parser is a reusable template, not a one-off slice 15 NY artifact. Likely template for future states that have similar 1-source-2-sinks ethics enforcement tables.

9. **`StateCommunityAdapter` interface gap: `fetcher` signature mismatch.** The `StateCommunityAdapter` interface's `fetcher?: () => Promise<unknown[]>` doesn't match the actual fetcher signatures used (`() => Promise<string>` for HTML, `() => Promise<NormalizedXxx[]>` for fixture injection). All implementations cast via `(opts as never as { fetcher?: ... })`. Same pattern in slice 7 + 8 + 9 + 15. Documented as carry-over inefficiency; refactoring requires widening the interface to a discriminated union which would touch every adapter — defer until a measured impact justifies it.

10. **Vitest scoped test runs miss broken-import regressions.** Per slice 15 Lesson 11: `pnpm typecheck` doesn't include `supabase/seed/` (only `src/**/*.ts`). The full `pnpm --filter @chiaro/db exec vitest run` is the only safety net for orchestrator import regressions. Slice 16 explicitly runs the FULL suite in Tasks 3 + 5 Step 8 (not just the scoped test) to catch the same trap slice 15 fell into.

**Active follow-ups (operator):**

- Slice 17: remaining audit follow-ups (FL district_offices multi-hop, NY FDS index ingest, FL stock + ethics SPA reverse-engineering, MI PFD predictable-URL ingest)
- PDF-parsing slice: TX TEC per-case orders + NY FDS filings + MI PFD. New workspace dep (`pdf-parse`)
- LCV-OR + PP × 5 browser-UA probe spike (slice 11 carryover)
- Mobile DoD on-device smoke
- Per-state slug-derivation drift monitoring: when CA Assembly URLs run against real district numbers, monitor `stats.errors[]` for `0 parsed rows` rate. Same for MI Senate + House.
- MI House TLS-flake measurement: instrument prod pass rate; if <50%, slice 18 adds retry helper.
- Combined-parser memoization: cross-adapter caching of the TX TEC fetch deferred until measured impact.

**Master state at slice 16 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans across 31 files (unchanged). 13 production parsers total (was 10 post-slice-15; +3 slice 16: CA district_offices, MI district_offices, TX ethics combined). @chiaro/db test count: ~620+ passing (568 + ~50-60 new). Bucket-A audit ship candidates: 6 → 3 (3 closed in slice 15, 3 closed in slice 16).

**Cross-links:** [[project-chiaro-slice5h-community-presence]] [[project-chiaro-slice5i-ethics-accountability]] [[project-chiaro-slice11-lcv-scorecards]] [[project-chiaro-slice12-stub-audit]] [[project-chiaro-slice15-ny-parsers]]
```

- [ ] **Step 3: Update MEMORY.md index**

Read `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`. Find the slice 15 entry line. Add the new line IMMEDIATELY AFTER:

```markdown
- [Chiaro slice 16 CA + MI + TX parsers](project_chiaro_slice16_ca_mi_tx_parsers.md) — 3 production parsers extending slice 15 patterns to non-NY states (CA + MI district_offices subfolders + TX ethics combined); hoists parseAddressText to district-offices/_shared.ts (6 callers); mid-slice-broken-state avoidance pattern (delete flat stub + add index.ts + update orchestrator in one commit)
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/web build
```

Expected: all green.
- `pnpm -r typecheck` — 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` — ~620+ tests pass (568 + ~50-60 new across CA + MI + TX)
- `pnpm --filter @chiaro/web build` — 12 routes green

- [ ] **Step 5: Commit Task 7**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 16 closure — CLAUDE.md entry

Slice 16 ships 3 production parsers extending slice 15 patterns
across non-NY states (CA + MI district_offices + TX ethics combined).
Hoists parseAddressText to district-offices/_shared.ts (6 callers).
Mid-slice-broken-state avoidance pattern documented.

No new Gotcha -- slice 15 patterns covered by existing Gotchas +
slice 15 lessons.

@chiaro/db test count: +~50-60 cases.
State bucket-A audit ship candidates: 6 -> 3 closed.
pgTAP unchanged at 402 plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo working tree — write them in Steps 2-3 but do NOT git add them.)

---

## Workspace verify gate (recap)

After all 7 tasks complete:

```bash
pnpm -r typecheck                                                    # 11 packages green
pnpm --filter @chiaro/db exec vitest run                             # full suite ~620+ tests green
pnpm --filter @chiaro/web build                                      # 12 routes
git log master..HEAD --oneline                                       # 8-9 commits (spec + plan + 7 implementation)
```

Expected:
- 11 packages typecheck green
- CA district_offices: ~16 tests PASS
- MI district_offices: ~17 tests PASS
- TX ethics combined: ~16 tests PASS
- Slice 16 total: ~50 new vitest cases
- @chiaro/db full suite: 568 + ~50 = ~620 tests
- Web build: 12 routes green
- Branch: 9 commits (1 spec + 1 plan + 7 implementation)

---

## Self-review notes

### Spec coverage

- ✅ CA district_offices Senate roster — Task 2
- ✅ CA district_offices Assembly per-member loop — Task 3
- ✅ CA subfolder dispatch — Task 3 (index.ts)
- ✅ MI district_offices Senate per-senator loop — Task 4
- ✅ MI district_offices House per-rep loop — Task 5
- ✅ MI subfolder dispatch — Task 5 (index.ts)
- ✅ TX ethics combined parser — Task 6 (shared.ts + 2 thin wrappers)
- ✅ parseAddressText hoist — Task 1
- ✅ Slice 15 NY re-import updates — Task 1
- ✅ Orchestrator import updates — Tasks 3 + 5 (bundled with stub deletion to avoid slice 15 trap)
- ✅ Flat-stub deletions — Tasks 3 + 5
- ✅ 5 HTML fixtures — Tasks 2-6
- ✅ CLAUDE.md slice entry — Task 7
- ✅ Memory + MEMORY.md — Task 7

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. Each task contains full file content or precise diff blocks. Port-time verification points documented as JSDoc comments in source files (CA Assembly URL pattern, MI senator/rep slug derivation, all HTML selectors).

### Type consistency

- `NormalizedDistrictOffice` shape used consistently across CA Senate + Assembly + MI Senate + House: `{official_openstates_person_id, kind, street_1, city, state, postal_code?, phone?, source_url}`.
- `NormalizedEthicsComplaint` + `NormalizedOfficialEvent` shapes consistent across TX tx-tec/shared.ts + adapter wrappers.
- `parseAddressText` signature `(raw: string) => {street_1, city, state, postal_code?, phone?} | null` consistent between `_shared.ts` definition and all 6 callers.
- `fetchSwornComplaintOrders` returns `{complaints, events, errors}` consistently mirroring slice 15 `fetchEnforcementActions`.

### Known incomplete details

- Task 3 + 5 CA Assembly URL pattern + MI senator/rep slug patterns: real URL patterns are audit-derived. Implementer SHOULD fetch 2-3 real URLs during scaffold to verify. Failure mode: 0 parsed rows per member → silent skip (acceptable v1 degradation).
- Task 6 TX status lexicon: catalog is from 1-2 sample order pages in audit reconnaissance. New variants discovered in production trigger a `mapStatus` update (no code design change required).
- Memory file `<squash SHA>` placeholder: filled post-merge during finishing-a-development-branch per slice 14/15 precedent.
- TX ethics combined parser's "production path calls fetchSwornComplaintOrders" test relies on the global fetch stub (slice 15 Lesson 12). All production-path adapter tests stub `globalThis.fetch` to prevent CI flake.
- HTML selectors in fixtures (`article.senator-card`, `section.capitol-office`, `table.orders-table`, etc.) are audit-derived. JSDoc on each parser flags this; production drift surfaces via empty result arrays (CA/MI) + `errors[]` (TX).
