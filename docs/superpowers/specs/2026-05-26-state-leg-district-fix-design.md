# Slice 28 — State-leg district format alignment + ancillaries design

**Status:** approved 2026-05-26 (verbal — brainstorming flow)
**Tier:** Compressed-to-Mega-Slice (~10-14 files)
**Builds on:** Slice 5C (state-officials identity + state-leg-config.ts origin), slice 27 audit (`docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md`).

## Goal

Ship the audit-recommended Option A fix (align `state-leg-config.ts` normalize to TIGER's `${state}-{SS|SH}-${num}` format) plus the bundled slice 27 ancillaries: WY at-large patch, Windows CLI no-op fix, CI gap closure, pgTAP test gap closure, and NH multi-word handling decision (live-data-dependent).

After this slice:
- All 49 non-NH state legislator district_id lookups succeed in production
- pgTAP asserts state-leg district code format
- CI runs `seed:state-officials` against post-`seed:tiger` data
- `pnpm seed:state-officials` works on Windows
- WY at-large state legislators (if any) match TIGER's `WY-{SS|SH}-AL`
- NH legislators either fully match (Option 9.b/9.c) or stay in documented Option 9.a status quo
- CLAUDE.md Gotcha #8 rewrite per audit Section 11

## Non-goals

- **No federal_house / federal_senate changes.** Federal district handling is correct; only state-leg paths change.
- **No schema migrations.** All changes are seed-side / TS surface.
- **No new workspace deps.**
- **No mobile / UI work.** Once `district_id` is correctly populated, existing officials-ui state cards work; nothing to add.
- **No re-ingest of historical OpenStates data.** The fix takes effect on next `seed:state-officials` run.
- **No restructure of `state-officials-ingest.ts`** beyond the Windows CLI fix.
- **No fix to other code paths flagged by audit Section 6** beyond what's needed for the format alignment (e.g. `fetchMyOfficials` already filters by `district_id IS NOT NULL`; post-fix it works without changes).

## Architecture

5 work-streams sequenced as 6 tasks:

```
Task 1 — Option A normalize alignment (3 files)
  packages/db/supabase/seed/state-leg-config.ts          MODIFY
  packages/db/supabase/seed/state-leg-config.test.ts     MODIFY
  packages/db/supabase/seed/state-officials-ingest.test.ts MODIFY (fixture districts)

Task 2 — WY at-large TIGER patch (1 file)
  packages/db/supabase/seed/tiger-config.ts              MODIFY (2-line: '00' → 'AL')

Task 3 — pgTAP format assertion (1 new file)
  packages/db/supabase/tests/state_leg_district_format.test.sql  NEW (~4 plans)

Task 4 — Windows CLI fix (1 file)
  packages/db/supabase/seed/state-officials-ingest.ts    MODIFY (pathToFileURL round-trip)

Task 5 — NH live sample + CI job (2-4 files conditional on NH outcome)
  (Live in-slice) seed:tiger background run
  (Live in-slice) SELECT NH state_house/state_senate codes
  packages/db/supabase/seed/state-leg-config.ts          MODIFY (NH branch if 9.b/9.c picked)
  packages/db/supabase/seed/state-leg-config.test.ts     MODIFY (NH cases if 9.b/9.c)
  .github/workflows/ci.yml                                MODIFY (add seed:state-officials step)

Task 6 — Closure (1 file + memory)
  CLAUDE.md                                               MODIFY (Gotcha #8 rewrite)
  memory file + MEMORY.md index                           (outside repo)
```

### File count

- Minimum (NH Option 9.a status quo, no NH-specific code changes): **8 files**
- Maximum (NH Option 9.b or 9.c with new branch + tests): **12 files**

Compressed-to-Mega-Slice tier.

### Mid-flight pivot policy

Task 5 has a built-in pivot:
- **`seed:tiger` completes cleanly + NH SLDL data lands** → sample NH codes → pick Option 9.b (numeric-only TIGER alignment) or 9.c (county-aware codes). Implement NH branch.
- **`seed:tiger` flakes (Census endpoint down)** → fall back to **Option 9.a (status-quo NH skip)**. Document the defer in closure; slice 29+ revisits.
- CI job ships in EITHER outcome (just runs against partial TIGER data if needed).

## Components

### Task 1 — Option A normalize alignment

**File:** `packages/db/supabase/seed/state-leg-config.ts`

Add a helper `chamberPrefix(chamber) → 'SS' | 'SH'` and update each branch in `normalizeStateLegDistrictCode` to embed it. Strip leading zeros (matching `tiger-config.ts:50`'s `replace(/^0+/, '') || '0'`).

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

**Test updates:**

`state-leg-config.test.ts` — current 50 lines of assertions on the OLD format. Rewrite to the NEW format. Add cases for:
- WY at-large lower → `WY-SH-AL`
- WY at-large upper → `WY-SS-AL`
- AK letter lower → `AK-SH-A`
- MD letter-suffix multi-member → `MD-SH-1` (from `1A`)
- Leading-zero stripping for various states (`'05'` → `'5'`)

`state-officials-ingest.test.ts:17-30` — rewrite fixture districts:
```ts
('state_house',  'CA', 'CA-SH-15', 'CA AD 15',  ...)
('state_senate', 'CA', 'CA-SS-8',  'CA SD 8',   ...)
('state_senate', 'NE', 'NE-SS-23', 'NE District 23', ...)
('state_house',  'MD', 'MD-SH-1',  'MD HD 01',  ...)
```

### Task 2 — WY at-large TIGER patch

**File:** `packages/db/supabase/seed/tiger-config.ts` lines 50 + 68:

```diff
-      const sldu = String(props.SLDUST).replace(/^0+/, '') || '0'
+      const slduRaw = String(props.SLDUST)
+      const sldu = slduRaw === '00' ? 'AL' : (slduRaw.replace(/^0+/, '') || '0')
```

Same for `sldl` at line 68. Mirrors federal_house at-large convention at line 34.

**No new tests** for this — Task 3's pgTAP format assertion covers the WY-{SS,SH}-AL pattern.

### Task 3 — pgTAP format assertion

**File:** `packages/db/supabase/tests/state_leg_district_format.test.sql`

`plan(4)`:

```sql
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

pgTAP delta: 424 → 428 (+4 plans).

**Note:** These plans only have value when run AFTER `seed:tiger` (per Gotcha #6 prerequisite). When run against `db:reset`-only state, all 4 plans pass trivially (zero rows in state_senate / state_house). The CI's `db` job runs `seed:tiger` before `db:test` so plans run against real data there.

### Task 4 — Windows CLI fix

**File:** `packages/db/supabase/seed/state-officials-ingest.ts:226`

Replace direct `process.argv[1]` comparison with `pathToFileURL` round-trip:

```diff
-import { fileURLToPath } from 'node:url'
+import { pathToFileURL } from 'node:url'
 ...
-if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
+if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
```

The reverse direction works cross-platform: `pathToFileURL('C:\\Users\\...\\state-officials-ingest.ts')` produces `'file:///C:/Users/.../state-officials-ingest.ts'` which matches `import.meta.url` exactly on both Windows and Linux. The forward direction (`fileURLToPath`) is fragile because path separators normalize differently across platforms when going URL → path.

**Test:** small unit test verifying `import.meta.url` round-trip works (skipped if too brittle; ancillary smoke can be operator-validated by running `pnpm seed:state-officials --help` on Windows post-fix).

### Task 5 — NH live sample + CI job

**5a. Background `seed:tiger`** — kick off early; ~5-15 min:

```bash
pnpm seed:tiger  # background; tolerate partial completion per Gotcha #6
```

**5b. Sample NH SLDL/SLDU data** (once seed:tiger has NH rows):

```sql
SELECT code FROM public.districts WHERE state='NH' AND tier='state_house' ORDER BY code LIMIT 20;
SELECT code FROM public.districts WHERE state='NH' AND tier='state_senate' ORDER BY code LIMIT 5;
```

**5c. Pick NH option based on observed format:**

- **If TIGER NH SLDL codes are numeric only (e.g. `NH-SH-1`, `NH-SH-2`, ...):** pick **Option 9.b**. Add per-county lookup table mapping OpenStates `"Rockingham 5"` → TIGER numeric code. May require fetching NH official district allocation table from `gencourt.state.nh.us` or hardcoding from a one-time scrape. Decide at scaffold based on complexity.
- **If TIGER NH SLDL codes are county-aware (e.g. `NH-SH-Rockingham-5`):** pick **Option 9.c**. Add NH-specific branch in `normalizeStateLegDistrictCode` that produces the matching format.
- **If `seed:tiger` flakes (no NH data):** pick **Option 9.a** (status quo). Document defer.

**5d. Implementation per pick:**

If 9.b — add NH branch:
```ts
if (state === 'NH') {
  const tigerDistrictNum = mapNhOpenStatesToTigerNum(rawDistrict)
  if (!tigerDistrictNum) return null
  return `${state}-${prefix}-${tigerDistrictNum}`
}
```

If 9.c — add NH branch with county-aware format:
```ts
if (state === 'NH') {
  const match = rawDistrict.match(/^(\w+)\s+(\d+)$/)
  if (!match) return null
  return `${state}-${prefix}-${match[1]}-${match[2]}`
}
```

If 9.a — no normalize change; `STATES_KNOWN_UNNORMALIZABLE.has('NH')` stays.

**5e. CI job addition** — `.github/workflows/ci.yml`. Find the `db` job; add a step after `seed:tiger`:

```yaml
- name: Run state-officials ingest
  run: pnpm seed:state-officials
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
    # OPENSTATES_API_KEY not required; ingest uses cached fixtures or YAML

- name: Verify state-leg district format
  run: pnpm --filter @chiaro/db exec tsx supabase/seed/diagnostics/state-leg-district-format-check.ts
```

CI threshold (if 9.a status quo): tolerate ~424 NH unmatched. The diagnostic script's existing exit-code logic only flags format mismatches, not unmatched legislators — so 9.a doesn't break the CI assertion.

### Task 6 — Closure

CLAUDE.md Gotcha #8 rewrite per audit Section 11. Memory file. MEMORY.md index. Final verify gate.

## Data flow

Format alignment is purely consumer-side. Post-fix:

```
OpenStates legislator → normalize emits new format → districts.code lookup matches → official.district_id populated
```

No new data sources. No new tables.

## Error handling

- **TIGER seed flake (Gotcha #6):** task 5 pivots to Option 9.a; remaining tasks unaffected.
- **NH live sample blocker:** explicit defer; document in closure + audit Section 9 update.
- **CI partial-completion:** new state-officials step runs against whatever districts landed; threshold counts adjust.
- **Existing pre-slice-28 production data:** post-fix, the next `seed:state-officials` run UPDATES `officials.district_id` for ~7400 legislators previously NULL. No data corruption; just newly-populated rows.

## Testing strategy

- **Unit tests:** state-leg-config.test.ts rewritten + at-large + AK + MD cases (5-10 new cases)
- **pgTAP:** state_leg_district_format.test.sql plan(4) (Task 3)
- **Integration smoke:** state-officials-ingest.test.ts continues to pass with fixture rewrites
- **CI smoke:** new step verifies the diagnostic script exit code (Task 5e)
- **Windows CLI smoke:** operator-validated (no automated test added in-slice; if implementer judges worthwhile, add a small unit test)

Expected test count delta:
- @chiaro/db vitest: 855 → ~862 (+5-7 new cases)
- pgTAP: 424 → 428 (+4)
- Other packages: unchanged

## Verify gate

```bash
pnpm -r typecheck                             # 11/11 green
pnpm db:reset                                 # apply 0001-0055
pnpm seed:tiger                               # if Census healthy; else partial OK
pnpm seed:state-officials                     # NEW: runs cleanly (or NH-skip in Option 9.a)
pnpm --filter @chiaro/db exec tsx supabase/seed/diagnostics/state-leg-district-format-check.ts  # exit 0
pnpm db:test                                  # 428 plans green
pnpm --filter @chiaro/db exec vitest run      # ~862 tests
pnpm --filter @chiaro/officials exec vitest run  # unchanged
pnpm --filter @chiaro/officials-ui exec vitest run  # unchanged (276)
pnpm --filter @chiaro/web build               # 12 routes green
```

## Risk + tradeoffs

1. **NH live sample is Census-flake-dependent.** Mitigation: explicit pivot to Option 9.a status quo if `seed:tiger` flakes. Slice 28 ships either way; NH option pick documented in closure.

2. **Test fixture rewrite churn.** All `state-officials-ingest.test.ts` fixture inserts change district codes. Touch surface is bounded; risk is low.

3. **CI job timing impact.** Adding `seed:state-officials` to CI adds ~30-60s per run (depending on OpenStates fixture size). Acceptable; existing CI already runs `seed:tiger` which takes minutes.

4. **WY at-large patch (Task 2)** changes TIGER output. Any future `seed:tiger` re-run will UPDATE existing WY district rows from `WY-SS-0` to `WY-SS-AL` (and SH similarly). UPSERT semantics handle this; document in closure that re-seed is needed for full alignment.

5. **NH Option 9.b implementation complexity unknown.** If TIGER NH SLDL uses opaque numbers that don't trivially map to OpenStates county-numbered districts, Option 9.b may require an external data source (NH gencourt PDF or web scrape). If complexity exceeds Patch tier, fall back to Option 9.a + defer 9.b to slice 29+.

6. **Windows CLI fix touches a critical entry point.** Test on both Windows + Linux to avoid regression. The `pathToFileURL` round-trip is the canonical Node.js cross-platform pattern (documented in Node.js docs), so the risk is low.

7. **CI threshold for unmatched legislators is implicit.** The diagnostic script checks format, not unmatched count. If a future regression caused unmatched > 0 (without format mismatch), CI wouldn't catch it. Consider adding an unmatched-count threshold assertion as a slice 29+ follow-up.

8. **Slice 28's diagnostic script (slice 27 deliverable) ships as CI gate.** If the script has bugs, CI catches it on first run. Mitigation: smoke-test the script locally first.

## Schema verification needed during planning

None — no migrations. Existing `districts.code` column shape unchanged. pgTAP new file is the only DB-touching deliverable.

## Cross-references

- Slice 5C (state-officials identity + state-leg-config.ts + Gotcha #8 NH limitation)
- Slice 27 (audit doc + diagnostic script + this slice's input)
- Slice 2 (TIGER ingest origin + tiger-config.ts)
- Slice 26 Gotcha #27 (ON CONFLICT partial-index lesson — peer pattern: production-defect class caught at review)
- CLAUDE.md Gotcha #6 (TIGER seed flake-tolerance)
- CLAUDE.md Gotcha #8 (NH limitation — gets rewritten in Task 6)
- Memory: [[project-chiaro-slice5c-state-officials]] (state-leg-config origin), [[project-chiaro-slice27-state-leg-district-audit]] (the audit), [[project-chiaro-tiger-ingest]] (tiger-config), [[feedback-workflow-tiers]] (Compressed-to-Mega-Slice tier choice)
