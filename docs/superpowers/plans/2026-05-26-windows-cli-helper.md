# Slice 30 — Windows CLI silent no-op mass fix + helper + CI guard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md Gotcha #25: implementer subagents MUST run sequentially.

**Goal:** Extract `isCliEntry()` helper + mass-fix 27 ingest scripts using either of two bad CLI guard patterns + add CI grep guard preventing recurrence. Closes the slice 29 smoke-finding Windows silent no-op bug.

**Architecture:** 5 tasks. Task 1 (helper + test) → Task 2a (15 broken-pattern files) → Task 2b (12 working-but-fragile files) → Task 3 (CI guard) → Task 4 (closure). Task 2a closes the production bug; Task 2b is uniformity refactor; both touch the new helper from Task 1.

**Tech Stack:** TypeScript strict + verbatimModuleSyntax. Pure code refactor; no schema, no migrations, no workspace deps.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-26-windows-cli-helper-design.md` (this slice's spec)
- `packages/db/supabase/seed/state-officials-ingest.ts:236` — slice 28 canonical pattern (basis for helper)
- `packages/db/supabase/seed/state-finance-ingest.ts:86` — example of the 2-slash broken pattern
- `packages/db/supabase/seed/officials-ingest.ts:290` — example of the forward-direction working pattern
- `packages/db/supabase/seed/shared/pdf.ts` — example of `seed/shared/` helper layout (slice 19)
- `packages/db/supabase/seed/shared/officials.ts` — another `seed/shared/` helper (slice 8 + slice 15 hoist)
- `.github/workflows/ci.yml` — current CI structure
- CLAUDE.md Gotcha #25 (parallel-agent git collision — implementers must run sequentially)
- CLAUDE.md Gotcha #27 (slice 26 ON CONFLICT bug — peer pattern; production-defect class caught via testing)

**Key findings from planning-time investigation:**

- Broken pattern (15 files): `import.meta.url === \`file://${process.argv[1]!.replace(/\\/g, '/')}\``
- Working pattern (11 files): `if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])`
- Slice 28 inline pattern (1 file — state-officials-ingest.ts:236): `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)`
- 11 working files exist (excluding state-officials); plus state-officials = 12 files in Task 2b.
- Subdir file: `scorecards/index.ts` needs `../shared/cli.ts` import path (one extra `..`).
- Some files retain `fileURLToPath` for `__dirname` derivation (e.g. `state-officials-ingest.ts:22`); keep those imports.

**Decision points the implementer makes at scaffold:**

1. **Import cleanup per file:** post-edit, grep for any remaining `fileURLToPath` / `pathToFileURL` use. Remove import line ONLY if zero uses remain.
2. **CI workflow placement:** the grep guard step should land in the `test` job (after typecheck, before vitest) — fast fail. If `test` job structure isn't obvious, ask the spec/existing slice 28+29 CI step pattern.
3. **Task batching:** Tasks 1-4 are sequential per spec. Tasks 2a + 2b are independent but related; default to sequential dispatch for cleaner per-commit history.

---

## File Structure

### Created files (2)
```
packages/db/supabase/seed/shared/cli.ts          Task 1 (helper, ~15 LOC)
packages/db/supabase/seed/shared/cli.test.ts     Task 1 (3 unit tests)
```

