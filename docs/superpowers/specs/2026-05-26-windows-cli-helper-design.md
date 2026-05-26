# Slice 30 — Windows CLI silent no-op mass fix + helper + CI guard design

**Status:** approved 2026-05-26 (verbal — brainstorming flow)
**Tier:** Mega-Slice (~31 files)
**Builds on:** Slice 28 Task 4 (canonical `pathToFileURL` pattern for state-officials-ingest), slice 27 audit (ancillary finding about Windows CLI silent no-op), slice 29 smoke testing (discovered 15 additional broken scripts).

## Goal

Fix the production-impact Windows CLI silent no-op bug across all 15 broken ingest scripts. Extract the canonical detection pattern into a shared `isCliEntry()` helper. Convert the other 11 working-but-fragile scripts to the helper for uniformity. Add a CI grep guard to prevent recurrence.

After this slice:
- `pnpm seed:<any-ingest>` runs (instead of silently no-oping) on Windows for ALL 27 affected scripts
- New ingest scripts get a one-line `if (isCliEntry(import.meta.url)) { ... }` pattern — no opportunity to reintroduce the bug
- Future PRs introducing either bad pattern fail CI fast with a clear error
- CLAUDE.md Gotcha #28 documents the lesson + canonical pattern

## Non-goals

- **No Windows CI matrix.** Adding Windows GitHub Actions runners would catch this bug class via execution, but is a substantial CI infrastructure cost. CI grep guard is the v1 prevention; Windows CI is slice 31+ candidate.
- **No ESLint rule.** Could enforce the helper via custom lint rule. Acceptable v1 with grep guard; ESLint rule is slice 31+ candidate if the grep guard proves insufficient.
- **No refactor of CLI-flag parsing.** Each script's `--flag=value` parsing stays inline + ad-hoc (existing convention). Future could extract into a shared parser; out of scope.
- **No schema changes.** Pure code refactor + CI workflow extension.
- **No test changes for the 27 ingest scripts.** The CLI guard is dead code in test paths (slice 28 lesson); existing 857 db vitest tests stay green.
- **No regenerated Database types.** No schema work.

## Architecture

3 work-streams in one slice:

```
1. Helper extraction
   packages/db/supabase/seed/shared/cli.ts        NEW (~15 LOC)
   packages/db/supabase/seed/shared/cli.test.ts   NEW (~3 unit tests)

2. Mass conversion (27 files using either broken or working pattern)
   2a. 15 broken sites (2-slash file://X)         REPLACE with isCliEntry()
   2b. 12 working sites (fileURLToPath forward + 1 slice 28 inline)
                                                  REPLACE with isCliEntry()

3. Recurrence prevention
   .github/workflows/ci.yml                       ADD grep guard step

4. Closure
   CLAUDE.md                                      NEW Gotcha #28
   memory + MEMORY.md                             (outside repo)
```

### File count

- 2 new files (helper + helper test)
- 27 modified ingest scripts (CLI guard sites)
- 1 modified CI workflow (.github/workflows/ci.yml)
- 1 modified CLAUDE.md
- **= 31 files.** Mega-Slice tier.

### Mid-slice safety

Tasks 2a and 2b commits are independent — Task 2a (15 broken) closes the production bug; Task 2b (12 working) is uniformity refactor. If Task 2b surfaces unexpected regression, can be reverted without losing the bug fix.

## Components

### Task 1 — Helper extraction

**File:** `packages/db/supabase/seed/shared/cli.ts`

