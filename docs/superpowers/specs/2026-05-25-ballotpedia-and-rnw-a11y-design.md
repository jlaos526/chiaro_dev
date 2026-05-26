# Slice 24 — Ballotpedia migration + RNW 0.19 a11y audit design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Slice 23 (instrumentation completion; TX TEC errors[] migration precedent) + slice 14 (a11y batch + Gotcha #22 RNW translation gap) + slice 22 (`skipSummary` parallel channel).

## Goal

Close 2 follow-ups carried forward from slices 14 + 23:

1. **Ballotpedia `errors[]` → onSkip migration** — Mirror of slice 23 Task 4 TX TEC pattern. Slice 23 Task 2 left Ballotpedia dual-writing `errors.push` + `onSkip` at 4 parse/resolve sites; this slice consolidates to single channel.

2. **RNW 0.19 a11y gap audit** — Discovery pass on `accessibilityValue` / `accessibilityHint` / non-standard `accessibilityRole` usage in `@chiaro/officials-ui`. Catalogs which RN a11y props RNW 0.19 silently drops or partially translates. Applies fix patches where bugs are found; documents gaps where they aren't worth fixing.

## Non-goals

- **No real production-run instrumentation.** Slice 22 framework + slice 23 coverage stand; operator schedules + executes separately.
- **No new parsers, no new adapters.**
- **No DB schema changes.**
- **No new workspace deps.**
- **No headless-browser a11y testing.** Audit uses static code analysis + reading `react-native-web/dist/modules/createDOMProps` source.
- **No scope growth mid-flight.** If RNW audit surfaces 5+ distinct bug-fix patches, fixes defer to slice 25 — slice 24 ships the audit doc with prioritized recommendations.

## Architecture

### Files in scope

```
Task 1: Ballotpedia migration ────────────────────────────────────────
  state-ethics/events/ballotpedia-recalls.ts                          MODIFY
  state-ethics/events/ballotpedia-recalls.test.ts                     MODIFY

Task 2: RNW 0.19 a11y gap audit ──────────────────────────────────────
  docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md            NEW
  packages/officials-ui/src/**/*.tsx                                  MODIFY (0-5 files; depends on findings)
  packages/officials-ui/test/**/*.test.tsx                            MODIFY (0-5 files; matches src)

Task 3: Closure ──────────────────────────────────────────────────────
  CLAUDE.md                                                            slice 24 entry
  memory file + MEMORY.md index                                        (outside repo)
```

### File count estimate

- **Minimum (0 a11y bugs):** ~4 files
- **Maximum (3-5 a11y bug fixes):** ~14 files

Compressed-Slice → Full-Slice tier depending on Task 2 findings.

## Components

### Task 1: Ballotpedia `errors[]` → onSkip migration

**File:** `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts`

Per slice 23 Task 2 implementer note, Ballotpedia has 4 dual-write sites where both `errors.push(...)` and `opts.onSkip?.(...)` fire. The exact lines need scaffold-time verification, but the spec assumes:
- HTML fetch failure (Cloudflare gate)
- Per-row name parse fail
- Per-row resolve null
- (Possibly) per-row index page parse fail

For each dual-write site:
- REMOVE the `errors.push(...)` line
- KEEP the `opts.onSkip?.(...)` call

The `errors[]` array stays in the return type (back-compat for any remaining producer — likely the initial fetch-failed case, though Ballotpedia may have already converted that channel too; scaffold verifies).

**File:** `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts`

For each test that asserts on `errors[]`:
- REMOVE the `errors[]` assertion
- KEEP the onSkip assertion (slice 23 Task 2 added these in parallel)
- RENAME the test if its name referenced "dual-write" → reflect single-channel

External consumer check: `state-ethics-ingest.ts` orchestrator + `state-ethics/events/index.ts` adapter wrapper. Per slice 23 Task 4 precedent, wrappers typically destructure `{ events }` discarding `errors` — but verify.

### Task 2: RNW 0.19 a11y gap audit

**Audit doc:** `docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md`

Pattern mirrors slice 18 audit (post-slice-17 bugs+refactors+follow-ups) + slice 21 CA FPPC re-audit:
1. Method: static code analysis via grep
2. Findings table per category (3 categories)
3. RNW 0.19 translation behavior empirically verified (read `node_modules/react-native-web/dist/modules/createDOMProps/index.js`)
4. Severity rubric: blocking (silent data loss / screen-reader noise) / important (UX degradation) / nit (cosmetic)
5. Recommendations: in-slice fix vs. defer

**Categories to audit:**

1. **`accessibilityValue={{ ... }}` usage** — RN convention `{ min, max, now, text }`. RNW 0.19 expected translation: `aria-valuemin` / `aria-valuemax` / `aria-valuenow` / `aria-valuetext`. Audit: grep `accessibilityValue` in `packages/officials-ui/src/`; cross-reference with createDOMProps source to confirm translation.

