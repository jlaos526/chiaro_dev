# Slice 18 — Bug-fix + tooling + 5 refactors + M6 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the post-slice-17 audit's full inventory in one substantive slice: 3 audit-identified bug fixes + 3 tooling investments + 5 cross-cutting parser refactors (M1, M3, M4, M5) + M6 a11y smart-anchor propagation.

**Architecture:** 7 tasks sequenced so each commit leaves master green. Task 2 (Gotcha #23) lands BEFORE Task 5 (the refactor it documents). Task 4 (interface widening) lands BEFORE Task 5 (uses the widened interface). Task 6 (UI a11y) is independent and could run in parallel.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler. `cheerio` already installed. `vitest` + jsdom for tests.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-bug-fix-tooling-refactors-design.md` (slice 18 spec)
- `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md` (audit basis)
- Slice 14 AlignmentChip smart-anchor implementation: `packages/officials-ui/src/cards/AlignmentChip.tsx:55-80` (M6 template)
- Slice 16 `_shared.ts`: `packages/db/supabase/seed/state-community/district-offices/_shared.ts` (will extend in Task 5)

**Key findings from file exploration:**

- `StateCommunityAdapter.fetchEvents` returns `Promise<Array<NormalizedTownHall | NormalizedDistrictOffice | NormalizedCommitteeHearing>>`. Generic widening must default to the union for back-compat.
- The page-fetcher signature `(url: string) => Promise<string>` is INTERNAL to per-chamber files (e.g. `mi-legislature/senate.ts:50`), NOT part of the public adapter interface. Task 4 widens the adapter-level fetcher only; the page-fetcher lives inside Task 5's `_shared.ts`.
- `packages/db/tsconfig.json` has `rootDir: "./src"`. Seed tsconfig needs `rootDir: "./"` override to avoid rootDir-violation warnings.

---

## File Structure

### Created files (~5)
```
packages/db/tsconfig.seed.json                              # Task 2
packages/db/supabase/seed/test-utils/stub-fetch.ts          # Task 3
packages/db/supabase/seed/state-community/district-offices/_shared.test.ts   # Task 5 (new helper unit tests)
~/.claude/projects/.../memory/project_chiaro_slice18_bug_fix_tooling_refactors.md  # Task 7 (outside repo)
```

### Modified files (~45)
```
# Task 1: Bug fixes
packages/db/supabase/seed/state-community/district-offices/ny-senate/{assembly,senate}.ts + tests
packages/db/supabase/seed/state-community/district-offices/ca-leginfo/{senate,assembly}.ts + tests
packages/db/supabase/seed/state-community/district-offices/mi-legislature/{senate,house}.ts + tests
packages/db/supabase/seed/state-community/district-offices/fl-doe/{senate,house}.ts + tests
packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts (+ test)

# Task 2: Tooling — tsconfig + Gotcha
packages/db/package.json
CLAUDE.md

# Task 3: Tooling — stubFetchBlocked propagation
~9 adapter test files

# Task 4: Generic StateXxxAdapter<E>
packages/db/supabase/seed/state-community/shared.ts
packages/db/supabase/seed/state-ethics/shared.ts
packages/db/supabase/seed/state-community-ingest.ts
packages/db/supabase/seed/state-ethics-ingest.ts
~13 adapter files (cast removal)

# Task 5: fetchPerMemberOffices helper
packages/db/supabase/seed/state-community/district-offices/_shared.ts (extends)
6 per-chamber parser files (collapse)
3 index.ts files (simplify)

# Task 6: M6 a11y propagation
packages/officials-ui/src/bio/BioContactLinks.tsx
packages/officials-ui/src/cards/OfficialsCard.tsx
packages/officials-ui/src/officials/OfficialsList.tsx
packages/officials-ui/src/finance/TopAmountBreakdown.tsx
apps/web consumer pages (chipHref builders extended)

# Task 7: Closure
CLAUDE.md (slice entry)
```

**Total touched: ~50 files**. Largest slice yet, but task decomposition contains blast radius.

---

## Task 1: Bug fixes (Unicode, MAX_PAGES, .first() selectors)

**Files:**
- Modify: `state-community/district-offices/ny-senate/senate.ts` (deriveSenatorSlug Unicode fix + .first() fix)
- Modify: `state-community/district-offices/ny-senate/assembly.ts` (.first() fix — verify if it uses .first() selector; assembly is single-page directory so may not apply)
- Modify: `state-community/district-offices/mi-legislature/senate.ts` (deriveMiSenatorUrl + .first())
- Modify: `state-community/district-offices/mi-legislature/house.ts` (deriveMiRepUrl + .first())
- Modify: `state-community/district-offices/ca-leginfo/senate.ts` (.first() — verify)
- Modify: `state-community/district-offices/ca-leginfo/assembly.ts` (.first())
- Modify: `state-community/district-offices/fl-doe/senate.ts` (.first())
- Modify: `state-community/district-offices/fl-doe/house.ts` (.first())
- Modify: `state-ethics/disclosures/ny-jcope.ts` (MAX_PAGES_DEFAULT)
- Modify: corresponding `.test.ts` files for test additions

- [ ] **Step 1: Read each derive-helper to confirm current state**

```bash
# Verify the 3 derive helpers' current Unicode-strip patterns:
grep -n "toLowerCase\|normalize\|Diacritic" packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.ts packages/db/supabase/seed/state-community/district-offices/mi-legislature/house.ts
```

Expected: none currently use `.normalize('NFD')`.

- [ ] **Step 2: Apply Unicode-strip fix to 3 derive helpers**

In each of these 3 files, locate the derive helper and insert one line:

**`state-community/district-offices/ny-senate/senate.ts` `deriveSenatorSlug`** (around line 25-30):
```diff
 export function deriveSenatorSlug(full_name: string): string {
   return full_name
     .toLowerCase()
+    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
     .replace(/\s+/g, '-')
     .replace(/[^a-z0-9-]/g, '')
 }
```

**`state-community/district-offices/mi-legislature/senate.ts` `deriveMiSenatorUrl`** (around line 21-27):
```diff
 export function deriveMiSenatorUrl(full_name: string): string {
   const slug = full_name
     .toLowerCase()
+    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
     .replace(/\s+/g, '-')
     .replace(/[^a-z0-9-]/g, '')
   return `https://senate.michigan.gov/senators/${slug}/`
 }
```

**`state-community/district-offices/mi-legislature/house.ts` `deriveMiRepUrl`** (around line 22-28):
```diff
 export function deriveMiRepUrl(full_name: string): string {
   const slug = full_name
     .toLowerCase()
+    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
     .replace(/\s+/g, '-')
     .replace(/[^a-z0-9-]/g, '')
   return `https://house.mi.gov/representative-${slug}`
 }
```

- [ ] **Step 3: Add Unicode test cases**

In each of the 3 `.test.ts` files corresponding to the derive helpers, add a test case to the existing `describe('deriveXxxYyy', ...)` block:

```ts
it('preserves accented characters as ASCII transliterations', () => {
  expect(deriveSenatorSlug('José Smith')).toBe('jose-smith')  // adapt name per helper
})
```

For NY: `deriveSenatorSlug` test in `state-community/district-offices/ny-senate/senate.test.ts`.
For MI Senate: `deriveMiSenatorUrl` test in `state-community/district-offices/mi-legislature/senate.test.ts` — assert URL `'https://senate.michigan.gov/senators/jose-smith/'`.
For MI House: `deriveMiRepUrl` test in `state-community/district-offices/mi-legislature/house.test.ts` — assert URL `'https://house.mi.gov/representative-jose-smith'`.

- [ ] **Step 4: MAX_PAGES_DEFAULT raise**

In `state-ethics/disclosures/ny-jcope.ts`, find `const MAX_PAGES_DEFAULT = 50` (line 8). Replace:

```diff
-const MAX_PAGES_DEFAULT = 50
+const MAX_PAGES_DEFAULT = 120
```

Update JSDoc comment on `fetchAllPages` to note:
```ts
/**
 * ...
 * Default cap = 120 pages (audit-derived sensible bound for 2,804
 * records at ~25/page → ~113 pages for full current cycle, plus
 * ~5% buffer). Operator can override via opts.maxPages.
 */