```ts
import { pathToFileURL } from 'node:url'

/**
 * Returns true if the calling module was invoked directly as a CLI
 * (vs imported as a library). Canonical Node.js cross-platform pattern
 * for detecting CLI entry — pass `import.meta.url` from the caller.
 *
 * Slice 30 origin (consolidates slice 28's pathToFileURL-reverse fix
 * applied to state-officials-ingest.ts). Replaces 2 broken patterns
 * found across seed/:
 *
 * 1. `file://${process.argv[1].replace(/\\/g, '/')}` — 2-slash bug:
 *    produces `file://C:/...` while import.meta.url is `file:///C:/...`.
 *    Silently no-ops on Windows. 15 files affected pre-slice-30.
 *
 * 2. `fileURLToPath(import.meta.url) === process.argv[1]` — forward
 *    direction. Works in current environments but fragile across
 *    path-separator + drive-letter case normalization.
 *
 * Usage:
 *   import { isCliEntry } from './shared/cli.ts'
 *   if (isCliEntry(import.meta.url)) {
 *     // CLI parsing + dispatch
 *   }
 *
 * Why `pathToFileURL(argv[1]).href` works cross-platform:
 *   pathToFileURL('C:\\Users\\...\\foo.ts') → 'file:///C:/Users/.../foo.ts'
 *   matches the same shape Node emits in import.meta.url. The reverse
 *   direction (fileURLToPath) is fragile because path separator and
 *   drive-letter case normalization differ across platforms.
 */
export function isCliEntry(importMetaUrl: string): boolean {
  if (!process.argv[1]) return false
  return importMetaUrl === pathToFileURL(process.argv[1]).href
}
```

**File:** `packages/db/supabase/seed/shared/cli.test.ts`

3 unit tests (helper is a pure function — argv-parsing brittleness from slice 28 doesn't apply because the helper is tested in isolation, not the full CLI flow):

```ts
import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { isCliEntry } from './cli.ts'

describe('isCliEntry', () => {
  it('returns true when import.meta.url matches pathToFileURL(argv[1]).href', () => {
    const savedArgv1 = process.argv[1]
    process.argv[1] = process.cwd() + '/test-script.ts'
    const expected = pathToFileURL(process.argv[1]).href
    expect(isCliEntry(expected)).toBe(true)
    process.argv[1] = savedArgv1
  })

  it('returns false on mismatch', () => {
    expect(isCliEntry('file:///different.ts')).toBe(false)
  })

  it('returns false when argv[1] is undefined', () => {
    const savedArgv1 = process.argv[1]
    process.argv = [process.argv[0]!]  // strip argv[1]
    expect(isCliEntry('file:///anything')).toBe(false)
    process.argv[1] = savedArgv1
  })
})
```

### Task 2a — 15 broken sites (2-slash pattern)

Files to modify (all in `packages/db/supabase/seed/`):
- `federal-ptrs-ingest.ts` (slice 26)
- `federal-fds-ingest.ts` (slice 26)
- `federal-community-mobilize-ingest.ts` (slice 8)
- `state-ethics-ingest.ts` (slice 5I)
- `state-community-ingest.ts` (slice 5H)
- `state-finance-ingest.ts` (slice 5E)
- `state-scorecards-ingest.ts` (slice 5G)
- `state-bills-votes-ingest.ts` (slice 5D)
- `state-bills-enrich.ts` (slice 5D)
- `openstates-v3-fetch.ts` (slice 5D)
- `openstates-v3-fetch-all.ts` (slice 5D)
- `openstates-v3-cache-prune.ts` (slice 5D)
- `openstates-committees-fetch.ts` (slice 5F)
- `openstates-committees-ingest.ts` (slice 5F)
- `recompute-state-metrics.ts` (slice 5D)

**Per-file edit shape:**

```diff
+ import { isCliEntry } from './shared/cli.ts'
  // ... other imports

- if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
+ if (isCliEntry(import.meta.url)) {
   // existing CLI parsing + dispatch unchanged
 }
```

Some scripts have additional `fileURLToPath` imports for unrelated purposes (e.g., `dirname(fileURLToPath(import.meta.url))` for `__dirname` derivation). Keep those imports intact; only remove if grep confirms zero remaining uses.

### Task 2b — 12 working sites (fileURLToPath forward direction + slice 28 inline)

Files to modify:
- `state-officials-ingest.ts` (slice 28 pathToFileURL inline → helper)
- `audit-calibrate-latest-user.ts`
- `audit-fixture-attach.ts`
- `bills-votes-ingest.ts`
- `finance-ingest.ts`
- `officials-ingest.ts`
- `recompute-metrics.ts`
- `salary-residency-ingest.ts`
- `scorecards/index.ts` (subdirectory; import path `../shared/cli.ts`)
- `stock-watcher-ingest.ts`
- `town-halls-ingest.ts`
- `unitedstates-legislators-ingest.ts`

**Per-file edit shape (forward-direction fileURLToPath):**

```diff
+ import { isCliEntry } from './shared/cli.ts'