### Modified files (29)
```
[Task 2a — 15 broken-pattern files]
packages/db/supabase/seed/federal-ptrs-ingest.ts
packages/db/supabase/seed/federal-fds-ingest.ts
packages/db/supabase/seed/federal-community-mobilize-ingest.ts
packages/db/supabase/seed/state-ethics-ingest.ts
packages/db/supabase/seed/state-community-ingest.ts
packages/db/supabase/seed/state-finance-ingest.ts
packages/db/supabase/seed/state-scorecards-ingest.ts
packages/db/supabase/seed/state-bills-votes-ingest.ts
packages/db/supabase/seed/state-bills-enrich.ts
packages/db/supabase/seed/openstates-v3-fetch.ts
packages/db/supabase/seed/openstates-v3-fetch-all.ts
packages/db/supabase/seed/openstates-v3-cache-prune.ts
packages/db/supabase/seed/openstates-committees-fetch.ts
packages/db/supabase/seed/openstates-committees-ingest.ts
packages/db/supabase/seed/recompute-state-metrics.ts

[Task 2b — 12 working-pattern files (11 fileURLToPath + 1 slice 28 inline)]
packages/db/supabase/seed/state-officials-ingest.ts
packages/db/supabase/seed/audit-calibrate-latest-user.ts
packages/db/supabase/seed/audit-fixture-attach.ts
packages/db/supabase/seed/bills-votes-ingest.ts
packages/db/supabase/seed/finance-ingest.ts
packages/db/supabase/seed/officials-ingest.ts
packages/db/supabase/seed/recompute-metrics.ts
packages/db/supabase/seed/salary-residency-ingest.ts
packages/db/supabase/seed/scorecards/index.ts       (subdir; ../shared/cli.ts)
packages/db/supabase/seed/stock-watcher-ingest.ts
packages/db/supabase/seed/town-halls-ingest.ts
packages/db/supabase/seed/unitedstates-legislators-ingest.ts

[Task 3 — CI guard]
.github/workflows/ci.yml

[Task 4 — closure]
CLAUDE.md
```

**Total touched: 31 files.** Mega-Slice tier.

---

## Task 1: Helper extraction + unit tests

**Files:**
- Create: `packages/db/supabase/seed/shared/cli.ts`
- Create: `packages/db/supabase/seed/shared/cli.test.ts`

- [ ] **Step 1: Verify `seed/shared/` directory exists**

```bash
ls packages/db/supabase/seed/shared/
```

Expected: `officials.ts`, `pdf.ts`, `instrumentation.ts`, etc. (slice 8 + slice 19 + slice 22 helpers). If missing, create with `mkdir -p`.

- [ ] **Step 2: Write `cli.ts` (helper)**

Use Write tool with absolute path `packages/db/supabase/seed/shared/cli.ts`. Verbatim content from spec Task 1 component:

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

- [ ] **Step 3: Write `cli.test.ts`**

Use Write tool. Verbatim content from spec Task 1 component:

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

- [ ] **Step 4: Run scoped tests + typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run shared/cli
pnpm -r typecheck
```

Expected: 3 tests green; typecheck 11/11 green.

If `verbatimModuleSyntax` complains about `import { describe, expect, it } from 'vitest'` (these are values, not types — should be fine), check sibling test files for exact import style.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/db/supabase/seed/shared/cli.ts \
        packages/db/supabase/seed/shared/cli.test.ts
git commit -m "$(cat <<'EOF'
feat(seed): slice 30 task 1 — isCliEntry() shared helper

Slice 29 smoke testing found 15 ingest scripts silently no-op on
Windows due to a 2-slash file:// CLI guard pattern. Slice 28 had
already fixed one such site (state-officials-ingest.ts) by switching
to pathToFileURL reverse direction. Slice 30 lifts that canonical
pattern into a shared helper.

isCliEntry(importMetaUrl: string): boolean
- Returns true when the calling module was invoked as a CLI
- Uses pathToFileURL(argv[1]).href === importMetaUrl (cross-platform)
- Replaces 2 known-broken patterns across seed/:
  - file://${argv[1]} (2-slash; 15 files)
  - fileURLToPath(import.meta.url) === argv[1] (forward; 11 files)

3 unit tests cover happy path + mismatch + undefined argv[1].
Helper is pure; argv-parsing brittleness from slice 28 doesn't apply.

Per spec: docs/superpowers/specs/2026-05-26-windows-cli-helper-design.md
Tasks 2a-2b convert the 27 callsites.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2a: Convert 15 broken-pattern files (closes the production bug)

**Files:** all under `packages/db/supabase/seed/`:
- `federal-ptrs-ingest.ts`
- `federal-fds-ingest.ts`
- `federal-community-mobilize-ingest.ts`
- `state-ethics-ingest.ts`
- `state-community-ingest.ts`
- `state-finance-ingest.ts`
- `state-scorecards-ingest.ts`
- `state-bills-votes-ingest.ts`
- `state-bills-enrich.ts`
- `openstates-v3-fetch.ts`
- `openstates-v3-fetch-all.ts`
- `openstates-v3-cache-prune.ts`
- `openstates-committees-fetch.ts`
- `openstates-committees-ingest.ts`
- `recompute-state-metrics.ts`

- [ ] **Step 1: For each file, apply the broken-pattern → helper edit**

Per-file edit shape (mechanical):

```diff
+ import { isCliEntry } from './shared/cli.ts'
  // ... other imports

