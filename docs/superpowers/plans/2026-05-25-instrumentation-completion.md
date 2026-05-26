# Slice 23 — Complete instrumentation framework implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `opts.onSkip?` callback (slice 22 framework) into remaining production adapters + migrate TX TEC `errors[]` dual-write to unified onSkip channel. After this slice, instrumentation coverage is uniform across all non-stub adapters.

**Architecture:** 5 tasks sequenced; each task closes one category. Task 4 (TX TEC migration) intentionally last because the cleanup depends on slice 22's onSkip telemetry being in place + tested.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler. Reuses slice 22 `SkipReason` + `createSkipCollector` + interface widening. No new workspace deps.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-instrumentation-completion-design.md` (slice 23 spec)
- Slice 22 plan (`docs/superpowers/plans/2026-05-25-production-instrumentation.md`) — framework foundation + instrumentation pattern this slice extends
- Slice 22 memory — durable lessons (TX TEC dual-write pattern this slice consolidates)

**Key findings from file exploration:**

- `state-scorecards/shared.ts` exposes `StateScorecardAdapter` interface (slice 5G) — has `fetchRatings(opts)` method, NOT `fetchEvents`. Task 3 widens this interface with `onSkip?` (mirror slice 22 Task 1 pattern).
- `ca-leginfo/senate.ts` already supports `opts.fetcher?` (page-level), but per-card silent-skip sites (resolve null, parseAddressText null) are uninstrumented.
- `ny-senate/assembly.ts` already supports `opts.fetcher?`; per-card silent-skip sites (`district_no` regex fail, parseAddressText null) uninstrumented.
- `state-community/town-halls/ny-senate.ts` already supports `pageFetcher?` (slice 22 widening); per-event resolve null + chamber-inference fail sites uninstrumented.
- `state-ethics/events/openstates-end-reason.ts` is fs-based (reads cache directory). Skip stages differ from HTTP-fetch adapters: `stage: 'fetch'` covers file read failure; `stage: 'parse'` covers YAML parse failure; `stage: 'filter'` covers end_reason regex non-match; `stage: 'resolve'` covers unmatched legislator.
- TX TEC dual-write: `errors.push(\`unresolved: ${row.respondent} (${chamber})\`)` line in `tx-tec/shared.ts` (slice 22 Task 3 addition). Slice 23 Task 4 removes ONLY that line; the `errors[]` array stays in the return type for the `fetch failed` initial entry case.

---

## File Structure

### Created files (1)
```
~/.claude/projects/.../memory/project_chiaro_slice23_instrumentation_completion.md   Task 5 (outside repo)
```

### Modified files (~22)
```
# Task 1: Single-page roster parsers
packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.ts            + .test.ts
packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts           + .test.ts

# Task 2: Town halls + state-ethics events
packages/db/supabase/seed/state-community/town-halls/ny-senate.ts                          + .test.ts
packages/db/supabase/seed/state-community/town-halls/mobilize.ts                           + .test.ts
packages/db/supabase/seed/state-community/town-halls/townhallproject.ts                    + .test.ts (if exists)
packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts                       + .test.ts
packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts                     + .test.ts

# Task 3: Scorecards
packages/db/supabase/seed/state-scorecards/shared.ts                                       (interface widen)
packages/db/supabase/seed/state-scorecards/lcv/mi.ts                                       + .test.ts (if separate)
packages/db/supabase/seed/state-scorecards/lcv/co.ts                                       + .test.ts (if separate)
packages/db/supabase/seed/state-scorecards/nra.ts                                          + .test.ts

# Task 4: TX TEC migration
packages/db/supabase/seed/state-ethics/tx-tec/shared.ts                                    (remove dual-write line)
packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts                               (update assertion)

# Task 5: Closure
CLAUDE.md                                                                                  slice 23 entry
```

**Total touched: ~22 files.**

---

## Task 1: Single-page roster parsers (CA Senate + NY Assembly)