- if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
+ if (isCliEntry(import.meta.url)) {
```

**Per-file edit shape (state-officials-ingest.ts; slice 28 inline pathToFileURL):**

```diff
- import { fileURLToPath, pathToFileURL } from 'node:url'
+ import { fileURLToPath } from 'node:url'  // still used for __dirname derivation
+ import { isCliEntry } from './shared/cli.ts'

- if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
+ if (isCliEntry(import.meta.url)) {
```

**Import cleanup audit per file:** After edit, run `grep -c "fileURLToPath\|pathToFileURL" <file>`. If count == 0, the import line can be removed. If > 0, keep the import (still used elsewhere — typically `__dirname` derivation).

### Task 3 — CI grep guard

`.github/workflows/ci.yml` — add a new step in the `test` job (runs after typecheck; cheap):

```yaml
- name: Verify no legacy CLI guard patterns
  run: |
    set -e
    if grep -rn 'file://\${process\.argv\[1\]' packages/db/supabase/seed/; then
      echo "::error::Found broken 2-slash file:// CLI guard. Use isCliEntry() from shared/cli.ts."
      exit 1
    fi
    if grep -rn 'fileURLToPath(import.meta.url) === process.argv\[1\]' packages/db/supabase/seed/; then
      echo "::error::Found legacy fileURLToPath CLI guard. Use isCliEntry() from shared/cli.ts."
      exit 1
    fi
```

Catches both bad patterns. Step runs in <1s. Failure messages name the canonical fix.

### Task 4 — Closure

**CLAUDE.md — NEW Gotcha #28** (verify slice 26 left the latest at #27; slice 30 adds #28):

```markdown
28. **Windows CLI silent no-op pattern: use `isCliEntry()` helper, not manual `file://X` or `fileURLToPath` forward direction.** Slice 30 smoke testing discovered 15 ingest scripts that silently no-op on Windows because their CLI entry-point detection uses `import.meta.url === \`file://${process.argv[1].replace(/\\/g, '/')}\`` — produces `file://C:/...` (2 slashes) while `import.meta.url` is `file:///C:/...` (3 slashes per RFC 8089). The mismatch causes the CLI block to never enter; the script exits 0 with no output. CI green doesn't catch it because GitHub Actions runs Linux. The canonical fix is `isCliEntry(import.meta.url)` from `seed/shared/cli.ts`, which uses `pathToFileURL(argv[1]).href === importMetaUrl` (reverse direction). A CI grep guard in `.github/workflows/ci.yml` fails the build if either bad pattern reappears. The lesson: file:// URL construction must use Node's canonical `pathToFileURL` API, not manual string concatenation — separator + drive-letter normalization is platform-specific.
```

**Memory file:** standard slice closure template.

**MEMORY.md index:** one-liner per slice 14-29 convention.

## Data flow

Pure refactor. Pre-slice runtime behavior on Linux unchanged (the 2-slash pattern worked on Linux by accident); pre-slice runtime behavior on Windows changes from "silent no-op" to "actually runs."

## Error handling

- **Helper** has 2 guards: missing `argv[1]` → false; mismatched path → false. No exceptions.
- **CI guard** exits 1 with clear `::error::` message. PR cannot merge.
- **Mass conversion drift** mitigated by Task 2a/2b split — bug fix and uniformity refactor in separate commits.
- **Existing tests unaffected** (CLI guard is dead code in test paths per slice 28 lesson).

## Testing strategy

- Helper unit tests (Task 1): 3 cases in `cli.test.ts`. Pure function; trivial to test.
- Existing 857 db vitest tests stay green (no behavioral change).
- CI guard self-check: post-slice, `grep -rn '<bad-pattern>' packages/db/supabase/seed/` returns nothing.
- Smoke verification (manual): post-slice, `pnpm --filter @chiaro/db seed:state-finance -- --cycle=2024 --skip-on-error` actually runs (not silent no-op). Replicates the slice 30 smoke session that uncovered the bug.

Expected test count delta: @chiaro/db vitest 857 → 860 (+3 helper tests). pgTAP unchanged.

## Verify gate

```bash
pnpm -r typecheck                                              # 11/11 green
pnpm --filter @chiaro/db exec vitest run shared/cli            # 3 new tests green
pnpm --filter @chiaro/db exec vitest run                       # 860 total
pnpm --filter @chiaro/officials exec vitest run                # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run             # 276 unchanged
pnpm --filter @chiaro/web build                                # 12 routes green

# Smoke (Windows-specific):
pnpm --filter @chiaro/db seed:state-finance -- --cycle=2024 --skip-on-error
# Expected: orchestrator dispatches (was silent no-op pre-slice).

# CI grep guard self-check:
grep -rn 'file://\${process\.argv\[1\]' packages/db/supabase/seed/      # zero matches
grep -rn 'fileURLToPath(import.meta.url) === process.argv\[1\]' packages/db/supabase/seed/  # zero matches
```

## Risk + tradeoffs

1. **Mass refactor touches 27 ingest scripts.** Risk of typo or missed import cleanup. Mitigation: nearly-identical per-file diffs (~3 lines each); existing tests catch any regression in CLI guard behavior; Task 2a/2b split limits per-commit blast radius.

2. **`isCliEntry()` API requires explicit `import.meta.url` argument.** Slight friction — callers always write `isCliEntry(import.meta.url)` literal. Alternative considered: function-decorator pattern via `Function.prototype` — overkill. Accepted.

3. **CI grep guard relies on lexical pattern matching.** Reformatting (e.g. line breaks inside template literal) could circumvent. Acceptable v1 — grep catches the specific known-bad patterns. If circumvention happens, slice 31+ moves to ESLint rule.

4. **The 12 "working" files don't strictly need conversion (Task 2b).** Convert anyway for uniformity. Risk: regression in a previously-working script. Mitigation: helper does exactly what `pathToFileURL(argv[1]).href === import.meta.url` does (slice 28 canonical pattern); regression would only happen if `import.meta.url` doesn't match the pattern, which would have broken slice 28's state-officials fix too. Confidence high.

5. **Subdirectory import path: `seed/scorecards/index.ts` → `../shared/cli.ts`.** Easy to miss when batching. Implementer does per-file grep audit before removing unused imports.

6. **CLAUDE.md Gotcha #28 numbering.** Slice 26 added #27; slice 30 = #28. Verify no conflict at scaffold (no parallel slices pending).

7. **No Windows CI matrix added.** Linux CI green doesn't catch this bug class going forward (only the grep guard does). Windows runners are slice 31+ candidate; out of slice 30 scope.

8. **Helper is not exported across packages.** `seed/shared/cli.ts` is internal to the `@chiaro/db` seed tree. If apps (web/mobile) ever grow CLI entry points, they get their own helper (or this one hoists to a shared utilities package). Acceptable v1.

## Schema verification needed during planning

None — pure code refactor; no schema changes.

## Cross-references

- Slice 28 Task 4 (`state-officials-ingest.ts` pathToFileURL inline fix — this slice consolidates into the helper)
- Slice 27 audit ancillary finding (Windows CLI silent no-op — initial discovery for state-officials only)
- Slice 29 smoke testing (this session — discovered the 15 additional broken scripts)
- Slice 26 (`federal-ptrs-ingest.ts` + `federal-fds-ingest.ts` — both shipped broken on Windows)
- CLAUDE.md Gotcha #27 (ON CONFLICT partial-index lesson — peer pattern: production-defect class caught at smoke/review)
- Memory: [[project-chiaro-slice27-state-leg-district-audit]] (audit origin), [[project-chiaro-slice28-state-leg-district-fix]] (slice 28 pathToFileURL fix this slice generalizes), [[project-chiaro-slice26-federal-stock-disclosures]] (federal-ptrs/fds origin shipped with bug), [[feedback-workflow-tiers]] (Mega-Slice tier choice)