- if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
+ if (isCliEntry(import.meta.url)) {
   // existing CLI parsing + dispatch unchanged
 }
```

**Notes per file:**
- All 15 files are at the top level of `seed/` — import path is `./shared/cli.ts`
- Some files use the `!` non-null assertion (`process.argv[1]!`), some don't — the new code drops the assertion (helper handles undefined internally).
- Existing CLI parsing logic INSIDE the `if (...)` block stays unchanged.

Use Edit tool with sufficient context to make each replacement unique.

- [ ] **Step 2: Per-file import cleanup audit**

For each file, after applying the edit, run:

```bash
grep -c "fileURLToPath\|pathToFileURL" packages/db/supabase/seed/<file>
```

If count == 0 AND the file had an `import { fileURLToPath } from 'node:url'` (or similar) line, remove that import.
If count > 0, the import is still used elsewhere (e.g. `dirname(fileURLToPath(import.meta.url))` for `__dirname`); keep it.

Likely most of the 15 broken-pattern files DON'T have these imports (the 2-slash pattern is pure string manipulation; no `fileURLToPath` import needed). But verify per file.

- [ ] **Step 3: Workspace verification**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
```

Expected: 11/11 typecheck; 860 db vitest tests green (857 baseline + 3 new from Task 1).

- [ ] **Step 4: Smoke verify (Windows)**

```bash
pnpm --filter @chiaro/db seed:state-finance -- --cycle=2024 --skip-on-error 2>&1 | tail -10
```

Expected: orchestrator runs (NOT silent no-op). Some kind of output — possibly an error from missing fetchers, but not silent.

If it's still silent: investigate the specific file's edit + verify the helper import path resolves.

- [ ] **Step 5: Commit Task 2a**

```bash
git add packages/db/supabase/seed/federal-ptrs-ingest.ts \
        packages/db/supabase/seed/federal-fds-ingest.ts \
        packages/db/supabase/seed/federal-community-mobilize-ingest.ts \
        packages/db/supabase/seed/state-ethics-ingest.ts \
        packages/db/supabase/seed/state-community-ingest.ts \
        packages/db/supabase/seed/state-finance-ingest.ts \
        packages/db/supabase/seed/state-scorecards-ingest.ts \
        packages/db/supabase/seed/state-bills-votes-ingest.ts \
        packages/db/supabase/seed/state-bills-enrich.ts \
        packages/db/supabase/seed/openstates-v3-fetch.ts \
        packages/db/supabase/seed/openstates-v3-fetch-all.ts \
        packages/db/supabase/seed/openstates-v3-cache-prune.ts \
        packages/db/supabase/seed/openstates-committees-fetch.ts \
        packages/db/supabase/seed/openstates-committees-ingest.ts \
        packages/db/supabase/seed/recompute-state-metrics.ts
git commit -m "$(cat <<'EOF'
fix(seed): slice 30 task 2a — replace 2-slash CLI guard in 15 ingest scripts

Slice 29 smoke testing found 15 ingest scripts silently no-op on
Windows because their CLI guards used:

  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`

which produces file://C:/... (2 slashes) while import.meta.url is
file:///C:/... (3 slashes per RFC 8089). Silent failure with exit 0.