**Files:**
- Modify: `packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.ts` + `.test.ts`
- Modify: `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts` + `.test.ts`

- [ ] **Step 1: Read both current adapter files to confirm shape**

```bash
sed -n '57,114p' packages/db/supabase/seed/state-community/district-offices/ca-leginfo/senate.ts
sed -n '1,50p' packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts
```

Confirm silent-skip sites:
- CA Senate: fetch try/catch, per-card resolve null, per-card parseAddressText null (capitol + district)
- NY Assembly: fetch try/catch, per-card district_no regex fail, per-card parseAddressText null

- [ ] **Step 2: Extend `fetchCaSenateOffices` opts with `onSkip?` + instrument silent-skip sites**

Modify `state-community/district-offices/ca-leginfo/senate.ts`. Add import:
```ts
import type { SkipReason } from '../../../shared/instrumentation.ts'
```

Update `fetchCaSenateOffices` signature:
```diff
 export async function fetchCaSenateOffices(
   client: Pick<Client, 'query'>,
-  opts: { fetcher?: () => Promise<string> },
+  opts: {
+    fetcher?: () => Promise<string>
+    onSkip?: (reason: SkipReason) => void
+  },
 ): Promise<NormalizedDistrictOffice[]> {
   let html: string
   try {
     html = opts.fetcher
       ? await opts.fetcher()
       : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
-  } catch {
+  } catch (e) {
+    opts.onSkip?.({
+      adapter: 'ca-leginfo',
+      stage: 'fetch',
+      reason: 'roster fetch threw',
+      detail: e instanceof Error ? e.message : String(e),
+    })
     return []
   }

   const parsed = parseCaSenateRosterHtml(html)
   const out: NormalizedDistrictOffice[] = []

   for (const s of parsed) {
     const openstates_person_id = await resolveOpenstatesPersonId(client, { ... })
-    if (!openstates_person_id) continue
+    if (!openstates_person_id) {
+      opts.onSkip?.({
+        adapter: 'ca-leginfo',
+        stage: 'resolve',
+        legislator: s.full_name,
+        reason: 'unmatched in officials table (state_senate)',
+      })
+      continue
+    }

     if (s.capitol_office) {
       const parts = parseAddressText(s.capitol_office)
-      if (parts) {
+      if (parts) {
         out.push({ ... })
+      } else {
+        opts.onSkip?.({
+          adapter: 'ca-leginfo',
+          stage: 'parse',
+          legislator: s.full_name,
+          reason: 'parseAddressText returned null for capitol office',
+        })
       }
     }
     // ... same pattern for district_office ...
   }
```

- [ ] **Step 3: Update `ca-leginfo/index.ts` to propagate `opts.onSkip` to BOTH senate + assembly sub-fetchers**

```diff
 export const caLeginfoOffices: StateCommunityAdapter<NormalizedDistrictOffice> = {
   slug: 'ca-leginfo',
   component: 'offices',
   covered_states: ['CA'],
   async fetchEvents(opts): Promise<NormalizedDistrictOffice[]> {
     if (opts.fetcher) return opts.fetcher()

+    const subOpts = opts.onSkip ? { onSkip: opts.onSkip } : {}
     const [senate, assembly] = await Promise.all([
-      fetchCaSenateOffices(opts.client, {}),
-      fetchCaAssemblyOffices(opts.client, {}),
+      fetchCaSenateOffices(opts.client, subOpts),
+      fetchCaAssemblyOffices(opts.client, subOpts),
     ])
     return [...senate, ...assembly]
   },
 }
```

(slice 22 Task 2 already wired CA Assembly through fetchPerMemberOffices; this step adds CA Senate propagation.)

- [ ] **Step 4: Mirror changes in `ny-senate/assembly.ts`**

Same pattern: extend `opts` with `onSkip?`, instrument fetch + per-card district_no fail + per-card parseAddressText null.

