# Slice 27 — State-leg district format audit implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md Gotcha #25: implementer agents MUST run sequentially.

**Goal:** Verify whether the `tiger-config.ts` ↔ `state-leg-config.ts` format mismatch is a real production bug; document findings + impact + recommended slice 28 fix shape.

**Architecture:** Audit-tier slice. 3 tasks: live reproduction (DB sample + stats), code analysis (file path trace + CI workflow review), then audit-doc synthesis. Closes with optional CLAUDE.md Gotcha update + memory.

**Tech Stack:** Read-only investigation + audit-doc writing. Optional TS diagnostic script (only if implementer judges it reusable for slice 28). No workspace deps changes.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-26-state-leg-district-format-audit-design.md`
- `packages/db/supabase/seed/tiger-config.ts` (lines 37-75 — state legislative district code construction)
- `packages/db/supabase/seed/state-leg-config.ts` (entire file, ~75 lines)
- `packages/db/supabase/seed/state-officials-ingest.ts:80-110` (district lookup query)
- `packages/db/supabase/seed/state-officials-ingest.test.ts:15-32` (fixture seeding)
- `.github/workflows/ci.yml` (CI jobs + seed scripts)
- CLAUDE.md Gotcha #8 (current NH limitation framing)

**Key findings from planning-time investigation:**

- `tiger-config.ts:53` emits state senate code as `${state}-SS-${sldu}` where `sldu` strips leading zeros (e.g., SLDUST=`'015'` → `'15'` → `'CA-SS-15'`).
- `tiger-config.ts:71` emits state house code as `${state}-SH-${sldl}` (e.g., `'CA-SH-12'`).
- `state-leg-config.ts:73-74` (default branch in `normalizeStateLegDistrictCode`) returns `${state}-${rawDistrict.padStart(2, '0')}` (e.g., `'CA-15'`).
- `state-officials-ingest.ts:99-104` does an exact-match lookup on `code = $1 and tier = $2`. If TIGER writes `'CA-SS-15'` but normalize returns `'CA-15'`, the lookup misses.
- `state-officials-ingest.test.ts:17-32` fixtures insert districts with `'CA-15'`, `'CA-08'`, `'NE-23'`, `'MD-01'` — matching the **normalize output**, not the production TIGER format. Tests pass by construction but don't validate against real seed data.
- Local DB after `pnpm db:reset` (without `seed:tiger`) has zero `state_senate` / `state_house` rows. CI's `seed:tiger` step would write the real TIGER format.

**Decision points the implementer makes at scaffold:**

1. **Run `seed:tiger` locally?** Long-running (5-15 min); flaky Census endpoint. If the operator can run it, live reproduction is definitive; if not, audit ships with code-path-analysis-only findings + a flag for slice 28 to start with live repro.
2. **Ship the optional diagnostic script?** Decide based on whether the SQL is non-trivial enough to warrant reuse. Rule of thumb: if the audit doc has >50 lines of embedded SQL, hoist to a TS script.
3. **Update CLAUDE.md Gotcha #8?** Only if findings confirm the bug. Skip if findings are inconclusive (e.g., CI has a workaround we missed).

---

## File Structure

### Created (1-3 files depending on decisions)
```
docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md    REQUIRED
packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts OPTIONAL
```

### Modified (1 file conditional)
```
CLAUDE.md   CONDITIONAL — only if audit confirms the bug
```

**Total touched: 1-3 files.** Audit-tier slice.

---

## Task 1: Live reproduction + DB inspection

**Files:** none created in this task (output captured for Task 2 to embed in audit doc).

- [ ] **Step 1: Verify local Supabase is running**

```bash
pnpm db:start  # idempotent if already running
```

If this is the first session, wait for the local stack to come up (~30s).

- [ ] **Step 2: Apply migrations + reset clean state**

```bash
pnpm db:reset
```

Expected: applies 0001-0055 cleanly. State tables empty.

- [ ] **Step 3: Decide on TIGER seed (decision point #1)**

If you can spare ~5-15 min of background time:

```bash
# Background long-running TIGER seed; let it complete while you do Task 2 reading.
# Use run_in_background=true on the Bash tool call so you get notified when done.
pnpm seed:tiger
```

If Census endpoint flakes (Gotcha #6), the seed may partial-complete with some states missing. Document in audit doc + use whatever data lands.

If you can NOT run `seed:tiger`:
- Skip live reproduction; mark Task 1 Step 4 + Step 5 as "code-path-analysis only" in the audit doc.
- Note in audit doc Risk section: "Live reproduction not performed; recommend slice 28 begin with `pnpm seed:tiger` to verify."

- [ ] **Step 4: Inspect actual TIGER-seeded district code formats (IF Step 3 ran)**

Capture this SQL output for the audit doc:

```bash
node -e "const{Client}=require('pg');(async()=>{
  const c=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});
  await c.connect();
  const r=await c.query(\`
    select tier, state, substring(code from 1 for 8) as code_pattern, count(*) as n
    from public.districts
    where tier in ('state_senate','state_house')
    group by tier, state, code_pattern
    order by tier, state, code_pattern
    limit 30
  \`);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e=>{console.error(e);process.exit(1)})"
```

Expected (if format mismatch is real): output shows codes like `CA-SS-1`, `CA-SH-1`, `NY-SS-12`, etc. NO codes like `CA-15` / `CA-08` (those are test-fixture-only).

Save to scratch file `/tmp/tiger-district-sample.txt` (not committed).

- [ ] **Step 5: Run state-officials ingest (IF Step 3 ran)**

OpenStates YAML repo data is what slice 5C uses. Either via fixtures or live data:

```bash
# Check whether state-officials seed exists + flags
grep -E '"seed:state-officials"' packages/db/package.json
```

If the script exists, run it and capture stats:

```bash
pnpm seed:state-officials 2>&1 | tee /tmp/state-officials-stats.txt
```

Look for `unmatchedDistricts` count in the output. Expected (if mismatch is real): count is large (~7000+ — total state legislators across 49 non-NH states).

If state-officials seed requires fixtures or env vars not available:
- Skip; audit doc records "ingest not run live" + documents what stats would show via fixture sample.

- [ ] **Step 6: Sample legislator district_id NULL counts (IF Step 5 ran)**

```bash
node -e "const{Client}=require('pg');(async()=>{
  const c=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});
  await c.connect();
  const r=await c.query(\`
    select chamber, state,
           count(*) total,
           count(district_id) populated,
           count(*) - count(district_id) null_count
    from public.officials
    where chamber in ('state_senate','state_house','state_legislature')
    group by chamber, state
    order by chamber, null_count desc
    limit 30
  \`);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e=>{console.error(e);process.exit(1)})"
```

Capture output for audit doc.

- [ ] **Step 7: No commit required for Task 1**

Findings are scratch data feeding Task 2. Don't commit anything.

---

## Task 2: Code analysis + CI evidence + audit-doc draft

**Files:**
- Create: `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`

- [ ] **Step 1: Read all relevant source files + capture code excerpts**

```bash
# These are the load-bearing references for the audit doc
# Implementer reads each + extracts the relevant lines + cites file:line in the doc
cat packages/db/supabase/seed/tiger-config.ts        # Focus on lines 37-75 (state-leg sections)
cat packages/db/supabase/seed/state-leg-config.ts    # Entire file
cat packages/db/supabase/seed/state-officials-ingest.ts | head -120
cat packages/db/supabase/seed/state-officials-ingest.test.ts | head -50
```

- [ ] **Step 2: Read CI workflow + check for state-officials in CI**

```bash
cat .github/workflows/ci.yml
```

Look for:
- Does any job run `pnpm seed:state-officials` (or equivalent)?
- Does any job assert on `unmatchedDistricts` count?
- What's the pgTAP coverage for state-leg districts? (Already established: `tiger_ingest.test.sql` only counts states; doesn't assert format.)