Replace with the slice 30 isCliEntry() helper from
seed/shared/cli.ts. Per-file diff is mechanical: import + 1-line
guard replacement. Existing CLI parsing logic unchanged.

Files (15):
- federal-ptrs-ingest.ts (slice 26)
- federal-fds-ingest.ts (slice 26)
- federal-community-mobilize-ingest.ts (slice 8)
- state-ethics-ingest.ts (slice 5I)
- state-community-ingest.ts (slice 5H)
- state-finance-ingest.ts (slice 5E)
- state-scorecards-ingest.ts (slice 5G)
- state-bills-votes-ingest.ts (slice 5D)
- state-bills-enrich.ts (slice 5D)
- openstates-v3-fetch.ts (slice 5D)
- openstates-v3-fetch-all.ts (slice 5D)
- openstates-v3-cache-prune.ts (slice 5D)
- openstates-committees-fetch.ts (slice 5F)
- openstates-committees-ingest.ts (slice 5F)
- recompute-state-metrics.ts (slice 5D)

Production impact: operators running these scripts on Windows no
longer get silent failure. Linux behavior unchanged (the 2-slash
pattern accidentally worked on Linux).

Per spec: docs/superpowers/specs/2026-05-26-windows-cli-helper-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2b: Convert 12 working-pattern files (uniformity refactor)

**Files:** all under `packages/db/supabase/seed/`:
- `state-officials-ingest.ts` (slice 28 pathToFileURL inline — convert to helper)
- `audit-calibrate-latest-user.ts`
- `audit-fixture-attach.ts`
- `bills-votes-ingest.ts`
- `finance-ingest.ts`
- `officials-ingest.ts`
- `recompute-metrics.ts`
- `salary-residency-ingest.ts`
- `scorecards/index.ts` (SUBDIR — import path `../shared/cli.ts`)
- `stock-watcher-ingest.ts`
- `town-halls-ingest.ts`
- `unitedstates-legislators-ingest.ts`

- [ ] **Step 1: For each forward-direction file (11 files), apply the edit**

```diff
+ import { isCliEntry } from './shared/cli.ts'
  // ... other imports

- if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
+ if (isCliEntry(import.meta.url)) {
   // existing CLI parsing + dispatch unchanged
 }
```

For `scorecards/index.ts` ONLY, the import path is `../shared/cli.ts` (one extra `..` because it's in a subdir).

- [ ] **Step 2: For state-officials-ingest.ts (slice 28 inline), apply the edit**

```diff
- import { fileURLToPath, pathToFileURL } from 'node:url'
+ import { fileURLToPath } from 'node:url'  // still used for __dirname at line 22
+ import { isCliEntry } from './shared/cli.ts'

- if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
+ if (isCliEntry(import.meta.url)) {
```

The `fileURLToPath` import stays (used at line 22 for `__dirname`). The `pathToFileURL` import is removed (only used in the guard).

Use Edit tool with `replace_all: false` and sufficient context for each.

- [ ] **Step 3: Per-file import cleanup audit**

For each file, post-edit:

```bash
grep -c "fileURLToPath\|pathToFileURL" packages/db/supabase/seed/<file>
```

If count == 0, remove the `import { fileURLToPath } from 'node:url'` line.
If count > 0 (typically `__dirname` derivation), keep the import.

Most of the 11 forward-direction files use `fileURLToPath` ONLY in the guard — likely safe to remove that import. Verify per file.

- [ ] **Step 4: Workspace verification**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
```

Expected: 11/11 typecheck; 860 db vitest tests green.

- [ ] **Step 5: Smoke verify slice 28 still works**

```bash
pnpm --filter @chiaro/db seed:state-officials -- --fixture-mode 2>&1 | tail -10
```

Expected: orchestrator runs cleanly (matches slice 29 smoke output). Verifies the slice 28 fix is preserved post-helper refactor.

Also smoke-test seed:officials (forward-direction file):

```bash
pnpm seed:officials 2>&1 | tail -10
```

Expected: starts running (may fail mid-way without API key, but the CLI guard fires correctly).

- [ ] **Step 6: Commit Task 2b**

```bash
git add packages/db/supabase/seed/state-officials-ingest.ts \
        packages/db/supabase/seed/audit-calibrate-latest-user.ts \
        packages/db/supabase/seed/audit-fixture-attach.ts \
        packages/db/supabase/seed/bills-votes-ingest.ts \
        packages/db/supabase/seed/finance-ingest.ts \
        packages/db/supabase/seed/officials-ingest.ts \
        packages/db/supabase/seed/recompute-metrics.ts \
        packages/db/supabase/seed/salary-residency-ingest.ts \
        packages/db/supabase/seed/scorecards/index.ts \
        packages/db/supabase/seed/stock-watcher-ingest.ts \
        packages/db/supabase/seed/town-halls-ingest.ts \
        packages/db/supabase/seed/unitedstates-legislators-ingest.ts
git commit -m "$(cat <<'EOF'
refactor(seed): slice 30 task 2b — uniform CLI guard via isCliEntry()

Convert 12 working-but-fragile CLI guards to use the slice 30
isCliEntry() helper. 11 files used fileURLToPath forward direction
(works in current environments but fragile across path-separator +
drive-letter case normalization). 1 file (state-officials-ingest.ts)
used slice 28's inline pathToFileURL reverse pattern (helper now
encapsulates).

