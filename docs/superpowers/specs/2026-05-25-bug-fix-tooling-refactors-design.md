# Slice 18 — Bug-fix + tooling + 5 refactors design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Post-slice-17 audit (`docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`)

## Goal

Consolidate the audit's full inventory into one substantive slice before more parsers ship:
- Fix 3 audit-identified bugs that ship silent data loss
- Land 2 tooling investments + 1 Gotcha that benefit all future slice work
- Execute 5 cross-cutting parser refactors (M1, M3, M4, M5, M6) that collapse ~480 lines + eliminate 36 unsafe `as never` casts + propagate a11y smart-anchor pattern to 7 UI sites

PDF-parsing infrastructure (the audit's other recommendation) defers to slice 19 — running it AFTER this slice means the new helper + tooling is available to the PDF parsers from day one.

## Non-goals

- **No new parsers.** All work is bug fixes, tooling, refactors, or cross-package a11y propagation.
- **No PDF parsing.** Slice 19 (or later).
- **No schema work.** pgTAP unchanged at 402 plans.
- **No new workspace deps.** `cheerio` already installed.
- **No `<section>` landmark restoration for BioHeader** (slice 14 deferred follow-up; out of scope).
- **No T5 (auto-fill `<squash SHA>` placeholder)** — touches Anthropic skill repo, not the project.
- **No production-run instrumentation pass.** Operator follow-up; depends on environment access.

## Architecture

```
Task 1: Bug fixes ───────────────────────────────────────────────────────────
  state-community/town-halls/ny-senate.ts                deriveSenatorSlug Unicode fix
  state-community/district-offices/ny-senate/senate.ts   deriveSenatorSlug Unicode fix (same fn)
  state-community/district-offices/mi-legislature/senate.ts  deriveMiSenatorUrl Unicode fix
  state-community/district-offices/mi-legislature/house.ts   deriveMiRepUrl Unicode fix
  state-ethics/disclosures/ny-jcope.ts                   MAX_PAGES_DEFAULT 50 → 120
  state-community/district-offices/ny-senate/{assembly,senate}.ts  .first() selector fixes
  state-community/district-offices/ca-leginfo/{senate,assembly}.ts  .first() selector fixes
  state-community/district-offices/mi-legislature/{senate,house}.ts  .first() selector fixes
  state-community/district-offices/fl-doe/{senate,house}.ts  .first() selector fixes
  (test updates as needed to validate the fixes)

Task 2: Tooling — tsconfig.seed.json + Gotcha #23 ───────────────────────────
  packages/db/tsconfig.seed.json                          NEW
  packages/db/package.json                                typecheck script composite
  CLAUDE.md                                               Gotcha #23

Task 3: Tooling — stubFetchBlocked() helper ─────────────────────────────────
  packages/db/supabase/seed/test-utils/stub-fetch.ts      NEW
  Refactor 9 existing adapter test files to use helper

Task 4: M3 — Generic StateXxxAdapter<E> ─────────────────────────────────────
  state-community/shared.ts                               interface widening
  state-ethics/shared.ts                                  interface widening
  ALL ~13 adapter files                                   remove `as never as { fetcher?: ... }` casts

Task 5: M1 + M4 + M5 — fetchPerMemberOffices helper ─────────────────────────
  state-community/district-offices/_shared.ts             ADD fetchPerMemberOffices + emitOfficeRow + constants
  6 per-chamber parsers                                   collapse from ~110 to ~25 lines each
  3 index.ts files                                        simplified

Task 6: M6 — Smart-anchor propagation across 7 UI sites ─────────────────────
  packages/officials-ui/src/bio/BioContactLinks.tsx       2 sites
  packages/officials-ui/src/cards/OfficialsCard.tsx       2 sites
  packages/officials-ui/src/officials/OfficialsList.tsx   2 sites
  packages/officials-ui/src/finance/TopAmountBreakdown.tsx 1 site
  Existing chipHref pattern from slice 14 extended

Task 7: Closure ─────────────────────────────────────────────────────────────
  CLAUDE.md                                               slice 18 entry
  memory + MEMORY.md                                       per slice 15-17 precedent
```

### File count

- **Created (4):** tsconfig.seed.json + test-utils/stub-fetch.ts + memory file (outside repo) + (potentially) new test files for fixes
- **Modified (~46):**
  - Task 1: ~11 parser files + their tests
  - Task 2: 2 files (package.json + CLAUDE.md)
  - Task 3: 9 test files
  - Task 4: 2 interface files + ~13 adapter files
  - Task 5: _shared.ts (extends existing) + 6 per-chamber + 3 index
  - Task 6: 4 UI component files + consumer pages
  - Task 7: CLAUDE.md
- **Deleted (0)**
- **Total touched: ~50 files** — largest slice yet but task decomposition stays manageable.

## Components

### Task 1: Bug fixes

**Bug 1: Unicode-strip drops accented characters**

Current pattern in 3 derive helpers:
```ts
return name.toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
```

Fix (insert one line before alphanumeric strip):
```ts
return name.toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
```

Apply to:
- `deriveSenatorSlug` in `state-community/district-offices/ny-senate/senate.ts:25-30`
- `deriveMiSenatorUrl` in `state-community/district-offices/mi-legislature/senate.ts:21-27`
- `deriveMiRepUrl` in `state-community/district-offices/mi-legislature/house.ts:22-28`

Add 1 test per function asserting "José Smith" → "jose-smith" (NOT "jos-smith").

**Bug 2: MAX_PAGES_DEFAULT raised**

`state-ethics/disclosures/ny-jcope.ts:8`:
```ts
const MAX_PAGES_DEFAULT = 120  // Was 50; raised per slice 18 audit (~113 pages needed for 2,804 records / ~25/page)
```

Update the page-cap test to use a smaller `maxPages: 3` opt (it already does — no test change required).

**Bug 3: `.first()` selector fragility**

Current pattern (8 sites):
```ts
const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
```

Fix (block-level text + replace newlines with commas to feed parseAddressText):
```ts
const capitolText = $('section.capitol-office').text().trim().replace(/\s+/g, ' ')
```

Caveat: `block.text()` flattens whitespace across all child nodes. parseAddressText comma-splits, so concatenated text without separators may split incorrectly. Recommended approach: iterate `$('p').each()` and join with `, ` to preserve segment boundaries.

```ts
const paragraphs: string[] = []
$('section.capitol-office p').each((_, p) => {
  const txt = $(p).text().trim().replace(/\s+/g, ' ')
  if (txt) paragraphs.push(txt)
})
const capitolText = paragraphs.length > 0 ? paragraphs.join(', ') : undefined
```

Apply to 8 sites in: `ny-senate/{assembly,senate}.ts`, `ca-leginfo/{senate,assembly}.ts`, `mi-legislature/{senate,house}.ts`, `fl-doe/{senate,house}.ts`. Add ≥1 test case per parser exercising a multi-`<p>` fixture variant.

### Task 2: tsconfig.seed.json + Gotcha #23

**tsconfig.seed.json** (new file at `packages/db/tsconfig.seed.json`):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["supabase/seed/**/*.ts"]
}
```

**packages/db/package.json** typecheck script:
```diff
-"typecheck": "tsc --noEmit",
+"typecheck": "tsc --noEmit && tsc -p tsconfig.seed.json",
```

**CLAUDE.md Gotcha #23** (append after Gotcha #22):
```markdown
23. **Atomic commit required for flat-stub → subfolder migrations.** When migrating a flat-file adapter (e.g. `state-community/district-offices/fl-doe.ts`) to a subfolder pattern (`fl-doe/{index,senate,house}.ts`), the deletion of the flat file + creation of `index.ts` + orchestrator import update MUST land in a single commit. Splitting them across commits leaves master in a broken-import state mid-PR — slice 15 fell into this trap (Tasks 3 + 4) and required a separate fix commit. Slices 16 + 17 explicitly bundled. The seed tree is not in `packages/db/tsconfig.json`'s `include` path (which catches this only via `pnpm vitest run`, not `pnpm typecheck`) — slice 18's new `tsconfig.seed.json` closes that blind spot.
```

### Task 3: stubFetchBlocked helper + propagation

**New file** `packages/db/supabase/seed/test-utils/stub-fetch.ts`:
```ts
import { vi } from 'vitest'

