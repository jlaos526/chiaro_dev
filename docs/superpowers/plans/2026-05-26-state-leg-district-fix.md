# Slice 28 — State-leg district format alignment + ancillaries implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per CLAUDE.md Gotcha #25: implementer subagents MUST run sequentially.

**Goal:** Ship the slice 27 audit-recommended Option A fix (align `state-leg-config.ts` normalize to TIGER's `${state}-{SS|SH}-${num}` format) plus bundled ancillaries (WY at-large patch, Windows CLI fix, CI gap closure, pgTAP test gap, NH option pick).

**Architecture:** 6 tasks. Tasks 1-4 are independent + small (can ship in any order; total ~6 files). Task 5 (NH live sample + CI job) blocks on `seed:tiger` background completion. Task 6 is closure.

**Tech Stack:** Existing only. No workspace dep changes. No schema migrations.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-26-state-leg-district-fix-design.md`
- `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md` (Sections 8 + 9 + 11 are load-bearing for slice 28 decisions)
- `packages/db/supabase/seed/state-leg-config.ts` (current normalize function)
- `packages/db/supabase/seed/state-leg-config.test.ts` (assertions to rewrite)
- `packages/db/supabase/seed/state-officials-ingest.ts:80-110` + `:220-235` (lookup + CLI guard)
- `packages/db/supabase/seed/state-officials-ingest.test.ts:15-35` (fixtures to rewrite)
- `packages/db/supabase/seed/tiger-config.ts:48-75` (TIGER state-leg + at-large convention)
- `packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts` (slice 27 deliverable; gets called by new CI step)
- CLAUDE.md Gotcha #6 (TIGER flake-tolerance), Gotcha #8 (current NH limitation framing — to be rewritten)
- `.github/workflows/ci.yml` (CI structure for Task 5e)

**Key findings from planning-time investigation:**

- `tiger-config.ts:50,68` strips leading zeros: `String(props.SLDUST).replace(/^0+/, '') || '0'`. So SLDUST `'015'` → `'15'`, `'00'` → `'0'`. Task 2 changes the `'00'` case to emit `'AL'` (mirror line 34).
- `tiger-config.ts:53` emits `${state}-SS-${sldu}`; line 71 emits `${state}-SH-${sldl}`.
- `state-leg-config.ts:43-75` `normalizeStateLegDistrictCode` currently returns format that doesn't match TIGER (the slice 27 audit's CONFIRMED bug).
- `state-officials-ingest.ts:226` Windows CLI guard:
  ```ts
  if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ```
  Fails on Windows because `fileURLToPath` returns `C:\...` with backslashes while `process.argv[1]` from `pnpm` may have forward-slash or mixed path separators. Task 4 uses reverse direction: `import.meta.url === pathToFileURL(process.argv[1]).href`.
- The slice 27 diagnostic script at `packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts` checks format only (not unmatched count). CI step in Task 5 calls it via `pnpm --filter @chiaro/db exec tsx ...` path.
- `state-leg-config.test.ts` exists at the path; check its current shape at scaffold to know what tests to rewrite.

**Decision points the implementer makes at scaffold:**

1. **NH option pick (Task 5c)** — depends on what `seed:tiger` produces for NH SLDL/SLDU codes. Criteria documented in Task 5c.
2. **Task batching** — Tasks 1-4 are atomic + independent; implementer may dispatch them as 1 batched task OR 4 separate tasks. Default plan ships 4 separate tasks for cleaner per-task review.
3. **Windows CLI test** — Task 4 ships the fix; whether to add an automated unit test is a judgment call (cross-platform mocking is brittle).

---

## File Structure

### Created files (1-3)
```
packages/db/supabase/tests/state_leg_district_format.test.sql                NEW (Task 3)
[Optional NH-related new files conditional on Task 5 outcome]
```

### Modified files (5-7)
```
packages/db/supabase/seed/state-leg-config.ts                                Task 1 (+ Task 5d conditional)
packages/db/supabase/seed/state-leg-config.test.ts                           Task 1 (+ Task 5d conditional)
packages/db/supabase/seed/state-officials-ingest.test.ts                     Task 1 (fixtures)
packages/db/supabase/seed/tiger-config.ts                                    Task 2 (WY at-large)
packages/db/supabase/seed/state-officials-ingest.ts                          Task 4 (Windows CLI)
.github/workflows/ci.yml                                                      Task 5e (new step)
CLAUDE.md                                                                     Task 6 (Gotcha #8 rewrite)
```

**Total touched: 8-12 files.** Compressed-to-Mega-Slice tier.

---

## Task 1: Option A normalize alignment

**Files:**
- Modify: `packages/db/supabase/seed/state-leg-config.ts`
- Modify: `packages/db/supabase/seed/state-leg-config.test.ts`
- Modify: `packages/db/supabase/seed/state-officials-ingest.test.ts`

- [ ] **Step 1: Update `state-leg-config.ts` `normalizeStateLegDistrictCode`**

Read the current function (lines 43-75). Replace with the spec's Task 1 code block:

```ts
function chamberPrefix(chamber: OpenStatesOrgClassification): 'SS' | 'SH' {
  // 'upper' + 'legislature' (NE unicameral) → SS; 'lower' → SH
  // Mirrors state-officials-ingest.ts:94-97 tier mapping.
  return chamber === 'lower' ? 'SH' : 'SS'
}

export function normalizeStateLegDistrictCode(
  state: string,
  chamber: OpenStatesOrgClassification,
  rawDistrict: string,
): string | null {
  if (!isStateChamberSupported(state, chamber)) return null
  const prefix = chamberPrefix(chamber)

  if (rawDistrict.toLowerCase() === 'at-large') return `${state}-${prefix}-AL`

  if (STATES_KNOWN_UNNORMALIZABLE.has(state)) return null

  if (STATES_MULTIMEMBER_LETTER_SUFFIX.has(state)) {
    const numericPart = rawDistrict.match(/^\d+/)?.[0]
    if (!numericPart) return null
    return `${state}-${prefix}-${numericPart.replace(/^0+/, '') || '0'}`
  }

  if (STATES_LETTER_ONLY_DISTRICTS.has(state)) {
    if (!/^[A-Z]+$/.test(rawDistrict)) return null
    return `${state}-${prefix}-${rawDistrict}`
  }

  if (!/^\d+$/.test(rawDistrict)) return null
  return `${state}-${prefix}-${rawDistrict.replace(/^0+/, '') || '0'}`
}
```

The `chamberPrefix` helper goes immediately above `normalizeStateLegDistrictCode`.

- [ ] **Step 2: Update `state-leg-config.test.ts`** assertions to new format.

Read the current file. For each test case, update the expected return value from `STATE-N` to `STATE-{SS|SH}-N`. Add NEW test cases for:
- WY at-large lower → `'WY-SH-AL'`
- WY at-large upper → `'WY-SS-AL'`
- NE legislature (unicameral) → `'NE-SS-23'`
- AK letter lower → `'AK-SH-A'`
- AK letter upper → `'AK-SS-B'`
- MD multi-member lower (`'1A'`) → `'MD-SH-1'`
- Leading-zero stripping: `'05'` lower → `'CA-SH-5'`; `'01'` upper → `'CA-SS-1'`

Each test:
```ts
expect(normalizeStateLegDistrictCode('CA', 'lower', '15')).toBe('CA-SH-15')
expect(normalizeStateLegDistrictCode('WY', 'lower', 'At-Large')).toBe('WY-SH-AL')
```

- [ ] **Step 3: Update `state-officials-ingest.test.ts:17-35`** fixture inserts:

```diff
       ('state_house',       'CA', 'CA-15', 'CA AD 15',
+      ('state_house',       'CA', 'CA-SH-15', 'CA AD 15',
       ...
       ('state_senate',      'CA', 'CA-08', 'CA SD 8',
+      ('state_senate',      'CA', 'CA-SS-8', 'CA SD 8',
       ...
       ('state_senate', 'NE', 'NE-23', 'NE District 23',
+      ('state_senate', 'NE', 'NE-SS-23', 'NE District 23',
       ...
       ('state_house',       'MD', 'MD-01', 'MD HD 01',
+      ('state_house',       'MD', 'MD-SH-1', 'MD HD 01',
```

Note the MD case: TIGER strips leading zero, so `'MD-01'` becomes `'MD-SH-1'` (zero-strip applied).

- [ ] **Step 4: Run scoped tests + typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-leg-config state-officials-ingest
pnpm -r typecheck
```

Expected: all updated cases pass; typecheck 11/11 green.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-leg-config.ts \
        packages/db/supabase/seed/state-leg-config.test.ts \
        packages/db/supabase/seed/state-officials-ingest.test.ts
git commit -m "$(cat <<'EOF'
fix(seed): slice 28 task 1 — align state-leg normalize to TIGER format

Slice 27 audit confirmed state-leg-config.ts:73-74 returned STATE-N
while tiger-config.ts:53,71 wrote STATE-{SS|SH}-N. All 49 non-NH
state legislators silently unmatched in production.

This commit applies Option A from
docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md:
- chamberPrefix() helper: 'lower' → SH; 'upper'+'legislature' → SS
- All normalize branches embed prefix
- Strip leading zeros (matches tiger-config.ts:50 replace(/^0+/, ''))
- WY at-large now emits {state}-{SS|SH}-AL
- AK letter retains letter form; MD multi-member strips suffix

Tests updated to new format including new cases for WY at-large +
AK letter + NE unicameral + MD multi-member + leading-zero strip.

Fixtures in state-officials-ingest.test.ts updated to TIGER format
(CA-SH-15 etc.) — closes the slice 5C test-fixture-vs-producer
anti-pattern documented in audit Section 7.

Per spec: docs/superpowers/specs/2026-05-26-state-leg-district-fix-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: WY at-large TIGER patch

**Files:**
- Modify: `packages/db/supabase/seed/tiger-config.ts`

- [ ] **Step 1: Patch `tiger-config.ts:48-55`** (state_senate)

```diff
     extract: (props, stateFipsHint) => {
       const stateFp = stateFipsHint ?? String(props.STATEFP)
-      const sldu = String(props.SLDUST).replace(/^0+/, '') || '0'
+      const slduRaw = String(props.SLDUST)
+      const sldu = slduRaw === '00' ? 'AL' : (slduRaw.replace(/^0+/, '') || '0')
       const state = fipsToState.get(stateFp)
       if (!state) return null
       const code = `${state}-SS-${sldu}`
       const name = String(props.NAMELSAD ?? `${state} Senate District ${sldu}`)
       return { code, state, name }
     },
```

- [ ] **Step 2: Patch `tiger-config.ts:66-74`** (state_house) — same pattern with `SLDLST` → `sldlRaw`:

```diff
     extract: (props, stateFipsHint) => {
       const stateFp = stateFipsHint ?? String(props.STATEFP)
-      const sldl = String(props.SLDLST).replace(/^0+/, '') || '0'
+      const sldlRaw = String(props.SLDLST)
+      const sldl = sldlRaw === '00' ? 'AL' : (sldlRaw.replace(/^0+/, '') || '0')
       const state = fipsToState.get(stateFp)
       if (!state) return null
       const code = `${state}-SH-${sldl}`
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm -r typecheck
```

11/11 green. No new tests needed — Task 3 pgTAP covers the WY-{SS,SH}-AL pattern.

- [ ] **Step 4: Commit Task 2**

```bash
git add packages/db/supabase/seed/tiger-config.ts
git commit -m "$(cat <<'EOF'
fix(seed): slice 28 task 2 — WY at-large TIGER patch (00 → AL)

tiger-config.ts:50,68 stripped leading zeros producing 'WY-SS-0' /
'WY-SH-0' for SLDUST/SLDLST = '00'. The federal_house case (line 34)
correctly emits 'AL' for '00'. Align state legislative cases.

Post-fix:
- SLDUST='00' → 'WY-SS-AL'  (was 'WY-SS-0')
- SLDLST='00' → 'WY-SH-AL'  (was 'WY-SH-0')

Existing WY rows in any live DB will UPDATE on next seed:tiger run
(districts.code primary key change is handled by UPSERT). Document
in slice 28 closure that re-seed is required for full alignment.

Per audit Section 8 caveat:
docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pgTAP format assertion

**Files:**
- Create: `packages/db/supabase/tests/state_leg_district_format.test.sql`

- [ ] **Step 1: Create the pgTAP test file**

Verbatim from spec Task 3 code block (`plan(4)`). Use the existing pgTAP convention (`begin; ... rollback;` envelope; cite migration / audit at top).

```sql
-- Slice 28: assert TIGER state-leg district code format consistency.
-- Pairs with slice 27 audit (docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md)
-- and the Option A normalize alignment in state-leg-config.ts.
-- Runs against post-seed:tiger data (per Gotcha #6 prerequisite).
-- Trivially passes against db:reset-only state (zero rows).

begin;
select plan(4);

-- 1. All state_senate codes match the TIGER format
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_senate' and code !~ '^[A-Z]{2}-SS-([0-9]+|AL|[A-Z])$' $$,
  ARRAY[0],
  'state_senate codes all match ^[A-Z]{2}-SS-(num|AL|letter)$'
);

-- 2. All state_house codes match the TIGER format
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_house' and code !~ '^[A-Z]{2}-SH-([0-9]+|AL|[A-Z])$' $$,
  ARRAY[0],
  'state_house codes all match ^[A-Z]{2}-SH-(num|AL|letter)$'
);

-- 3. No state_senate codes without the SS prefix
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_senate' and code not like '%-SS-%' $$,
  ARRAY[0],
  'state_senate: zero rows lack -SS- prefix'
);

-- 4. No state_house codes without the SH prefix
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_house' and code not like '%-SH-%' $$,
  ARRAY[0],
  'state_house: zero rows lack -SH- prefix'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Verify pgTAP green**

```bash
pnpm db:test
```

Expected: 424 → 428 plans. All 4 new plans pass (trivially against empty state_senate/state_house in `db:reset`-only mode; will pass against real data post-seed-tiger if the format is consistent).

- [ ] **Step 3: Commit Task 3**

```bash
git add packages/db/supabase/tests/state_leg_district_format.test.sql
git commit -m "$(cat <<'EOF'
test(db): slice 28 task 3 — pgTAP state-leg district code format

+4 plans (424 → 428):
1. state_senate codes match ^[A-Z]{2}-SS-(num|AL|letter)$
2. state_house codes match ^[A-Z]{2}-SH-(num|AL|letter)$
3. Zero state_senate rows lack -SS- prefix
4. Zero state_house rows lack -SH- prefix

Closes test gap flagged in slice 27 audit Section 10. Catches
future format drift early (e.g. if someone reverts state-leg-config
or tiger-config emits new formats).

Per Gotcha #6: runs against post-seed:tiger data; trivially passes
against db:reset-only state.

Per spec: docs/superpowers/specs/2026-05-26-state-leg-district-fix-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Windows CLI fix

**Files:**
- Modify: `packages/db/supabase/seed/state-officials-ingest.ts`

- [ ] **Step 1: Read the current import line + CLI guard**

```bash
grep -n "fileURLToPath\|pathToFileURL\|process\.argv\[1\]" packages/db/supabase/seed/state-officials-ingest.ts
```

Expected: line near top imports `fileURLToPath` from `node:url`; line ~226 uses it in the CLI guard.

- [ ] **Step 2: Replace the import and guard**

```diff
-import { fileURLToPath } from 'node:url'
+import { pathToFileURL } from 'node:url'
```

```diff
-if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
+if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
```

**Why this works cross-platform:** `pathToFileURL('C:\\Users\\...\\state-officials-ingest.ts')` produces a normalized `file:///C:/Users/.../state-officials-ingest.ts` URL that matches `import.meta.url`'s format exactly. The reverse direction (`fileURLToPath`) is fragile because path separator normalization differs between Windows and Linux at the path level.

- [ ] **Step 3: Verify typecheck + smoke**

```bash
pnpm -r typecheck
# On Windows: smoke test the CLI works (no DB hit needed; just argv detection)
node -e "console.log(require('url').pathToFileURL(process.argv[1] || '/x').href)" "C:\test.ts"
```

If `fileURLToPath` is used elsewhere in `state-officials-ingest.ts` (not the CLI guard), DO NOT remove the import unconditionally. Check via grep first.

- [ ] **Step 4: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-officials-ingest.ts
git commit -m "$(cat <<'EOF'
fix(seed): slice 28 task 4 — Windows CLI silent no-op (slice 27 ancillary)

Slice 27 audit found `pnpm seed:state-officials` silently no-ops on
Windows. Root cause: state-officials-ingest.ts:226 used
`fileURLToPath(import.meta.url) === process.argv[1]`, which fails
on Windows due to path separator + drive-letter case normalization
mismatches between `fileURLToPath` output and pnpm's argv[1].

Reverse the comparison direction: `import.meta.url === pathToFileURL(
process.argv[1]).href`. `pathToFileURL` always produces a normalized
file:/// URL matching `import.meta.url`'s shape, so the equality
works cross-platform.

This is the canonical Node.js cross-platform CLI-entry-point pattern;
see https://nodejs.org/api/url.html#urlpathtofileurlpath

No DB or schema changes. Tests unaffected.

Per audit ancillary finding:
docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md
(Section 4.4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: NH live sample + CI job

**Files:**
- Run: `pnpm seed:tiger` (background; may flake per Gotcha #6)
- Modify: `packages/db/supabase/seed/state-leg-config.ts` (conditional: only if NH Option 9.b or 9.c picked)
- Modify: `packages/db/supabase/seed/state-leg-config.test.ts` (conditional: only if NH branch added)
- Modify: `.github/workflows/ci.yml` (REQUIRED: add seed:state-officials step)

### Task 5a: Start `seed:tiger` in background (do this FIRST, immediately on Task 5 entry)

- [ ] **Step 1: Start the background seed**

```bash
# Run in background; takes 5-15 min; may flake per Gotcha #6
pnpm seed:tiger
```

Use `run_in_background=true` on the Bash tool call. You'll get notified when it completes (success OR Census-flake-fail). Continue with Task 5b reading + Task 5e CI work while it runs.

### Task 5b: Sample NH SLDL/SLDU codes

- [ ] **Step 1: Wait for `seed:tiger` to complete (notified)**

If the seed succeeded (even partially), query NH:

```bash
node -e "const{Client}=require('pg');(async()=>{
  const c=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});
  await c.connect();
  const sh = await c.query(\"select code, name from public.districts where state='NH' and tier='state_house' order by code limit 25\");
  const ss = await c.query(\"select code, name from public.districts where state='NH' and tier='state_senate' order by code limit 25\");
  console.log('-- NH state_house sample --');
  console.log(JSON.stringify(sh.rows, null, 2));
  console.log('-- NH state_senate sample --');
  console.log(JSON.stringify(ss.rows, null, 2));
  await c.end();
})().catch(e=>{console.error(e);process.exit(1)})"
```

Capture output for decision in Task 5c.

If `seed:tiger` flaked + NH has zero rows → skip to Task 5c with "Option 9.a fallback" branch.

### Task 5c: NH option pick (decision point)

- [ ] **Step 1: Decide NH option based on observed format**

Looking at the Task 5b output:

- **TIGER NH SLDL codes are numeric only** (e.g. `NH-SH-1`, `NH-SH-2`, ..., `NH-SH-400`):
  → Pick **Option 9.b (numeric-only TIGER alignment)**. Implementation requires mapping OpenStates `"Rockingham 5"` → TIGER's numeric district number. This is non-trivial without an external NH gencourt data source. If a static lookup table or simple county+number → district-number mapping isn't immediately derivable from the TIGER data itself, defer to Option 9.a + flag as slice 29 work.

- **TIGER NH SLDL codes are county-aware** (e.g. `NH-SH-Rockingham-5` or `NH-SH-Rockingham_5`):
  → Pick **Option 9.c (county-aware codes)**. Implementation: add an NH-specific branch in `normalizeStateLegDistrictCode` that produces matching format from OpenStates' `"Rockingham 5"`.

- **`seed:tiger` flaked OR NH has zero rows**:
  → Pick **Option 9.a (status quo)**. No code change to NH branch. Document defer in closure.

- [ ] **Step 2: Implement the picked option**

**If Option 9.a (default fallback):** No state-leg-config.ts changes for NH. Remove NH from `STATES_KNOWN_UNNORMALIZABLE`? NO — keep it. Status quo means NH normalize still returns null and ingest skips NH legislators (424 unmatched, documented).

**If Option 9.b:** Add NH branch in `normalizeStateLegDistrictCode` BEFORE the `STATES_KNOWN_UNNORMALIZABLE` check (so NH no longer skips):

```ts
if (state === 'NH') {
  const m = rawDistrict.match(/^(\w+)\s+(\d+)$/)
  if (!m) return null
  // Map county+number → TIGER district number. If no static mapping
  // available, return null (NH stays effectively in Option 9.a).
  const tigerNum = nhCountyNumberToTigerDistrict(m[1], parseInt(m[2], 10))
  if (!tigerNum) return null
  return `${state}-${prefix}-${tigerNum}`
}
```

Static mapping table (if discoverable from TIGER name field comparison) lives in a new constant block at the top of `state-leg-config.ts`. If not discoverable in-slice, defer to Option 9.a.

**If Option 9.c:** Add NH branch with county-aware format:

```ts
if (state === 'NH') {
  const m = rawDistrict.match(/^(\w+)\s+(\d+)$/)
  if (!m) return null
  return `${state}-${prefix}-${m[1]}-${m[2]}`
}
```

Note: this code precedes `STATES_KNOWN_UNNORMALIZABLE.has(state)` check. Remove NH from that set to enable the new branch.

- [ ] **Step 3: Update `state-leg-config.test.ts`** with NH cases for the picked option (if 9.b or 9.c).

- [ ] **Step 4: Verify typecheck + scoped tests**

```bash
pnpm --filter @chiaro/db exec vitest run state-leg-config
pnpm -r typecheck
```

### Task 5d: (Optional intermediate commit for NH)

If you picked 9.b or 9.c and implemented:

```bash
git add packages/db/supabase/seed/state-leg-config.ts \
        packages/db/supabase/seed/state-leg-config.test.ts
git commit -m "$(cat <<'EOF'
fix(seed): slice 28 task 5d — NH multi-word district handling (Option 9.{b|c})

Replaces with actual option text. E.g.:

NH OpenStates district names ("Rockingham 5", "Hillsborough 23")
were previously returned as null by normalize and skipped by
state-officials-ingest. Sampled TIGER NH SLDL data shows [observed
format]; implementing [9.b: numeric-only mapping] OR
[9.c: county-aware codes].

NH branch precedes STATES_KNOWN_UNNORMALIZABLE check; NH removed
from that set since the branch handles it.

[If 9.b with deferred static-mapping:]
The static county+number → TIGER district mapping was not derivable
in-slice from TIGER alone; deferred to slice 29+. NH effectively
stays in Option 9.a status quo for now.

[If 9.c:]
Format: NH-{SS|SH}-County-Number (e.g. NH-SH-Rockingham-5).

Tests updated with NH cases. Audit Section 9 option pick documented
in slice 28 closure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Option 9.a (status quo): no code commit; document defer in Task 6 closure.

### Task 5e: CI job — add seed:state-officials step (REQUIRED regardless of NH outcome)

- [ ] **Step 1: Read `.github/workflows/ci.yml`** to find the `db` job structure.

```bash
cat .github/workflows/ci.yml
```

Locate the `db` job section. Find where `seed:tiger` runs + where `db:test` runs.

- [ ] **Step 2: Add new steps after `seed:tiger`** (and before `db:test` to ensure state-officials runs against fresh districts):

```yaml
- name: Run state-officials ingest
  run: pnpm seed:state-officials
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

- name: Verify state-leg district format
  run: pnpm --filter @chiaro/db exec tsx supabase/seed/diagnostics/state-leg-district-format-check.ts
```

The exact YAML structure depends on the existing job's step pattern (check indentation + naming convention). Match the existing convention.

If `seed:state-officials` requires fixtures or env vars not currently in CI, document in Task 6 closure that the CI run will use whatever fixture path the script defaults to (slice 5C convention).

- [ ] **Step 3: Verify CI yaml is well-formed**

```bash
# Quick syntax check; doesn't run CI
grep -c "^- name:" .github/workflows/ci.yml
```

Or use the `yaml` library if available:

```bash
node -e "const y=require('js-yaml'); console.log('OK'); const f=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); y.load(f); console.log('valid yaml')"
```

- [ ] **Step 4: Commit Task 5e**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: slice 28 task 5e — run seed:state-officials + diagnostic in CI

Slice 27 audit Section 5 flagged that CI never ran
state-officials-ingest against post-seed:tiger data, masking the
slice 27 format mismatch bug.

Add two steps to the db job:
1. Run pnpm seed:state-officials (against the fresh seeded TIGER
   district data + OpenStates fixtures)
2. Run the slice 27 diagnostic script
   (diagnose:state-leg-district-format) which exit-codes nonzero
   on TIGER format mismatches.

Catches future regressions to state-leg-config.ts ↔ tiger-config.ts
format alignment.

[If NH Option 9.a fallback:] CI tolerates ~424 NH unmatched
legislators; diagnostic script only flags format mismatches, not
unmatched counts.

Per audit Section 10 test-gap recommendation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Closure — CLAUDE.md Gotcha #8 rewrite + memory

**Files:**
- Modify: `CLAUDE.md` (Gotcha #8 rewrite)
- Create (outside repo): `~/.claude/projects/.../memory/project_chiaro_slice28_state_leg_district_fix.md`
- Modify (outside repo): `~/.claude/projects/.../memory/MEMORY.md`

- [ ] **Step 1: Read the current Gotcha #8** in CLAUDE.md and the audit doc Section 11 proposed rewrite text. Apply the rewrite verbatim.

The current Gotcha #8 lists 8 sub-bullets about state-legislator data sources. Audit Section 11 proposes integrating the format alignment outcome into the relevant sub-bullet (likely the NH-multi-word one) or adds a new sub-bullet about the format.

After rewriting, also append a NOTE clarifying which NH option was picked in slice 28 (9.a / 9.b / 9.c). E.g.:

```markdown
   **Update (slice 28, 2026-05-26):** The format mismatch documented in
   slice 27 audit is FIXED. `state-leg-config.ts` now emits
   `STATE-{SS|SH}-N` matching `tiger-config.ts:53,71`. Test fixtures
   updated to TIGER format. pgTAP `state_leg_district_format.test.sql`
   asserts format consistency. CI now runs `seed:state-officials`
   after `seed:tiger` + asserts via the slice 27 diagnostic script.
   Windows CLI silent no-op fixed (`pathToFileURL` round-trip).
   WY at-large state-leg districts now emit `WY-{SS|SH}-AL`.
   **NH multi-word handling:** [picked 9.a / 9.b / 9.c — fill empirically].
```

- [ ] **Step 2: Write memory file**

Use Write tool with absolute path `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice28_state_leg_district_fix.md`. Template:

```markdown
---
name: project-chiaro-slice28-state-leg-district-fix
description: Slice 28 — state-leg district format alignment + ancillaries (slice 27 audit fix)
metadata:
  type: project
---

Slice 28 shipped 2026-05-26 — merged locally to master as squash `<squash SHA>`. Compressed-to-Mega-Slice (~8-12 files). Ships the slice 27 audit Option A fix + bundled ancillaries.

**What shipped:**
- Option A normalize alignment: `state-leg-config.ts` emits `${state}-{SS|SH}-${num}` matching TIGER. All 49 non-NH state legislators now correctly match district_id in production.
- WY at-large patch: `tiger-config.ts:50,68` emits `WY-{SS|SH}-AL` for SLDUST/SLDLST = `'00'` (mirrors federal_house line 34).
- pgTAP `state_leg_district_format.test.sql` (+4 plans; 424 → 428). Asserts format consistency against post-seed:tiger data.
- Windows CLI fix at `state-officials-ingest.ts:226` — replaced `fileURLToPath` forward direction with `pathToFileURL(argv[1]).href === import.meta.url` reverse. Cross-platform.
- CI job: new steps in `.github/workflows/ci.yml` db job run `seed:state-officials` + invoke slice 27 diagnostic script after `seed:tiger`. Catches future format drift.
- NH option pick: [fill empirically from Task 5c — 9.a / 9.b / 9.c].
- CLAUDE.md Gotcha #8 rewritten per audit Section 11.

**Durable lessons:**

1. **The format-alignment pattern.** When two seed-side modules write/read codes that should match (TIGER writer ↔ state-leg-config reader), the canonical fix is to align the consumer to the producer — not vice versa. State-leg-config (consumer) was rewritten to emit TIGER's actual format; TIGER's `'00' → '0'` quirk got the small `'AL'` patch for at-large parity. Avoids cascade reads from other code paths that may depend on the producer format.

2. **Audit-tier → implementation-tier transitions.** Slice 27 audit's empirical findings (two-arm live test) directly informed slice 28's scope without further investigation. The 11-section audit structure (background, code evidence, reproduction, findings, CI evidence, impact, why tests didn't catch, recommended fix, NH options, test gaps, Gotcha update) is the right shape for follow-on slices to consume.

3. **Windows CLI guard pattern: pathToFileURL reverse direction.** Canonical Node.js cross-platform check is `import.meta.url === pathToFileURL(process.argv[1]).href` — NOT `fileURLToPath(import.meta.url) === process.argv[1]`. The reverse direction normalizes path separators + URL encoding consistently. Apply to any future CLI guard.

4. **pgTAP format regex assertion.** `code !~ '^[A-Z]{2}-(SS|SH)-(...)$'` style assertions catch future format drift cheaply (4 plans). Use this pattern for any constraint not enforceable via column CHECK (e.g. inter-row format consistency, regex semantics that PostgreSQL CHECK doesn't model cleanly).

5. **CI gap closure pattern.** Slice 27 found that `seed:state-officials` was never in CI. Slice 28 added it after `seed:tiger`. Audit-time recommendation → next-slice CI step. For any seed in `packages/db/supabase/seed/*-ingest.ts`, audit whether it's actually in CI before adding new dependencies.

[Add lesson 6 if NH Option 9.b/9.c picked and surfaced something specific.]

**Active follow-ups (operator):**
- [If NH Option 9.a status quo: NH multi-word handling — defer until Census stable + can sample live TIGER NH SLDL]
- Add unmatched-count threshold assertion in CI diagnostic (audit Section 10 recommendation; slice 28 covers format only)
- Schedule D/E/F/G FD walkers (slice 26 carryover)
- LCV-OR + PP × 5 anti-bot probe (slice 11 carryover)
- party_unity_state real implementation (slice 5F carryover)
- Mobile DoD on-device smoke (blocked on EAS APK + Apple Developer credentials)

**Master state at slice 28 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0055; pgTAP 424 → 428 plans (+4). @chiaro/db vitest 855 → ~862 (+5-7). @chiaro/officials-ui: 276 (unchanged).

**Cross-links:** [[project-chiaro-slice5c-state-officials]] (state-leg-config origin), [[project-chiaro-slice27-state-leg-district-audit]] (the audit this slice closes), [[project-chiaro-tiger-ingest]] (tiger-config), [[project-chiaro-slice26-federal-stock-disclosures]] (Gotcha #27 peer pattern). Audit: `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`.
```

Fill bracketed placeholders based on actual Task 5c NH pick + Task 1-5 outcomes.

- [ ] **Step 3: Update `MEMORY.md` index** — append after slice 27 line:

```markdown
- [Chiaro slice 28 state-leg district fix](project_chiaro_slice28_state_leg_district_fix.md) — Compressed-to-Mega-Slice (~10 files). Closes slice 27 audit: Option A normalize alignment to TIGER STATE-{SS|SH}-N format + WY at-large patch + pgTAP format assertion (+4 plans) + Windows CLI fix + CI seed:state-officials step + NH Option [9.a|9.b|9.c]. Gotcha #8 rewritten.
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm db:reset
pnpm db:test                                     # 428 plans
pnpm --filter @chiaro/db exec vitest run         # ~862
pnpm --filter @chiaro/officials exec vitest run  # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run  # 276
pnpm --filter @chiaro/web build                  # 12 routes
```

Optional smoke: if `seed:tiger` completed in Task 5a:
```bash
pnpm seed:state-officials                        # verify post-format-fix behavior
pnpm --filter @chiaro/db exec tsx supabase/seed/diagnostics/state-leg-district-format-check.ts  # exit 0
```

- [ ] **Step 5: Commit Task 6** (CLAUDE.md only — memory files outside repo)

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 28 closure — Gotcha #8 rewrite + audit Section 11 implementation

Slice 28 ships the slice 27 audit's recommended Option A fix +
ancillaries:
- state-leg-config emits TIGER STATE-{SS|SH}-N format
- WY at-large patches tiger-config (00 → AL)
- pgTAP +4 plans (424 → 428) asserting format consistency
- Windows CLI fixed (pathToFileURL reverse direction)
- CI runs seed:state-officials + diagnostic exit-code check

NH multi-word handling: [9.a / 9.b / 9.c — fill empirically].

CLAUDE.md Gotcha #8 rewritten per audit Section 11.

@chiaro/db vitest: 855 → ~862 (+5-7); pgTAP 424 → 428 (+4).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Workspace verify gate (recap)

After all 6 tasks complete:

```bash
pnpm -r typecheck                              # 11/11 green
pnpm db:reset                                  # apply 0001-0055
pnpm db:test                                   # 428 plans green (+4)
pnpm --filter @chiaro/db exec vitest run       # ~862 tests
pnpm --filter @chiaro/officials exec vitest run  # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run  # 276
pnpm --filter @chiaro/web build                # 12 routes
git log master..HEAD --oneline                 # 6-8 commits (spec + plan + 4-6 task commits)
```

---

## Self-review notes

### Spec coverage

- ✅ Task 1 (Option A normalize alignment) — matches spec Components Task 1
- ✅ Task 2 (WY at-large TIGER patch) — matches spec Components Task 2
- ✅ Task 3 (pgTAP format assertion) — matches spec Components Task 3 with verbatim SQL
- ✅ Task 4 (Windows CLI fix) — matches spec Components Task 4
- ✅ Task 5 (NH live sample + CI job) — matches spec Components Task 5 with conditional branches for 9.a/9.b/9.c
- ✅ Task 6 (closure) — matches spec Components Task 6 + verify gate

### Placeholder scan

Plan contains intentional bracketed placeholders in commit messages + memory file for Task 5 NH option pick — the implementer fills empirically. `<squash SHA>` per slice 14-27 precedent.

### Type consistency

`pathToFileURL` import from `'node:url'` matches `state-officials-ingest.ts`'s existing import style. `OpenStatesOrgClassification` type used in `chamberPrefix` is already exported from `state-leg-config.ts`.

### Known incomplete details

- Task 5c NH option pick depends on observed TIGER NH SLDL format (live data). Plan provides 3 explicit branches; implementer picks one.
- Task 5b CLI YAML structure depends on existing ci.yml step patterns; implementer matches local convention.
- Task 5b NH Option 9.b implementation may defer to 9.a fallback if static mapping isn't derivable in-slice. Plan documents the escape hatch.

### Subagent decomposition (per Gotcha #25 — sequential implementers)

Tasks 1 → 2 → 3 → 4 → 5 → 6. Task 5a (background `seed:tiger`) starts EARLY when Task 5 is entered so it overlaps with the YAML editing in 5e + the NH sample wait in 5b.

If implementer judges Tasks 1-4 as one logical unit, may dispatch as a single combined implementer task (matches their atomic + independent nature). Default sequential dispatch is fine.

### Audit-tier execution note

This slice ships code changes (not audit-only). Two-stage review (spec compliance + code quality) applies per slice 26 precedent. Reviewers should verify against the spec + the slice 27 audit recommendations.
