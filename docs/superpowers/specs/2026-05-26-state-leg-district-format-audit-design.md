# Slice 27 — State-leg district format audit design

**Status:** approved 2026-05-26 (verbal — brainstorming flow)
**Tier:** Audit-only (~3 files)
**Builds on:** Slice 2 (TIGER ingest origin), slice 5C (state-officials identity + `state-leg-config.ts` introduction + Gotcha #8 NH limitation).

## Goal

Verify whether the format mismatch between `tiger-config.ts` and `state-leg-config.ts` is a real production bug or whether some mechanism reconciles them. Document findings + impact assessment + recommended fix shape for slice 28.

**Background:**
- `packages/db/supabase/seed/tiger-config.ts:53,71` writes state legislative district codes as `${state}-SS-${num}` (senate) and `${state}-SH-${num}` (house).
- `packages/db/supabase/seed/state-leg-config.ts:73-74` (`normalizeStateLegDistrictCode`) returns `${state}-${num-padded}` (no SS/SH prefix).
- `packages/db/supabase/seed/state-officials-ingest.ts:99-104` queries `where code = $1 and tier = $2` using the normalize output → if formats truly diverge, ALL state-tier district lookups silently unmatch.
- `state-officials-ingest.test.ts:17-30` fixtures seed districts in state-leg-config format (`CA-15`), not TIGER format (`CA-SS-15`) — masking the production mismatch from unit tests.
- CLAUDE.md Gotcha #8 describes NH as the only state with district-code drift; if the broader format mismatch is confirmed, that Gotcha is materially incomplete.

## Non-goals

- **No code changes** to `tiger-config.ts`, `state-leg-config.ts`, `state-officials-ingest.ts`, or any pgTAP test.
- **No new workspace deps.**
- **No mobile / UI work.**
- **No CI changes.**
- **No fix-shipping.** If the mismatch is confirmed, slice 28 ships the alignment + NH handling on top.
- **No decision on NH multi-word handling.** Audit doc lays out options for slice 28; doesn't pick one.

## Architecture

```
1. Local reproduction
   pnpm db:reset                              # apply migrations 0001-0055
   pnpm seed:tiger                            # ~5-15 min; writes 50-state legislative districts
   pnpm seed:state-officials                  # ingest OpenStates legislators
   → observe stats.unmatchedDistricts count + sample direct DB

2. Sample data inspection
   SELECT tier, substring(code from 1 for 6) AS code_pattern, count(*)
   FROM districts WHERE tier IN ('state_senate','state_house')
   GROUP BY tier, code_pattern ORDER BY tier, code_pattern;

3. CI evidence review
   - Read .github/workflows/ci.yml — does seed:state-officials run?
   - If yes, does CI assert unmatched < threshold? Or just exit code?
   - What recent CI runs show for state-officials-ingest stats?

4. Code-path trace + impact assessment
   - Confirm normalize → SQL lookup → silent skip
   - Quantify affected: 49 of 50 states (NH always returns null today)
   - Cross-reference UI: does /state-officials/[id] depend on district_id?

5. Audit deliverable
   docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md
```

### Files in scope

```
Created (3 maximum):
  docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md
  packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts  (OPTIONAL; ship only if useful)
  CLAUDE.md                                                                  (Gotcha #8 update IF findings are conclusive)
```

**Note on conditional files:**
- The diagnostic script is OPTIONAL. Ship only if the implementer judges it reusable for slice 28 verification. If skipped, audit doc embeds the SQL + sample-output inline.
- CLAUDE.md Gotcha #8 update is CONDITIONAL on findings. If the audit confirms the mismatch is real, append a follow-up note pointing at the audit doc + slice 28 fix scope. If findings are inconclusive (e.g. CI has some workaround we missed), defer the Gotcha edit.

**Minimum:** 1 file (audit doc). **Maximum:** 3 files. **Audit-tier slice.**

## Components

### Audit document structure

**File:** `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`

Sections (in this order):

1. **Background** — state-leg-config + tiger-config + state-officials-ingest interaction. Cite file paths + line numbers for both formats.

2. **The observed mismatch (code evidence)** — exact code excerpts from:
   - `tiger-config.ts:53` (`STATE-SS-N`)
   - `tiger-config.ts:71` (`STATE-SH-N`)
   - `state-leg-config.ts:73-74` (`STATE-N`)
   - `state-officials-ingest.ts:99-104` (lookup query)
   - `state-officials-ingest.test.ts:17-30` (fixture format)

3. **Reproduction steps** — exact commands the operator runs to reproduce:
   - `pnpm db:reset`
   - `pnpm seed:tiger` (with note about 5-15 min duration)
   - `pnpm seed:state-officials` (or whichever CLI exists)
   - Sample SQL queries to inspect actual district code formats + per-state legislator district_id NULL counts

4. **Findings** — empirical data the audit collects:
   - Live DB sample: actual TIGER state legislative district codes (head -20)
   - state-officials-ingest stats: `unmatchedDistricts.length` (expected: ~all legislators if mismatch is real)
   - Per-state breakdown: how many legislators in each state have `district_id IS NULL`
   - Sample 5 random legislators per state: do they have populated district_id?

5. **CI evidence** — what the CI workflow shows:
   - Is `seed:state-officials` in the CI workflow?
   - What stats does it print + assert?
   - Has any CI run flagged the unmatched count?

6. **Impact assessment** — what's broken in production:
   - UI: does `/state-officials/[id]` depend on `district_id`? (Cross-reference `packages/officials/src/queries.ts` + officials-ui state cards)
   - Map: does state legislator display rely on district_id linkage?
   - Search: does any user-facing flow hit `district_id IS NOT NULL`?
   - Quantify expected legislator count vs current populated count if the mismatch is confirmed.

7. **Why tests didn't catch the bug** — test fixture format diverged from production TIGER format. Document the fixture-vs-production divergence pattern as a meta-lesson (anti-pattern similar to slice 18 Task 2 tsconfig.seed.json gap from CLAUDE.md history — fixtures that mask production state).

8. **Recommended fix for slice 28**:
   - **Option A (recommended):** Change `state-leg-config.ts` to emit `${state}-SS-${num}` / `${state}-SH-${num}` to match TIGER. Update `state-officials-ingest.test.ts` fixtures. Then layer NH multi-word handling on top.
   - **Option B:** Change `tiger-config.ts` to emit `${state}-${num}` (no SS/SH prefix). Riskier — other consumers may rely on the SS/SH prefix.
   - **Option C:** Introduce a 3rd transformation layer that bridges the two formats.
   - For each option: pros / cons / risk / file count.

9. **NH multi-word options** — separately, regardless of which format wins:
   - (a) Skip NH like today (status quo)
   - (b) Map to county-numbered code (e.g. `NH-Rockingham-5` → `NH-SH-Rockingham-5` if Option A wins)
   - (c) Defer until TIGER supplies state-specific codes
   - Audit doc records the options + recommends one based on TIGER NH district code structure observed in the live DB.

10. **Test gaps that hid the bug** — actionable recommendations:
    - Add a pgTAP assertion checking `state_senate` / `state_house` district code format matches `STATE-SS-N` / `STATE-SH-N`.
    - Update `state-officials-ingest.test.ts` fixtures OR add a separate integration test that runs against actual TIGER-seeded data.

11. **Slice 5C Gotcha #8 update suggestion** — proposed CLAUDE.md edit text for slice 28's closure to update.

### Optional diagnostic script

**File:** `packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts`

Self-contained TS script that:
- Connects to local DB via `pg.Client`
- Queries actual district code patterns + counts
- Prints results as a table
- Returns non-zero exit code if mismatch detected (would be useful for slice 28 verify gate)

Ship ONLY if the implementer judges it reusable (rule-of-three says probably yes — slice 28 will rerun it; slice 27 audit uses it).

### CLAUDE.md update (conditional)

If findings confirm the bug, append a brief follow-up paragraph to Gotcha #8 OR add Gotcha #28 cross-referencing the audit doc + slice 28 fix scope.

## Data flow

Audit-only. No code paths.

## Error handling

If the implementer can't run `seed:tiger` (long-running, may fail on flaky Census endpoint per Gotcha #6), the audit doc records "couldn't verify live; code-path analysis only" and recommends slice 28 begin with live reproduction.

## Testing strategy

**No new tests in this slice.** The audit doc records recommendations for slice 28 to add the missing tests.

If the optional diagnostic script ships:
- `pnpm -r typecheck` 11/11 green
- No vitest changes
- Manual smoke: run the script against local DB; verify exit code matches expectation

## Verify gate

- Audit doc commits to `docs/superpowers/audits/`
- If diagnostic script ships: typecheck 11/11 green
- If Gotcha #8 update lands: CLAUDE.md still well-formed (no broken markdown)
- pgTAP unchanged at 424 plans
- All other test counts unchanged

## Risk + tradeoffs

1. **`seed:tiger` is long-running (5-15 min) and may flake on Census endpoint.** If the implementer's machine can't complete it, the audit ships with code-path-analysis-only findings + slice 28 begins with live repro. Mitigation: implementer runs `seed:tiger` in background early in the audit work; uses the time to write code-path analysis sections.

2. **`state-officials` ingest may need OpenStates fixtures or live OpenStates data** (slice 5C uses both modes). Audit can run against fixtures alone if live OpenStates is unavailable.

3. **CI may have a reconciliation we're not seeing.** Audit explicitly checks for this; if found, the audit doc records the mechanism + revises the recommended fix.

4. **The diagnostic script is optional.** Ship it if reusable; otherwise audit doc embeds SQL inline. Decision at scaffold time, not spec time.

5. **CLAUDE.md edit is conditional on findings.** If the audit finds the bug is real, Gotcha #8 needs an update; if findings are inconclusive, defer. Decision at scaffold time.

6. **No commitment to slice 28 fix shape.** The audit recommends Option A (change normalize to emit SS/SH) but the user picks during slice 28 brainstorm. The audit doc presents all 3 options.

7. **Audit-only ≠ no-effort.** Live reproduction + thorough findings + actionable recommendations require an investment proportional to the bug's potential impact (which is large if confirmed: ~49 states × hundreds of legislators each).

8. **Test fixture format anti-pattern is a meta-lesson worth documenting.** The audit doc may surface it as a candidate Gotcha for slice 28 to add: "Integration test fixtures that diverge from production seed-data format mask production failures." Aligns with slice 18 Task 2 tsconfig.seed.json blind-spot pattern.

## Schema verification needed during planning

None — audit doc references existing schema; no migrations.

## Cross-references

- Slice 2 (TIGER ingest origin + tiger-config.ts SS/SH format introduction)
- Slice 5C (state-officials identity + state-leg-config.ts introduction + Gotcha #8 NH limitation + state-officials-ingest.ts)
- Slice 18 audit (post-slice-17 + tsconfig.seed.json gap pattern — test-fixture-vs-production divergence parallel)
- Slice 25 + 26 reviewers' audit-first methodology (Gotcha #20)
- CLAUDE.md Gotcha #6 (TIGER seed prerequisite + flake tolerance)
- CLAUDE.md Gotcha #8 (NH multi-word limitation — needs update post-audit)
- Memory: [[project-chiaro-slice5c-state-officials]] (state-leg-config origin), [[project-chiaro-tiger-ingest]] (tiger-config origin), [[feedback-workflow-tiers]] (audit-tier is the smallest workflow tier)
