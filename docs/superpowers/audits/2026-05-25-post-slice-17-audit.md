# Post-Slice-17 Audit — Bugs, Refactors, and Follow-ups

**Date:** 2026-05-25
**Scope:** Slices 14-17 (a11y batch → NY parsers → CA/MI/TX parsers → NY FDS + FL parsers). 13 production parsers shipped. Audit-only inventory; no code changes in this branch.
**Method:** 4 parallel research agents (review-feedback / cross-cutting parser patterns / open follow-ups / schema-orchestrator-tooling). Findings deduped + ranked.

## TL;DR

- **3 real bugs in shipped code** ship silent data loss against production sources. Bug-fix mini-slice recommended for slice 18.
- **5 high-leverage refactors** would collapse 480+ lines of duplicated parser code and eliminate 36 unsafe `as never` casts. Best-positioned BEFORE more parsers ship.
- **PDF-parsing infrastructure** has accumulated 3 slice memory mentions; strongest cross-cutting candidate for an upcoming substantive slice.
- **5 deferred follow-ups blocked by production runs** — convertible to actionable data via a single instrumentation pass.

## High-severity findings (real bugs in shipped code)

### 1. `deriveMiSenatorUrl` / `deriveMiRepUrl` Unicode-strip silently truncates accented chars

**Source:** Slice 16. Files: `packages/db/supabase/seed/state-community/district-offices/mi-legislature/senate.ts:21-27` + `house.ts:22-28`.

The slug derivation `replace(/[^a-z0-9-]/g, '')` drops accented chars wholesale: `"José Smith"` → `"jos-smith"`. MI has at least one such legislator. The slug-mismatched URL silently 404s; production parser drops that legislator with no surface.

**Fix (2-3 lines):** Add `.normalize('NFD').replace(/\p{Diacritic}/gu, '')` before the alphanumeric strip. Same pattern applies retroactively to slice 15's `deriveSenatorSlug` (`ny-senate/senate.ts:25-30`).

### 2. `MAX_PAGES_DEFAULT = 50` under-budgets NY FDS

**Source:** Slice 17. File: `packages/db/supabase/seed/state-ethics/disclosures/ny-jcope.ts:8`.

Audit cited 2,804 records at ~25/page = ~113 pages for full current cycle. Cap of 50 stops at ~1,250 records — silently ingests <45% of available filings. Production operators must override `opts.maxPages` or accept under-ingest.

**Fix (1 line):** Raise default to 120. Add a comment explaining the audit-derived budget.

### 3. `.first()` selector silently drops multi-`<p>` data across 8 parsers

**Source:** Slices 15-17. Files: `ca-leginfo/assembly.ts:35-39`, `mi-legislature/senate.ts:39-43`, `mi-legislature/house.ts:34-38`, `fl-doe/senate.ts:35-39`, `fl-doe/house.ts:33-37`. Plus slice 15 NY senate pattern.

Every per-member parser uses `$('section.capitol-office p').first().text()`. If real source pages split addresses across multiple `<p>` siblings (e.g. street / city-state-zip / phone on separate `<p>` tags, or multiple branch offices), only the first is captured. Fixtures all have single-`<p>`-per-section, so tests don't surface the gap.

**Fix (per parser, ~3-4 lines):** Switch to block-level `.text()` on the section (concatenates all children) OR iterate `$('p').each(...)` and join with `, ` for parseAddressText. Cross-cutting fix — touches 8 files.

## Medium-severity refactors (highest ROI for slice 18+)

### M1. `fetchPerMemberOffices` helper — collapses 6 parsers ~480 lines

**Source:** Audit task 2 cross-cutting scan.

`ny-senate/{assembly,senate}.ts`, `ca-leginfo/{senate,assembly}.ts`, `mi-legislature/{senate,house}.ts`, `fl-doe/{senate,house}.ts` are ~95% identical: query officials by `(chamber, state)` → loop with optional `district_id` parsing → derive URL → fetch with timeout → parse two address sections → emit two `NormalizedDistrictOffice` rows. Adding `fetchPerMemberOffices(client, { chamber, state, deriveUrl, parseDetailHtml, capitolKey, districtKey })` to `district-offices/_shared.ts` would collapse each ~110-line file to ~30 lines.

**Impact:** Cuts slice 18+ per-state-offices scaffold time ~70%. Highest-impact refactor.

### M2. Fix `.first()` selector fragility before slice 18 ships more parsers

See bug #3 above. Cross-cutting fix BEFORE more parsers land is cheaper than 8 patches later.

### M3. Widen `StateXxxAdapter.fetcher` to discriminated/generic — eliminates 36 `as never` casts

**Source:** Audit task 4. Files: `state-community/shared.ts:43-53`, `state-ethics/shared.ts:44-56`. 36 grep hits for `as never as { fetcher`.

`StateCommunityAdapter` + `StateEthicsAdapter` both type `fetcher?` as `() => Promise<unknown[]>`. Every adapter `(opts as never as { fetcher?: () => Promise<NormalizedXxx[]> }).fetcher`s to recover type. Slice 17 confirmed this loses type safety silently when adapter wants two fetcher signatures.