```

The existing page-cap test in `ny-jcope.test.ts` uses an explicit `maxPages: 3` opt, so no test change needed for the constant raise.

- [ ] **Step 5: `.first()` selector fix — pattern + per-file application**

The fix replaces `$('section.X p').first().text()` with `$('section.X p').each(...)` collecting paragraphs and joining with `, `. This preserves segment boundaries for `parseAddressText`'s comma-split.

**Pattern:**
```ts
// BEFORE (data-loss on multi-<p>):
const lansingText = $('section.lansing-office p').first().text().trim().replace(/\s+/g, ' ')
if (lansingText) out.lansing_office = lansingText

// AFTER (concat all <p> children, join with comma):
const lansingParas: string[] = []
$('section.lansing-office p').each((_, p) => {
  const t = $(p).text().trim().replace(/\s+/g, ' ')
  if (t) lansingParas.push(t)
})
if (lansingParas.length > 0) out.lansing_office = lansingParas.join(', ')
```

Apply to ALL of these section selectors:
- `mi-legislature/senate.ts` lines 39, 42 (`section.lansing-office p` + `section.district-office p`)
- `mi-legislature/house.ts` lines 34, 37 (same sections)
- `ca-leginfo/assembly.ts` lines 35, 38 (`section.capitol-office p` + `section.district-office p`)
- `ca-leginfo/senate.ts` — verify if uses `.first()` (single-page roster; selectors may differ)
- `fl-doe/senate.ts` lines 35, 38
- `fl-doe/house.ts` lines 33, 36
- `ny-senate/senate.ts` — uses `<br>`-aware text extraction from slice 15 Task 4 fix; verify if `.first()` is present anywhere

For each parser, EITHER replace the inline 2-line `.first()` pattern with the 5-line each-loop pattern, OR (cleaner) extract a tiny helper at the top of the file:

```ts
/**
 * Extract all <p> text children of a section, joining with ", ".
 * Replaces `.first()` pattern that silently drops multi-paragraph
 * addresses (audit Bug 3 fix).
 */
function joinParagraphs($: cheerio.CheerioAPI, selector: string): string | undefined {
  const paras: string[] = []
  $(selector).each((_, p) => {
    const t = $(p).text().trim().replace(/\s+/g, ' ')
    if (t) paras.push(t)
  })
  return paras.length > 0 ? paras.join(', ') : undefined
}
```

Inline helper is preferable here — adds 8 lines per file but avoids exporting a helper that should be obsoleted by Task 5's `fetchPerMemberOffices`. Task 5 will absorb this pattern into the shared `parseDetailHtml` callback.

- [ ] **Step 6: Add multi-`<p>` fixture variants + tests**

For each parser updated in Step 5, add ≥1 test case asserting multi-`<p>` extraction works. Pattern:

```ts
it('joins multi-paragraph section addresses with comma (Audit Bug 3 fix)', () => {
  const html = `
    <section class="lansing-office">
      <p>Farnum Building, P.O. Box 30036</p>
      <p>Lansing, MI 48909</p>
      <p>Phone: (517) 373-7350</p>
    </section>
  `
  const parsed = parseMiSenatorProfileHtml(html)
  expect(parsed.lansing_office).toBe('Farnum Building, P.O. Box 30036, Lansing, MI 48909, Phone: (517) 373-7350')
})
```

Adapt the section class name + parser name per file. One test per parser is sufficient (the join pattern is identical across).

- [ ] **Step 7: Run scoped tests + full suite**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices state-ethics/disclosures/ny-jcope
```
Expected: PASS, with ~9 new test cases added (3 Unicode + ~6 multi-`<p>`).

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 631 + ~9 = ~640 tests PASS.

- [ ] **Step 8: Workspace typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-community/district-offices \
        packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts \
        packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.test.ts
git commit -m "$(cat <<'EOF'
fix(seed): audit bug fixes — Unicode-strip, MAX_PAGES, .first() selectors

Three audit-identified bugs that shipped silent data loss against
production sources:

- Unicode-strip: deriveSenatorSlug (slice 15), deriveMiSenatorUrl
  (slice 16), deriveMiRepUrl (slice 16) silently truncated accented
  characters ("José" → "jos"). Added
  .normalize('NFD').replace(/\p{Diacritic}/gu, '') before alphanumeric
  strip. 3 new test cases assert accent transliteration.
- MAX_PAGES_DEFAULT: NY FDS parser had hardcoded 50-page cap; needed
  ~113 pages for 2,804 records at ~25/page. Raised to 120 with
  ~5% buffer.
- .first() selectors across 8 per-chamber parsers (ny-senate/{assembly,
  senate}, ca-leginfo/{senate,assembly}, mi-legislature/{senate,house},
  fl-doe/{senate,house}) silently dropped multi-paragraph addresses.
  Replaced with $('p').each() + join(', '). Per-parser inline helper
  (joinParagraphs); to be absorbed into Task 5's shared
  fetchPerMemberOffices helper. ~6 new test cases assert multi-<p>
  extraction.

No schema work; pgTAP unchanged at 402 plans. Total +9 vitest cases.

Per audit: docs/superpowers/audits/2026-05-25-post-slice-17-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tooling — tsconfig.seed.json + Gotcha #23