Capture the relevant CI yaml snippet + the missing-test observation for the audit doc.

- [ ] **Step 3: Write the audit doc**

Use the structure from the spec (11 sections). Use the captured findings from Task 1 + Task 2 Step 1-2 to fill each section.

Each code citation must include file:line. Each SQL output must show actual numbers (or `"live repro not performed"` if Task 1 was code-only).

**Section weight guidance:**
- Background + Observed Mismatch (sections 1-2): ~50 lines each, code-citation heavy
- Reproduction Steps (section 3): ~30 lines, the exact commands implementer ran
- Findings (section 4): ~50-100 lines depending on Task 1 outcomes
- CI Evidence (section 5): ~20-30 lines
- Impact Assessment (section 6): ~30-50 lines
- Why Tests Didn't Catch (section 7): ~20 lines (meta-lesson)
- Recommended Fix (section 8): ~40-60 lines (3 options with pros/cons)
- NH Multi-Word Options (section 9): ~20-30 lines (3 options)
- Test Gaps (section 10): ~15-20 lines
- Slice 5C Gotcha #8 Update Suggestion (section 11): ~10-15 lines (proposed edit text)

Total: ~300-450 lines of audit doc.

- [ ] **Step 4: Decide on optional diagnostic script (decision point #2)**

After drafting sections 3-4 of the audit doc, look at the SQL queries embedded. If the queries total >50 lines or if you anticipate slice 28 will rerun them:

**SHIP the diagnostic script.** Create `packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Slice 27 audit diagnostic: prints state-leg district code patterns
 * + legislator district_id NULL counts. Run against local Supabase
 * after `pnpm seed:tiger` (and optionally `pnpm seed:state-officials`)
 * to verify the format mismatch documented in
 * docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md.
 *
 * Exit code 0 if NO mismatch detected; non-zero if codes don't match
 * the TIGER ${state}-SS-${num} / ${state}-SH-${num} format.
 */
import { Client } from 'pg'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    // 1. District code format check
    const codes = await client.query<{ tier: string; code_pattern: string; n: number }>(`
      select tier, substring(code from 1 for 6) as code_pattern, count(*)::int as n
      from public.districts
      where tier in ('state_senate','state_house')
      group by tier, code_pattern
      order by tier, code_pattern
    `)
    console.log('-- District code patterns --')
    console.table(codes.rows)

    // 2. Legislator district_id NULL counts per chamber
    const legs = await client.query<{ chamber: string; total: number; populated: number; null_count: number }>(`
      select chamber,
             count(*)::int as total,
             count(district_id)::int as populated,
             (count(*) - count(district_id))::int as null_count
      from public.officials
      where chamber in ('state_senate','state_house','state_legislature')
      group by chamber
      order by chamber
    `)
    console.log('-- Legislator district_id population --')
    console.table(legs.rows)

    // 3. Exit code: nonzero if any state_senate/state_house district code is missing SS/SH
    const malformed = await client.query<{ n: number }>(`
      select count(*)::int as n
      from public.districts
      where (tier = 'state_senate' and code not like '%-SS-%')
         or (tier = 'state_house'  and code not like '%-SH-%')
    `)
    const malformedCount = malformed.rows[0]?.n ?? 0
    if (malformedCount > 0) {
      console.error(`\nFAIL: ${malformedCount} district rows with non-TIGER-format codes.`)
      process.exit(1)
    }
    console.log(`\nOK: all state-leg districts use TIGER format.`)
  } finally {
    await client.end()
  }
}

main().catch(err => { console.error(err); process.exit(2) })
```

Add a CLI script entry in `packages/db/package.json`:

```diff
  "scripts": {
+   "diagnose:state-leg-district-format": "tsx supabase/seed/diagnostics/state-leg-district-format-check.ts",
    ...
```

**SKIP the diagnostic script** if the audit doc's SQL is short + you don't anticipate slice 28 reuse. Document in audit doc Risk section the decision.

- [ ] **Step 5: Commit Task 2 deliverable**

```bash
git add docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md
# Optional script:
# git add packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts packages/db/package.json
git commit -m "$(cat <<'EOF'
audit: slice 27 — state-leg district format mismatch findings

[Replace this paragraph with the audit's actual top-level finding
once Task 2 completes. Examples:
- "Confirmed: tiger-config writes STATE-SS-N / STATE-SH-N but
  state-leg-config.ts:73-74 returns STATE-N; all 49 non-NH state
  legislators fail district_id lookup in production."
- "Inconclusive: live reproduction blocked by Census endpoint
  flakes; code-path analysis suggests mismatch; slice 28 should
  re-verify."]

Sections:
1. Background
2. Observed mismatch (code evidence)
3. Reproduction steps
4. Findings (live or code-path-only)
5. CI evidence
6. Impact assessment
7. Why tests didn't catch
8. Recommended slice 28 fix (3 options)
9. NH multi-word options (3 options)
10. Test gaps
11. Gotcha #8 update suggestion

[If diagnostic script shipped: add bullet noting the new
diagnose:state-leg-district-format script + its exit-code contract.]

Per spec: docs/superpowers/specs/2026-05-26-state-leg-district-format-audit-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

The implementer fills in the bracketed paragraphs based on actual findings.

---

## Task 3: Closure — optional CLAUDE.md Gotcha update + memory

**Files:**
- Modify: `CLAUDE.md` (CONDITIONAL — only if findings confirm bug)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice27_state_leg_district_audit.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Decide whether to update CLAUDE.md Gotcha #8 (decision point #3)**

Read the audit's Findings section. If findings empirically confirm the bug (live reproduction OR conclusive code-path analysis), append to Gotcha #8:

```markdown
   **Update (slice 27 audit, 2026-05-26):** The "NH multi-word" framing above understates the issue. `tiger-config.ts:53,71` writes state legislative district codes as `STATE-SS-N` / `STATE-SH-N`, but `state-leg-config.ts:73-74` returns `STATE-N` (no prefix). All 49 non-NH states are affected — state-officials-ingest silently unmatches every legislator. Slice 5C tests fixtures used the normalize format (`CA-15`) which masked the production-TIGER format (`CA-SS-15`). See `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`. Slice 28 will ship the fix.
```

If findings are inconclusive, defer the Gotcha update to slice 28.

- [ ] **Step 2: Write memory file**

Use Write tool with absolute path `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice27_state_leg_district_audit.md`. Template:

```markdown
---
name: project-chiaro-slice27-state-leg-district-audit
description: Slice 27 — state-leg district format audit (tiger ↔ state-leg-config mismatch verification)
metadata:
  type: project
---

Slice 27 shipped 2026-05-26 — merged locally to master as squash `<squash SHA>`. Audit-tier slice (1-3 files). [REPLACE BRACKET WITH AUDIT'S TOP-LEVEL FINDING.]

**What shipped:**
- Audit doc at `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`
[- Optional: diagnostic script `packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts` (if shipped)]
[- Optional: CLAUDE.md Gotcha #8 update (if findings confirmed bug)]

**Durable lessons:**

1. **Integration test fixtures that diverge from production-seed-data format mask production failures.** Slice 5C's `state-officials-ingest.test.ts:17-30` seeded fixtures with `CA-15` codes — exactly matching the normalize output — instead of TIGER's actual `CA-SS-15` format. The unit tests passed by construction; production silently unmatched 49/50 states. The anti-pattern: fixtures generated by inspecting the consumer's expected input, NOT by sampling the producer's actual output. Future test design: fixtures should mirror what the producer (TIGER seed) actually writes, OR run a separate integration test against post-seed data.

2. **Audit-first pays off when the bug surface is large but the discovery cost is small.** Slice 27 was a ~1-hour-of-LLM-time audit; if findings confirmed the bug, slice 28 ships a 6-8 file fix vs. the original plan's 3-file NH patch. Validates Gotcha #20 (stub-shipping requires per-pair URL verification) generalizes to "format-translation requires producer/consumer alignment verification."

3. **TIGER state-leg district codes use SS/SH prefix.** `tiger-config.ts:53,71` writes `${state}-SS-${num}` / `${state}-SH-${num}`. Any code consuming these must match the format. Document in CLAUDE.md if Gotcha #8 update lands.

[Add empirical lesson 4 if findings surface something specific, e.g.
"NH actually IS unique even in TIGER — its multi-word districts
require a different mapping strategy than other states."]

**Active follow-ups (operator):**
- Slice 28 ships the fix per audit recommendation (likely Option A: change normalize to emit SS/SH)
- NH multi-word handling decision (audit doc presents 3 options)
- pgTAP test asserting state-leg district code format (audit Test Gaps recommendation)
- LCV-OR + PP × 5 anti-bot probe (slice 11 carryover)
- party_unity_state real implementation (slice 5F carryover)
- Schedule D/E/F/G FD walkers (slice 26 carryover)

**Master state at slice 27 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0055; pgTAP 424 plans (unchanged — audit-only). Test counts unchanged.

**Cross-links:** [[project-chiaro-slice5c-state-officials]] (state-leg-config origin), [[project-chiaro-tiger-ingest]] (tiger-config origin), [[project-chiaro-slice18-bug-fix-tooling-refactors]] (test-fixture-vs-production divergence parallel — slice 18 Task 2 tsconfig.seed.json gap pattern), [[project-chiaro-slice26-federal-stock-disclosures]] (Gotcha #27 ON CONFLICT partial-index — peer production-defect class caught at review). Audit: `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`.
```

Fill the bracketed placeholders based on actual findings.

- [ ] **Step 3: Update `MEMORY.md` index** — append after slice 26 line:

```markdown
- [Chiaro slice 27 state-leg district format audit](project_chiaro_slice27_state_leg_district_audit.md) — Audit-tier (1-3 files). Verified tiger-config writes STATE-SS-N / STATE-SH-N but state-leg-config.ts returns STATE-N — [confirmed bug | inconclusive] affecting [49 non-NH states | TBD]. Slice 28 ships the fix.
```

Fill bracketed text based on findings.

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck                                # If diagnostic script shipped: 11/11 green
pnpm --filter @chiaro/db exec vitest run         # No changes; 855 tests stay green
```

Expected: typecheck 11/11; vitest unchanged. No pgTAP changes (audit-only).

If diagnostic script shipped:
```bash
# Smoke-test the diagnostic script (requires Task 1 Step 3 to have run seed:tiger)
pnpm --filter @chiaro/db exec tsx supabase/seed/diagnostics/state-leg-district-format-check.ts
```

Expected (if format mismatch confirmed): non-zero exit code + mismatch printed.

- [ ] **Step 5: Commit Task 3 deliverables**

If CLAUDE.md was updated:

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 27 closure — Gotcha #8 update from state-leg district audit

Audit confirmed the format mismatch documented in
docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md.

Gotcha #8 (slice 5C "NH multi-word" framing) materially understated
the issue: all 49 non-NH states are affected by the same format
mismatch between tiger-config and state-leg-config.

Slice 28 ships the fix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If CLAUDE.md was NOT updated (inconclusive findings), no commit. Just note in the audit doc that slice 28 begins with live reproduction.

---

## Workspace verify gate (recap)

After all 3 tasks complete:

```bash
pnpm -r typecheck                                              # 11/11 (unchanged or +1 if script shipped)
pnpm --filter @chiaro/db exec vitest run                       # 855 tests (unchanged)
pnpm --filter @chiaro/officials-ui exec vitest run             # 276 tests (unchanged)
pnpm --filter @chiaro/web build                                # 12 routes (unchanged)
git log master..HEAD --oneline                                 # 2-3 commits (spec + audit doc + optional CLAUDE.md)
```

---

## Self-review notes

### Spec coverage

- ✅ Live reproduction (spec section "Architecture step 1") — Task 1
- ✅ Sample data inspection (spec step 2) — Task 1 Steps 4-6
- ✅ CI evidence review (spec step 3) — Task 2 Step 2
- ✅ Code-path trace (spec step 4) — Task 2 Step 1
- ✅ Impact assessment (spec step 5) — Task 2 Step 3 (audit doc section 6)
- ✅ Audit deliverable (spec step 6) — Task 2 Step 3 (entire doc)
- ✅ Optional diagnostic script — Task 2 Step 4 (decision point #2)
- ✅ Conditional CLAUDE.md update — Task 3 Step 1 (decision point #3)
- ✅ Memory file — Task 3 Step 2-3

### Placeholder scan

The plan intentionally contains bracketed placeholders in commit messages + memory file that the implementer fills with empirical findings (audit's actual top-level conclusion). This is correct for an audit slice — the synthesis content can't be pre-written.

`<squash SHA>` in memory file is the standard post-merge fill-in pattern (slice 14-26 precedent).

### Type consistency

Diagnostic script (if shipped) uses `pg.Client` matching `stock-watcher-ingest.ts` + `state-officials-ingest.ts` precedent. Connection-string default matches.

### Known incomplete details

- Audit doc's specific findings can't be pre-written; the plan provides structure + line-count guidance, the implementer fills in.
- Decision points (TIGER seed live? diagnostic ship? Gotcha update?) are explicit; the implementer chooses based on environment + findings.

### Subagent decomposition (per Gotcha #25)

Tasks 1 → 2 → 3 dispatched serially. Task 1 produces scratch data; Task 2 synthesizes; Task 3 closes.

If implementer dispatches differently (e.g., one big "do the audit" subagent), that's acceptable for an audit-tier slice — the work is investigation + writing, not implementation. Two-stage review (spec compliance + code quality) may collapse to one combined review for the audit doc itself.

### Audit-tier execution note

Per CLAUDE.md slice 24 precedent (audit-tier compressed-Slice), the audit doc IS the deliverable. The verify gate is doc-completeness + cross-link integrity + (if script shipped) typecheck. Squash-merge can be done by a single closure pass with no per-task implementer churn.

For very small audits, the implementer can collapse Tasks 1+2+3 into a single dispatched session that does live repro → write audit doc → commit. The 3-task structure here is the maximum decomposition; minimum is 1 task.