/**
 * Stub `globalThis.fetch` to reject all calls during a test. Used by
 * production-path adapter tests where the production code path
 * naturally calls `fetch()` and we want to assert it gracefully
 * degrades to `[]` without making real network calls.
 *
 * Returns the spy so caller can assert on it; spy auto-restores on
 * test teardown if the caller uses afterEach(() => fetchSpy.mockRestore()).
 */
export function stubFetchBlocked() {
  return vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
}

/**
 * Block fetch for the duration of `fn`. Auto-restores on completion
 * (success or throw). Use when you want stub scoping inside one test.
 */
export async function withStubbedFetch<T>(fn: () => Promise<T>): Promise<T> {
  const spy = stubFetchBlocked()
  try {
    return await fn()
  } finally {
    spy.mockRestore()
  }
}
```

**Refactor 9 test files** to use the helper. Each replaces ~5 lines with 1 import + 1 call:
```diff
-const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
+const fetchSpy = stubFetchBlocked()
 // ... test body ...
 fetchSpy.mockRestore()
```

Files: `ny-senate/index.test.ts`, `ca-leginfo/index.test.ts`, `mi-legislature/index.test.ts`, `fl-doe/index.test.ts`, `ny-coelig/shared.test.ts` (if applicable), `tx-tec/shared.test.ts` (if applicable), 3 adapter wrapper tests (complaints/events ny-jcope + tx-tec).

### Task 4: M3 — Generic `StateXxxAdapter<E>`

**`state-community/shared.ts` widening:**
```ts
type StateCommunityEventType =
  | NormalizedTownHall
  | NormalizedDistrictOffice
  | NormalizedCommitteeHearing