Files (12):
- state-officials-ingest.ts (slice 28 inline → helper)
- audit-calibrate-latest-user.ts
- audit-fixture-attach.ts
- bills-votes-ingest.ts
- finance-ingest.ts
- officials-ingest.ts
- recompute-metrics.ts
- salary-residency-ingest.ts
- scorecards/index.ts (subdir; ../shared/cli.ts)
- stock-watcher-ingest.ts
- town-halls-ingest.ts
- unitedstates-legislators-ingest.ts

After this commit: ALL 27 ingest CLI guards use the same one-line
isCliEntry(import.meta.url) pattern. Future ingest scripts get
uniform shape; CI guard (Task 3) catches reintroduction of either
bad pattern.

No behavioral change for these files — they were already working
in current environments. Refactor is for uniformity + future-proofing.

Per spec: docs/superpowers/specs/2026-05-26-windows-cli-helper-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: CI grep guard

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read existing ci.yml structure**

```bash
grep -n "name:\|run:" .github/workflows/ci.yml | head -50
```

Identify the `test` job (or wherever fast-fail steps live). Slice 28+29 added steps in the `db` job; the grep guard is logically independent — could go in `test` job (catches PRs before they hit any test work) OR in `db` job (consistent location with slice 28+29 steps).

Recommended: add as a NEW step at the start of the `test` job (before vitest). Fast-fail behavior; runs in <1s.

- [ ] **Step 2: Add the grep guard step**

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

Match the existing indentation convention in `ci.yml`.

- [ ] **Step 3: Validate YAML well-formedness**

```bash
node -e "const y=require('js-yaml'); const f=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); y.load(f); console.log('valid yaml')"
```

If `js-yaml` isn't easily available, fall back to visual diff inspection:

```bash
git diff .github/workflows/ci.yml | head -30
```

- [ ] **Step 4: Self-test the guard locally**

```bash
# Confirm the guard would PASS post-Task 2a+2b (no broken patterns left):
if grep -rn 'file://\${process\.argv\[1\]' packages/db/supabase/seed/; then echo "STILL BROKEN"; else echo "OK 2-slash"; fi
if grep -rn 'fileURLToPath(import.meta.url) === process.argv\[1\]' packages/db/supabase/seed/; then echo "STILL BROKEN"; else echo "OK fileURLToPath"; fi
```

Expected: both print "OK". If either prints "STILL BROKEN", Task 2a or Task 2b missed a file — investigate before proceeding.

- [ ] **Step 5: Commit Task 3**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: slice 30 task 3 — grep guard against legacy CLI patterns

After Task 2a + 2b: zero ingest scripts use either bad CLI guard
pattern. This step ensures NEW PRs don't reintroduce them.

