# Slice 29 — `seed:state-officials` CI fixture-mode design

**Status:** approved 2026-05-26 (verbal — brainstorming flow)
**Tier:** Compressed-Slice (~4-5 files)
**Builds on:** Slice 27 audit, slice 28 fix + CLAUDE.md Gotcha #8 "Known CI gap" carryover.

## Goal

Close the last open recommendation from the slice 27 audit: wire `seed:state-officials` into CI so the consumer-side (normalize → district-id lookup) catches future format-mismatch regressions. Slice 28 already added the diagnostic step that catches TIGER producer-side drift; this slice closes the consumer-side gap.

Add a `--fixture-mode` CLI flag that bypasses the production pre-flight thresholds (`minStateHouseCount=4500`, `minStateSenateCount=1800`) so the bundled 6-fixture YAML dir can satisfy CI runs.

After this slice:
- `pnpm seed:state-officials --fixture-mode` runs without pre-flight error against the bundled fixture dir
- CI's `db` job runs `seed:state-officials --fixture-mode` after `seed:tiger` and before the slice 28 diagnostic step
- Future regressions to `state-leg-config.ts` normalize OR `state-officials-ingest.ts` upsert logic are caught by CI
- CLAUDE.md Gotcha #8 "Known CI gap" paragraph removed (now closed)

## Non-goals

- **No threshold-tuning beyond bypass.** `--fixture-mode` sets both min counts to 0; no granular per-chamber flag. If a future scenario needs only-one-chamber-bypass, that's a slice 30+ extension.
- **No new fixture data.** The existing 6 YAML files (CA, MD, NE samples) are sufficient for CI smoke. Fixture expansion (WY at-large + AK letter + NH coverage) deferred.
- **No schema changes.** No migrations; pgTAP unchanged at 428 plans.
- **No new workspace deps.**
- **No mobile / UI work.**
- **No production behavior change.** Default CLI invocation (without `--fixture-mode`) still uses production thresholds.
- **No env-var alternative.** The chosen mechanism is a single CLI flag, not a parallel env-var path. Reasoning: explicit + discoverable; existing `OPENSTATES_DATA_DIR` env-var pattern stays untouched for unrelated config.

## Architecture

```
1. CLI flag parsing extension
   state-officials-ingest.ts:226-240   ADD `--fixture-mode` flag detection
   ↓
   When set, pass minStateHouseCount=0 + minStateSenateCount=0 to ingestStateOfficials()

2. Test coverage
   state-officials-ingest.test.ts      ADD test for min-count-zero behavior path

3. CI wiring
   .github/workflows/ci.yml            ADD `seed:state-officials --fixture-mode` step
                                       REMOVE the slice 28 stale "deferred follow-up" comment

4. Closure
   CLAUDE.md                            UPDATE Gotcha #8 (clear the "Known CI gap" paragraph)
   memory + MEMORY.md                   (outside repo)
```

### Files in scope

```
Modified (4):
  packages/db/supabase/seed/state-officials-ingest.ts                MODIFY (CLI flag parsing)
  packages/db/supabase/seed/state-officials-ingest.test.ts           MODIFY (+1 test case)
  .github/workflows/ci.yml                                            MODIFY (add step + clean comment)
  CLAUDE.md                                                            MODIFY (Gotcha #8 paragraph cleanup)
```

**Total touched: 4 files.** Compressed-Slice tier.

## Components

### Task 1: `--fixture-mode` CLI flag

**File:** `packages/db/supabase/seed/state-officials-ingest.ts`

Read the existing CLI guard at lines 226-240. Current shape (verified at planning time):

```ts
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allowDeactArg = process.argv.find(a => a.startsWith('--allow-deactivations='))
  const allowDeactivations = allowDeactArg
    ? parseInt(allowDeactArg.split('=')[1] ?? '0', 10)
    : undefined
  ingestStateOfficials(allowDeactivations !== undefined ? { allowDeactivations } : {})
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
```