**Files:**
- Create: `packages/db/tsconfig.seed.json`
- Modify: `packages/db/package.json` (typecheck script)
- Modify: `CLAUDE.md` (Gotcha #23 append)

- [ ] **Step 1: Create tsconfig.seed.json**

Create `packages/db/tsconfig.seed.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./",
    "noEmit": true
  },
  "include": ["supabase/seed/**/*.ts"]
}
```

Note: `rootDir: "./"` override is critical — the base tsconfig has `rootDir: "./src"` which would cause rootDir-violation warnings for the seed tree. The seed tsconfig points rootDir at the package root so seed/ is in-scope.

- [ ] **Step 2: Update `packages/db/package.json` typecheck script**

```diff
   "scripts": {
-    "typecheck": "tsc --noEmit",
+    "typecheck": "tsc --noEmit && tsc -p tsconfig.seed.json",
```

- [ ] **Step 3: Run typecheck to verify both pass**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: PASS for BOTH tsc invocations. If seed tree has any latent type errors (it shouldn't given existing test coverage), this is where they surface.

- [ ] **Step 4: Append Gotcha #23 to CLAUDE.md**

Find the `## Gotchas` section's Gotcha #22 entry. Append IMMEDIATELY AFTER:

```markdown
23. **Atomic commit required for flat-stub → subfolder migrations.** When migrating a flat-file adapter (e.g. `state-community/district-offices/fl-doe.ts`) to a subfolder pattern (`fl-doe/{index,senate,house}.ts`), the deletion of the flat file + creation of `index.ts` + orchestrator import update MUST land in a single commit. Splitting them across commits leaves master in a broken-import state mid-PR — slice 15 fell into this trap (Tasks 3 + 4) and required a separate fix commit. Slices 16 + 17 explicitly bundled. Slice 18's new `tsconfig.seed.json` closes the `pnpm typecheck` blind spot that previously hid the broken state (the seed tree was outside `packages/db/tsconfig.json`'s `include` path; full `pnpm vitest run` was the only safety net).
```

- [ ] **Step 5: Workspace typecheck + smoke test**

```bash
pnpm --filter @chiaro/db typecheck
pnpm -r typecheck
```
Both should PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/db/tsconfig.seed.json packages/db/package.json CLAUDE.md
git commit -m "$(cat <<'EOF'
build(db): add tsconfig.seed.json + Gotcha #23 (atomic stub→subfolder)

Closes the typecheck blind spot identified in the post-slice-17
audit. `packages/db/tsconfig.json` only includes `src/**/*.ts`,
leaving the ~200-file `supabase/seed/` tree invisible to
`pnpm typecheck`. Slices 15 + 17 both relied on `pnpm vitest run`
to catch broken orchestrator imports — slow safety net.

- packages/db/tsconfig.seed.json: extends base + sets rootDir: "./"
  + include: ["supabase/seed/**/*.ts"] + noEmit: true.
- packages/db/package.json: typecheck script becomes composite
  (`tsc --noEmit && tsc -p tsconfig.seed.json`). Adds ~3-5s but
  catches every broken seed-tree import going forward.
- CLAUDE.md Gotcha #23: documents the atomic-commit pattern for
  flat-stub → subfolder migrations that slices 16 + 17 already
  follow. Slice 15's broken state (Tasks 3 + 4 ordering) is the
  durable lesson.

Per audit: docs/superpowers/audits/2026-05-25-post-slice-17-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tooling — stubFetchBlocked helper + propagation

**Files:**
- Create: `packages/db/supabase/seed/test-utils/stub-fetch.ts`
- Modify: ~9 existing adapter test files

- [ ] **Step 1: Create the helper**

Create `packages/db/supabase/seed/test-utils/stub-fetch.ts`:

```ts
import { vi, type MockInstance } from 'vitest'

/**
 * Stub `globalThis.fetch` to reject all calls during a test. Used
 * by production-path adapter tests where the production code path
 * naturally calls `fetch()` and we want to assert it gracefully
 * degrades to `[]` without making real network calls.
 *
 * Returns the spy so caller can assert on it; caller must
 * `.mockRestore()` in afterEach/finally to avoid leaking the stub
 * across tests.
 *
 * Per slice 18 audit + slice 15 Lesson 12 — formalized after the
 * pattern reached 11 occurrences across 9 files.
 *
 * @example
 *   const fetchSpy = stubFetchBlocked()
 *   const result = await adapter.fetchEvents({ client })
 *   expect(result).toEqual([])
 *   fetchSpy.mockRestore()
 */
export function stubFetchBlocked(): MockInstance {
  return vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
}

/**
 * Block fetch for the duration of `fn`. Auto-restores on completion
 * (success or throw). Use when stub scoping inside one test body
 * is preferred over manual `.mockRestore()`.
 *
 * @example
 *   await withStubbedFetch(async () => {
 *     const result = await adapter.fetchEvents({ client })
 *     expect(result).toEqual([])
 *   })
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

- [ ] **Step 2: Locate every existing fetch-stub site**

```bash
grep -rn "vi.spyOn(globalThis, 'fetch')" packages/db/supabase/seed --include='*.test.ts'
```

Expected ~9-11 matches. The audit cited 9 files; recount.

- [ ] **Step 3: Refactor each site to use the helper**

For each match, replace the verbose pattern with the helper:

```diff
+import { stubFetchBlocked } from '../../test-utils/stub-fetch.ts'
 // ... in test body:
-const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))
+const fetchSpy = stubFetchBlocked()
 // ... assertions ...
 fetchSpy.mockRestore()
```

Adjust the import path depth per file:
- `state-community/district-offices/<subfolder>/index.test.ts` → `'../../../test-utils/stub-fetch.ts'`
- `state-ethics/<subfolder>/shared.test.ts` → `'../../test-utils/stub-fetch.ts'`
- `state-ethics/complaints/xx-yy.test.ts` → `'../../test-utils/stub-fetch.ts'`
- `state-ethics/events/xx-yy.test.ts` → `'../../test-utils/stub-fetch.ts'`
- `state-ethics/disclosures/ny-jcope.test.ts` → `'../../test-utils/stub-fetch.ts'`

Each file gains 1 import line + loses 1 inline-stub line.

- [ ] **Step 4: Run scoped tests + full suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: All ~640 tests PASS (no behavior change; just code consolidation).

- [ ] **Step 5: Workspace typecheck (including seed tree)**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS for both base + seed tsconfig.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/db/supabase/seed/test-utils \
        packages/db/supabase/seed/**/*.test.ts
git commit -m "$(cat <<'EOF'
test(seed): add stubFetchBlocked() helper + propagate across 9 test files

Per audit T2: 11 occurrences of `vi.spyOn(globalThis, 'fetch').
mockRejectedValue(new Error('blocked in test'))` across 9 test files
(slice 15 Lesson 12 pattern). Hoisted to a single helper module.

- packages/db/supabase/seed/test-utils/stub-fetch.ts: stubFetchBlocked()
  returns the spy (caller responsible for .mockRestore()) +
  withStubbedFetch(fn) auto-restores via try/finally.
- 9 test files refactored: 5 lines per file → 1 import + 1 call.
  Net: ~40 lines deleted, 1 file created.

No behavior change in any test (assertions unchanged). Pattern now
documented + reusable for slice 19+ adapter tests.

Per audit: docs/superpowers/audits/2026-05-25-post-slice-17-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: M3 — Generic `StateXxxAdapter<E>` interface widening

**Files:**
- Modify: `state-community/shared.ts` (interface widening)
- Modify: `state-ethics/shared.ts` (interface widening)
- Modify: `state-community-ingest.ts` (orchestrator array type)
- Modify: `state-ethics-ingest.ts` (orchestrator array type)
- Modify: ~13 adapter files (cast removal)

- [ ] **Step 1: Read `state-ethics-ingest.ts` to confirm orchestrator array shape**

```bash
head -40 packages/db/supabase/seed/state-ethics-ingest.ts
```

Look for the `ADAPTERS_DEFAULT` array declaration to match the type widening pattern.

- [ ] **Step 2: Widen `state-community/shared.ts`**

Replace the existing `StateCommunityAdapter` interface (lines 43-53):

```diff
-export interface StateCommunityAdapter {
-  slug: string
-  component: CommunityComponent
-  covered_states: string[]
-  fetchEvents(opts: {
-    client: Client
-    state?: string
-    session?: string
-    fetcher?: () => Promise<unknown[]>
-  }): Promise<Array<NormalizedTownHall | NormalizedDistrictOffice | NormalizedCommitteeHearing>>
-}
+export type StateCommunityEvent =
+  | NormalizedTownHall
+  | NormalizedDistrictOffice
+  | NormalizedCommitteeHearing
+
+export interface StateCommunityAdapter<E extends StateCommunityEvent = StateCommunityEvent> {
+  slug: string
+  component: CommunityComponent
+  covered_states: string[]
+  fetchEvents(opts: {
+    client: Client
+    state?: string
+    session?: string
+    fetcher?: () => Promise<E[]>
+  }): Promise<E[]>
+}
```

- [ ] **Step 3: Widen `state-ethics/shared.ts`**

Same pattern:

```diff
-export interface StateEthicsAdapter {
-  slug: string
-  component: EthicsComponent
-  covered_states: string[]
-  fetchEvents(opts: {
-    client: Client
-    state?: string
-    fetcher?: () => Promise<unknown[]>
-  }): Promise<Array<
-    NormalizedFinancialDisclosure |
-    NormalizedEthicsComplaint | NormalizedOfficialEvent
-  >>
-}
+export type StateEthicsEvent =
+  | NormalizedFinancialDisclosure
+  | NormalizedEthicsComplaint
+  | NormalizedOfficialEvent
+
+export interface StateEthicsAdapter<E extends StateEthicsEvent = StateEthicsEvent> {
+  slug: string
+  component: EthicsComponent
+  covered_states: string[]
+  fetchEvents(opts: {
+    client: Client
+    state?: string
+    fetcher?: () => Promise<E[]>
+  }): Promise<E[]>
+}
```

- [ ] **Step 4: Update orchestrator array types**

`state-community-ingest.ts` line 29:
```diff
-const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
+const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [  // defaults to union via type parameter default
```

(No change needed — the default type parameter handles this.)

Same for `state-ethics-ingest.ts`.

Verify by running typecheck after step 5.

- [ ] **Step 5: Update each adapter file — narrow the generic + remove `as never` casts**

For each adapter file, add the specific event type to the generic + remove the dual-cast pattern.

**Example: `state-community/district-offices/fl-doe/index.ts`**:
```diff
-import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
+import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../../shared.ts'
 // ...
-export const flDoeOffices: StateCommunityAdapter = {
+export const flDoeOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
   slug: 'fl-doe',
   component: 'offices',
   covered_states: ['FL'],
   async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
-    const injected = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
-    if (injected) return injected()
+    if (opts.fetcher) return opts.fetcher()
     // ...
   },
 }