export interface StateCommunityAdapter<E extends StateCommunityEventType = StateCommunityEventType> {
  slug: string
  component: CommunityComponent
  covered_states: string[]
  fetchEvents(opts: {
    client: Client
    state?: string
    fetcher?: () => Promise<E[]>
  }): Promise<E[]>
}
```

**`state-ethics/shared.ts` same pattern** for `StateEthicsAdapter<E>`.

**Adapter file updates (~13 files):**
```diff
-export const flDoeOffices: StateCommunityAdapter = {
+export const flDoeOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
   slug: 'fl-doe',
   component: 'offices',
   covered_states: ['FL'],
   async fetchEvents(opts) {
-    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
-    if (injected) return injected()
+    if (opts.fetcher) return opts.fetcher()
     // ... rest
   },
 }
```

**Orchestrator array update** (`state-community-ingest.ts:29`):
```diff
-const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
+const ADAPTERS_DEFAULT: Array<StateCommunityAdapter<StateCommunityEventType>> = [
```

(The array stays mixed-event-type via the wildcard. Each adapter's specific `E` parameter narrows internally.)

**NY FDS dual-fetcher cleanup:** The dual-fetcher discriminator from slice 17 (`hasClient` heuristic) is replaced by the typed `opts.fetcher` from the widened interface. Page-fetcher tests inject a typed override; production path uses the default. The slice 17 `hasClient` discriminator becomes obsolete.

### Task 5: M1 + M4 + M5 — fetchPerMemberOffices helper

**`state-community/district-offices/_shared.ts` extension** (additions to existing file):

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../shared.ts'

export const FETCH_TIMEOUT_MS = 5000
export const RATE_LIMIT_MS = 1000

// ... existing parseAddressText (slice 16) stays here ...

export interface ParsedMemberDetail {
  capitol_office?: string
  district_office?: string
}

export interface PerMemberOfficesOpts {
  chamber: 'state_house' | 'state_senate'
  state: string
  deriveUrl: (legislator: { full_name: string; district_id: string | null; openstates_person_id: string }) => string | null
  parseDetailHtml: (html: string) => ParsedMemberDetail
  fetcher?: (url: string) => Promise<string>
}

/**
 * Generic per-member offices fetch loop. Shared by all 6 per-chamber
 * parsers (slice 16 ca-leginfo + mi-legislature, slice 17 fl-doe,
 * slice 15 ny-senate detail-page side).
 *
 * Queries `officials` for the (chamber, state) cohort, derives each
 * legislator's profile URL via the caller-supplied deriveUrl
 * callback (returns null to skip), fetches with 1-req/sec courtesy
 * throttle (skipped when opts.fetcher is injected), parses via the
 * caller-supplied parseDetailHtml, and emits NormalizedDistrictOffice
 * rows via emitOfficeRow.
 *
 * The throttle is guarded against firing after the last iteration
 * (audit M5 fix).
 *
 * Replaces ~480 lines of duplicated per-chamber boilerplate.
 */
export async function fetchPerMemberOffices(
  client: Pick<Client, 'query'>,
  opts: PerMemberOfficesOpts,
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{
    openstates_person_id: string
    full_name: string
    district_id: string | null
  }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = $1 and state = $2 and in_office = true`,
    [opts.chamber, opts.state],
  )

  const out: NormalizedDistrictOffice[] = []
  const rows = res.rows
  const totalRows = rows.length

  for (let i = 0; i < totalRows; i += 1) {
    const legislator = rows[i]!
    const url = opts.deriveUrl(legislator)
    if (!url) continue

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = opts.parseDetailHtml(html)

    if (parsed.capitol_office) {
      const row = emitOfficeRow(parsed.capitol_office, {
        openstates_person_id: legislator.openstates_person_id,
        kind: 'capitol',
        source_url: url,
      })
      if (row) out.push(row)
    }
    if (parsed.district_office) {
      const row = emitOfficeRow(parsed.district_office, {
        openstates_person_id: legislator.openstates_person_id,
        kind: 'district',
        source_url: url,
      })
      if (row) out.push(row)
    }

    // Audit M5: skip throttle after last iteration
    if (!opts.fetcher && i < totalRows - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}

export function emitOfficeRow(
  raw: string,
  opts: {
    openstates_person_id: string
    kind: 'capitol' | 'district'
    source_url: string
  },
): NormalizedDistrictOffice | null {
  const parts = parseAddressText(raw)
  if (!parts) return null
  const row: NormalizedDistrictOffice = {
    official_openstates_person_id: opts.openstates_person_id,
    kind: opts.kind,
    street_1: parts.street_1,
    city: parts.city,
    state: parts.state,
    source_url: opts.source_url,
  }
  if (parts.postal_code) row.postal_code = parts.postal_code
  if (parts.phone) row.phone = parts.phone
  return row
}
```

**Per-chamber parser collapse** (example for `mi-legislature/senate.ts`):

```ts
import { fetchPerMemberOffices, type ParsedMemberDetail } from '../_shared.ts'
// ... no Client import, no FETCH_TIMEOUT_MS local, no RATE_LIMIT_MS, no inline loop

export function deriveMiSenatorUrl(full_name: string): string {
  const slug = full_name
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')  // Audit Bug 1 fix
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `https://senate.michigan.gov/senators/${slug}/`
}

export function parseMiSenatorProfileHtml(html: string): ParsedMemberDetail {
  const $ = cheerio.load(html)
  const out: ParsedMemberDetail = {}
  // Audit Bug 3 fix: iterate paragraphs, join with ", "
  const lansingParas: string[] = []
  $('section.lansing-office p').each((_, p) => {
    const t = $(p).text().trim().replace(/\s+/g, ' ')
    if (t) lansingParas.push(t)
  })
  if (lansingParas.length > 0) out.capitol_office = lansingParas.join(', ')
  // ... same for district-office
  return out
}

export async function fetchMiSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_senate',
    state: 'MI',
    deriveUrl: (l) => l ? deriveMiSenatorUrl(l.full_name) : null,
    parseDetailHtml: parseMiSenatorProfileHtml,
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
  })
}
```

Each per-chamber file collapses to ~25-30 lines (down from ~110).

**Tests:** parser-level tests (parseDetailHtml + deriveUrl) keep working unchanged. Fetcher-loop tests can either stay (testing the per-chamber adapter) or be partially deduplicated by adding a single `fetchPerMemberOffices` test in `_shared.test.ts`.

### Task 6: M6 — Smart-anchor propagation

**Pattern (from slice 14 AlignmentChip):**
```ts
import { createElement } from 'react'
import { Platform } from 'react-native'

