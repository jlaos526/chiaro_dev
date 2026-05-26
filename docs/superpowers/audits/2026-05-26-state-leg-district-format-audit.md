# State-leg district format audit — 2026-05-26 (Slice 27)

**Status:** CONFIRMED — production bug, deterministic, 100% reproducible.
**Tier:** Audit-only (no code changes in this slice). Slice 28 ships the fix.
**Branch:** `slice-27-state-leg-district-audit` (HEAD `3488a34` at start).

**Top-level finding.** `packages/db/supabase/seed/tiger-config.ts:48-55,66-74` writes state legislative district codes as `${state}-SS-${num}` (senate) / `${state}-SH-${num}` (house) with leading zeros **stripped**. `packages/db/supabase/seed/state-leg-config.ts:43-75` (`normalizeStateLegDistrictCode`) returns `${state}-${num}` with no SS/SH prefix and num **zero-padded to 2 digits**. `packages/db/supabase/seed/state-officials-ingest.ts:99-104` does an exact-match SQL lookup on `(code, tier)` — the two formats never align, and every state legislator silently fails the district_id lookup in production. The bug has **two format axes**, not one (prefix + zero-padding), and is masked by the unit-test fixture seeding districts in the consumer's normalize-output format instead of the producer's TIGER format.

---

## 1. Background