```

Apply this pattern across all ~13 adapter files:
- `state-community/town-halls/ny-senate.ts` — `StateCommunityAdapter<NormalizedTownHall>`
- `state-community/district-offices/ny-senate/index.ts` — `StateCommunityAdapter<NormalizedDistrictOffice>`
- `state-community/district-offices/ca-leginfo/index.ts` — `StateCommunityAdapter<NormalizedDistrictOffice>`
- `state-community/district-offices/mi-legislature/index.ts` — `StateCommunityAdapter<NormalizedDistrictOffice>`
- `state-community/district-offices/fl-doe/index.ts` — `StateCommunityAdapter<NormalizedDistrictOffice>`
- `state-community/town-halls/{ca-leginfo, fl-doe, mi-legislature, tx-capitol}.ts` — TownHall variants
- `state-community/district-offices/tx-capitol.ts` — DistrictOffice variant (still a stub but interface change applies)
- `state-community/committee-hearings/openstates-v3.ts` — `StateCommunityAdapter<NormalizedCommitteeHearing>`
- `state-ethics/complaints/{ca-fppc, fl-coe, mi-board, ny-jcope, tx-tec}.ts` — `StateEthicsAdapter<NormalizedEthicsComplaint>`
- `state-ethics/events/{ca-fppc, fl-coe, mi-board, ny-jcope, tx-tec, ballotpedia-recalls, openstates-end-reason}.ts` — `StateEthicsAdapter<NormalizedOfficialEvent>`
- `state-ethics/disclosures/{ca-fppc, fl-coe, mi-board, ny-jcope, tx-tec}.ts` — `StateEthicsAdapter<NormalizedFinancialDisclosure>`

For each file, the cast removal is:
```diff
-const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedXxx[]> }).fetcher
-if (fetcher) return fetcher()
+if (opts.fetcher) return opts.fetcher()
```

- [ ] **Step 6: Clean up NY FDS dual-fetcher discriminator (slice 17 carryover)**

`state-ethics/disclosures/ny-jcope.ts` (slice 17) has the `hasClient` discriminator workaround for the dual-fetcher confusion. Now that the interface uses typed fetcher signatures, the page-fetcher (URL-string-returning) needs a separate injection mechanism since the adapter-level `fetcher` is for fixture injection.

Option (a) — keep dual fetchers via separate opts keys (recommended; cleaner):
```ts
export const nyJcopeDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  // ...
  async fetchEvents(opts): Promise<NormalizedFinancialDisclosure[]> {
    // Adapter-level fixture injection (returns pre-resolved rows)
    if (opts.fetcher) return opts.fetcher()

    // Page-level fetcher injection (returns HTML for parser tests)
    const pageFetcher = (opts as { pageFetcher?: (url: string) => Promise<string> }).pageFetcher
    const fetcher: (url: string) => Promise<string> = pageFetcher
      ?? (async (url: string) => {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
        return res.text()
      })
    // ... rest of fetchAllPages flow ...
  },
}
```

The `pageFetcher` is an explicit, typed opts key (no `as never`). Tests that need to inject HTML pass `pageFetcher`; tests that need to short-circuit production pass `fetcher`.

Update ny-jcope.test.ts tests that previously used the `client` heuristic to use `pageFetcher` explicitly.

- [ ] **Step 7: Run full @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ALL ~640 tests PASS. Interface widening is purely type-level; runtime behavior unchanged. NY FDS tests pass with the new `pageFetcher` opts key.

- [ ] **Step 8: Workspace typecheck (including seed tree via Task 2's tsconfig.seed.json)**

```bash
pnpm --filter @chiaro/db typecheck
pnpm -r typecheck
```
Both expected: PASS. The new `tsconfig.seed.json` ensures the seed tree is included.

- [ ] **Step 9: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-community/shared.ts \
        packages/db/supabase/seed/state-ethics/shared.ts \
        packages/db/supabase/seed/state-community-ingest.ts \
        packages/db/supabase/seed/state-ethics-ingest.ts \
        packages/db/supabase/seed/state-community \
        packages/db/supabase/seed/state-ethics
git commit -m "$(cat <<'EOF'
refactor(seed): generic StateXxxAdapter<E> — eliminate 36 `as never` casts

Per audit M3: `StateCommunityAdapter` + `StateEthicsAdapter` both
typed `fetcher` as `() => Promise<unknown[]>`; every adapter then
`(opts as never as { fetcher?: () => Promise<NormalizedXxx[]> })`
cast to recover type. 36 instances workspace-wide; slice 17
confirmed type safety silently lost when 2 cast targets refer to
the same value.

- state-community/shared.ts + state-ethics/shared.ts: interface now
  generic on event type. Default type parameter preserves back-compat
  with the union; concrete adapters narrow via `StateCommunityAdapter
  <NormalizedDistrictOffice>` etc.
- ~13 adapter files: type-narrowed + `as never` casts removed. Inline
  `opts.fetcher` is now typed correctly per-adapter.
- ny-jcope disclosures dual-fetcher: slice 17's `hasClient` heuristic
  replaced by explicit `pageFetcher?` opts key for page-level
  injection (distinct from the typed `fetcher?` adapter-level
  injection). Test cases updated.
- Orchestrator arrays unchanged (default-typed StateCommunityAdapter[]
  still resolves to the union upper bound).

No runtime behavior change. All ~640 tests pass; typecheck passes
both base + seed tsconfig (Task 2).

Per audit: docs/superpowers/audits/2026-05-25-post-slice-17-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: M1 + M4 + M5 — `fetchPerMemberOffices` helper

**Files:**
- Modify: `state-community/district-offices/_shared.ts` (extend with constants + helper)
- Create: `state-community/district-offices/_shared.test.ts` (unit tests for helper)
- Modify: 6 per-chamber parser files (collapse)
- Modify: 3 index.ts files (simplified)
- Modify: corresponding `.test.ts` files (adjust to helper-driven behavior)

- [ ] **Step 1: Extend `_shared.ts` with constants + helper**

Append to `state-community/district-offices/_shared.ts` (keep existing `parseAddressText`):

```ts
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../shared.ts'

export const FETCH_TIMEOUT_MS = 5000
export const RATE_LIMIT_MS = 1000

export interface ParsedMemberDetail {
  capitol_office?: string
  district_office?: string
}

export interface PerMemberOfficesOpts {
  chamber: 'state_house' | 'state_senate'
  state: string
  /**
   * Build the per-member detail-page URL from the legislator row.
   * Return null to skip this legislator (e.g. missing district_id,
   * malformed name, no derivable URL).
   */
  deriveUrl: (legislator: {
    full_name: string
    district_id: string | null
    openstates_person_id: string
  }) => string | null
  /**
   * Parse a single detail page into capitol + district address blocks.
   * Implementations should use the multi-paragraph join pattern
   * (audit Bug 3 fix) — `.first()` selectors silently drop data.
   */
  parseDetailHtml: (html: string) => ParsedMemberDetail
  /**
   * Optional page fetcher for test injection. Production path uses
   * native fetch + 1-req/sec throttle (skipped when fetcher injected).
   */
  fetcher?: (url: string) => Promise<string>
}