2. **`accessibilityHint="..."` usage** — RN convention: hint text describing the result of activating an element. RNW 0.19 expected translation: `aria-describedby` (pointing to an inserted hint element) OR `aria-details`. May actually translate to nothing / silently drop. Audit: grep; confirm behavior.

3. **Non-standard `accessibilityRole` values** — RN supports many roles RNW 0.19 may not fully translate. Standard roles like "button", "link", "header", "text" work. Non-standard candidates: "summary", "image", "img", "search", "timer", "alert", "checkbox", "radio", "switch", "tab", "tablist", "tabpanel", "togglebutton", "spinbutton", "menubar", "menu", "menuitem", "scrollbar", "toolbar", "progressbar". Audit: grep `accessibilityRole=` to enumerate values used; cross-reference with createDOMProps role table.

**For each gap found, recommend:**
- **Blocking** fixes: apply in-slice (analogous to slice 14 `aria-expanded` + slice 18 `accessibilityRole="link"` smart-anchor)
- **Important** fixes: apply in-slice if quick (~1 file per fix)
- **Nit** + **deferred** fixes: cataloged in audit doc for future slice

If audit surfaces > 5 distinct bug-fix patches: defer fixes to slice 25; slice 24 ships audit doc + 0-5 in-slice fixes only.

### Task 3: Closure

Standard slice closure (slice 14-23 precedent):
- CLAUDE.md slice 24 entry
- Memory file with squash SHA placeholder + durable lessons
- MEMORY.md index line
- Workspace verify gate

## Data flow

No runtime change in Task 1 (Ballotpedia internal cleanup). Task 2 may add small DOM-attribute changes per component fix.

## Error handling

N/A — no new code paths.

## Testing strategy

- Ballotpedia tests updated in-place (rename + assertion change)
- For any RNW fix patch: add direct DOM-attribute assertion test (mirror of slice 14 `aria-expanded` test pattern from Gotcha #22)

Expected test count delta: +0 (Ballotpedia rename) to +5-10 (RNW fixes if any). Total: 784 → 784-794.

## Verify gate

- `pnpm -r typecheck` → 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` → 784 tests (unchanged from Ballotpedia migration)
- `pnpm --filter @chiaro/officials-ui exec vitest run` → 256 + N (where N = new a11y tests if any)
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans

## Risk + tradeoffs

1. **Ballotpedia dual-write site count assumed = 4.** Implementer verifies via grep at scaffold time. If count differs, adapt.

2. **RNW 0.19 createDOMProps source inspection** is the source of truth for translation behavior. Documentation is sparse; actual library code reveals which RN props get translated to ARIA attributes. Audit cites file paths + line numbers for reproducibility.

3. **Mid-flight scope growth** mitigated by escape hatch: if 5+ fixes needed, ship audit doc + defer fixes to slice 25. Avoids slice 24 becoming a full-Slice that wasn't planned.

4. **A11y testing without screen-reader.** jsdom + testing-library can assert DOM attributes (e.g. `expect(el.getAttribute('aria-valuenow')).toBe('5')`), but can't simulate actual screen-reader announcement. Slice 14 Gotcha #22 established the "assert ARIA attribute directly" pattern; slice 24 reuses.

5. **No external consumer migration risk for Ballotpedia.** Pattern parallels slice 23 Task 4 TX TEC: wrappers + orchestrator already discard `errors[]` for the unresolved case (slice 22 `skipSummary` is the canonical channel).

6. **Compressed-Slice tier with escape hatch.** Spec scopes as 3 tasks; plan may collapse to fewer if Task 2 surfaces no bugs.

## Schema verification needed during planning

None. `SkipReason` shape (slice 22) accommodates all existing Ballotpedia onSkip calls. RNW fixes are component-level only.

## Cross-references

- Slice 14 (a11y batch + Gotcha #22 RNW `accessibilityState` → `aria-expanded` translation gap)
- Slice 18 audit (`docs/superpowers/audits/2026-05-25-post-slice-17-audit.md`) — RNW 0.19 audit listed as follow-up (M6 successor)
- Slice 22 (instrumentation framework + skipSummary parallel channel)
- Slice 23 Task 4 (TX TEC errors[] migration precedent this slice mirrors)
- Slice 23 Task 2 implementer note ("Ballotpedia preserved `errors[]` return contract... Migration of `errors[]` to onSkip-only could be a follow-up")
- Memory: [[project-chiaro-slice14-a11y-batch]] (Gotcha #22 origin), [[project-chiaro-slice23-instrumentation-completion]] (TX TEC migration precedent)