For NY Assembly, the per-card silent-skip is "district_no regex fail" (per `parseNyAssemblyDirectoryHtml`). However, that fails INSIDE the parser (returns nothing for those cards). The fetcher loop's silent-skip is at `resolveOpenstatesPersonId` null. Instrument both: the parser-internal silent-skip is logged as `stage: 'parse'` from the `fetchNyAssemblyOffices` loop side (if the parser exposes a count of skipped cards) OR `stage: 'resolve'` for the per-card null openstates_person_id case.

If the existing parser doesn't expose skip count, a simpler approach: only instrument the fetcher-level sites (fetch try/catch + resolve null + parseAddressText null). Parser-internal silent-skip (district_no regex fail at parse time) stays uninstrumented; an audit follow-up could expose it.

- [ ] **Step 5: Update `ny-senate/index.ts`** to propagate `opts.onSkip` to senate + assembly sub-fetchers (same Promise.all pattern as ca-leginfo).

- [ ] **Step 6: Add 6 new vitest tests (~3 per adapter)**

Each test: assert onSkip fires with correct adapter slug + stage + legislator + reason at each instrumented site. Existing tests stay passing (opt-in onSkip = back-compat).

- [ ] **Step 7: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/district-offices/ca-leginfo state-community/district-offices/ny-senate
pnpm --filter @chiaro/db typecheck
```

- [ ] **Step 8: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 749 + 6 = ~755 tests PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-community/district-offices/ca-leginfo \
        packages/db/supabase/seed/state-community/district-offices/ny-senate
git commit -m "$(cat <<'EOF'
feat(state-community): single-page roster parsers honor onSkip

Slice 22 deferred CA Senate (single-page roster) + NY Assembly
(single-page directory) because they don't use fetchPerMemberOffices.
Slice 23 Task 1 instruments their silent-skip sites + propagates
onSkip through their index.ts dispatchers.

- ca-leginfo/senate.ts: fetch + per-card resolve + per-card parse
  (capitol + district independently).
- ny-senate/assembly.ts: fetch + per-card resolve + per-card parse.
- ca-leginfo/index.ts + ny-senate/index.ts dispatchers propagate
  opts.onSkip to both sub-fetchers via Promise.all.
- 6 new vitest tests assert correct skip attribution.

Existing tests unchanged (opt-in onSkip = back-compat).

Per spec: docs/superpowers/specs/2026-05-25-instrumentation-completion-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Town halls + state-ethics events

**Files:**
- Modify: `state-community/town-halls/ny-senate.ts` + `.test.ts` (slice 15)
- Modify: `state-community/town-halls/mobilize.ts` + `.test.ts` (slice 7/8)
- Modify: `state-community/town-halls/townhallproject.ts` + `.test.ts` (slice 7 deprecated; verify file exists)
- Modify: `state-ethics/events/ballotpedia-recalls.ts` + `.test.ts` (slice 9)
- Modify: `state-ethics/events/openstates-end-reason.ts` + `.test.ts` (slice 7)

Each adapter gains `opts.onSkip?` via the slice 22 widened interface (StateCommunityAdapter or StateEthicsAdapter). Instrument silent-skip sites per the spec.

- [ ] **Step 1: Read each adapter to identify silent-skip sites**

For each of the 5 adapters, read the file + locate try/catch + continue sites + per-row null-coalesce skips.

- [ ] **Step 2: Instrument `ny-senate.ts` town halls**

```ts
// fetch failure
try {
  html = pageFetcher ? await pageFetcher() : await fetch(SOURCE_URL).then(r => r.text())
} catch (e) {
  opts.onSkip?.({
    adapter: 'ny-senate',
    stage: 'fetch',
    reason: 'events listing fetch threw',
    detail: e instanceof Error ? e.message : String(e),
  })
  return []
}