**Fix:** Make adapters generic on event type: `interface StateCommunityAdapter<E = ...>` with `fetcher?: () => Promise<E[]>`. Eliminates the casts structurally.

### M4. Hoist `FETCH_TIMEOUT_MS = 5000` + `RATE_LIMIT_MS = 1000` to `_shared.ts`

**Source:** Audit task 2. 11+ duplicate definitions across slice 15-17 parser files.

`_shared.ts` already exists (slice 16 hoist). Trivial extension. Reduces drift risk if timeout/throttle ever needs adjustment.

### M5. Throttle-after-last-iteration guard

**Source:** Audit task 2. Files: 6 parser fetch loops.

Every per-member fetcher sleeps 1s after the final iteration (wasted). Guard with `if (i < res.rows.length - 1 && !opts.fetcher)`.

**Impact:** ~6s wasted per orchestrator run × N future runs. Minor but free with the M1 refactor.

### M6. `accessibilityRole="link"` smart-anchor non-propagation (slice 14 carryover)

**Source:** Audit task 1. Files: `BioContactLinks.tsx:23/30`, `OfficialsList.tsx:36/60`, `OfficialsCard.tsx:132/175`, `TopAmountBreakdown.tsx:127` — 8 `accessibilityRole="link"` sites.

Slice 14 fixed AlignmentChip via the smart-anchor pattern (real `<a href>` + intercepted click for SPA nav). 8 other `Pressable + accessibilityRole="link"` sites render as `<div role="link">` — screen readers announce them, but middle-click / prefetch / status-bar URL all silently fail. Same RNW translation-gap class as Gotcha #22.

**Fix:** Apply slice 14 smart-anchor pattern to the other 8 sites. ~half-day if propagated through `chipHref` callback chain pattern.

## Low-severity cosmetics

### L1. `senate.ts` + `house.ts` JSDoc duplication
After M1 refactor lands, JSDoc lives once in the shared helper.

### L2. `Pick<Client, 'query'>` asymmetry
`resolveOpenstatesPersonId` uses Pick; `resolveOfficialByName` uses full Client. Block test stubbing via minimal mock for the latter. 1-line fix, defer.

### L3. `deriveSlug` variants
3 inconsistent name-to-slug helpers across slice 15-17 parsers. Same regex shape. Hoist to `_shared.ts` as `nameToUrlSlug(full_name)`. Couples to M1.

### L4. Address-emit boilerplate duplication
12-line `{ official_openstates_person_id, kind, street_1, city, state, ...postal_code, ...phone, source_url }` block repeats 16 times. Couples to M1.

### L5. `mapStatus` duplication (NY COELIG vs TX TEC)
Same structure, different lexicons. Wait for 3rd caller (rule-of-three) before hoisting.

### L6. `isStateLegislatorRow` vs `isTexasLegislatorRow` naming
Convention drift. Trivial.

### L7. `nextPageHref` destructured-but-unused in ny-jcope.test.ts:18
Cosmetic.

## Tooling investments (high leverage for slice 18+)

### T1. `tsconfig.seed.json` — closes typecheck blind spot

**Source:** Audit task 4 #1. Slices 15+17 both relied on `pnpm vitest run` to catch broken orchestrator imports because `packages/db/tsconfig.json:8` only `include`s `src/**/*.ts`, blind to the ~200-file `supabase/seed/` tree.

**Fix:** Add `tsconfig.seed.json` extending base with `include: ["supabase/seed/**/*.ts"], noEmit: true`; wire `"typecheck:seed": "tsc -p tsconfig.seed.json"` into the package's `typecheck` script (composite via `&&`). ~3 lines + one new file.

### T2. Shared `stubFetchBlocked()` test helper

**Source:** Audit task 4 #5. 11 occurrences across 9 test files.

Pattern: `const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in test'))` + `fetchSpy.mockRestore()`. Extract to `packages/db/supabase/seed/test-utils/stub-fetch.ts` exporting `stubFetchBlocked()` (returns spy) + `withStubbedFetch(async () => ...)` (auto-restore wrapper). 5 lines per file → 1 import.

### T3. Generic `StateCommunityAdapter<E>` (see M3)

### T4. Gotcha #23 — flat-stub → subfolder pattern requires atomic commit

**Source:** Audit task 4 #6. Slice 15 fell into the mid-slice broken-state trap; slices 16+17 explicitly bundled.

**Fix:** 4-line addition to CLAUDE.md `## Gotchas`: "When converting a flat-file stub → subfolder pattern, the deletion + new index.ts + orchestrator-import-update MUST land in a single commit. Splitting them leaves master in a broken-import state mid-PR." Codifies the durable lesson.

### T5. Auto-fill `<squash SHA>` placeholder in memory files

**Source:** Audit task 4 #8.

`finishing-a-development-branch` skill could grep most-recent memory file for `<squash SHA>` and substitute the freshly-merged SHA. Reduces manual step. Touches Anthropic's skill repo, not the user's project — defer or upstream as a skill enhancement.

## Cross-cutting follow-ups

### Cross-cutting (appear in 2+ slice memories)