(Implementer verifies actual current shape at scaffold; the above is the expected pattern from slice 28 Task 4 + slice 3 deactivation guard.)

Extend to detect `--fixture-mode`:

```ts
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allowDeactArg = process.argv.find(a => a.startsWith('--allow-deactivations='))
  const allowDeactivations = allowDeactArg
    ? parseInt(allowDeactArg.split('=')[1] ?? '0', 10)
    : undefined
  const fixtureMode = process.argv.includes('--fixture-mode')
  ingestStateOfficials({
    ...(allowDeactivations !== undefined ? { allowDeactivations } : {}),
    ...(fixtureMode ? { minStateHouseCount: 0, minStateSenateCount: 0 } : {}),
  })
    .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
    .catch(e => { console.error(e); process.exit(2) })
}
```

The spread-conditional pattern keeps `exactOptionalPropertyTypes: true` happy (matches slice 26 + slice 28 precedent).

Add a JSDoc above the CLI guard documenting the flag (since `--fixture-mode` is new public CLI surface):

```ts
/**
 * CLI entry point.
 *
 * Supported flags:
 * - --allow-deactivations=N — acknowledge an expected mass deactivation (slice 3 pattern)
 * - --fixture-mode — bypass pre-flight thresholds (min counts → 0). For CI / smoke runs
 *   against the bundled `seed/fixtures/openstates-people/` dir. Production runs MUST NOT
 *   use this flag.
 */
if (process.argv[1] && ...) { ... }
```

### Task 2: Test coverage

**File:** `packages/db/supabase/seed/state-officials-ingest.test.ts`

Add ONE new test case in the existing `describe('ingestStateOfficials', ...)` block:

```ts
it('fixture-mode behavior path: bundled fixture dir runs cleanly with min counts = 0', async () => {
  const stats = await ingestStateOfficials({
    fixturesDir: FIXTURE_DIR,
    minStateHouseCount: 0,
    minStateSenateCount: 0,
  })
  expect(stats.errors).toEqual([])
  expect(stats.officialsUpserted).toBeGreaterThan(0)
})
```

This validates the same behavior path that the CLI flag triggers (testing argv parsing directly is brittle per slice 28 Task 4 observation — the CLI guard is dead code in test paths anyway).

Test count delta: +1 case.

### Task 3: CI wiring

**File:** `.github/workflows/ci.yml`

Find the `db` job. After the `seed:tiger` step + BEFORE the existing slice 28 diagnostic step. Add:

```yaml
- name: Run state-officials ingest (fixture mode)
  run: pnpm seed:state-officials --fixture-mode
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Also clean up the existing diagnostic step's stale comment (slice 28 left a "deferred to follow-up slice" note that's now obsolete):

```diff
       - name: Verify state-leg district format
-        # `seed:state-officials` itself is skipped in CI because its pre-flight
-        # thresholds (lower>=4500, upper+legislature>=1800) exceed what the
-        # 6-file bundled fixtures dir can satisfy. Wiring a fixture-mode flag
-        # is deferred to a follow-up slice.
         run: pnpm --filter @chiaro/db diagnose:state-leg-district-format
         env:
           SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Validate YAML well-formedness post-edit:

```bash
node -e "const y=require('js-yaml'); const f=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); y.load(f); console.log('valid yaml')"
```

### Task 4: Closure

**File:** `CLAUDE.md` — find Gotcha #8 + the slice 28 update paragraph. Remove or trim the "Known CI gap" sentence(s) that mention `seed:state-officials` being deferred. Keep the rest of the slice 28 update intact.

Memory file at `~/.claude/projects/.../memory/project_chiaro_slice29_state_officials_fixture_mode.md` + MEMORY.md index line.

Final verify gate.

## Data flow

No new data flow. The CLI flag simply opts into a lower-threshold path that already existed in `ingestStateOfficials({ minStateHouseCount, minStateSenateCount })`.

## Error handling