// per-event resolve
const openstates_person_id = await resolveOpenstatesPersonId(client, { ... })
if (!openstates_person_id) {
  opts.onSkip?.({
    adapter: 'ny-senate',
    stage: 'resolve',
    legislator: p.full_name,
    reason: 'unmatched senator in officials table',
  })
  continue
}
```

Add ~3 tests asserting both fire correctly.

- [ ] **Step 3: Instrument `mobilize.ts`**

Mobilize has 3 silent-skip sites:
1. API fetch failure (try/catch around mobilize.us API call)
2. Per-event regex classification fail (filter stage — title regex doesn't match state-tier)
3. Per-event resolve null (resolve stage)

```ts
// classification (filter stage)
const { state_chamber, legislator_name } = classifyMobilizeTitle(event.title)
if (!state_chamber) {
  opts.onSkip?.({
    adapter: 'mobilize',
    stage: 'filter',
    legislator: legislator_name ?? event.title,
    reason: 'title did not match state-legislator pattern',
  })
  continue
}

// resolve
const openstates_person_id = await resolveOpenstatesPersonId(client, { ... })
if (!openstates_person_id) {
  opts.onSkip?.({
    adapter: 'mobilize',
    stage: 'resolve',
    legislator: legislator_name,
    reason: `unmatched ${state_chamber} in officials`,
  })
  continue
}
```

Add ~3 tests.

- [ ] **Step 4: Instrument `townhallproject.ts`**

Slice 7 deprecated this; it currently returns `[]` unconditionally. Wire onSkip for completeness (will emit 0 calls in practice but maintains uniformity):

```ts
async fetchEvents(opts): Promise<NormalizedTownHall[]> {
  if (opts.fetcher) return opts.fetcher()
  // Deprecated per slice 7 (TownHallProject offline since 2021). Mobilize.us
  // is the active source. No skip emitted because adapter is intentionally
  // returning [].
  return []
},
```

If the file already has `@deprecated` JSDoc, no test changes needed. Just verify the existing test stays passing.

- [ ] **Step 5: Instrument `ballotpedia-recalls.ts`**

Slice 9 production HTML scrape. Silent-skip sites:
1. HTML fetch failure (Cloudflare-gated; uses browser UA already)
2. Per-row name parse fail (regex on respondent column)
3. Per-row resolve null

```ts
// fetch failure
try {
  html = pageFetcher ? await pageFetcher() : await fetch(SOURCE_URL, { headers: BROWSER_UA }).then(r => r.text())
} catch (e) {
  opts.onSkip?.({
    adapter: 'ballotpedia-recalls',
    stage: 'fetch',
    reason: 'recalls page fetch threw (Cloudflare gate?)',
    detail: e instanceof Error ? e.message : String(e),
  })
  return []
}

// per-row name parse
const parsedRow = parseRecallRow(row)
if (!parsedRow) {
  opts.onSkip?.({
    adapter: 'ballotpedia-recalls',
    stage: 'parse',
    reason: 'recall row name parse failed',
  })
  continue
}

// resolve
if (!openstates_person_id) {
  opts.onSkip?.({
    adapter: 'ballotpedia-recalls',
    stage: 'resolve',
    legislator: parsedRow.legislator_name,
    reason: 'unmatched in officials',
  })
  continue
}
```

Add ~3 tests.

- [ ] **Step 6: Instrument `openstates-end-reason.ts`**

FS-based adapter. Silent-skip sites:
1. Cache dir missing (existsSync) → emit `fetch` stage skip ONCE; `return []`
2. Per-file YAML/JSON parse failure (try/catch) → `parse` stage
3. Per-role end_reason regex non-match (resign/death) → `filter` stage
4. Per-role state extraction fail (jurisdiction regex) → `parse` stage
5. (No `resolve` stage here because end_reason events are by name; UPSERT in orchestrator handles unmatched)

```ts
if (!existsSync(dir)) {
  opts.onSkip?.({
    adapter: 'openstates-end-reason',
    stage: 'fetch',
    reason: `cache dir absent: ${dir}`,
  })
  return []
}