// On web with href, render real <a> + intercept clicks for SPA nav.
if (Platform.OS === 'web' && href) {
  return createElement('a', {
    href,
    onClick: (e: any) => {
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault()
        onPress?.()
      }
      // Modifier-key clicks fall through to browser default
    },
    children: /* same content as Pressable */,
  })
}
// Native or web-without-href: use Pressable
```

Apply to:
- `packages/officials-ui/src/bio/BioContactLinks.tsx` lines 23 + 30 — 2 sites
- `packages/officials-ui/src/officials/OfficialsList.tsx` lines 36 + 60 — 2 sites
- `packages/officials-ui/src/cards/OfficialsCard.tsx` lines 132 + 175 — 2 sites
- `packages/officials-ui/src/finance/TopAmountBreakdown.tsx` line 127 — 1 site

Each site needs an `href?: string` prop added alongside existing `onPress?`. Consumer pages (in `apps/web/`) pass href builders via callback props (matching `chipHref` pattern from slice 14).

Total: 7 sites consolidated (audit said 8; might find 1 more during scaffold).

### Task 7: Closure

Standard slice closure pattern (slice 15-17 precedent):
- CLAUDE.md slice 18 entry under `## Slices delivered`
- Memory file `project_chiaro_slice18_bug_fix_tooling_refactors.md` with squash SHA placeholder + durable lessons
- MEMORY.md index line
- Workspace verify gate