- **Production safety:** default invocation (no `--fixture-mode`) still uses the 4500/1800 thresholds. Existing production safety unchanged.
- **CI failure mode:** if the new step fails (e.g., fixture YAML changes break the ingest), CI fails fast. The slice 28 diagnostic step runs unconditionally after — its outcome is independent.
- **Flag-typo safety:** `--fixture-mod` (typo) is silently ignored — falls through to production thresholds → pre-flight error. Acceptable since CI yaml is committed + reviewed.

## Testing strategy

- Unit test added (Task 2) for the min-count-zero behavior path
- Existing 8 tests in `state-officials-ingest.test.ts` continue to pass (already use `fixturesDir: FIXTURE_DIR` opt)
- CI integration smoke = the new CI step itself; first CI run validates end-to-end behavior

Expected test count delta: 856 → 857 (+1).

## Verify gate

```bash
pnpm -r typecheck                                          # 11/11 green
pnpm --filter @chiaro/db exec vitest run state-officials-ingest  # 9 tests (was 8 + 1 new)
pnpm db:reset && pnpm seed:state-officials --fixture-mode  # smoke runs cleanly
pnpm --filter @chiaro/db exec vitest run                   # ~857 total
pnpm --filter @chiaro/officials exec vitest run            # 43 (unchanged)
pnpm --filter @chiaro/officials-ui exec vitest run         # 276 (unchanged)
pnpm --filter @chiaro/web build                            # 12 routes (unchanged)
```

YAML validation post-CI edit:

```bash
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('OK')"
```

## Risk + tradeoffs

1. **`--fixture-mode` is a new public CLI surface.** Production operators must NOT use it (would silently disable pre-flight safety). Documented in JSDoc above the CLI guard. Lower risk than expected — naming is unambiguous.

2. **Threshold-bypass is binary (both chambers).** No granular per-chamber bypass. Acceptable v1; revisit if a debugging scenario surfaces requiring chamber-specific bypass.

3. **CI step runs against tiny fixture dir** (4 lower + 2 upper). Doesn't exercise WY/AK/NH/at-large branches in normalize. Acceptable v1 — the diagnostic script already catches format-drift across ALL TIGER districts (slice 28 Task 3 pgTAP covers it too). Slice 30+ could expand fixtures if a normalize branch needs explicit CI coverage.

4. **Slice 28 ci.yml comment lifecycle.** The "deferred to follow-up slice" comment was true when slice 28 shipped; slice 29 closes it. Comment removal is housekeeping, not a behavioral change.

5. **CI execution time impact.** New step adds ~5-10s (6 fixture YAML files + small ingest). Negligible against existing `seed:tiger` (~5-15 min) and pgTAP suite.

6. **No automated test for `--fixture-mode` CLI flag parsing.** Per slice 28 Task 4 observation — the CLI guard is dead code in test paths. Argv-parsing tests are brittle cross-platform. Task 2 tests the behavior path the flag triggers, which is the load-bearing check.

7. **JSDoc-above-guard documentation pattern.** Establishes a convention for documenting CLI flags in this codebase. Slice 30+ may extend to other ingest CLIs (`stock-watcher-ingest.ts`, `state-finance-ingest.ts`, etc.) for consistency.

## Schema verification needed during planning

None — no schema work.

## Cross-references

- Slice 27 audit (`docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`) — Section 10 test-gap recommendation this slice closes
- Slice 28 fix — added the producer-side diagnostic; this slice adds the consumer-side ingest
- Slice 3 (federal officials ingest) — `--allow-deactivations=N` precedent for CLI flag pattern
- Slice 28 Task 4 — slice 28 also touched the CLI guard (`pathToFileURL` fix); slice 29 builds on top
- Memory: [[project-chiaro-slice27-state-leg-district-audit]] (audit origin), [[project-chiaro-slice28-state-leg-district-fix]] (slice 28 carryover this slice closes), [[feedback-workflow-tiers]] (Compressed-Slice tier choice)