// per-file:
try {
  if (file.endsWith('.yml') || file.endsWith('.yaml')) {
    person = parseYaml(raw) as OpenStatesPerson
  } else {
    person = JSON.parse(raw) as OpenStatesPerson
  }
} catch (e) {
  opts.onSkip?.({
    adapter: 'openstates-end-reason',
    stage: 'parse',
    legislator: file,
    reason: 'YAML/JSON parse failed',
    detail: e instanceof Error ? e.message : String(e),
  })
  continue
}

// per-role:
if (!RESIGN_RE.test(role.end_reason!) && !DEATH_RE.test(role.end_reason!)) {
  // not a resignation/death — silently filter (don't emit skip; this is
  // the normal case for most roles, not an error condition).
  continue
}
```

Note: only emit skip for ERROR-LIKE silent skips, NOT for the "this role isn't relevant to our event-type filter" case. The filter for resign/death is intentional, not a failure.

Add ~3 tests covering cache-missing + YAML parse fail + state-extraction fail.

- [ ] **Step 7: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-community/town-halls state-ethics/events
pnpm --filter @chiaro/db typecheck
```

- [ ] **Step 8: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 755 + ~12 = ~767 tests PASS (3 tests × ~4 adapters with skip sites; townhallproject contributes 0).

- [ ] **Step 9: Commit Task 2**

```bash
git add packages/db/supabase/seed/state-community/town-halls \
        packages/db/supabase/seed/state-ethics/events
git commit -m "$(cat <<'EOF'
feat(state-community + state-ethics): town halls + events adapters honor onSkip

Slice 23 Task 2 instruments 5 production adapters' silent-skip sites:

- state-community/town-halls/ny-senate.ts (slice 15): fetch +
  per-event resolve. 3 tests.
- state-community/town-halls/mobilize.ts (slice 7/8): fetch + filter
  (title classifier mismatch) + per-event resolve. 3 tests.
- state-community/town-halls/townhallproject.ts (slice 7, deprecated):
  no-op (returns [] unconditionally). JSDoc updated for uniformity.
- state-ethics/events/ballotpedia-recalls.ts (slice 9): fetch +
  per-row parse + per-row resolve. 3 tests.
- state-ethics/events/openstates-end-reason.ts (slice 7): fetch
  (cache dir absent) + per-file parse (YAML/JSON) + per-role state
  extraction fail. Filter for resign/death end_reason is INTENTIONAL
  (not a skip emission — normal case). 3 tests.

All adapters use slice 22 widened interface (opts.onSkip?).
Existing tests unchanged (opt-in onSkip = back-compat).

Per spec: docs/superpowers/specs/2026-05-25-instrumentation-completion-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Scorecards — widen StateScorecardAdapter + wire onSkip

**Files:**
- Modify: `packages/db/supabase/seed/state-scorecards/shared.ts` (interface widen)
- Modify: `packages/db/supabase/seed/state-scorecards/lcv/mi.ts` + `.test.ts` (slice 11)
- Modify: `packages/db/supabase/seed/state-scorecards/lcv/co.ts` + `.test.ts` (slice 11)
- Modify: `packages/db/supabase/seed/state-scorecards/nra.ts` + `.test.ts` (slice 9)

- [ ] **Step 1: Widen `StateScorecardAdapter` interface**

Modify `state-scorecards/shared.ts`. Add import:
```ts
import type { SkipReason } from '../shared/instrumentation.ts'
```

Update `StateScorecardAdapter.fetchRatings` opts:
```diff
 export interface StateScorecardAdapter {
   slug: string
   // ... existing fields ...
   fetchRatings(opts: {
     client: Client
     session: string
     state?: string
     fetcher?: () => Promise<NormalizedStateRating[]>
+    onSkip?: (reason: SkipReason) => void
   }): Promise<NormalizedStateRating[]>
 }