## Data flow

No new data flows. All work is internal-quality. Existing parser/test/orchestrator data flow unchanged.

## Error handling

Same patterns as slices 15-17. The `.first()` selector fix is the only behavior change: previously, multi-`<p>` sections silently dropped data after the first paragraph; now all paragraphs concatenate via comma-join for parseAddressText consumption.

## Testing strategy

- Task 1: Add 1 Unicode test case per derive function (3 new cases). Update existing parser tests to assert multi-`<p>` extraction yields the expected joined string.
- Task 2: tsconfig.seed.json smoke test (`pnpm --filter @chiaro/db run typecheck` shows it covering seed tree).
- Task 3: Existing 9 test files keep passing (assertions unchanged; just import helper).
- Task 4: All ~13 adapter tests keep passing (interface widening doesn't change runtime behavior).
- Task 5: 6 per-chamber adapter tests keep passing (helper-collapsed code preserves contracts). 1 new test file `_shared.test.ts` for fetchPerMemberOffices + emitOfficeRow direct tests.
- Task 6: AlignmentChip smart-anchor test pattern adapts to each new site (7 new test files OR shared test helper).

Expected test count: 631 → ~660 (+~30 cases for Task 1 + Task 5 + Task 6).

## Verify gate

- `pnpm --filter @chiaro/db typecheck` AND `pnpm --filter @chiaro/db run typecheck` (the new composite catches seed tree)
- `pnpm -r typecheck` → 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` → ~660 tests green
- `pnpm --filter @chiaro/web build` → 12 routes green
- `pnpm --filter @chiaro/officials-ui exec vitest run` → existing 233 tests + ~7 new smart-anchor tests

## Risk + tradeoffs

1. **Task 4 + Task 5 both touch every per-chamber parser file.** Order matters: Task 4 (interface widening + cast removal) first, Task 5 (helper hoist that uses the widened interface) second. Each commit verified independently.

2. **Task 5 collapses 6 files at once.** If `fetchPerMemberOffices` has a subtle bug, all 6 states regress simultaneously. Mitigation: test `fetchPerMemberOffices` in isolation BEFORE migrating parsers. The 1 new test file gates the helper.

3. **`.first()` fix may surprise existing tests.** Fixtures with single-`<p>` sections behave identically; multi-`<p>` fixtures (none currently exist) would now extract more. No fixture changes needed in this slice, but the joining-with-comma behavior creates a new expectation. Adding 1-2 multi-`<p>` fixture variants per parser locks the new behavior.

4. **`pnpm typecheck` runtime extension.** Adding tsconfig.seed.json adds ~3-5 seconds to typecheck. Acceptable tradeoff for the regression-catching value.

5. **M3 generic interface may force orchestrator changes.** `state-community-ingest.ts` builds a `StateCommunityAdapter[]` array mixing 3 event types. With generics, the array typing needs `Array<StateCommunityAdapter<StateCommunityEventType>>` or similar. Verify during implementation.

6. **M6 (Task 6) is in a different package.** `@chiaro/officials-ui` work is independent of parser tasks; can run as parallel subagent dispatch if subagent-driven-development allows. Or sequence after parser tasks.

7. **Slice scope is the largest yet (~50 files).** Risk of fatigue / regression during execution. Subagent-driven-development with two-stage review per task contains blast radius per commit.

8. **Atomic Gotcha #23 lands BEFORE Task 5** (Task 2 is sequenced before Task 5). Documents the pattern that Task 5 follows.

9. **The slice 17 dual-fetcher discriminator (`hasClient` heuristic in NY FDS) becomes obsolete after Task 4.** The widened interface + typed fetcher signature removes the need for the heuristic. Task 4 should explicitly clean it up.

## Schema verification needed during planning

No new types introduced. Existing `NormalizedDistrictOffice`, `NormalizedTownHall`, `NormalizedFinancialDisclosure`, `NormalizedEthicsComplaint`, `NormalizedOfficialEvent` shapes are unchanged.

`StateCommunityAdapter` + `StateEthicsAdapter` interface generics need careful design — the union of possible event types is the default upper bound; concrete adapters narrow.

## Cross-references

- Audit: `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`
- Slice 14 (AlignmentChip smart-anchor pattern): `docs/superpowers/plans/2026-05-24-a11y-batch.md`
- Slice 15 (NY parsers): `docs/superpowers/plans/2026-05-24-ny-parsers.md`
- Slice 16 (CA + MI + TX parsers): `docs/superpowers/plans/2026-05-24-ca-mi-tx-parsers.md` (parseAddressText hoist pattern)
- Slice 17 (NY FDS + FL parsers): `docs/superpowers/plans/2026-05-25-ny-fds-fl-offices.md` (dual-fetcher discriminator that Task 4 eliminates)
- Gotcha #22 (RNW 0.19 aria-expanded translation gap) — same RNW translation-gap class as M6
- Memory: [[project-chiaro-slice15-ny-parsers]] (Normalized* shape verification), [[project-chiaro-slice16-ca-mi-tx-parsers]] (parseAddressText hoist precedent), [[project-chiaro-slice17-ny-fds-fl-offices]] (dual-fetcher trap), [[project-chiaro-slice14-a11y-batch]] (smart-anchor pattern)