/**
 * Generic per-member offices fetch loop. Shared by all 6 per-chamber
 * parsers (slice 16 ca-leginfo + mi-legislature, slice 17 fl-doe,
 * slice 15 ny-senate detail-page side).
 *
 * Queries `officials` for the (chamber, state) cohort, derives each
 * legislator's profile URL via the caller-supplied deriveUrl callback,
 * fetches with 1-req/sec courtesy throttle (skipped when opts.fetcher
 * is injected), parses via the caller-supplied parseDetailHtml, and
 * emits NormalizedDistrictOffice rows via emitOfficeRow.
 *
 * Throttle skipped after the last iteration (audit M5 fix).
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

    // Audit M5: skip throttle after last iteration (saves ~1s/run)
    if (!opts.fetcher && i < totalRows - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}

/**
 * Build a NormalizedDistrictOffice row from a raw address string via
 * parseAddressText. Returns null if the address can't be parsed
 * (missing street_1, city, or state).
 */
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

- [ ] **Step 2: Write `_shared.test.ts` for the new helper**

Create `packages/db/supabase/seed/state-community/district-offices/_shared.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  parseAddressText,
  fetchPerMemberOffices,
  emitOfficeRow,
  type ParsedMemberDetail,
} from './_shared.ts'

describe('parseAddressText', () => {
  // Existing slice 15 + 16 behavior covered indirectly via per-parser tests;
  // direct test cases here lock the contract.
  it('parses standard "Street, City, State Zip · Phone: ..." format', () => {
    const result = parseAddressText('123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234')
    expect(result).toEqual({
      street_1: '123 Main Street',
      city: 'Buffalo',
      state: 'NY',
      postal_code: '14201',
      phone: '(716) 555-1234',
    })
  })

  it('returns null when state-zip segment is malformed', () => {
    expect(parseAddressText('123 Main, Buffalo, malformed')).toBeNull()
  })
})

describe('emitOfficeRow', () => {
  it('returns row when address parses', () => {
    const row = emitOfficeRow('123 Main Street, Buffalo, NY 14201', {
      openstates_person_id: 'ocd-person/test',
      kind: 'capitol',
      source_url: 'https://example.com/profile',
    })
    expect(row).toMatchObject({
      official_openstates_person_id: 'ocd-person/test',
      kind: 'capitol',
      street_1: '123 Main Street',
      city: 'Buffalo',
      state: 'NY',
      postal_code: '14201',
    })
  })

  it('returns null when address parsing fails', () => {
    expect(emitOfficeRow('garbage no commas', {
      openstates_person_id: 'ocd-person/test',
      kind: 'capitol',
      source_url: 'https://example.com',
    })).toBeNull()
  })
})

describe('fetchPerMemberOffices', () => {
  const fixture: ParsedMemberDetail = {
    capitol_office: '100 Capitol St, Lansing, MI 48909',
    district_office: '200 Local Ave, Detroit, MI 48201',
  }

  it('queries officials with the supplied chamber + state', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: () => 'https://example.com',
      parseDetailHtml: () => ({}),
      fetcher: async () => '',
    })
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('chamber = $1'),
      ['state_senate', 'MI'],
    )
  })

  it('emits 2 rows per resolved legislator with both addresses', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith', district_id: 'MI-8' },
        ],
        rowCount: 2,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    // 2 legislators × 2 offices = 4 rows
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.kind === 'capitol').length).toBe(2)
    expect(rows.filter(r => r.kind === 'district').length).toBe(2)
  })

  it('skips legislators when deriveUrl returns null', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: null },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith', district_id: 'MI-8' },
        ],
        rowCount: 2,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => l.district_id ? `https://example.com/${l.full_name}` : null,
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    expect(rows).toHaveLength(2)  // Only Alex resolves
  })

  it('silently skips legislators on fetcher failure', async () => {
    let n = 0
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { openstates_person_id: 'ocd-1', full_name: 'Jane Doe', district_id: 'MI-7' },
          { openstates_person_id: 'ocd-2', full_name: 'Alex Smith', district_id: 'MI-8' },
        ],
        rowCount: 2,
      }),
    }
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => fixture,
      fetcher: async () => {
        n += 1
        if (n === 1) throw new Error('TLS handshake failed')
        return 'html'
      },
    })
    expect(rows).toHaveLength(2)  // First errors, second succeeds
  })

  it('skips throttle when fetcher injected (test mode)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: Array.from({ length: 5 }, (_, i) => ({
          openstates_person_id: `ocd-${i}`,
          full_name: `Name ${i}`,
          district_id: `MI-${i}`,
        })),
        rowCount: 5,
      }),
    }
    const start = Date.now()
    const rows = await fetchPerMemberOffices(client as never, {
      chamber: 'state_senate',
      state: 'MI',
      deriveUrl: (l) => `https://example.com/${l.full_name}`,
      parseDetailHtml: () => fixture,
      fetcher: async () => 'html',
    })
    const elapsed = Date.now() - start
    expect(rows).toHaveLength(10)  // 5 × 2 = 10
    expect(elapsed).toBeLessThan(500)  // No throttle delays
  })
})
```

- [ ] **Step 3: Run helper unit tests to verify FAIL → PASS**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/_shared
```
Expected: ~12 tests PASS.

- [ ] **Step 4: Collapse each per-chamber parser**

**Pattern (example for `mi-legislature/senate.ts`):**

```ts
import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { fetchPerMemberOffices, type ParsedMemberDetail } from '../_shared.ts'

export type ParsedMiSenatorProfile = ParsedMemberDetail

export function deriveMiSenatorUrl(full_name: string): string {
  const slug = full_name
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `https://senate.michigan.gov/senators/${slug}/`
}

export function parseMiSenatorProfileHtml(html: string): ParsedMiSenatorProfile {
  const $ = cheerio.load(html)
  const out: ParsedMiSenatorProfile = {}

  // Audit Bug 3 fix: join multi-paragraph addresses with ", " for parseAddressText
  const lansingParas: string[] = []
  $('section.lansing-office p').each((_, p) => {
    const t = $(p).text().trim().replace(/\s+/g, ' ')
    if (t) lansingParas.push(t)
  })
  if (lansingParas.length > 0) out.capitol_office = lansingParas.join(', ')

  const districtParas: string[] = []
  $('section.district-office p').each((_, p) => {
    const t = $(p).text().trim().replace(/\s+/g, ' ')
    if (t) districtParas.push(t)
  })
  if (districtParas.length > 0) out.district_office = districtParas.join(', ')

  return out
}