```

- [ ] **Step 2: Identify LCV directory structure**

```bash
ls packages/db/supabase/seed/state-scorecards/lcv/
```

Expected output: `index.ts`, `helpers.ts`, `mi.ts`, `co.ts`, plus test files (per slice 11 subfolder pattern). Each per-state file is a function that fetches + parses + emits ratings.

Decision: Read `lcv/index.ts` to see how MI + CO sub-fetchers are wired. If there's a parent `lcvScorecards` adapter at `lcv/index.ts` that dispatches to per-state sub-fetchers, the onSkip propagates through `index.ts` to each sub-fetcher via a Promise.all-style or sequential loop.

- [ ] **Step 3: Instrument `lcv/mi.ts` + `lcv/co.ts`**

Each per-state file has HTML scrape + per-row resolve + per-row score parse. Instrument:
1. Fetch failure → `stage: 'fetch'`
2. Per-row resolve null → `stage: 'resolve'`
3. Per-row score parse fail → `stage: 'parse'`

Adapter slug for skip reasons: `'lcv'` (the parent scorecard adapter slug). State + chamber go in the skip reason's `detail` field.

- [ ] **Step 4: Instrument `nra.ts`**

NRA uses HTML scrape with browser UA (slice 9 Cloudflare workaround). Instrument:
1. Fetch failure → `stage: 'fetch'`
2. Per-row letter-grade parse fail → `stage: 'parse'`
3. Per-row resolve null → `stage: 'resolve'`

Adapter slug: `'nra'`.

- [ ] **Step 5: Update `lcv/index.ts` to propagate onSkip**

If LCV uses a multi-state dispatch pattern:
```ts
async fetchRatings(opts) {
  if (opts.fetcher) return opts.fetcher()
  const subOpts = opts.onSkip ? { onSkip: opts.onSkip } : {}
  // sequential dispatch (or Promise.all)
  const mi = await fetchLcvMiRatings(opts.client, opts.session, subOpts)
  const co = await fetchLcvCoRatings(opts.client, opts.session, subOpts)
  return [...mi, ...co]
}
```

- [ ] **Step 6: Add ~9 vitest tests**

3 tests per adapter (LCV-MI, LCV-CO, NRA). Existing tests unchanged.

- [ ] **Step 7: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-scorecards
pnpm --filter @chiaro/db typecheck
```

- [ ] **Step 8: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 767 + 9 = ~776 tests PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add packages/db/supabase/seed/state-scorecards
git commit -m "$(cat <<'EOF'
feat(state-scorecards): widen StateScorecardAdapter + wire onSkip in production parsers

Slice 23 Task 3 widens StateScorecardAdapter.fetchRatings opts with
optional onSkip? callback + instruments 3 production scorecard
parsers' silent-skip sites:

- lcv/mi.ts + lcv/co.ts (slice 11 LCV): fetch + per-row resolve +
  per-row score parse. ~6 tests.
- nra.ts (slice 9): fetch (Cloudflare gate via browser UA) +
  per-row letter-grade parse + per-row resolve. ~3 tests.
- lcv/index.ts propagates opts.onSkip through to MI + CO sub-fetchers.

ACLU + AFP + Planned Parenthood adapters NOT instrumented (slice 11
deprecated / slice 5G stubs — return [] unconditionally; no
silent-skip sites).

Per spec: docs/superpowers/specs/2026-05-25-instrumentation-completion-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: TX TEC `errors[]` → onSkip migration

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/tx-tec/shared.ts` (remove dual-write `errors.push` line for unresolved-legislator)
- Modify: `packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts` (update dual-write assertion to onSkip-only)

- [ ] **Step 1: Locate the dual-write line**

```bash
grep -n "errors.push.*unresolved" packages/db/supabase/seed/state-ethics/tx-tec/shared.ts
```

Expected match (slice 22 Task 3 added this):
```ts
errors.push(`unresolved: ${row.respondent} (${chamber})`)
opts.onSkip?.({ adapter: 'tx-tec', stage: 'resolve', ... })
```

- [ ] **Step 2: Remove the dual-write line**

```diff
   if (!openstates_person_id) {
-    // DUAL-WRITE: existing errors[] consumers stay; new onSkip channel
-    errors.push(`unresolved: ${row.respondent} (${chamber})`)
     opts.onSkip?.({
       adapter: 'tx-tec',
       stage: 'resolve',
       legislator: row.respondent,
       reason: `unmatched in officials (${chamber})`,
     })
     continue
   }