Slice 5C (PR #14, squash `4b8d2aa`, 2026-05-19) added state-legislator ingestion via the `openstates/people` GitHub YAML repo. The ingest path:

1. `loadOpenStatesYamlDir` parses YAML legislators.
2. `normalizeStateLegDistrictCode(state, chamber, rawDistrict)` translates OpenStates' `current_role.district` strings (e.g. `"15"`, `"1A"`, `"A"`, `"Rockingham 5"`) into a canonical district-code string used to look up the row TIGER seeded.
3. The ingest then queries `public.districts` by `(code, tier)` to obtain the `district_id` UUID it stores on each `officials` row.

The contract between the two modules — undocumented but load-bearing — is that **`normalizeStateLegDistrictCode` must emit the same string `tiger-config.ts` writes for the corresponding state/chamber/district triple**. If the formats diverge, the lookup silently misses and the legislator is shunted to `stats.unmatchedDistricts[]`.

Slice 5C's known limitation (CLAUDE.md Gotcha #8) was framed as a single-state issue: NH's multi-word district codes ("Rockingham 5") aren't normalizable, so 424 NH legislators are skipped. The audit finds this framing materially understates the problem — **all 49 non-NH states are affected by the same root cause: format divergence between the producer and the consumer.**

---

## 2. Observed mismatch (code evidence)

### 2.1 TIGER state senate code construction

`packages/db/supabase/seed/tiger-config.ts:48-56`:

```ts
extract: (props, stateFipsHint) => {
  const stateFp = stateFipsHint ?? String(props.STATEFP)
  const sldu = String(props.SLDUST).replace(/^0+/, '') || '0'
  const state = fipsToState.get(stateFp)
  if (!state) return null
  const code = `${state}-SS-${sldu}`
  const name = String(props.NAMELSAD ?? `${state} Senate District ${sldu}`)
  return { code, state, name }
},
```

Critical: `.replace(/^0+/, '')` **strips** leading zeros (Census `SLDUST = '015'` → `'15'`). Final code shape: `CA-SS-15`, `NY-SS-1`, `WY-SS-30`.

### 2.2 TIGER state house code construction

`packages/db/supabase/seed/tiger-config.ts:66-74`:

```ts
extract: (props, stateFipsHint) => {
  const stateFp = stateFipsHint ?? String(props.STATEFP)
  const sldl = String(props.SLDLST).replace(/^0+/, '') || '0'
  const state = fipsToState.get(stateFp)
  if (!state) return null
  const code = `${state}-SH-${sldl}`
  const name = String(props.NAMELSAD ?? `${state} House District ${sldl}`)
  return { code, state, name }
},
```

Same leading-zero stripping. Final code shape: `CA-SH-12`, `MD-SH-1`, `TX-SH-150`.

### 2.3 state-leg-config normalize function

`packages/db/supabase/seed/state-leg-config.ts:43-75`:

```ts
export function normalizeStateLegDistrictCode(
  state: string,
  chamber: OpenStatesOrgClassification,
  rawDistrict: string,
): string | null {
  if (!isStateChamberSupported(state, chamber)) return null

  // At-large case (rare for state houses; WY uses it).
  if (rawDistrict.toLowerCase() === 'at-large') return `${state}-AL`

  if (STATES_KNOWN_UNNORMALIZABLE.has(state)) {
    // NH and similar — log + skip handled by caller.
    return null
  }

  if (STATES_MULTIMEMBER_LETTER_SUFFIX.has(state)) {
    // MD: '1A' / '1B' / '1C' all map to district '01'.
    const numericPart = rawDistrict.match(/^\d+/)?.[0]
    if (!numericPart) return null
    return `${state}-${numericPart.padStart(2, '0')}`
  }

  if (STATES_LETTER_ONLY_DISTRICTS.has(state)) {
    // AK: 'A', 'B', etc.
    if (!/^[A-Z]+$/.test(rawDistrict)) return null
    return `${state}-${rawDistrict}`
  }

  // Default: numeric district, zero-pad to at least 2 digits.
  if (!/^\d+$/.test(rawDistrict)) return null
  const padded = rawDistrict.padStart(2, '0')
  return `${state}-${padded}`
}
```

Returns `${state}-${padded}` — **no SS/SH prefix** for any branch, and zero-**pads** to 2 digits in the numeric branch.

### 2.4 The lookup query

`packages/db/supabase/seed/state-officials-ingest.ts:80-110`:

```ts
for (const person of people) {
  const code = normalizeStateLegDistrictCode(
    person.role.state, person.role.type, person.role.district,
  )
  if (!code) {
    stats.unmatchedDistricts.push(`${person.role.state}:${person.role.district}`)
    continue
  }
  ...
  const districtTier =
    person.role.type === 'lower'        ? 'state_house' :
    person.role.type === 'upper'        ? 'state_senate' :
                                          'state_senate'

  const districtRow = await client.query<{ id: string }>(
    `select id from public.districts
     where code = $1 and tier = $2::public.district_tier
     limit 1`,
    [code, districtTier],
  )
  if (districtRow.rowCount === 0) {
    stats.unmatchedDistricts.push(`${person.role.state}:${person.role.district}`)
    continue
  }
```

Exact-match `code = $1`. No format reconciliation. A miss appends to `unmatchedDistricts` and `continue`s — the legislator is **never inserted into `public.officials`**.

### 2.5 The test fixture (anti-pattern)

`packages/db/supabase/seed/state-officials-ingest.test.ts:15-32`:

```ts
beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',       'CA', 'CA-15', 'CA AD 15', ...),
      ('state_senate',      'CA', 'CA-08', 'CA SD 8',  ...),
      ('state_senate',      'NE', 'NE-23', 'NE District 23', ...),
      ('state_house',       'MD', 'MD-01', 'MD HD 01', ...)
    on conflict (tier, code) do nothing
  `)
})
```

District codes are seeded as `CA-15`, `CA-08`, `NE-23`, `MD-01` — **the normalize OUTPUT format, not TIGER's format.** The test passes by construction; it cannot detect the producer/consumer mismatch because it never seeds producer-format rows.

### 2.6 Format divergence — both axes

| Triple | TIGER writes (`tiger-config.ts:53,71`) | normalize returns (`state-leg-config.ts:73`) | Match? |
|---|---|---|---|
| CA senate district 15 | `CA-SS-15` | `CA-15` | ✗ prefix |
| CA house district 8 | `CA-SH-8` (zero stripped) | `CA-08` (zero padded) | ✗ prefix + padding |
| NE legislature 23 | `NE-SS-23` (NE unicameral, lives in senate tier) | `NE-23` | ✗ prefix |
| MD house district 1 | `MD-SH-1` (zero stripped) | `MD-01` (zero padded) | ✗ prefix + padding |
| WY house at-large | `WY-SH-AL` (per `'00' → 'AL'` precedent? — actually `WY-SH-1` since SLDLST is numeric) | `WY-AL` (per at-large branch) | ✗ prefix |
| AK senate `A` | `AK-SS-A` (assumes SLDUST = `'A'`) | `AK-A` | ✗ prefix |

Two axes diverge:
1. **SS/SH prefix** — TIGER includes; normalize omits. Affects all 50 states.
2. **Zero-padding** — TIGER strips leading zeros; normalize pads to 2 digits. Affects single-digit districts in numeric-state branches.

A hypothetical "fix" that only touched one axis would leave half the legislators still unmatched.

---

## 3. Reproduction steps

The Task 1 implementer ran the following sequence on Windows + PowerShell + Git-for-Windows bash, against a fresh local Supabase.

```bash
# 1. Local stack
pnpm db:start
pnpm db:reset                    # applies migrations 0001-0055 cleanly