export async function fetchMiSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_senate',
    state: 'MI',
    deriveUrl: (l) => deriveMiSenatorUrl(l.full_name),
    parseDetailHtml: parseMiSenatorProfileHtml,
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
  })
}
```

(Lines: ~40, down from ~110. The `ParsedMemberDetail` type is shared so `ParsedMiSenatorProfile` becomes a type alias.)

Apply this collapse to:
- `state-community/district-offices/ca-leginfo/senate.ts` (single-page roster — DIFFERENT structure; may not fit fetchPerMemberOffices verbatim. v1: keep CA Senate's single-page parser separate; only collapse the per-member parsers.)
- `state-community/district-offices/ca-leginfo/assembly.ts` (per-AM loop fits)
- `state-community/district-offices/mi-legislature/senate.ts` (above)
- `state-community/district-offices/mi-legislature/house.ts`
- `state-community/district-offices/fl-doe/senate.ts`
- `state-community/district-offices/fl-doe/house.ts`
- `state-community/district-offices/ny-senate/senate.ts` (verify pattern fits — slice 15 senate uses per-senator loop with `<br>`-aware text extraction; the `<br>`-aware part needs to STAY in `parseNySenatorContactHtml`)

**Decision per parser:**

- **CA Senate** (`senate.ca.gov/senators` single-page roster): NOT a fit for `fetchPerMemberOffices` (single fetch, all 40 senators on one page). Leave structurally unchanged; apply Task 1 + Task 4 changes only (Unicode + .first() + cast removal).
- **CA Assembly** (per-AM loop): collapse via `fetchPerMemberOffices`.
- **MI Senate + House**: collapse.
- **FL Senate + House**: collapse.
- **NY Senate detail-page side** (`ny-senate/senate.ts`): collapse, but `parseDetailHtml` must preserve slice 15's `<br>`-aware extraction. The `parseNySenatorContactHtml` function stays; only the fetch loop simplifies.

**5 per-chamber parsers collapse** (CA Assembly + MI Senate + MI House + FL Senate + FL House + NY Senate = 6). Per-parser line count: ~110 → ~40 each. Total: ~480 → ~240 = ~240 lines removed.

- [ ] **Step 5: Verify each parser's existing tests still pass**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices
```
Expected: ALL existing per-parser tests PASS. The collapse preserves the parser's public contract (`deriveUrl`, `parseDetailHtml`, `fetchXxxOffices`); behavior is identical.

Some tests may need minor adjustments if they relied on the per-parser fetch loop internals (e.g. throttle timing assertions). Adjust as needed.

- [ ] **Step 6: Update index.ts files (no functional change; just verify they still work)**

The 3 `index.ts` files (`ca-leginfo`, `mi-legislature`, `fl-doe`) use `Promise.all([fetchSenate, fetchHouse])`. Their structure stays. The only change is the imports may shift if a per-chamber file moved exports.

Verify no breakage.

- [ ] **Step 7: Run FULL @chiaro/db test suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: All ~640 + ~12 new helper tests = ~652 tests PASS.

- [ ] **Step 8: Workspace typecheck (composite)**

```bash
pnpm --filter @chiaro/db typecheck
pnpm -r typecheck
```
Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add packages/db/supabase/seed/state-community/district-offices/_shared.ts \
        packages/db/supabase/seed/state-community/district-offices/_shared.test.ts \
        packages/db/supabase/seed/state-community/district-offices
git commit -m "$(cat <<'EOF'
refactor(seed): fetchPerMemberOffices helper — collapse 6 parsers ~240 lines

Per audit M1 + M4 + M5: 6 per-chamber parsers were ~95% duplicate
(SQL chamber filter + URL pattern + section name differences). Hoisted
the common fetch-loop + address-emit boilerplate to district-offices/
_shared.ts.

- _shared.ts gains: FETCH_TIMEOUT_MS + RATE_LIMIT_MS constants (audit
  M4), fetchPerMemberOffices generic helper, emitOfficeRow helper,
  ParsedMemberDetail interface.
- fetchPerMemberOffices guards throttle against the last iteration
  (audit M5 fix; saves ~1s per orchestrator run).
- 6 per-chamber parsers collapsed: ny-senate/senate.ts (kept slice 15
  <br>-aware parseNySenatorContactHtml), ca-leginfo/assembly.ts,
  mi-legislature/{senate,house}.ts, fl-doe/{senate,house}.ts.
  Per-parser line count: ~110 → ~40. Total: ~240 lines removed.
