# Slice 23 — Complete instrumentation framework design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** Slice 22 instrumentation framework (`createSkipCollector` + `SkipReason` + `--instrument` CLI flag). Wires remaining production adapters that slice 22 deliberately left unwired (single-page rosters + town_halls + state-ethics events + scorecards) + migrates TX TEC `errors[]` to the unified onSkip channel.

## Goal

Complete the instrumentation coverage so an operator's `--instrument` run produces a uniform skip summary across ALL production adapters, not just the per-chamber + PDF-aware subset slice 22 wired. This unblocks 3 slice 22 follow-ups in one slice:

1. Single-page roster parsers instrumentation (CA Senate + NY Assembly)
2. Town halls + state-ethics events + scorecards adapter instrumentation
3. TX TEC `errors[]` array migration to unified onSkip channel

After this slice: the only remaining unwired adapters are slice 5H/5I stubs that `return []` (no silent-skip sites to instrument) and slice 11/21 deprecated stubs (same reason).

## Non-goals

- **No new production parsers.** Pure instrumentation work.
- **No real production run.** Operator schedules + executes separately (carried over from slice 22).
- **No DB schema changes.** Skip telemetry remains ephemeral per-run.
- **No new workspace deps.** Pure TypeScript + slice 22's `createSkipCollector` helper.
- **No instrumentation for deprecated/stub adapters.** ACLU, AFP, Planned Parenthood, CA FPPC, slice 5H/5I per-state stubs — all return `[]` unconditionally; nothing to skip.
- **No retry-on-failure logic.** Skip telemetry observes; doesn't auto-remediate.

## Architecture

### Files in scope (~22 modified + 1 new)

```
Task 1: Single-page roster parsers ─────────────────────────────────────────
  state-community/district-offices/ca-leginfo/senate.ts                  MODIFY
  state-community/district-offices/ca-leginfo/senate.test.ts             MODIFY
  state-community/district-offices/ny-senate/assembly.ts                 MODIFY
  state-community/district-offices/ny-senate/assembly.test.ts            MODIFY

Task 2: Town halls + state-ethics events ───────────────────────────────────
  state-community/town-halls/ny-senate.ts                                MODIFY
  state-community/town-halls/ny-senate.test.ts                           MODIFY
  state-community/town-halls/mobilize.ts                                 MODIFY
  state-community/town-halls/mobilize.test.ts                            MODIFY (if exists; see spec note)
  state-community/town-halls/townhallproject.ts                          MODIFY
  state-community/town-halls/townhallproject.test.ts                     MODIFY (if exists)
  state-ethics/events/ballotpedia-recalls.ts                             MODIFY
  state-ethics/events/ballotpedia-recalls.test.ts                        MODIFY
  state-ethics/events/openstates-end-reason.ts                           MODIFY
  state-ethics/events/openstates-end-reason.test.ts                      MODIFY

Task 3: Scorecards ─────────────────────────────────────────────────────────
  state-scorecards/shared.ts (or wherever StateScorecardAdapter lives)   MODIFY (interface widen)
  state-scorecards/lcv/{mi,co,...}.ts                                    MODIFY (LCV-MI + LCV-CO production parsers)
  state-scorecards/nra.ts                                                MODIFY (NRA slice 9)
  Tests for above                                                        MODIFY

Task 4: TX TEC errors[] → onSkip migration ─────────────────────────────────
  state-ethics/tx-tec/shared.ts                                          MODIFY (remove errors[] dual-write)
  state-ethics/tx-tec/shared.test.ts                                     MODIFY (remove dual-write assertions; keep onSkip ones)
  state-ethics-ingest.ts                                                 MODIFY (orchestrator reads stats.skipSummary instead of per-adapter errors[])

Task 5: Closure ────────────────────────────────────────────────────────────
  CLAUDE.md                                                              slice 23 entry
  memory file + MEMORY.md                                                (outside repo)
```

## Components

### Task 1: Single-page roster parsers (CA Senate + NY Assembly)