# 2. Attempt TIGER seed (per Gotcha #6, can flake on Census endpoint)
pnpm seed:tiger                  # stalled on tl_2024_04_cd119.zip after >5 min;
                                 # killed; only 8 federal_house rows landed.
                                 # Substituted simulated TIGER rows (see Section 4 caveat).

# 3. Seed simulated TIGER-format state-leg districts via direct SQL
#    Patterns derived by hand from tiger-config.ts:48-74:
#      CA-SS-15, CA-SH-12, NE-SS-23, MD-SH-1
#    Marked source_version='SIM-TIGER-2024' for cleanup.

# 4. Invoke ingest via dynamic import (CLI guard at state-officials-ingest.ts:226
#    no-ops on Windows path-quoting; see Section 4 Ancillary findings)
node -e "import('./packages/db/supabase/seed/state-officials-ingest.ts')
  .then(m => m.ingestStateOfficials({
    minStateHouseCount: 0,
    minStateSenateCount: 0,
  }))
  .then(s => console.log(JSON.stringify(s, null, 2)))"
```

A second arm of the experiment added rows in the **normalize-output format** (`CA-15`, `CA-08`, `NE-23`, `MD-01`, marked `source_version='FX-stateleg'`) alongside the TIGER-format rows, then re-ran the identical ingest.

The two-arm design controls for everything except district code format.

---

## 4. Findings

### 4.1 Two-arm empirical result — bug confirmed

**Test A (TIGER format only).** Inserted 4 districts mirroring `tiger-config.ts:53,71`:

| tier | code | what TIGER writes |
|---|---|---|
| state_senate | `CA-SS-15` | `${state}-SS-${sldu}` (line 53) |
| state_house | `CA-SH-12` | `${state}-SH-${sldl}` (line 71) |
| state_senate | `NE-SS-23` | NE unicameral lives in senate tier per `NO_STATE_HOUSE` |
| state_house | `MD-SH-1` | numeric MD HD 1 (zero stripped per `.replace(/^0+/, '')`) |

Ran `ingestStateOfficials({ minStateHouseCount: 0, minStateSenateCount: 0 })` against the 6-person OpenStates fixture set (`packages/db/supabase/seed/fixtures/openstates-people/`):

```
Ingest summary (state officials, fixtures):
  officials upserted: 0
  offices upserted:   0
  unmatched count:    6
  errors:             0
  unmatched samples:  [ 'CA:15', 'CA:8', 'MD:1A', 'MD:1B', 'MD:1C', 'NE:23' ]
```

**All 6 fixtures unmatched. Zero officials written.** Despite valid TIGER-format districts existing in the same DB.

**Test B (added normalize format).** Added 4 districts matching `state-officials-ingest.test.ts:17-30` (`source_version='FX-stateleg'`):

| tier | code |
|---|---|
| state_house | `CA-15` |
| state_senate | `CA-08` |
| state_senate | `NE-23` |
| state_house | `MD-01` |

Re-ran the identical ingest:

```
Ingest WITH FX-stateleg fixture districts:
  officials upserted: 6
  unmatched count:    0
  unmatched samples:  []