Two patterns banned:
1. `file://${process.argv[1].replace(/\\/g, '/')}` — 2-slash bug
   (silent no-op on Windows per slice 29 smoke finding)
2. `fileURLToPath(import.meta.url) === process.argv[1]` — forward
   direction (fragile across path-separator + drive-letter case)

Canonical replacement: isCliEntry() from
packages/db/supabase/seed/shared/cli.ts (slice 30 Task 1).

Step runs in <1s. PRs introducing either pattern fail fast with a
clear error message naming the canonical fix.

Per spec: docs/superpowers/specs/2026-05-26-windows-cli-helper-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Closure — CLAUDE.md Gotcha #28 + memory

**Files:**
- Modify: `CLAUDE.md` (NEW Gotcha #28)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice30_windows_cli_helper.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Confirm next Gotcha number**

```bash
grep -n "^[0-9]\+\. \*\*" CLAUDE.md | tail -5
```

Expected: last entry is `27. **ON CONFLICT partial-index requires WHERE predicate in match clause.**` (slice 26 closure). Slice 30 = #28.

If a parallel slice landed and added #28 first, slice 30 becomes #29. Adjust numbering.

- [ ] **Step 2: Append Gotcha #28 to CLAUDE.md**

Find the Gotcha section + the last numbered entry. Append:

```markdown
28. **Windows CLI silent no-op pattern: use `isCliEntry()` helper, not manual `file://X` or `fileURLToPath` forward direction.** Slice 30 smoke testing discovered 15 ingest scripts that silently no-op on Windows because their CLI entry-point detection uses `import.meta.url === \`file://${process.argv[1].replace(/\\/g, '/')}\`` — produces `file://C:/...` (2 slashes) while `import.meta.url` is `file:///C:/...` (3 slashes per RFC 8089). The mismatch causes the CLI block to never enter; the script exits 0 with no output. CI green doesn't catch it because GitHub Actions runs Linux. The canonical fix is `isCliEntry(import.meta.url)` from `seed/shared/cli.ts`, which uses `pathToFileURL(argv[1]).href === importMetaUrl` (reverse direction). A CI grep guard in `.github/workflows/ci.yml` fails the build if either bad pattern reappears. **Lesson:** file:// URL construction must use Node's canonical `pathToFileURL` API, not manual string concatenation — separator + drive-letter normalization is platform-specific.
```

- [ ] **Step 3: Write memory file**

Use Write tool with absolute path `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice30_windows_cli_helper.md`. Template:

```markdown
---
name: project-chiaro-slice30-windows-cli-helper
description: Slice 30 — isCliEntry() helper + mass-fix 27 ingest scripts + CI grep guard
metadata:
  type: project
---

Slice 30 shipped 2026-05-26 — merged locally to master as squash `<squash SHA>`. Mega-Slice (~31 files). Closes the Windows CLI silent no-op bug discovered during slice 29 smoke testing.

**What shipped:**
- `seed/shared/cli.ts` — `isCliEntry(importMetaUrl)` helper using canonical `pathToFileURL(argv[1]).href === importMetaUrl` reverse-direction pattern (slice 28 origin)
- 3 unit tests covering happy path + mismatch + undefined argv[1]
- Task 2a: 15 ingest scripts with the broken 2-slash `file://X` pattern → converted to helper. **Closes the production bug.**
- Task 2b: 12 ingest scripts with working-but-fragile `fileURLToPath` forward direction (11 files) + slice 28 inline pathToFileURL (state-officials-ingest.ts) → converted to helper. **Uniformity refactor.**
- CI grep guard in `.github/workflows/ci.yml` — fails build if either bad pattern reappears.
- CLAUDE.md Gotcha #28 documenting the lesson + canonical pattern + CI guard.

**Durable lessons:**

1. **The 2-slash `file://X` pattern is a Windows-specific silent failure.** It accidentally works on Linux (no backslash to replace) but produces `file://C:/...` (2 slashes) on Windows, which doesn't match `import.meta.url`'s `file:///C:/...` (3 slashes per RFC 8089). The script exits 0 with no output. CI green doesn't catch it because GitHub Actions runs Linux. **Lesson:** Never construct `file://` URLs by hand; always use Node's `pathToFileURL`.

2. **The `pathToFileURL` reverse direction is the canonical cross-platform CLI guard pattern.** Slice 28 introduced it for state-officials-ingest.ts; slice 30 lifts it to a shared helper. Other approaches (`fileURLToPath` forward, manual string concat) are fragile to path-separator + drive-letter case normalization differences across platforms.

3. **Smoke testing finds bugs that vitest can't.** Slice 29 found this bug by trying to actually run the seed scripts on Windows. Vitest passes (CLI guard is dead code in test paths). Linux CI passes (different platform). The bug class is uniquely detectable by execution on the target platform OR by static pattern detection (the grep guard).

4. **CI grep guard is a low-cost recurrence prevention.** ~5 lines of bash; runs in <1s; catches the specific known-bad patterns lexically. Not a substitute for actual execution coverage (e.g. Windows CI matrix), but cheaper + sufficient for known patterns.

5. **Mass-replace refactors benefit from a Task 2a/2b split.** Task 2a closes the production bug (15 files); Task 2b is uniformity refactor (12 files). Committing separately lets the bug fix ship + any uniformity-refactor regression revert without losing the bug fix.

6. **Shared helpers under `seed/shared/`.** Established convention from slice 8 (`officials.ts`), slice 19 (`pdf.ts`), slice 22 (`instrumentation.ts`). Slice 30 adds `cli.ts`. New helpers in the seed tree should land here.

**Active follow-ups (operator):**
- Windows CI matrix (slice 31+ candidate; substantial CI infrastructure cost)
- ESLint rule replacing grep guard (slice 31+ candidate if grep guard proves insufficient)
- party_unity_state real implementation (slice 5F carryover — oldest)
- Schedule D/E/F/G FD walkers (slice 26 carryover)
- LCV-OR + PP × 5 anti-bot probe (slice 11 carryover)
- NH multi-word handling Option 9.b/9.c reconsideration (slice 28 deferred)
- Mobile DoD on-device smoke (blocked on EAS APK + Apple Developer credentials)

**Master state at slice 30 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0055; pgTAP 428 plans (unchanged — no schema work). @chiaro/db vitest: 857 → 860 (+3 helper tests).

**Cross-links:** [[project-chiaro-slice28-state-leg-district-fix]] (slice 28 pathToFileURL inline pattern this slice generalizes), [[project-chiaro-slice27-state-leg-district-audit]] (initial Windows CLI ancillary finding), [[project-chiaro-slice26-federal-stock-disclosures]] (federal-ptrs/fds origin shipped with the bug), [[project-chiaro-slice29-state-officials-fixture-mode]] (smoke session that discovered the broader bug class). Spec: `docs/superpowers/specs/2026-05-26-windows-cli-helper-design.md`.
```

- [ ] **Step 4: Update MEMORY.md index**

Append after slice 29 line:

```markdown
- [Chiaro slice 30 Windows CLI helper](project_chiaro_slice30_windows_cli_helper.md) — Mega-Slice (~31 files). Closes Windows silent no-op across 15 broken ingest scripts. Extracts isCliEntry() helper to seed/shared/cli.ts; mass-converts all 27 CLI guards (15 bug fix + 12 uniformity) to helper; CI grep guard prevents recurrence. CLAUDE.md Gotcha #28.
```

- [ ] **Step 5: Workspace verify gate**

```bash
pnpm -r typecheck                                              # 11/11 green
pnpm --filter @chiaro/db exec vitest run                       # 860
pnpm --filter @chiaro/officials exec vitest run                # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run             # 276 unchanged
pnpm --filter @chiaro/web build                                # 12 routes
```

CI guard self-check:
```bash
grep -rn 'file://\${process\.argv\[1\]' packages/db/supabase/seed/  # zero matches
grep -rn 'fileURLToPath(import.meta.url) === process.argv\[1\]' packages/db/supabase/seed/  # zero matches
```

Smoke verify (mirrors slice 29 smoke):
```bash
pnpm --filter @chiaro/db seed:state-finance -- --cycle=2024 --skip-on-error 2>&1 | tail -5
# Expected: orchestrator runs (no silent no-op)

pnpm --filter @chiaro/db seed:state-officials -- --fixture-mode 2>&1 | tail -5
# Expected: slice 28+29 behavior preserved
```

- [ ] **Step 6: Commit Task 4** (CLAUDE.md only — memory files outside repo)

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 30 closure — CLAUDE.md Gotcha #28 (Windows CLI helper)

Slice 30 ships isCliEntry() helper + 27-file mass conversion +
CI grep guard. Gotcha #28 documents:
- The 2 known-bad patterns (2-slash file://X + fileURLToPath forward)
- The canonical pathToFileURL reverse-direction pattern
- The shared seed/shared/cli.ts helper
- The CI grep guard preventing recurrence

After this slice: zero ingest scripts use either bad pattern; CI
catches reintroduction.

@chiaro/db vitest: 857 → 860 (+3 helper tests). pgTAP unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo — do NOT git add them.)

---

## Workspace verify gate (recap)

After all 5 tasks complete:

```bash
pnpm -r typecheck                                              # 11/11 green
pnpm --filter @chiaro/db exec vitest run                       # 860 tests
pnpm --filter @chiaro/officials exec vitest run                # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run             # 276 unchanged
pnpm --filter @chiaro/web build                                # 12 routes
git log master..HEAD --oneline                                 # 7 commits (spec + plan + 4 task commits + closure)
```

CI guard self-check (zero matches expected):
```bash
grep -rn 'file://\${process\.argv\[1\]' packages/db/supabase/seed/
grep -rn 'fileURLToPath(import.meta.url) === process.argv\[1\]' packages/db/supabase/seed/
```

---

## Self-review notes

### Spec coverage

- ✅ Task 1 (helper + test) — matches spec Components Task 1
- ✅ Task 2a (15 broken-pattern files) — matches spec Components Task 2a
- ✅ Task 2b (12 working-pattern files) — matches spec Components Task 2b
- ✅ Task 3 (CI grep guard) — matches spec Components Task 3
- ✅ Task 4 (closure) — matches spec Components Task 4

### Placeholder scan

`<squash SHA>` in memory file (filled post-merge per slice 14-29 precedent). No TBD/TODO.

### Type consistency

- Helper signature: `isCliEntry(importMetaUrl: string): boolean` — matches all 27 callsites where `import.meta.url` is passed.
- Import path: `./shared/cli.ts` from top-level seed files; `../shared/cli.ts` from `scorecards/index.ts` (subdir).
- `verbatimModuleSyntax: true` — `isCliEntry` is a function (value), not a type — regular `import { isCliEntry }` works.

### Known incomplete details

- Per-file `fileURLToPath` / `pathToFileURL` import cleanup is implementer-driven (grep audit per file). Plan provides the audit command; implementer applies the resulting cleanup.
- CI workflow step placement (`test` job vs `db` job) is implementer-driven based on existing step layout. Plan recommends `test` job for fast-fail.

### Subagent decomposition (per Gotcha #25 — sequential implementers)

Tasks 1 → 2a → 2b → 3 → 4 dispatched serially. Tasks 2a and 2b are batched per-file edits (15 + 12 files respectively); each implementer handles all files in its task. Each task ends with a single commit per the commit template.

### Atomic commit history

- Commit 1: helper + test (Task 1)
- Commit 2: bug fix in 15 files (Task 2a) — production-impact closure
- Commit 3: uniformity refactor in 12 files (Task 2b) — revertable without losing bug fix
- Commit 4: CI guard (Task 3) — runs against the now-clean tree
- Commit 5: closure docs (Task 4)

5 implementation commits + 2 prep commits (spec + plan) = 7 commits on branch; squashes to 1 on master.