```

The `errors[]` array stays in the return type — it's still populated by the initial `fetch failed` case at line ~127:
```ts
} catch {
  return { complaints: [], events: [], errors: ['fetch failed'] }
}
```

That's the only remaining producer of `errors[]` entries. Operators reading `errors[]` for unresolved legislators must migrate to `stats.skipSummary.byAdapter.get('tx-tec').byStage.get('resolve')`.

- [ ] **Step 3: Update test assertions**

Find the slice 22 Task 3 test that asserts dual-write:
```bash
grep -n "errors\[.*unresolved" packages/db/supabase/seed/state-ethics/tx-tec/shared.test.ts
```

Remove the `errors[]` assertion; keep the onSkip assertion:
```diff
   it('emits resolve skip + tracks dual-write errors[] for unresolved', async () => {
     // ... setup ...
     const skips: SkipReason[] = []
     const result = await fetchSwornComplaintOrders(client as never, {
       fetcher: async () => html,
       onSkip: (r) => { skips.push(r) },
     })
-    // dual-write: errors[] + onSkip
-    expect(result.errors.some(e => e.includes('unresolved'))).toBe(true)
     expect(skips.find(s => s.stage === 'resolve' && s.adapter === 'tx-tec')).toBeDefined()
   })
```

Rename the test to reflect single-channel:
```ts
it('emits resolve skip for unresolved legislator (single channel)', async () => {
```

- [ ] **Step 4: Verify no other consumers of `errors[]` for unresolved**

```bash
grep -rn "tx-tec.*errors" packages/db/supabase/seed
grep -rn "errors\.includes.*unresolved" packages/db/supabase/seed
```

If any orchestrator code reads `stats.byAdapter[i].errors` looking for `unresolved:` substrings, migrate it to `stats.skipSummary?.byAdapter.get(...).byStage.get('resolve')`. (Unlikely — slice 22's orchestrator already prints skipSummary at end; the byAdapter[i].errors only surfaces the initial fetch-failed case.)

- [ ] **Step 5: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/tx-tec
pnpm --filter @chiaro/db typecheck
```
Expected: all tx-tec tests PASS (1 dual-write test renamed/updated; rest unchanged).

- [ ] **Step 6: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: ~776 tests PASS (test count unchanged; just renamed an existing test).

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-ethics/tx-tec
git commit -m "$(cat <<'EOF'
refactor(state-ethics): TX TEC errors[] → onSkip migration

Slice 22 Task 3 added DUAL-WRITE pattern to TX TEC unresolved-
legislator case: existing errors.push + new onSkip both called.
Slice 23 Task 4 consolidates to single channel — onSkip-only.

- tx-tec/shared.ts: remove `errors.push(\`unresolved: X\`)` line
  for the unresolved-legislator case. onSkip stays.
- errors[] array stays in return type but is now populated ONLY by
  the initial 'fetch failed' case (HTML fetch reject before any row
  is processed).
- tx-tec/shared.test.ts: dual-write test renamed + assertion updated
  to single-channel (onSkip-only).

Breaking change risk: any external consumer of
`stats.byAdapter[i].errors` looking for `unresolved:` substrings
must migrate to `stats.skipSummary.byAdapter.get('tx-tec').byStage.get('resolve')`.
Slice 22 already shipped skipSummary as the parallel channel; this
slice just retires the dual-write.

Per spec: docs/superpowers/specs/2026-05-25-instrumentation-completion-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Closure — CLAUDE.md slice 23 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 23 entry)
- Create (outside repo): memory file
- Modify (outside repo): MEMORY.md index

- [ ] **Step 1: Append slice 23 entry to CLAUDE.md**

After slice 22 entry in `## Slices delivered`, append:

```markdown
- **Slice 23 — Complete instrumentation framework** (2026-05-25): Wires `opts.onSkip?` callback (slice 22 framework) into the remaining production adapters that slice 22 deliberately deferred — single-page roster parsers (CA Senate + NY Assembly), town halls (`ny-senate`, `mobilize`, `townhallproject`), state-ethics events (`ballotpedia-recalls`, `openstates-end-reason`), and scorecards (LCV-MI + LCV-CO + NRA). Widens `StateScorecardAdapter.fetchRatings` opts with optional `onSkip?` callback (mirror of slice 22 Task 1 pattern for the 3rd adapter interface in the codebase). Consolidates TX TEC `errors[]` dual-write (slice 22 Task 3) to single-channel onSkip — `errors[]` stays in return type but is now populated only by the initial fetch-failed case. After slice 23: instrumentation coverage is uniform across all non-stub production adapters; only slice 5H/5I/11/21 deprecated stubs remain unwired (they `return []` unconditionally — nothing to instrument). ~22 files; no schema work; pgTAP unchanged at 402 plans. Test count: 749 → ~776 (+~27).
```

No new Gotcha — patterns are slice 22 verbatim.

- [ ] **Step 2: Write memory file** (full content TBD by implementer; follow slice 14-22 template with ~8-10 durable lessons)

- [ ] **Step 3: Update MEMORY.md index** with slice 23 line after slice 22

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm --filter @chiaro/web build
```

Expected: all green.

- [ ] **Step 5: Commit Task 5** (CLAUDE.md only — memory files outside repo)

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 23 closure — CLAUDE.md entry

Completes instrumentation framework coverage across all non-stub
production adapters. After slice 23: only slice 5H/5I/11/21
deprecated stubs remain unwired (return [] unconditionally —
nothing to instrument).

No new Gotcha — patterns are slice 22 verbatim.

@chiaro/db test count: +~27 (749 → ~776).
pgTAP unchanged at 402 plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Workspace verify gate (recap)

After all 5 tasks complete:

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run                         # ~776 tests green
pnpm --filter @chiaro/web build                                  # 12 routes
git log master..HEAD --oneline                                   # 7 commits (spec + plan + 5 implementation)
```

---

## Self-review notes

### Spec coverage

- ✅ CA Senate + NY Assembly single-page roster onSkip — Task 1
- ✅ Town halls (3 adapters) + state-ethics events (2 adapters) onSkip — Task 2
- ✅ StateScorecardAdapter interface widening + LCV-MI + LCV-CO + NRA onSkip — Task 3
- ✅ TX TEC dual-write removal — Task 4
- ✅ Closure docs + memory — Task 5

### Placeholder scan

No "TBD" placeholders — task structure delegates fine-grained step-level details to implementer when file shapes need scaffold-time verification (e.g. exact LCV directory structure). All instrumentation patterns are explicit (adapter slug + stage + skip context).

### Type consistency

- `SkipReason` import path: `'../../shared/instrumentation.ts'` from state-community/state-ethics/state-scorecards subdirs (2 levels up); `'../../../shared/instrumentation.ts'` from district-offices subfolders (3 levels up).
- All adapter slugs match their canonical slug values (ca-leginfo / ny-senate / mobilize / townhallproject / ballotpedia-recalls / openstates-end-reason / lcv / nra / tx-tec).
- `onSkip?` is OPTIONAL throughout — back-compat preserved.
- `StateScorecardAdapter.fetchRatings` keeps `session: string` requirement (slice 5G); only `onSkip?` is added.

### Known incomplete details

- LCV subfolder structure (mi.ts / co.ts split vs single file) verified by implementer at scaffold time. If LCV has a different layout, Task 3 adapts.
- `mobilize.ts` test file existence verified at scaffold time. If absent, Task 2 adds it.
- `townhallproject.ts` deprecated state may vary; verify the file's current shape before wiring.
- Memory file `<squash SHA>` placeholder filled post-merge per slice 14-22 precedent.
- Test count estimates ±2 per task due to vitest grouping; implementer reports actual.