Slice 22 deliberately left these unwired because they don't use `fetchPerMemberOffices` (different loop pattern — parse roster cards from one HTML page, then iterate per-card).

**`ca-leginfo/senate.ts`** silent-skip sites:
- Fetch failure: wraps `(await fetch(SOURCE_URL, {...})).text()` in try/catch. Currently returns `[]` on failure. → emit `stage: 'fetch'` skip.
- Per-card resolve: `resolveOpenstatesPersonId` returns null → skip card. → emit `stage: 'resolve'` skip with legislator name.
- Per-card parseAddressText: returns null → skip emit (both capitol + district independently). → emit `stage: 'parse'` skip.

**`ny-senate/assembly.ts`** silent-skip sites:
- Fetch failure (same pattern).
- Per-card district number parse: regex fails → skip card. → emit `stage: 'parse'` skip with reason 'district number unparseable'.
- Per-card parseAddressText: returns null → skip emit.

Add ~3 new tests per file (~6 total) asserting onSkip fires correctly.

### Task 2: Town halls + state-ethics events

**`state-community/town-halls/ny-senate.ts`** (slice 15):
- Fetch failure (HTML scrape of nysenate.gov/events).
- Per-card resolve null → skip.
- Per-card chamber-inference fail → skip (filter stage).

**`state-community/town-halls/mobilize.ts`** (slice 7/8):
- Mobilize API fetch failure.
- Per-event resolve null → skip (legislator name regex doesn't match officials).
- State-tier classification fail (federal vs state title regex) → filter stage.

**`state-community/town-halls/townhallproject.ts`** (slice 7, deprecated):
- Already shipping `return []` per deprecation per slice 7. Wire `onSkip` for completeness; emits 0 calls in practice.

**`state-ethics/events/ballotpedia-recalls.ts`** (slice 9):
- HTML fetch failure.
- Per-row name parse fail → filter/parse stage.
- Per-row resolve null → skip.

**`state-ethics/events/openstates-end-reason.ts`** (slice 7):
- YAML parse failure → fetch stage (treating YAML as text-extraction).
- Per-entry resolve null → skip.
- end_reason regex doesn't match resignation/death patterns → filter stage.

Each adapter: ~3 new tests covering its instrumented stages. ~15 new tests total for Task 2.

### Task 3: Scorecards

**Interface widening check:** Read `packages/db/supabase/seed/state-scorecards/` to find the canonical adapter type. If `StateScorecardAdapter` exists (slice 5G or 11), widen its opts to include `onSkip?` (same pattern as slice 22 Task 1). If scorecards use ad-hoc function signatures (no canonical adapter interface), document the variance + add `onSkip?` to each adapter's local opts type.

**`state-scorecards/lcv/mi.ts` + `co.ts`** (slice 11 LCV production parsers):
- HTML fetch failure (cheerio scrape of league.lcv.org legislator scorecard pages).
- Per-row resolve null → skip.
- Per-row score parse fail (regex on letter grade or numeric) → parse stage.

**`state-scorecards/nra.ts`** (slice 9):
- HTML fetch failure (Cloudflare gate potential — already handled with browser UA per Gotcha #18).
- Per-row resolve null → skip.
- Per-row letter-grade parse fail (A+ through F mapping) → parse stage.

~9 new tests total.

### Task 4: TX TEC `errors[]` → onSkip migration

Slice 22 Task 3 added DUAL-WRITE pattern to TX TEC: existing `errors.push(unresolved: X)` PLUS new `onSkip` for resolve failures. Slice 23 Task 4 removes the dual-write.

**`state-ethics/tx-tec/shared.ts`** changes:
- Remove `errors.push(\`unresolved: ${row.respondent} (${chamber})\`)` line for unresolved-legislator case.
- `errors[]` array stays in the return type (back-compat for `fetch failed` initial entry); just no longer populated by per-row resolve failures.

**`state-ethics-ingest.ts`** orchestrator changes:
- Currently `StateEthicsStats.errors[]` is populated by adapter throw catches at orchestrator level (general error handling, NOT skip-reason). Verify slice 22 didn't change this.
- The change here is **adapter-internal cleanup only** — orchestrator already reads `stats.skipSummary` (slice 22) for unresolved counts. Adapter-level `errors[]` was a slice 16 pre-slice-22 mechanism; slice 22 made it redundant.
- Verify CLI summary output preserves equivalent information via skipSummary.

**Tests:** Remove or update slice 22 Task 3's TX TEC test case that asserts dual-write. Replace with single-channel assertion (onSkip-only).

### Task 5: Closure

Standard slice closure (slice 14-22 precedent):
- CLAUDE.md slice 23 entry
- Memory file with squash SHA placeholder + durable lessons
- MEMORY.md index update
- Workspace verify gate

## Data flow

No change from slice 22. Adapters call `opts.onSkip?.()` at each silent-skip site; orchestrator's `--instrument` mode collects + summarizes.

## Error handling

Same silent-skip pattern as slice 22. Each instrumented site keeps its existing try/catch + continue; the only addition is the `opts.onSkip?.()` call before continuing.

## Testing strategy

- ~30 new vitest cases (3 per adapter × ~10 instrumented adapters)
- Each test asserts: skip fires with correct adapter slug + stage + legislator + reason
- Back-compat verified by existing tests passing unchanged (opt-in onSkip)
- TX TEC migration: existing dual-write test deleted; replaced with single-channel onSkip-only test

Expected total @chiaro/db: 749 → ~779.

## Verify gate

- `pnpm -r typecheck` → 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` → ~779 tests green
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans

## Risk + tradeoffs

1. **Scorecards interface variance.** `StateScorecardAdapter` may not exist; Task 3 starts by reading actual code + adapting pattern. Defensive scope estimate.

2. **TX TEC errors[] removal is breaking-change-adjacent.** Anyone reading `stats.byAdapter[i].errors` for the unresolved-legislator case must migrate to `stats.skipSummary.byAdapter.get('tx-tec').byStage.get('resolve')`. Slice 22 already shipped the parallel channel; this slice consolidates. Existing CLI output (line 130 of state-ethics-ingest.ts) summarizes errors[] for any cause — should preserve via skipSummary lookups.

3. **Town halls + scorecards + events adapters are LOW-STAKES** vs the high-stakes per-chamber/PDF parsers slice 22 covered. Production drift here matters less; instrumentation is more about uniformity than diagnostic value.

4. **`townhallproject.ts` is deprecated** (slice 7 deprecation post-Mobilize). Wiring onSkip is symbolic — it returns `[]` in practice and emits 0 skips. Cost: ~3 minutes; benefit: pattern uniformity.

5. **`mobilize.ts` regex-based federal/state classifier** has a "filter" stage that's distinct from chamber inference. Tests need to cover both the filter stage (event doesn't match state-tier title regex) and resolve stage (state-tier title matches but no legislator found).

6. **OpenStates `end_reason` YAML parser** failure modes differ from HTML scrape — YAML parse can succeed but return junk. Test fixtures need a few examples of malformed YAML and legitimate-but-unmatched end_reason patterns.

## Schema verification needed during planning

No schema changes. `SkipReason` shape (slice 22) accommodates all new stage labels (derive_url / fetch / extract / parse / resolve / filter).

## Cross-references

- Slice 22 (`docs/superpowers/specs/2026-05-25-production-instrumentation-design.md`) — framework foundation
- Slice 18 audit (5 "blocked by production" follow-ups; slice 22 + 23 close them collectively)
- Slice 11 (LCV scorecards production parsers) + slice 9 (NRA production parser) — scorecards being instrumented here
- Slice 7 (Mobilize + townhallproject + openstates-end-reason) + slice 9 (Ballotpedia recalls) — events + town halls being instrumented here
- Memory: [[project-chiaro-slice22-instrumentation]] (framework + dual-write pattern this slice consolidates)