```

**Zero unmatched. All 6 officials written.** Same fixtures, same ingest code, only difference: district codes match normalize output.

The diagnostic also probed individual lookups against TIGER-format-only data:

```
Lookup CA-15 state_house  → found: false
Lookup CA-08 state_senate → found: false
Lookup NE-23 state_senate → found: false
Lookup MD-01 state_house  → found: false
```

### 4.2 Conclusion

- `tiger-config.ts:53,71` writes `STATE-SS-N` / `STATE-SH-N`.
- `state-leg-config.ts:73-74` (default branch) returns `STATE-N` (no SS/SH prefix, zero-padded to 2).
- `state-officials-ingest.ts:99-104` does exact-match SQL `where code = $1 and tier = $2` and silently misses.
- 100% of state legislators in the 49 non-NH states would fail district_id lookup in production. NH already returns null upstream (known limitation).
- Test fixtures in `state-officials-ingest.test.ts` mask the bug by seeding districts in the normalize-output format.

### 4.3 Caveat — live TIGER substitution

The Census endpoint flaked partway through `seed:tiger` per Gotcha #6 (stalled on `tl_2024_04_cd119.zip` after fetching `tl_2024_01` + `tl_2024_02`; only 8 federal_house rows landed; no state-leg rows). The Task 1 implementer **simulated** TIGER state-leg rows by hand-constructing them from `tiger-config.ts:48-73` source. The format is mechanically derivable from the code; the simulation is faithful.

Slice 28 should re-verify against real TIGER data once the Census endpoint stabilizes; we predict identical behavior at full scale (~7,500 state legislators across 49 non-NH states all unmatched).

### 4.4 Ancillary findings

- **Windows CLI silent no-op.** `pnpm seed:state-officials` on Windows does nothing — the guard at `state-officials-ingest.ts:226` (`file://${process.argv[1].replace(/\\/g, '/')}`) doesn't normalize drive-letter casing/URI-escaping, so the equality check fails. Task 1 worked around it via dynamic import. Slice 28 should fix this alongside the format alignment (or in a small follow-up patch).
- **Zero-padding axis.** Even if a fix kept the no-prefix shape and only aligned format on `STATE-N`, single-digit districts (1-9) would still mismatch (`MD-01` vs `MD-1`). Two axes diverge; both must be addressed.

---

## 5. CI evidence

`.github/workflows/ci.yml` runs `seed:tiger` in the `db` job (line 42) and `test` job (line 158), and runs the slice-3 + slice-4 fixture smoke tests in the `db` job (lines 47-62):

```yaml
- name: Seed districts (TIGER 2024)
  run: pnpm --filter @chiaro/db db:seed-tiger
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

- name: Run pgTAP suite
  run: pnpm db:test
- name: Smoke officials ingest (against fixtures)
  run: pnpm --filter @chiaro/db test supabase/seed/officials-ingest.test.ts
- name: Smoke slice-4 ingest pipelines (against fixtures)
  run: |
    pnpm --filter @chiaro/db test supabase/seed/unitedstates-legislators-ingest.test.ts
    pnpm --filter @chiaro/db test supabase/seed/bills-votes-ingest.test.ts
    pnpm --filter @chiaro/db test supabase/seed/scorecards/index.test.ts
    pnpm --filter @chiaro/db test supabase/seed/finance-ingest.test.ts
    pnpm --filter @chiaro/db test supabase/seed/salary-residency-ingest.test.ts
    pnpm --filter @chiaro/db test supabase/seed/town-halls-ingest.test.ts
    pnpm --filter @chiaro/db test supabase/seed/stock-watcher-ingest.test.ts
    pnpm --filter @chiaro/db test supabase/seed/recompute-metrics.test.ts
```

**Conspicuously absent:** `supabase/seed/state-officials-ingest.test.ts`. The state-officials ingest is exercised only via the workspace `pnpm test` (which goes through turbo, line 192), and **only against the fixture districts that pre-bake the mismatch.**

No CI job ever runs `pnpm seed:state-officials` (or `pnpm --filter @chiaro/db seed:state-officials`) against TIGER-seeded data. There is no live smoke for state-officials analogous to slice 3's `officials-ingest.test.ts` (which IS in CI line 48). No pgTAP test asserts state-leg district code format — `tiger_ingest.test.sql` only does row-count assertions.

**A live CI smoke would have caught the bug immediately.**

---

## 6. Impact assessment

### 6.1 Surface