- **PDF-parsing slice** (slices 15, 16, 17 memories): NY FDS line-items + MI PFD + CA FPPC Form 700 + TX TEC per-case orders all blocked. Recurs 3x. **Top slice 18 candidate.**
- **LCV-OR + PP × 5 browser-UA probe spike** (slices 14, 15, 16, 17 memories): Slice 11 carryover. ~1-hour spike.
- **Mobile DoD on-device smoke** (slices 14, 15, 16, 17 memories): Slice 2.5 carryover. Blocked on EAS APK (Android) + Apple Developer credentials (iOS).
- **Combined-parser memoization** (slices 15, 16, 17): Cross-adapter caching of COELIG + TX TEC fetches. Marked "defer until measured impact" — still no measured impact.

### Blocked by production runs (convertible via single instrumentation pass)

- **MI House TLS-flake measurement** (slices 16+17): Need real ingest pass-rate before deciding on retry helper.
- **FL House MemberId-as-district verification** (slice 17): Threshold: >5% silent skips → add index-page mapping.
- **NY FDS pagination selector verification** (slice 17): Confirm `nav.pagination a.next-page` still works.
- **Per-senator slug-derivation drift monitoring** (slices 15+16): NY senate + CA Assembly + MI Senate/House.
- **NY FDS year-filter coupling brittleness** (slice 17): If `?year=` param changes name, parser fails silently.

### Stale (mentioned once, not progressed)

- **`party_unity_state` stub** (slice 5F): Real majority-of-same-party-peers computation deferred.
- **NH multi-word district codes** (slice 5C): State legislators with codes like "Rockingham 5" still unmatched. May be acceptable as known limitation.
- **`<section>` landmark on BioHeader via createElement escape hatch** (slice 14): Deferred unless concrete a11y need surfaces.

### Active (could be slice 18-20)

- **Slice 18 PDF-parsing infrastructure**: Strongly nominated; unlocks 4 downstream parsers.
- **`accessibilityValue` / `accessibilityHint` / non-standard `accessibilityRole` RNW 0.19 translation gap audit** (slice 14 follow-up): ~half-day audit; prevents future Gotcha #22-class silent gaps.

## Recommended slice 18+ priorities

Top 3 actionable items, ranked by leverage:

### Priority 1 — Slice 18 (the substantive parser slice)
**PDF-parsing infrastructure + MI PFD.** Cross-cutting (3 slice mentions). Adds `pdf-parse` workspace dep + shared `extractPdfText` helper + first concrete user (MI PFD). Unlocks NY FDS line-items (slice 19) + CA FPPC + TX TEC per-case orders. Highest cross-cutting payoff.

### Priority 2 — Slice 18.5 (bug-fix + tooling mini-slice; can run before or after slice 18)
**Bug-fix sweep + 2 tooling investments**, bundled because each is small:
- **Bug-fix sweep** (3 bugs): Unicode-strip in deriveMiXxxUrl (~2 lines), MAX_PAGES_DEFAULT raise (~1 line), `.first()` selector audit across 8 parsers (~3-4 lines each).
- **T1**: `tsconfig.seed.json` (~5 lines + 1 file). Single highest-leverage tooling fix.
- **T2**: Shared `stubFetchBlocked()` helper (~10 lines + 1 file; refactors 9 test files).
- **T4**: Gotcha #23 in CLAUDE.md (~4 lines).

Total: ~10 files; lockup ~1 day. Pays back across every future parser slice.

### Priority 3 — Slice 19 (parser-refactor slice; defer if slice 18 lands without friction)
**M1 + M3 + M4 + M5 bundled refactor:**
- M1: `fetchPerMemberOffices` helper hoist (-480 lines, ~6 parsers collapsed)
- M3: Generic `StateXxxAdapter<E>` (-36 `as never` casts)
- M4: Hoist `FETCH_TIMEOUT_MS` / `RATE_LIMIT_MS` to `_shared.ts`
- M5: Throttle-after-last-iteration guard

Done before more parsers ship, this refactor pays off in slice 20+ scaffolding speed. Total: ~10-15 files modified, ~30 files affected by `as never` removal. Lockup ~1-2 days.

### Lower-priority backlog (run any time, low risk)
- **LCV-OR + PP × 5 browser-UA probe spike** (cross-cutting, ~1h)
- **`accessibilityRole="link"` smart-anchor propagation** (M6, ~half-day)
- **RNW 0.19 a11y gap audit** (~half-day, prevents future Gotcha #22-class issues)
- **Mobile DoD on-device smoke** (blocked on EAS APK / Apple credentials — operator follow-up)
- **Production-run instrumentation pass** (resolves 5 "blocked by production" items in one shot — schedule when an operator can run a real ingest)

## Cross-references

- Slice 12 audit: `docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md` (audit-first methodology precedent)
- Slice 11 audit: `docs/superpowers/audits/2026-05-23-scorecard-discovery.md` (per-source URL verification → Gotcha #20)
- CLAUDE.md `## Gotchas` (current count: 22; this audit recommends adding #23)
- Memory files for slices 14, 15, 16, 17 in `~/.claude/projects/.../memory/`