- CA Senate (single-page roster) NOT collapsed (different structure;
  doesn't fit per-member loop pattern).
- _shared.test.ts: ~12 new vitest cases lock the helper contract
  before parsers consume it.

No behavior change in any production parser (existing tests pass
unchanged); the helper preserves each parser's public contract.

Per audit: docs/superpowers/audits/2026-05-25-post-slice-17-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: M6 — Smart-anchor propagation across 7 UI sites

**Files:**
- Modify: `packages/officials-ui/src/bio/BioContactLinks.tsx`
- Modify: `packages/officials-ui/src/cards/OfficialsCard.tsx`
- Modify: `packages/officials-ui/src/officials/OfficialsList.tsx`
- Modify: `packages/officials-ui/src/finance/TopAmountBreakdown.tsx`
- Modify: corresponding test files
- Modify: `apps/web` consumer pages (extend chipHref-style callback prop)

- [ ] **Step 1: Read AlignmentChip for the canonical pattern**

```bash
sed -n '55,95p' packages/officials-ui/src/cards/AlignmentChip.tsx
```

This is the template (slice 14, already shipped). Reuse the `createElement('a', ...)` + modifier-key guard + `e.preventDefault() + onPress()` structure.

- [ ] **Step 2: Locate all `accessibilityRole="link"` sites**

```bash
grep -rn 'accessibilityRole="link"\|accessibilityRole={`link`}' packages/officials-ui/src
```

Expected ~7-8 matches across 4 files. Cross-reference with the audit's listing.

- [ ] **Step 3: Apply the smart-anchor pattern to each site**

**Pattern (per site):**

```ts
import { createElement } from 'react'
import { Platform, Pressable } from 'react-native'

export interface XxxProps {
  // ... existing props ...
  href?: string  // NEW: pass href to render real <a> on web
  onPress?: () => void  // EXISTING
}

// Inside render:
const innerContent = /* same JSX as before, but as a function or variable */

// Web smart-anchor case: real <a href> with intercepted plain left-click.
if (Platform.OS === 'web' && href) {
  return createElement(
    'a',
    {
      href,
      onClick: (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
        if (onPress) {
          e.preventDefault()
          onPress()
        }
      },
      style: {
        textDecoration: 'none',
        cursor: 'pointer',
        display: 'inline-block',
      },
    },
    innerContent,
  )
}

// Native or web-without-href: use Pressable with accessibilityRole="link"
return (
  <Pressable
    onPress={onPress}
    accessibilityRole="link"
    /* ... existing props ... */
  >
    {innerContent}
  </Pressable>
)
```

Apply to:
1. **`BioContactLinks.tsx:23`** — phone link
2. **`BioContactLinks.tsx:30`** — email link
3. **`OfficialsList.tsx:36`** — officials row link
4. **`OfficialsList.tsx:60`** — alternate officials row link
5. **`OfficialsCard.tsx:132`** — main card click target
6. **`OfficialsCard.tsx:175`** — secondary card link
7. **`TopAmountBreakdown.tsx:127`** — donor/PAC link

For each site, the `href` prop comes from the parent via callback (e.g. `getHref(item) => string`). This matches slice 14's `chipHref` pattern.

- [ ] **Step 4: Update consumer pages to pass href callbacks**

`apps/web/app/officials/page.tsx` (or wherever OfficialsList renders): add `getHref={(official) => /officials/${official.id}}`.
`apps/web/app/officials/[id]/page.tsx`: add hrefs for BioContactLinks (tel: + mailto: scheme).

(Native apps in `apps/mobile` do NOT pass href; Pressable path kicks in.)

- [ ] **Step 5: Add smart-anchor tests per site**

Pattern (mirrors AlignmentChip smart-anchor test):

```ts
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { XxxComponent } from './XxxComponent.tsx'

describe('XxxComponent smart-anchor', () => {
  it('renders as <a href> on web when href provided', () => {
    const { container } = render(<XxxComponent href="/target" onPress={() => {}} />)
    const anchor = container.querySelector('a')
    expect(anchor).toBeTruthy()
    expect(anchor?.getAttribute('href')).toBe('/target')
  })

  it('intercepts plain left-click + calls onPress', () => {
    const onPress = vi.fn()
    const { container } = render(<XxxComponent href="/target" onPress={onPress} />)
    const anchor = container.querySelector('a')!
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const dispatched = anchor.dispatchEvent(evt)
    expect(onPress).toHaveBeenCalled()
    expect(dispatched).toBe(false)  // preventDefault'd
  })

  it('falls through on modifier-key click (browser default)', () => {
    const onPress = vi.fn()
    const { container } = render(<XxxComponent href="/target" onPress={onPress} />)
    const anchor = container.querySelector('a')!
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    const dispatched = anchor.dispatchEvent(evt)
    expect(onPress).not.toHaveBeenCalled()
    expect(dispatched).toBe(true)  // NOT prevented
  })
})
```

~3 tests per site × 7 sites = ~21 new vitest cases. Realistically can share test patterns by extracting a test helper in `packages/officials-ui/test/utils/smart-anchor.ts`.

- [ ] **Step 6: Run officials-ui test suite**

```bash
pnpm --filter @chiaro/officials-ui exec vitest run
```
Expected: ALL existing 233 tests + ~21 new = ~254 PASS.

- [ ] **Step 7: Workspace typecheck**

```bash
pnpm -r typecheck
```
Expected: PASS (officials-ui + web + mobile all see the new optional `href` prop).

- [ ] **Step 8: Web build smoke test**

```bash
pnpm --filter @chiaro/web build
```
Expected: 12 routes green.

- [ ] **Step 9: Commit Task 6**

```bash
git add packages/officials-ui/src apps/web/app
git commit -m "$(cat <<'EOF'
feat(officials-ui): M6 smart-anchor propagation across 7 link sites

Per audit M6: 8 `accessibilityRole="link"` sites in officials-ui
rendered as <div role="link"> on RNW 0.19 — screen readers
announced them but middle-click / prefetch / status-bar URL all
silently failed. Slice 14 fixed AlignmentChip via the smart-anchor
pattern; this slice propagates that fix to the other sites.

Pattern (from slice 14 AlignmentChip): on web with href present,
render real <a href> via createElement + intercept plain left-click
with e.preventDefault() + onPress(); modifier-key clicks fall
through to browser default.

Sites covered (7):
- BioContactLinks.tsx (phone + email = 2 sites)
- OfficialsList.tsx (officials row links = 2 sites)
- OfficialsCard.tsx (main + secondary = 2 sites)
- TopAmountBreakdown.tsx (donor/PAC link = 1 site)

Each gains an optional `href?` prop alongside existing `onPress?`.
Consumer pages (`apps/web/app/officials/...`) extended with href
builders following slice 14's `chipHref` pattern. Native apps
(`apps/mobile`) ignore href and keep the existing Pressable path.

~21 new vitest cases (3 per site × 7 sites) verify smart-anchor
behavior. Reuses slice 14 test patterns.

Per audit: docs/superpowers/audits/2026-05-25-post-slice-17-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Closure — CLAUDE.md slice 18 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 18 entry)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice18_bug_fix_tooling_refactors.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Append slice 18 entry to CLAUDE.md**

After the slice 17 entry in `## Slices delivered`, append:

```markdown
- **Slice 18 — Bug-fix + tooling + 5 refactors + M6 a11y** (2026-05-25): Consolidated the post-slice-17 audit's full inventory before PDF-parsing infra ships. (1) **3 bug fixes**: Unicode-strip in deriveSenatorSlug/deriveMiSenatorUrl/deriveMiRepUrl (silently dropped accented chars); MAX_PAGES_DEFAULT 50 → 120 (NY FDS under-budgeting); `.first()` selector fragility across 8 per-chamber parsers replaced with `$('p').each() + join(', ')`. (2) **3 tooling investments**: `packages/db/tsconfig.seed.json` closes typecheck blind spot (seed tree was outside base tsconfig's include path); `seed/test-utils/stub-fetch.ts` `stubFetchBlocked()` + `withStubbedFetch()` helpers consolidate 11 inline fetch-stub occurrences across 9 test files; **Gotcha #23** documents the atomic-commit pattern for flat-stub → subfolder migrations (slice 15's broken-state trap). (3) **5 refactors**: M1 = `fetchPerMemberOffices` + `emitOfficeRow` helpers in `district-offices/_shared.ts` collapse 6 per-chamber parsers from ~110 to ~40 lines each (~240 lines removed); M3 = `StateXxxAdapter<E>` generic interface widening eliminates 36 unsafe `as never` casts; M4 = `FETCH_TIMEOUT_MS` + `RATE_LIMIT_MS` constants hoisted to `_shared.ts`; M5 = throttle-after-last-iteration guard saves ~1s/run; M6 = smart-anchor pattern propagated from slice 14 AlignmentChip to 7 other `accessibilityRole="link"` sites (BioContactLinks ×2, OfficialsList ×2, OfficialsCard ×2, TopAmountBreakdown ×1). NY FDS slice 17 dual-fetcher discriminator cleaned up (typed `pageFetcher?` opts key replaces the `hasClient` heuristic). ~50 files touched. No schema work; pgTAP unchanged at 402 plans. Test count: 631 → ~660 (+~30 new across bug-fix Unicode/multi-`<p>` + helper unit tests + smart-anchor tests).
```

- [ ] **Step 2: Write memory file**

Use Write tool to create `~/.claude/projects/.../memory/project_chiaro_slice18_bug_fix_tooling_refactors.md`:

```markdown
---
name: project-chiaro-slice18-bug-fix-tooling-refactors
description: Slice 18 — audit-derived bug fixes + tooling investments + parser refactors + M6 a11y
metadata:
  type: project
---

Slice 18 shipped 2026-05-25 — merged locally to master as squash `<squash SHA>`. Feature branch `slice-18-bug-fix-tooling-refactors` deleted post-merge.

**Scope:** Consolidate the post-slice-17 audit inventory before more parsers ship. 3 bug fixes + 3 tooling investments + 5 cross-cutting refactors + 1 a11y propagation (M6). Largest slice yet (~50 files). PDF-parsing infrastructure deferred to slice 19 — benefits from this slice's tooling + helpers landing first.

**What shipped:**
- 3 bug fixes: Unicode-strip preservation (`.normalize('NFD').replace(/\p{Diacritic}/gu, '')`), `MAX_PAGES_DEFAULT 50 → 120`, multi-paragraph address join replacing `.first()` selectors.
- 3 tooling: `tsconfig.seed.json`, `stubFetchBlocked()` helper, Gotcha #23.
- 5 refactors: `fetchPerMemberOffices` helper, generic `StateXxxAdapter<E>`, hoisted constants, throttle-guard, smart-anchor propagation.
- ~30 new vitest cases.

**Durable lessons:**

1. **`.first()` selector → `$('p').each() + join(', ')` is the canonical multi-paragraph extraction pattern.** Fixture-only test coverage misses real-world multi-`<p>` layouts. Always test with a multi-paragraph variant when adding new section-based parsers.

2. **`.normalize('NFD').replace(/\p{Diacritic}/gu, '')` is the standard accent fold.** Apply BEFORE any alphanumeric strip in URL slug derivation. Cheap (2 chained method calls); silently fixes ~5% of real legislator names.

3. **`tsconfig.seed.json` closes the seed-tree typecheck blind spot.** `packages/db/tsconfig.json` only includes `src/**/*.ts`. The new composite typecheck script catches every broken seed import going forward (slice 15 + 17 needed full vitest runs to catch these previously). Cost: +3-5s on every typecheck.

4. **Generic `StateXxxAdapter<E>` eliminates `as never` casts structurally.** With `interface StateCommunityAdapter<E extends StateCommunityEvent = StateCommunityEvent>`, default type parameter preserves orchestrator-array back-compat while concrete adapters narrow via `StateCommunityAdapter<NormalizedDistrictOffice>`. Pattern: any cross-cutting interface that's been forced to use `unknown[]` for type-erasure reasons is a candidate for generic widening.

5. **`fetchPerMemberOffices` helper template for per-member loops.** All future state-legislator district_offices parsers should follow this template: define `deriveUrl(legislator) => string | null` + `parseDetailHtml(html) => ParsedMemberDetail` + call `fetchPerMemberOffices(client, opts)`. ~30-line per-state file replaces ~110-line copy-paste.

6. **Throttle-after-last-iteration is a bug, not stylistic.** Saves ~1s per orchestrator run × 6 parsers × N runs. Always guard with `i < totalRows - 1`.

7. **`stubFetchBlocked()` is the canonical production-path fetch leak protection.** 9 test files already use it; future adapter tests should import from `seed/test-utils/stub-fetch.ts` instead of inlining the pattern.

8. **Smart-anchor pattern (slice 14) propagates via `href?: string` prop + chipHref-style callback.** Native ignores `href`; web with href renders real `<a>` + intercepts clicks. Apply to every `accessibilityRole="link"` site to restore middle-click / prefetch / status-bar URL.

9. **Slice 17 dual-fetcher `hasClient` heuristic is obsolete after Task 4.** Generic interface restores typed `fetcher?: () => Promise<E[]>` (adapter-level fixture injection); page-level injection uses explicit `pageFetcher?` opts key. No more discriminator runtime hacks.

10. **Atomic commit for flat-stub → subfolder migration is a Gotcha (#23).** Codified after slices 15 (fell into trap) + 16 + 17 (avoided via bundling). Slice 18 documents the durable pattern. Future migrations: deletion + index.ts + orchestrator import update MUST land in ONE commit.

**Active follow-ups (operator):**
- Slice 19: PDF-parsing infrastructure + MI PFD (the original substantive-slice candidate; deferred to land after slice 18's tooling).
- LCV-OR + PP × 5 browser-UA probe spike (slice 11 carryover).
- Mobile DoD on-device smoke.
- Production-run instrumentation pass to convert 5 "blocked by production" follow-ups into actionable data.
- `<section>` landmark restoration on BioHeader (slice 14 deferred).
- `accessibilityValue` / `accessibilityHint` / non-standard `accessibilityRole` RNW 0.19 audit (slice 14 follow-up).
- `mapStatus` shared lexicon helper deferred until 3rd ethics adapter (rule-of-three).

**Master state at slice 18 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans across 31 files (unchanged). 15 production parsers total (unchanged from slice 17). @chiaro/db test count: ~660 (631 + ~30 new). officials-ui test count: ~254 (233 + ~21 smart-anchor). Audit deferred candidates: 4 → 2 (PDF-bound NY FDS line-items + CA FPPC Form 700 remain; both await slice 19 PDF infra).

**Cross-links:** [[project-chiaro-slice14-a11y-batch]] (AlignmentChip smart-anchor pattern), [[project-chiaro-slice15-ny-parsers]] (Normalized* shape verification, Lesson 11 tsconfig gap, Lesson 12 fetch stubbing), [[project-chiaro-slice16-ca-mi-tx-parsers]] (parseAddressText hoist precedent, MI House TLS-flake), [[project-chiaro-slice17-ny-fds-fl-offices]] (dual-fetcher discriminator trap, placeholder-row pattern). Audit: `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`.
```

- [ ] **Step 3: Update MEMORY.md index**

Read `MEMORY.md`. Add IMMEDIATELY AFTER the slice 17 line:

```markdown
- [Chiaro slice 18 bug-fix + tooling + refactors](project_chiaro_slice18_bug_fix_tooling_refactors.md) — audit-derived 3 bug fixes (Unicode-strip, MAX_PAGES, .first() selectors) + 3 tooling investments (tsconfig.seed.json, stubFetchBlocked, Gotcha #23) + 5 refactors (fetchPerMemberOffices helper -240 lines, generic StateXxxAdapter<E> -36 casts, constants hoist, throttle-guard, M6 smart-anchor across 7 UI sites)
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm --filter @chiaro/web build
```

Expected: All green.
- `pnpm -r typecheck` — 11 packages green (+ Task 2's `tsconfig.seed.json` covers seed tree)
- `pnpm --filter @chiaro/db exec vitest run` — ~660 tests pass
- `pnpm --filter @chiaro/officials-ui exec vitest run` — ~254 tests pass
- `pnpm --filter @chiaro/web build` — 12 routes green

- [ ] **Step 5: Commit Task 7**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 18 closure — CLAUDE.md entry

Slice 18 ships 3 bug fixes + 3 tooling investments + 5 refactors +
M6 a11y propagation. Consolidated audit inventory before PDF-parsing
infra ships (slice 19).

No new Gotcha beyond #23 added in Task 2.

@chiaro/db test count: +~30 (631 → ~660).
officials-ui test count: +~21 (233 → ~254).
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
pnpm -r typecheck                                                   # 11 packages green
pnpm --filter @chiaro/db typecheck                                  # base + seed tsconfig
pnpm --filter @chiaro/db exec vitest run                            # ~660 tests green
pnpm --filter @chiaro/officials-ui exec vitest run                  # ~254 tests green
pnpm --filter @chiaro/web build                                     # 12 routes
git log master..HEAD --oneline                                      # 9 commits (spec + plan + 7 tasks)
```

---

## Self-review notes

### Spec coverage

- ✅ Bug 1 (Unicode-strip) — Task 1 Steps 2-3
- ✅ Bug 2 (MAX_PAGES) — Task 1 Step 4
- ✅ Bug 3 (.first() selectors) — Task 1 Steps 5-6
- ✅ T1 (tsconfig.seed.json) — Task 2 Steps 1-3
- ✅ T2 (stubFetchBlocked) — Task 3
- ✅ T4 (Gotcha #23) — Task 2 Step 4
- ✅ M1 (fetchPerMemberOffices) — Task 5
- ✅ M3 (generic StateXxxAdapter<E>) — Task 4
- ✅ M4 (hoist constants) — Task 5 Step 1 (inside _shared.ts)
- ✅ M5 (throttle guard) — Task 5 Step 1 (inside fetchPerMemberOffices)
- ✅ M6 (smart-anchor propagation) — Task 6
- ✅ Closure docs + memory — Task 7

### Placeholder scan

No "TBD", "TODO", "Similar to Task N" without code. Each task contains full file content or precise diff blocks. URL patterns audit-derived flagged with port-time verification.

### Type consistency

- `StateCommunityAdapter<E>` + `StateEthicsAdapter<E>` generic interfaces consistent across Task 4 widening.
- `fetchPerMemberOffices` signature consistent with all 5-6 callers (CA Assembly + MI Senate/House + FL Senate/House + NY Senate).
- `ParsedMemberDetail` interface unifies what was per-parser `ParsedXxxProfile` types.
- `pageFetcher?: (url: string) => Promise<string>` (Task 4 NY FDS cleanup) is distinct from `fetcher?: () => Promise<E[]>` (adapter-level fixture).
- `parseAddressText` signature unchanged from slice 16.

### Known incomplete details

- CA Senate parser is NOT collapsed into `fetchPerMemberOffices` (single-page roster has different structure). Acceptable — only the per-member loop variants collapse. CA Senate gets Task 1 + Task 4 changes only.
- NY town_halls parser is NOT a district_offices loop — doesn't fit `fetchPerMemberOffices`. Task 4 (interface widening) applies; Task 5 (helper hoist) doesn't.
- Memory `<squash SHA>` placeholder filled post-merge per slice 14-17 precedent.
- Task 6 site count: audit said 8, planning says 7. Implementer verifies via grep during Task 6 Step 2.
- Some per-parser tests in Task 5 may need adjustment if they relied on the per-parser fetch loop internals. Adjust as needed; behavior contracts preserved.