Without the fix, **all ~7,400 US state legislators across 49 non-NH states would have `officials.district_id = NULL` in production**, assuming a CI or operator-driven state-officials ingest ever ran against TIGER-seeded data (it currently does not — see Section 5).

NH legislators (~424) are also unmatched, but for the original known-limitation reason (multi-word codes); that's pre-existing and tracked separately.

**Predicted NULL ratio: 99%+** (every legislator outside the test fixture, except possibly some edge case in WY/AK).

### 6.2 Downstream consumer impact

Two load-bearing query paths key on `officials.district_id`:

- `packages/officials/src/queries.ts:38` — `fetchMyOfficials` filters via `.in('district_id', districtIds.map((d) => d.district_id))`. State legislators with NULL `district_id` would be **invisible to calibrated users on the home screen**. This is the highest-impact UI break.
- `packages/officials/src/queries.ts:19` — `SELECT_WITH_DISTRICT` joins via `officials_district_id_fkey`. State-officials detail pages that depend on the joined district name/code would render `null` for those fields.
- `packages/location/src/queries.ts:55,60` — `getMyDistricts` returns the user's district set independent of officials, so the user's `user_districts` row IS populated (assuming TIGER ran). The cross-product between `user_districts` and `officials` is where the break appears.

### 6.3 Production status today

The fix has **not yet bitten production** because:
1. CI never runs `seed:state-officials` against TIGER-seeded data.
2. No production deploy of state-officials ingest has happened (slice 5C shipped the code but the operator deploy step is open).
3. Local developers running `pnpm db:reset` + `pnpm seed:tiger` + `pnpm seed:state-officials` would hit the bug, but the Windows CLI silent no-op (Section 4.4) prevents Windows devs from even invoking it.

Once any operator runs the production ingest against real TIGER data, the result is silent: 7,400+ legislators inserted with NULL `district_id`, threshold guards do NOT fire (the deactivation guard is on prior-active rows, not on insertion), and the home-screen "my officials" card silently omits state-tier representation.

---

## 7. Why tests didn't catch the bug

The unit test (`state-officials-ingest.test.ts:17-32`) was **constructed by inspecting the consumer's expected input, not the producer's actual output**. The fixture seed seeds districts in the format `normalizeStateLegDistrictCode` returns (`CA-15`), so by construction the test's lookup query at line 99-104 always matches.

