# Slice 29 — `seed:state-officials` CI fixture-mode implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md Gotcha #25: implementer subagents MUST run sequentially.

**Goal:** Add `--fixture-mode` flag to `state-officials-ingest.ts` CLI + wire `seed:state-officials --fixture-mode` into CI. Closes slice 27 audit's Section 10 test-gap recommendation.

**Architecture:** 3 tasks. Task 1 (CLI flag + test) + Task 2 (CI wiring) + Task 3 (closure). Tasks 1 + 2 are independent + small; could be batched.

**Tech Stack:** Existing only. No workspace deps, no schema, no migrations.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-26-state-officials-fixture-mode-design.md`
- `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md` (Section 10)
- `packages/db/supabase/seed/state-officials-ingest.ts` — line 226 CLI guard + lines 24-55 thresholds/opts
- `packages/db/supabase/seed/state-officials-ingest.test.ts` — existing test pattern + `FIXTURE_DIR` constant
- `packages/db/supabase/seed/fixtures/openstates-people/` — bundled 6-file YAML fixture dir
- `.github/workflows/ci.yml` — current `db` job structure (slice 28 added the diagnostic step + a "deferred follow-up" comment)
- CLAUDE.md Gotcha #8 (slice 28 update paragraph mentioning "Known CI gap" — to trim)
- Slice 3 `--allow-deactivations=N` CLI-flag precedent

**Key findings from planning-time investigation:**

- CLI guard at line 226 (post slice 28 Task 4 fix): `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {`
- Existing flag parsing pattern: `process.argv.find(a => a.startsWith('--allow-deactivations='))` — ad-hoc, no commander dep
- `ingestStateOfficials` already accepts `minStateHouseCount?: number` + `minStateSenateCount?: number` opts (lines 53-54). Defaults: 4500 / 1800.
- `FIXTURE_DIR` constant in test file: `join(__dirname, 'fixtures', 'openstates-people')`
- `exactOptionalPropertyTypes: true` enforced — must use spread-conditional pattern for optional opt fields (slice 26 + slice 28 precedent)
- Slice 28's "deferred to follow-up slice" comment in ci.yml lives in the diagnostic step block (4 lines of comment above `run:`)

**Decision points the implementer makes at scaffold:**

1. **Task batching** — Tasks 1 + 2 are atomic + small + independent. Implementer may dispatch as 2 separate or 1 combined task. Default plan ships 3 separate tasks for cleanest per-task review.
2. **JSDoc placement** — above the CLI guard block (matches existing convention from other ingest files).
3. **Test placement** — append to existing `describe('ingestStateOfficials', ...)` block OR add as a new `describe('fixture-mode behavior', ...)` block. Choice depends on existing test organization; match local convention.

---

## File Structure

### Modified files (4)
```
packages/db/supabase/seed/state-officials-ingest.ts                    Task 1 (CLI flag + JSDoc)
packages/db/supabase/seed/state-officials-ingest.test.ts               Task 1 (+1 test case)
.github/workflows/ci.yml                                                Task 2 (add step + clean comment)
CLAUDE.md                                                                Task 3 (Gotcha #8 trim)
```

**Total touched: 4 files.** Compressed-Slice tier.

---

## Task 1: `--fixture-mode` CLI flag + test

**Files:**
- Modify: `packages/db/supabase/seed/state-officials-ingest.ts`
- Modify: `packages/db/supabase/seed/state-officials-ingest.test.ts`

- [ ] **Step 1: Read the current CLI guard block** at `state-officials-ingest.ts:225-245`

```bash
sed -n '225,245p' packages/db/supabase/seed/state-officials-ingest.ts
```

Expected (post slice 28 Task 4):
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

If the actual code differs, adapt the diff in Step 2.

- [ ] **Step 2: Apply the JSDoc + flag-parsing patch**

Add the JSDoc block above the CLI guard, and extend the parsing inside it:

```diff
+/**
+ * CLI entry point.
+ *
+ * Supported flags:
+ * - `--allow-deactivations=N` — acknowledge an expected mass deactivation
+ *   (slice 3 pattern). N must exactly match the unexpected-deactivation count.
+ * - `--fixture-mode` — bypass pre-flight thresholds (minStateHouseCount +
+ *   minStateSenateCount set to 0). For CI / smoke runs against the bundled
+ *   `seed/fixtures/openstates-people/` dir (6 YAML files; far below the
+ *   production thresholds 4500/1800). Production runs MUST NOT use this flag.
+ */
 if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
   const allowDeactArg = process.argv.find(a => a.startsWith('--allow-deactivations='))
   const allowDeactivations = allowDeactArg
     ? parseInt(allowDeactArg.split('=')[1] ?? '0', 10)
     : undefined
-  ingestStateOfficials(allowDeactivations !== undefined ? { allowDeactivations } : {})
+  const fixtureMode = process.argv.includes('--fixture-mode')
+  ingestStateOfficials({
+    ...(allowDeactivations !== undefined ? { allowDeactivations } : {}),
+    ...(fixtureMode ? { minStateHouseCount: 0, minStateSenateCount: 0 } : {}),
+  })
     .then(s => { console.log(JSON.stringify(s, null, 2)); process.exit(0) })
     .catch(e => { console.error(e); process.exit(2) })
 }
```

The spread-conditional pattern keeps `exactOptionalPropertyTypes: true` happy (slice 26 + slice 28 precedent). When NO flag is set, the call is `ingestStateOfficials({})` — equivalent to the old code.

- [ ] **Step 3: Add the test case**

Read the existing test file to find the right `describe` block + the `FIXTURE_DIR` constant location. Append the following test inside the existing `describe('ingestStateOfficials', ...)` block (or wherever existing fixture-related tests live):

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

This validates the SAME path the CLI flag triggers (testing argv parsing directly is brittle per slice 28 Task 4 observation; the CLI guard is dead code in test paths).

If the existing tests already cover this path indirectly (e.g., happy-path test uses small fixture dir + likely hits the same code branch), then the new test is still valuable as an EXPLICIT assertion of the fixture-mode behavior. Don't skip it.

- [ ] **Step 4: Run scoped tests + typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-officials-ingest
pnpm -r typecheck
```

Expected: 8 → 9 tests in `state-officials-ingest.test.ts` (assuming existing test count is 8 per slice 28 records); typecheck 11/11 green.

If existing test count differs from 8, just report the new total (it should be old+1).

- [ ] **Step 5: Smoke-test the CLI flag end-to-end**

```bash
pnpm db:reset
pnpm seed:state-officials --fixture-mode 2>&1 | tail -20
```

Expected: ingest runs to completion + prints final stats JSON. NO pre-flight threshold error.

Compare against without-flag invocation (which should fail pre-flight):

```bash
pnpm db:reset
pnpm seed:state-officials 2>&1 | tail -10
# Expected: pre-flight error "lower=4 (min 4500)" or similar
```

If both behave as expected, the flag works correctly.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-officials-ingest.ts \
        packages/db/supabase/seed/state-officials-ingest.test.ts
git commit -m "$(cat <<'EOF'
feat(seed): slice 29 task 1 — --fixture-mode CLI flag for state-officials

Slice 27 audit Section 10 recommendation: catch consumer-side normalize
regressions by running seed:state-officials in CI. Slice 28 deferred
this because the 6-file bundled fixtures dir can't satisfy production
pre-flight thresholds (lower>=4500, upper+legislature>=1800).

This commit adds --fixture-mode CLI flag that sets minStateHouseCount=0
+ minStateSenateCount=0 when passed. JSDoc above the CLI guard warns
that production runs MUST NOT use this flag (silent safety bypass).

Test added: explicit assertion that min-count-zero behavior path runs
cleanly against bundled FIXTURE_DIR (4 lower + 2 upper YAML files).
Validates the same path the CLI flag triggers.

Spread-conditional pattern (slice 26 + slice 28 precedent) keeps
exactOptionalPropertyTypes happy.

Slice 29 Task 2 wires the new flag into ci.yml.

Per spec: docs/superpowers/specs/2026-05-26-state-officials-fixture-mode-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: CI wiring — add step + clean stale comment

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the current `db` job structure**

```bash
grep -n "name:\|run:\|env:" .github/workflows/ci.yml | head -40
```

Identify:
- Where `seed:tiger` step runs
- Where the slice 28 diagnostic step runs (with the stale "deferred follow-up" comment)
- The convention for step indentation + env block

- [ ] **Step 2: Add new step + clean stale comment**

Two edits in the same file:

**Edit 1 (add new step):** insert after the `seed:tiger` step + before the diagnostic step:

```yaml
- name: Run state-officials ingest (fixture mode)
  run: pnpm seed:state-officials --fixture-mode
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Match existing indentation + env block style.

**Edit 2 (clean stale comment):** remove the 4-line comment block above the diagnostic step's `run:`. The comment text per slice 28 ci.yml:
```
# `seed:state-officials` itself is skipped in CI because its pre-flight
# thresholds (lower>=4500, upper+legislature>=1800) exceed what the
# 6-file bundled fixtures dir can satisfy. Wiring a fixture-mode flag
# is deferred to a follow-up slice.
```

After removal, the diagnostic step is just:
```yaml
- name: Verify state-leg district format
  run: pnpm --filter @chiaro/db diagnose:state-leg-district-format
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

- [ ] **Step 3: Validate YAML well-formedness**

```bash
node -e "const y=require('js-yaml'); const f=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); y.load(f); console.log('valid yaml')"
```

If `js-yaml` isn't in `node_modules`, install via `pnpm` cache or use a different validator (e.g. `yq` if installed, or visual review + `grep -c "^      - name:"` to confirm step count increased by 1).

If neither works, just visually inspect the diff:
```bash
git diff .github/workflows/ci.yml
```

Confirm indentation is correct + no extra spaces.

- [ ] **Step 4: Commit Task 2**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: slice 29 task 2 — add seed:state-officials --fixture-mode step

Slice 28 deferred wiring seed:state-officials into CI (commit
e7448c3) because the pre-flight thresholds (lower>=4500,
upper+legislature>=1800) exceeded fixture-dir capacity. Slice 29
Task 1 added a --fixture-mode CLI flag that bypasses the thresholds.

This commit adds the CI step after seed:tiger + before the slice 28
diagnostic step:
- name: Run state-officials ingest (fixture mode)
  run: pnpm seed:state-officials --fixture-mode

Removes the slice 28 stale "deferred follow-up" comment above the
diagnostic step (now obsolete).

Closes slice 27 audit Section 10 test-gap recommendation: CI now
catches BOTH producer-side format drift (slice 28 diagnostic) AND
consumer-side normalize/upsert regressions (this step).

CI execution time impact: +5-10s (6-file fixture ingest is fast).

Per spec: docs/superpowers/specs/2026-05-26-state-officials-fixture-mode-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Closure — CLAUDE.md Gotcha #8 trim + memory

**Files:**
- Modify: `CLAUDE.md` (trim Gotcha #8 "Known CI gap" paragraph)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice29_state_officials_fixture_mode.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Trim CLAUDE.md Gotcha #8 "Known CI gap" sentence(s)**

Find the "Update (slice 28, 2026-05-26)" paragraph in CLAUDE.md Gotcha #8. The relevant sentences (per slice 28 closure commit `1bbe999`):

```
**Known CI gap:** `seed:state-officials` was not added to CI in slice 28 — its
pre-flight thresholds (lower≥4500, upper+legislature≥1800) exceed what the
current fixture dir can satisfy; the CLI has no fixture-mode override flag.
Deferred to a follow-up slice that wires up a fixture-mode flag OR adds full
OpenStates YAML cache to CI.
```

Replace those sentences with a brief closure note OR remove entirely. Recommended replacement:

```
**CI coverage (slice 29):** `seed:state-officials --fixture-mode` runs in CI's
db job after `seed:tiger` + before the diagnostic step, catching consumer-side
normalize/upsert regressions.
```

This keeps the slice 28 history intact while showing the gap closed.

- [ ] **Step 2: Write memory file**

Use Write with absolute path `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice29_state_officials_fixture_mode.md`:

```markdown
---
name: project-chiaro-slice29-state-officials-fixture-mode
description: Slice 29 — seed:state-officials --fixture-mode CLI flag + CI wiring
metadata:
  type: project
---

Slice 29 shipped 2026-05-26 — merged locally to master as squash `<squash SHA>`. Compressed-Slice (~4 files). Closes slice 27 audit Section 10 last open recommendation + slice 28 "Known CI gap" carryover.

**What shipped:**
- `--fixture-mode` CLI flag on `state-officials-ingest.ts`. Sets minStateHouseCount=0 + minStateSenateCount=0 when passed. Production safety: default invocation unchanged (4500/1800 thresholds).
- JSDoc above CLI guard documenting `--fixture-mode` + warning against production use.
- CI step `seed:state-officials --fixture-mode` after `seed:tiger` in the db job.
- Cleaned slice 28 stale "deferred follow-up" comment in ci.yml diagnostic step.
- CLAUDE.md Gotcha #8 "Known CI gap" paragraph trimmed to "CI coverage (slice 29)" closure note.

**Durable lessons:**

1. **Sidecar CLI flag pattern for CI consumption.** When a production CLI has safety guards that prevent CI runs (pre-flight thresholds, dry-run modes, idempotency-only paths), adding a single semantic flag (`--fixture-mode`, `--ci-mode`, etc.) is cleaner than parametrizing every guard. The flag opts into a known set of bypasses + the JSDoc documents the production-safety implication. Mirrors slice 3 `--allow-deactivations=N` precedent.

2. **Test the BEHAVIOR path, not the CLI parser.** Slice 28 Task 4 already established that argv-parsing tests are brittle cross-platform + the CLI guard is dead code in test paths. Slice 29 Task 1 tests `ingestStateOfficials({ minStateHouseCount: 0, minStateSenateCount: 0 })` directly — the same path the CLI triggers. This is the load-bearing assertion.

3. **Producer + consumer CI coverage closes a bug class.** Slice 28 added the producer-side diagnostic (TIGER format). Slice 29 adds the consumer-side ingest (normalize + upsert). Together they catch regressions in either direction of the slice 27 format-mismatch bug class. Pattern: when a producer/consumer schema bug is fixed, BOTH sides need CI assertions.

4. **Stale CI comments become technical debt.** Slice 28 left a "deferred to follow-up slice" comment that became misleading the moment slice 29 closed it. Comments referring to future work should either link to a tracked issue (would resolve when closed) OR get cleaned up by the slice that closes the gap. Slice 29 cleaned it explicitly.

**Active follow-ups (operator):**
- party_unity_state real implementation (slice 5F carryover — oldest)
- Schedule D/E/F/G FD walkers (slice 26 carryover)
- LCV-OR + PP × 5 anti-bot probe (slice 11 carryover)
- NH multi-word handling Option 9.b/9.c reconsideration (slice 28 deferred — needs external NH gencourt data)
- Mobile DoD on-device smoke (blocked on EAS APK + Apple Developer credentials)
- Production-run instrumentation pass against slice 22/23/26 framework (operator schedules)
- Fixture expansion for CI: current 6 YAML files cover CA/MD/NE only; adding WY at-large + AK letter + NH coverage would catch more normalize branches in CI

**Master state at slice 29 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0055; pgTAP 428 plans (unchanged). @chiaro/db vitest: 856 → 857 (+1).

**Cross-links:** [[project-chiaro-slice27-state-leg-district-audit]] (audit origin — Section 10), [[project-chiaro-slice28-state-leg-district-fix]] (slice 28 carryover this slice closes), [[project-chiaro-slice26-federal-stock-disclosures]] (peer slice — also added CI step). Spec: `docs/superpowers/specs/2026-05-26-state-officials-fixture-mode-design.md`.
```

Post-merge, replace `<squash SHA>` placeholders with the actual squash commit hash per slice 14-28 precedent.

- [ ] **Step 3: Update `MEMORY.md` index** — append after slice 28 line:

```markdown
- [Chiaro slice 29 state-officials fixture-mode](project_chiaro_slice29_state_officials_fixture_mode.md) — Compressed-Slice (~4 files). Closes slice 27/28 audit's last open recommendation: --fixture-mode CLI flag bypasses pre-flight thresholds; CI now runs seed:state-officials --fixture-mode after seed:tiger. Producer + consumer sides both covered in CI now.
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck                                          # 11/11 green
pnpm --filter @chiaro/db exec vitest run                   # 856 → 857 (+1 new test)
pnpm --filter @chiaro/officials exec vitest run            # 43 (unchanged)
pnpm --filter @chiaro/officials-ui exec vitest run         # 276 (unchanged)
pnpm --filter @chiaro/web build                            # 12 routes (unchanged)
```

Optional CI yaml smoke:
```bash
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('OK')"
```

End-to-end smoke (already done in Task 1 Step 5; rerun if Tasks 1-2 were committed separately):
```bash
pnpm db:reset
pnpm seed:state-officials --fixture-mode 2>&1 | tail -5
```

Expected: ingest completes; final JSON stats printed; no pre-flight error.

- [ ] **Step 5: Commit Task 3** (CLAUDE.md only — memory files outside repo)

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 29 closure — Gotcha #8 trim + CI gap closed

Slice 29 closes slice 27 audit Section 10 + slice 28 "Known CI gap"
carryover:
- --fixture-mode CLI flag added (Task 1)
- CI step seed:state-officials --fixture-mode (Task 2)
- Gotcha #8 paragraph trimmed: "Known CI gap" → "CI coverage (slice 29)"

After this slice: CI catches both producer-side format drift
(slice 28 diagnostic) AND consumer-side normalize/upsert
regressions. No deferred audit recommendations remain.

@chiaro/db vitest: 856 → 857 (+1). pgTAP unchanged at 428.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo — do NOT git add them.)

**Constraints:**
- Don't push to remote.
- Don't skip git hooks.
- Don't modify any CLAUDE.md section beyond the Gotcha #8 paragraph trim.
- DO NOT commit memory files.

---

## Workspace verify gate (recap)

After all 3 tasks complete:

```bash
pnpm -r typecheck                                              # 11/11 green
pnpm --filter @chiaro/db exec vitest run                       # 857 tests
pnpm --filter @chiaro/officials exec vitest run                # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run             # 276 unchanged
pnpm --filter @chiaro/web build                                # 12 routes
git log master..HEAD --oneline                                 # 5 commits (spec + plan + 3 task commits)
```

---

## Self-review notes

### Spec coverage

- ✅ Task 1 (CLI flag + JSDoc) — matches spec Components Task 1
- ✅ Task 2 (test case) — folded into Task 1 per atomic-file-set grouping
- ✅ Task 3 (CI wiring) — matches spec Components Task 3, becomes plan Task 2
- ✅ Task 4 (closure) — matches spec Components Task 4, becomes plan Task 3

Plan consolidates spec's 4 tasks into 3 dispatchable units (Tasks 1+2 grouped because they touch the same 2 files). Equivalent surface; cleaner dispatch.

### Placeholder scan

`<squash SHA>` placeholders in memory file (filled post-merge per slice 14-28 precedent). No TBD/TODO.

### Type consistency

`process.argv.includes('--fixture-mode')` returns boolean. Spread-conditional `(fixtureMode ? { minStateHouseCount: 0, minStateSenateCount: 0 } : {})` matches `exactOptionalPropertyTypes` (slice 26 + slice 28 precedent).

`ingestStateOfficials({ ... })` opts param shape — `minStateHouseCount?: number` + `minStateSenateCount?: number` already declared (lines 53-54 in current `state-officials-ingest.ts`).

### Known incomplete details

- Exact line numbers in `state-officials-ingest.ts` may differ slightly from planning-time observations (lines 225-245); implementer reads + adapts at scaffold.
- ci.yml diff lines depend on slice 28's exact step ordering; implementer matches local convention.
- Existing test count (currently 8) may differ if other slices add tests in parallel; report empirical post-fix count.

### Subagent decomposition (per Gotcha #25 — sequential implementers)

Tasks 1 → 2 → 3 dispatched serially. Each is small; minimal review overhead. Tasks 1 + 2 could be batched if the implementer judges the spec/code alignment to be tight enough.

### Audit-driven workflow closure

Slice 27 audit → slice 28 fix (producer side) → slice 29 fix (consumer side). After slice 29: zero deferred audit recommendations remain. Pattern validates the audit-tier workflow for catching production bugs early.