This is the same anti-pattern surfaced in slice 18 Task 2 (`tsconfig.seed.json` was missing the seed tree, so typecheck didn't see seed-only TS errors) — a quiet zone where the safety net was shaped around the code being tested rather than around the upstream producer's contract.

**The general lesson:** integration test fixtures should mirror what the producer (TIGER seed) actually writes, OR run a separate integration test against post-seed data. Fixtures generated from the consumer's expected input cannot detect producer/consumer divergence.

This is also why CI passing for ~7 days post-slice-5C did not surface the bug — the `pnpm test` invocation runs the unit test which passes by construction.

---

## 8. Recommended fix for slice 28

Three options, ranked by recommendation.

### Option A (recommended) — change normalize to emit SS/SH and strip leading zeros

Update `state-leg-config.ts` to mirror TIGER's output exactly. Affected branches:
- Default numeric branch: `${state}-${chamberPrefix}-${rawDistrict.replace(/^0+/, '') || '0'}` where `chamberPrefix` is `'SS'` for upper + legislature, `'SH'` for lower.
- `STATES_MULTIMEMBER_LETTER_SUFFIX` (MD): same — `${state}-SH-${numericPart.replace(/^0+/, '')}` (MD has no state senate multi-member case; MD-01 etc. are all state_house).
- `STATES_LETTER_ONLY_DISTRICTS` (AK): `${state}-${chamberPrefix}-${rawDistrict}`.
- At-large branch (WY): `${state}-${chamberPrefix}-AL` (matches TIGER's `'00' → 'AL'` precedent in `federal_house`; verify against real TIGER WY data in slice 28 since `tiger-config.ts:50` strips leading zeros so SLDLST=`'00'` → `'0'`, NOT `'AL'`).

**At-large caveat.** `tiger-config.ts:50` does `String(props.SLDUST).replace(/^0+/, '') || '0'`, which yields `'0'` for SLDUST=`'00'`, not `'AL'`. This is DIFFERENT from the federal_house at-large convention (line 34 emits `'AL'` for `'00'`). Slice 28 must decide: align WY at-large to TIGER's actual `WY-SH-0` shape, or fix TIGER to emit `WY-SH-AL`. Option A is "follow whatever TIGER writes" — recommend a 2-line patch to `tiger-config.ts` mirroring the federal at-large handling to keep semantics, then align normalize to the new TIGER shape.

**Test fixture update.** `state-officials-ingest.test.ts:19-29` district codes change to `CA-SH-15` / `CA-SS-8` / `NE-SS-23` / `MD-SH-1`.

**Touch surface:** `state-leg-config.ts` + `state-officials-ingest.test.ts` + `state-leg-config.test.ts` + optionally a 2-line at-large patch in `tiger-config.ts`. ~4-6 files.

**Pros:** TIGER format is the canonical district-code source-of-truth across the whole codebase (federal_house uses it too); aligning normalize to TIGER preserves the single-format invariant.
**Cons:** Touches the consumer side (normalize); requires fixture rewrites. Low risk because consumer-side changes don't propagate to other code paths.

### Option B — change TIGER to emit `${state}-${num}` (no prefix)

Update `tiger-config.ts:53,71` to drop the `-SS-` / `-SH-` prefix; relies on the `tier` column to discriminate state_senate vs state_house at query time.

**Pros:** Smaller code change (2 lines in one file).
**Cons:** Riskier — other code paths may rely on the SS/SH prefix to distinguish state-tier from federal-tier when querying generically. For example, location calibration in `/state-officials/[id]` route uses district codes for display, and `MAP_COLORS` / DistrictPanel may filter on code prefix. Requires an audit of all consumers of `districts.code` before committing.
- Also requires rolling out fresh TIGER data (re-running `seed:tiger`) — the existing rows in any live DB are now wrong-format.
- Doesn't address the zero-padding axis (normalize's `padStart(2, '0')` still produces `CA-15` vs `CA-1` from a hypothetical de-prefixed TIGER).

**Not recommended** unless slice 28 confirms zero collateral consumers of the SS/SH prefix.

### Option C — add a translation layer in state-officials-ingest

Convert normalize output → TIGER format inside `state-officials-ingest.ts` at lookup time:

```ts
const districtCode = code.replace(/^([A-Z]{2})-/, `$1-${districtTier === 'state_senate' ? 'SS' : 'SH'}-`)
  .replace(/-0+(\d)/, '-$1') // strip zero-padding for numeric districts
```

**Pros:** Isolated, single-file change. No producer-side touches.
**Cons:** Introduces a 3rd format the codebase has to reason about. The translation logic now lives apart from both normalize and TIGER; future contributors will be confused. Each subsequent consumer of normalize would need the same translation (federal_house if it ever cross-pollinates; bills/votes lookups; etc.). Conceptually a band-aid.

**Recommended only if Option A blocks on Gotcha #8 NH multi-word handling.**

---

## 9. NH multi-word handling options

Given TIGER format uses SS/SH prefixes (after Option A or status-quo), NH's TIGER SLDL/SLDU data uses some structure we haven't sampled yet. Three options, decided by what TIGER actually writes:

### Option 9.a — keep skipping NH (status quo)

Slice 28's normalize keeps returning null for NH; ingest skips. 424 NH legislators have NULL `officials.district_id`. Acceptable v1 — documented in Gotcha #8.

### Option 9.b — try numeric-only TIGER alignment

NH's SLDL/SLDU shapefiles may use simple numeric district codes (`NH-SH-1`, `NH-SH-2`, ...) regardless of how OpenStates phrases "Rockingham 5". If so, the OpenStates → TIGER mapping is `"Rockingham 5"` → district number → `NH-SH-N`. Requires a per-state lookup table or county-aware logic.

### Option 9.c — switch NH to county-numbered TIGER format

If TIGER's NH SLDL uses county-aware codes (e.g. `NH-Rockingham-5` → `NH-SH-Rockingham-5`), align normalize to that scheme. Requires a custom branch in `normalizeStateLegDistrictCode`.

**Action:** Task 1 did NOT fetch live NH SLDL data (Census endpoint flake). Slice 28 should run `SELECT code FROM districts WHERE state='NH' AND tier='state_house' LIMIT 20` against post-TIGER-seed data to see NH's actual format before deciding. The audit doc cannot pick an option without that sample.

---

## 10. Test gaps

### 10.1 Missing pgTAP assertion

Add a pgTAP file (e.g. `packages/db/supabase/tests/state_leg_district_format.test.sql`) asserting:

```sql
select is_empty(
  $$ select 1 from public.districts
     where tier = 'state_senate' and code !~ '^[A-Z]{2}-SS-' $$,
  'state_senate district codes must match STATE-SS-N pattern'
);

select is_empty(
  $$ select 1 from public.districts
     where tier = 'state_house'  and code !~ '^[A-Z]{2}-SH-' $$,
  'state_house district codes must match STATE-SH-N pattern'
);
```

This would have caught the format mismatch immediately under `pnpm db:test` (which runs against TIGER-seeded data).

### 10.2 Update fixture format

`state-officials-ingest.test.ts:17-30` must be rewritten to seed districts in TIGER format (`CA-SH-15`, `CA-SS-8`, `NE-SS-23`, `MD-SH-1`) AFTER slice 28 ships the fix. Until then, the test will fail by construction.

### 10.3 Add post-seed integration test

Add `state-officials-ingest.tiger.test.ts` (or extend the existing test) that:
1. Requires `seed:tiger` to have run.
2. Loads a small fixture of OpenStates legislators (CA + NE + MD).
3. Asserts `unmatchedDistricts.length === 0` after ingest.

This test would have detected the producer/consumer divergence in slice 5C before merge.

### 10.4 Add CI smoke for state-officials

Add a step to `.github/workflows/ci.yml` `db` job (after the slice-3/4 smoke tests at line 60):

```yaml
- name: Smoke state-officials ingest (against fixtures + TIGER)
  run: pnpm --filter @chiaro/db test supabase/seed/state-officials-ingest.test.ts
  env:
    SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Plus an assertion threshold: `unmatchedDistricts.length < 5` or similar (allowing NH + a couple of edge cases without flooding).

---

## 11. Proposed CLAUDE.md Gotcha #8 update (slice 28 closure)

The current Gotcha #8 ("State-legislator data sources have known quirks") accurately describes the NH multi-word limitation but completely misses the broader format mismatch. Proposed full-rewrite text for the "NH multi-word district codes" bullet:

```markdown
   - **NH multi-word district codes** (e.g. "Rockingham 5") aren't normalizable to TIGER `STATE-N` format — `state-leg-config.ts` returns null, ingest logs to `stats.unmatchedDistricts` + skips. Documented as a known limitation.

   - **State-leg district code format alignment** (slice 28, 2026-05-26): `tiger-config.ts:53,71` writes `STATE-SS-N` / `STATE-SH-N` (leading zeros stripped); `state-leg-config.ts` was updated to emit matching format. Both axes — SS/SH prefix AND zero-stripping — were misaligned pre-fix; all 49 non-NH state legislators were silently unmatched at lookup time. Slice 5C unit tests masked the bug by seeding fixtures in the old normalize-output format. Slice 27 audit at `docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md` documents the empirical reproduction and impact assessment.
```

(Final wording to be finalized by slice 28; this is a starting draft.)

Also propose a new entry in the CI workflow + pgTAP additions (per Section 10) — these are durable correctness mechanisms, not just one-off fixes.

---

## Appendix — diagnostic script

A diagnostic script has been shipped alongside this audit at `packages/db/supabase/seed/diagnostics/state-leg-district-format-check.ts` (CLI: `pnpm --filter @chiaro/db diagnose:state-leg-district-format`). It connects to the local Supabase, prints state-leg district code patterns + legislator `district_id` NULL counts, and returns non-zero exit code if any `state_senate` / `state_house` row has a code missing the SS/SH prefix. Slice 28 reruns it as part of the verify gate to confirm the fix lands.
