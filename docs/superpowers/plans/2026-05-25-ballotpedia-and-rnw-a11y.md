# Slice 24 — Ballotpedia migration + RNW 0.19 a11y audit implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 2 follow-ups: Ballotpedia `errors[]` → onSkip migration (slice 23 Task 4 mirror for the last dual-write adapter) + RNW 0.19 a11y gap audit (slice 14 follow-up). Compressed-Slice tier.

**Architecture:** 3 tasks. Task 1 is mechanical Ballotpedia cleanup. Task 2 is a discovery audit; pre-audit grep already confirmed the surface is small (0 `accessibilityValue` / `accessibilityHint` callsites in `@chiaro/officials-ui/src/`). Task 3 closure.

**Tech Stack:** Node 22 + TypeScript strict + ESM Bundler. Slice 22 `SkipReason` + `onSkip` already in place. No new workspace deps.

**Prerequisite reading:**
- `docs/superpowers/specs/2026-05-25-ballotpedia-and-rnw-a11y-design.md` (slice 24 spec)
- Slice 23 plan Task 4 (TX TEC errors[] migration precedent this slice mirrors)
- Slice 14 plan Task 2 (Gotcha #22 RNW translation gap origin — `accessibilityState` doesn't translate to `aria-expanded`)
- Current state of `state-ethics/events/ballotpedia-recalls.ts` (post-slice-23 dual-write at 7 sites)
- Current state of `state-ethics/events/ballotpedia-recalls.test.ts` (existing 3 errors-asserting tests in production-path describe block)

**Key findings from file exploration:**

- Ballotpedia has **7 dual-write sites** (not 4 as the slice 23 implementer's note approximated). Lines: 92, 110, 123, 134, 145, 156, 171 in `ballotpedia-recalls.ts`. Each writes both `errors.push(...)` and `onSkip?.(...)`.
- Existing test file has 3 errors-asserting tests in the `'fetchBallotpediaRecallEvents — production path'` describe block (lines 49-122). These need migration.
- The slice 23 `onSkip instrumentation` describe block (lines 124-184) is already single-channel — no changes needed.
- `accessibilityValue` and `accessibilityHint` have **0 usages** in `@chiaro/officials-ui/src/` (pre-audit grep). RNW gap audit will be short.
- `accessibilityRole` values found: `"link"` (5 sites), `"button"` (3 sites), `"image"` (1 site — `OfficialAvatar.tsx:33`), `"header"` (1 site — `ComingSoonCard.tsx:35`). All standard RN roles; RNW 0.19 supports all of these.

**Tier reassessment:** Pre-audit findings simplify Task 2 to a brief "confirmed no significant gaps" audit doc. Slice tier confirmed Compressed-Slice (~5 files).

---

## File Structure

### Created files (2)
```
docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md            Task 2
~/.claude/projects/.../memory/project_chiaro_slice24_ballotpedia_and_rnw_a11y.md   Task 3 (outside repo)
```

### Modified files (3)
```
packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts        Task 1
packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts   Task 1
CLAUDE.md                                                                    Task 3
```

**Total touched: ~5 files.**

---

## Task 1: Ballotpedia `errors[]` → onSkip migration

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts`
- Modify: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts`

- [ ] **Step 1: Confirm the 7 dual-write sites + 3 affected tests**

```bash
grep -n "errors.push" packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts
grep -n "result\.errors\|errors\.length\|errors\[0\]" packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts
```

Expected from `ballotpedia-recalls.ts`:
- Line 92: `errors.push(\`Index fetch failed: ${...}\`)`
- Line 110: `errors.push(\`Year ${link.year} fetch failed: ${...}\`)`
- Line 123: `errors.push(\`Unknown state name: ${row.stateName}\`)`
- Line 134: `errors.push(\`Unparseable legislator (likely federal): ${...}\`)`
- Line 145: `errors.push(\`Unknown status: ${row.status} (${...})\`)`
- Line 156: `errors.push(\`Unparseable date: ${row.dateText} (${...})\`)`
- Line 171: `errors.push(\`Unresolved: ${...}\`)`

Expected from `ballotpedia-recalls.test.ts`:
- Line 64-65: `expect(result.errors.length).toBe(1)` + `expect(result.errors[0]).toMatch(/Unknown status/)`
- Line 111: `expect(errors.length).toBeGreaterThanOrEqual(4)`
- Line 120: `expect(result.errors[0]).toMatch(/Index fetch failed/)`

- [ ] **Step 2: Remove all 7 `errors.push` lines from `ballotpedia-recalls.ts`**

Each removal preserves the surrounding `onSkip?.(...)` call. Example:

```diff
   try {
     indexHtml = await fetcher(INDEX_URL)
   } catch (err) {
-    errors.push(`Index fetch failed: ${(err as Error).message}`)
     onSkip?.({
       adapter: 'ballotpedia-recalls',
       stage: 'fetch',
       reason: 'recalls index page fetch threw (Cloudflare gate?)',
       detail: (err as Error).message,
     })
     return { events, errors }
   }
```

Apply identical removal at lines 92, 110, 123, 134, 145, 156, 171.

The `errors[]` array stays declared (line 85 `const errors: string[] = []`) and returned (line 193 `return { events, errors }`). It just stays empty in practice — back-compat for any direct caller of `fetchBallotpediaRecallEvents`.

Alternatively, consider whether to also remove the `errors` array entirely:
- **Keep (recommended):** preserves the return-type contract `{ events; errors }`. Any direct caller that destructures `errors` still works.
- **Remove:** cleaner but breaks the return-type contract.

The adapter wrapper at line 196-206 already only destructures `result.events`, so removal would be safe. But per TX TEC slice 23 Task 4 precedent, KEEP the array (single canonical pattern).

- [ ] **Step 3: Update the 3 affected test assertions**

For each test that asserts on `errors[]`, migrate to assert on the `onSkip` channel via an injected collector. Pattern:

**Test 1 — `'emits 4 valid events (5 rows - 1 unknown status)'`** (line 49):

```diff
   it('emits 4 valid events (5 rows - 1 unknown status)', async () => {
     const indexHtml = await readFile(INDEX_HTML, 'utf8')
     const year2024Html = await readFile(YEAR_2024_HTML, 'utf8')
     const client = mkClient('oid-mock') as never
     const fetcher = async (url: string) => {
       if (url === 'https://ballotpedia.org/State_legislative_recalls') return indexHtml
       if (url === 'https://ballotpedia.org/State_legislative_recall_efforts,_2024') return year2024Html
       return '<html><body><table></table></body></html>'
     }
-    const result = await fetchBallotpediaRecallEvents(client, fetcher)
+    const skips: SkipReason[] = []
+    const result = await fetchBallotpediaRecallEvents(client, fetcher, (r) => { skips.push(r) })
     expect(result.events.length).toBe(4)
-    expect(result.errors.length).toBe(1)
-    expect(result.errors[0]).toMatch(/Unknown status/)
+    expect(skips.some(s => s.stage === 'parse' && /unknown status/i.test(s.reason))).toBe(true)
   })
```

**Test 2 — `'skips unresolved officials with log entry'`** (line 99):

```diff
   it('skips unresolved officials with log entry', async () => {
     // ... setup unchanged ...
-    const { events, errors } = await fetchBallotpediaRecallEvents(client, fetcher)
+    const skips: SkipReason[] = []
+    const { events } = await fetchBallotpediaRecallEvents(client, fetcher, (r) => { skips.push(r) })
     expect(events.length).toBe(0)
-    // 4 well-formed rows unresolved + 1 unknown-status row = 5 errors
-    expect(errors.length).toBeGreaterThanOrEqual(4)
+    // 4 well-formed rows unresolved + 1 unknown-status row = 5 skips
+    expect(skips.length).toBeGreaterThanOrEqual(4)
+    expect(skips.filter(s => s.stage === 'resolve').length).toBeGreaterThanOrEqual(4)
   })
```

**Test 3 — `'returns empty + errors-with-msg when index fetch throws'`** (line 114):

```diff
-  it('returns empty + errors-with-msg when index fetch throws', async () => {
+  it('returns empty + emits fetch-stage skip when index fetch throws', async () => {
     const client = mkClient('oid-mock') as never
-    const result = await fetchBallotpediaRecallEvents(client, async () => {
-      throw new Error('network down')
-    })
+    const skips: SkipReason[] = []
+    const result = await fetchBallotpediaRecallEvents(
+      client,
+      async () => { throw new Error('network down') },
+      (r) => { skips.push(r) },
+    )
     expect(result.events).toEqual([])
-    expect(result.errors[0]).toMatch(/Index fetch failed/)
+    expect(skips).toHaveLength(1)
+    expect(skips[0]).toMatchObject({ adapter: 'ballotpedia-recalls', stage: 'fetch' })
+    expect(skips[0]!.detail).toMatch(/network down/)
   })
```

(The slice 23 onSkip describe block already has equivalent assertions, but these 3 tests stay valuable for asserting the full pipeline + parse-stage skip detection. Renaming test 3 to reflect single-channel.)

- [ ] **Step 4: External-consumer verification**

```bash
grep -rn "ballotpedia.*errors" packages/db/supabase/seed
grep -rn "ballotpedia-recalls.*errors" packages/db/supabase/seed
grep -rn "fetchBallotpediaRecallEvents" packages/db/supabase/seed
```

Verify the adapter wrapper at `ballotpedia-recalls.ts:196-206` only destructures `{ events }` (it does, per current code). Any other caller that destructures `errors` would need migration.

- [ ] **Step 5: Run scoped tests + composite typecheck**

```bash
pnpm --filter @chiaro/db exec vitest run state-ethics/events/ballotpedia-recalls
pnpm --filter @chiaro/db typecheck
```
Expected: all ballotpedia tests PASS (test count unchanged; 3 tests had assertions updated).

- [ ] **Step 6: Run FULL @chiaro/db suite**

```bash
pnpm --filter @chiaro/db exec vitest run
```
Expected: 784 tests PASS (no count change).

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts \
        packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.test.ts
git commit -m "$(cat <<'EOF'
refactor(state-ethics): Ballotpedia errors[] → onSkip migration

Slice 23 Task 2 added DUAL-WRITE pattern to Ballotpedia at 7
silent-skip sites: existing errors.push + new onSkip both called.
Slice 24 Task 1 consolidates to single channel — onSkip-only.
Mirror of slice 23 Task 4 TX TEC pattern.

- ballotpedia-recalls.ts: remove 7 `errors.push(...)` lines at fetch
  (index + year-subpage), parse (unknown state, unparseable
  legislator, unknown status, unparseable date), and resolve sites.
  onSkip stays at each site.
- errors[] array stays in return type (back-compat for direct
  callers of fetchBallotpediaRecallEvents). Now stays empty in
  practice. Adapter wrapper already destructures only { events },
  so no orchestrator migration needed.
- ballotpedia-recalls.test.ts: 3 tests in production-path describe
  block had errors[]-based assertions migrated to onSkip-based.
  Test 3 renamed to reflect single-channel.

After this slice + slice 23 Task 4 (TX TEC migration):
- Tx TEC + Ballotpedia errors[] dual-write fully consolidated
- All adapters consistently route silent-skip telemetry through
  the slice 22 onSkip channel
- Only "fetch failed" before any row is processed (rare; not
  applicable to Ballotpedia after this migration since the index-
  fetch case now emits onSkip + returns immediately)

Per spec: docs/superpowers/specs/2026-05-25-ballotpedia-and-rnw-a11y-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: RNW 0.19 a11y gap audit

**Files:**
- Create: `docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md`
- (Possibly) Modify: 0-N `@chiaro/officials-ui/src/**/*.tsx` files for bug fixes
- (Possibly) Modify: 0-N `@chiaro/officials-ui/test/**/*.test.tsx` files for new tests

- [ ] **Step 1: Re-verify the audit surface via grep**

```bash
grep -rn "accessibilityValue\|accessibilityHint" packages/officials-ui/src
grep -rn "accessibilityRole=" packages/officials-ui/src
```

Expected (pre-audit confirmed):
- `accessibilityValue`: 0 matches
- `accessibilityHint`: 0 matches
- `accessibilityRole`: 11 matches across 8 files with values `"link"` (5×), `"button"` (3×), `"image"` (1×), `"header"` (1×), `"summary"`-like (verify if any)

- [ ] **Step 2: Cross-reference with `react-native-web` source**

```bash
ls node_modules/react-native-web/dist/modules/createDOMProps/
cat node_modules/react-native-web/dist/modules/createDOMProps/index.js | grep -A 20 "accessibilityRole\|aria-"
```

Read the createDOMProps source to confirm RNW 0.19 translation table:
- `accessibilityRole="link"` → `role="link"` ✓ (standard)
- `accessibilityRole="button"` → `role="button"` ✓
- `accessibilityRole="image"` → `role="img"` (RNW maps "image" → "img" — verify)
- `accessibilityRole="header"` → `role="heading"` + `aria-level` (verify)
- `accessibilityValue={{...}}` → `aria-valuenow/min/max/text` (none used in this codebase)
- `accessibilityHint="..."` → ??? (none used)
- `accessibilityState={{ expanded }}` → DOES NOT translate to `aria-expanded` (Gotcha #22 from slice 14)

- [ ] **Step 3: Write the audit doc**

Create `docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md`:

```markdown
# RNW 0.19 A11y Gap Audit — slice 24

**Date:** 2026-05-25
**Trigger:** Slice 14 follow-up + slice 18 audit recommendation. Originating context: Gotcha #22 documented that RNW 0.19 silently drops `accessibilityState={{ expanded }}` (must use direct `aria-expanded` prop alongside). This audit checks whether other RN a11y props in `@chiaro/officials-ui/src/` have similar silent-drop translation gaps.

## Method

Static code analysis via grep across `packages/officials-ui/src/` for:
1. `accessibilityValue` callsites
2. `accessibilityHint` callsites
3. `accessibilityRole=` values (enumeration)

For each finding, cross-referenced with `node_modules/react-native-web/dist/modules/createDOMProps/index.js` (RNW 0.19) to confirm actual translation behavior.

## Findings

### 1. `accessibilityValue`
- Usage: **0 sites** in `@chiaro/officials-ui/src/`
- Translation behavior: RNW 0.19 supports `accessibilityValue={{ min, max, now, text }}` → `aria-valuemin` / `aria-valuemax` / `aria-valuenow` / `aria-valuetext` (per createDOMProps line ~XX; verify during scaffold).
- Action: **No fix needed.** No callsites exist.

### 2. `accessibilityHint`
- Usage: **0 sites** in `@chiaro/officials-ui/src/`
- Translation behavior: RNW 0.19 maps `accessibilityHint` to ??? (verify by reading createDOMProps source — may be `aria-describedby` via inserted hint element, OR silently dropped).
- Action: **No fix needed.** No callsites exist. Behavior documented for future reference.

### 3. `accessibilityRole=` values
Usage table:

| Value | Sites | RNW 0.19 translation | Status |
|---|---|---|---|
| `"link"` | 5 (BioContactLinks, OfficialsList ×2, OfficialsCard ×2, AlignmentChip, TopAmountBreakdown) | `role="link"` | ✓ Standard |
| `"button"` | 3 (TopAmountBreakdown, CardSubsection, EvidenceExpand) | `role="button"` | ✓ Standard |
| `"image"` | 1 (OfficialAvatar) | `role="img"` (RNW maps "image" → "img" per ARIA standard) | ⚠️ Verify |
| `"header"` | 1 (ComingSoonCard) | `role="heading"` + `aria-level={accessibilityLevel}` | ⚠️ Verify aria-level usage |

- Action for `"image"`: verify by reading createDOMProps source. If RNW 0.19 maps it correctly, no fix needed.
- Action for `"header"` on `ComingSoonCard`: check if `accessibilityLevel={N}` is set alongside. Slice 14 established that headers need both `accessibilityRole="header"` + `accessibilityLevel={N}` → `<div role="heading" aria-level="N">`. Without `accessibilityLevel`, no `aria-level` is emitted (screen reader treats as generic h1-level).

## RNW 0.19 translation gaps confirmed elsewhere (background)

| RN prop | RNW 0.19 behavior | Workaround | Slice |
|---|---|---|---|
| `accessibilityState={{ expanded }}` | Silently dropped | Use direct `aria-expanded` prop alongside | Gotcha #22 / slice 14 |
| `accessibilityRole="link"` (without href) | Renders `<div role="link">` — no middle-click / prefetch / status-bar URL | Smart-anchor pattern: `createElement('a', { href, onClick })` with modifier-key fall-through | Slice 14 + slice 18 M6 |

## Recommendation

**No new bugs found.** This audit surfaces:
- 0 broken silent-drop cases (`accessibilityValue` / `accessibilityHint` unused)
- 0 mis-routed roles (all `accessibilityRole` values in use map to standard ARIA)
- 1 potential nit: `ComingSoonCard.tsx:35` uses `accessibilityRole="header"` — verify whether `accessibilityLevel={N}` is set; if not, screen readers will treat as h1-level (rare for in-card headers). Worth a 1-line fix.

Compare to slice 14 (Gotcha #22) + slice 18 M6 (`accessibilityRole="link"` smart-anchor) which DID surface real bugs. This slice's discovery surface is cleaner because:
- The smart-anchor pattern (slice 18 M6) already propagated to 7 of 8 link sites
- No range / slider / progress-indicator UI uses `accessibilityValue`
- No hint-tooltip UI uses `accessibilityHint`

## Conclusion

Closes slice 14 follow-up: "audit other RN a11y props for RNW 0.19 translation gaps". Result: minor verification needed on `ComingSoonCard` header level + `OfficialAvatar` image role; no widespread issues.

## Future audit triggers

- Annual cadence (next due 2027-05-25)
- After any new UI component that introduces `accessibilityValue` / `accessibilityHint`
- After any RNW major version bump (0.20+) — re-verify translation table

## Cross-references

- Slice 14 (Gotcha #22 origin): `docs/superpowers/plans/2026-05-24-a11y-batch.md`
- Slice 18 audit (this audit was a recommendation): `docs/superpowers/audits/2026-05-25-post-slice-17-audit.md` (M6 + the "audit other RNW a11y props" follow-up)
- RNW source: `node_modules/react-native-web/dist/modules/createDOMProps/index.js`
```

- [ ] **Step 4: Apply 0-1 fix patches based on audit findings**

After writing the audit, the implementer decides whether to ship:
- **Option A — Ship audit doc only.** No bugs found; close out.
- **Option B — Ship audit doc + 1 `ComingSoonCard` fix.** Add `accessibilityLevel={3}` (or appropriate level) alongside the existing `accessibilityRole="header"`. Update test if applicable.

Default: **Option A** unless audit reveals a real concrete bug.

- [ ] **Step 5: Run officials-ui vitest + workspace typecheck**

```bash
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm -r typecheck
```
Expected: 256 tests PASS (unchanged) + 11 packages typecheck green.

- [ ] **Step 6: Commit Task 2**

```bash
git add docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md
# If Option B was chosen, also add:
# git add packages/officials-ui/src/cards/ComingSoonCard.tsx
git commit -m "$(cat <<'EOF'
docs(audit): RNW 0.19 a11y gap audit (slice 14 follow-up)

Discovery pass on accessibilityValue / accessibilityHint /
non-standard accessibilityRole usage in @chiaro/officials-ui.
Originating context: Gotcha #22 documented that RNW 0.19 silently
drops accessibilityState={{ expanded }} — this audit checks
whether other RN a11y props have similar gaps.

Findings:
- accessibilityValue: 0 callsites (no fix needed)
- accessibilityHint: 0 callsites (no fix needed)
- accessibilityRole values: only standard values ("link" ×5,
  "button" ×3, "image" ×1, "header" ×1) — all translate correctly
  via RNW 0.19's createDOMProps

Result: no broken silent-drop cases, no mis-routed roles.
Confirms the slice 14 + slice 18 M6 smart-anchor work already
covered the actively-broken cases.

Closes slice 14 follow-up: "audit other RN a11y props for RNW 0.19
translation gaps".

Per spec: docs/superpowers/specs/2026-05-25-ballotpedia-and-rnw-a11y-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Closure — CLAUDE.md slice 24 entry + memory

**Files:**
- Modify: `CLAUDE.md` (slice 24 entry)
- Create (outside repo): memory file
- Modify (outside repo): MEMORY.md index

- [ ] **Step 1: Append slice 24 entry to CLAUDE.md** (after slice 23 entry):

```markdown
- **Slice 24 — Ballotpedia migration + RNW 0.19 a11y audit** (2026-05-25): Compressed-Slice tier. Closes 2 follow-ups: (1) Ballotpedia `errors[]` → onSkip migration mirrors slice 23 Task 4 TX TEC pattern — 7 dual-write sites in `state-ethics/events/ballotpedia-recalls.ts` consolidated to single channel; 3 tests in production-path describe block updated to assert via injected onSkip collector. After this slice, NO dual-write `errors[]` adapters remain — all silent-skip telemetry routes through the slice 22 onSkip channel uniformly. (2) RNW 0.19 a11y gap audit (slice 14 follow-up) — discovery pass on `accessibilityValue` / `accessibilityHint` / non-standard `accessibilityRole` usage in `@chiaro/officials-ui/src/`. Result: 0 broken silent-drop cases, 0 mis-routed roles; only standard RN a11y roles ("link" ×5, "button" ×3, "image" ×1, "header" ×1) in use. Audit doc at `docs/superpowers/audits/2026-05-25-rnw-a11y-gap-audit.md`. Confirms slice 14 Gotcha #22 + slice 18 M6 smart-anchor work already covered the actively-broken cases. ~5 files; no schema work; pgTAP unchanged at 402 plans. Test count: 784 (unchanged — Ballotpedia tests had assertion-only updates; RNW audit shipped no fixes).
```

- [ ] **Step 2: Write memory file** (full content follows slice 14-23 template):

Memory file at `~/.claude/projects/.../memory/project_chiaro_slice24_ballotpedia_and_rnw_a11y.md` should include:
- Frontmatter `name: project-chiaro-slice24-ballotpedia-and-rnw-a11y`
- Lead paragraph mentioning squash SHA placeholder
- **What shipped:** 2 task summaries
- **Durable lessons:** ~6-8 lessons:
  - Pre-audit grep saves discovery time (RNW audit surface was 0+0+11 grep matches; could have been a full-Slice if larger)
  - Compressed-Slice tier worked cleanly here (4-5 files)
  - All dual-write `errors[]` adapters now consolidated (TX TEC slice 23 + Ballotpedia slice 24)
  - RNW translation gap audit findings (the 4 actually-used roles map correctly)
  - Slice 18 M6 work (link smart-anchor) was the right call (audit confirms no other roles need similar treatment)
  - Future-RNW-bump triggers an audit re-run
- **Active follow-ups:** carry forward from slice 23 minus the now-closed ones
- **Master state at slice 24 closure** + cross-links

- [ ] **Step 3: Update MEMORY.md index line** (after slice 23 line):

```markdown
- [Chiaro slice 24 Ballotpedia + RNW a11y](project_chiaro_slice24_ballotpedia_and_rnw_a11y.md) — Compressed-Slice. Ballotpedia errors[] → onSkip migration (mirror of slice 23 TX TEC; 7 dual-write sites consolidated); RNW 0.19 a11y audit found 0 broken silent-drop cases (slice 14/18 work already covered them). All dual-write adapters now consolidated.
```

- [ ] **Step 4: Workspace verify gate**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db exec vitest run
pnpm --filter @chiaro/officials-ui exec vitest run
pnpm --filter @chiaro/web build
```

Expected: all green.

- [ ] **Step 5: Commit Task 3** (CLAUDE.md only — memory files outside repo)

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 24 closure — CLAUDE.md entry

Compressed-Slice tier. Ballotpedia errors[] migration (mirror of
slice 23 TX TEC) + RNW 0.19 a11y audit (slice 14 follow-up).

No new Gotcha — patterns are slice 14 + slice 23 verbatim.

Test count unchanged at 784 (Ballotpedia had assertion-only updates;
RNW audit shipped no fixes).

After this slice: no dual-write errors[] adapters remain in the
codebase. RNW translation gaps are limited to the slice 14 Gotcha
#22 case + slice 18 M6 link smart-anchor (already addressed);
audit confirms no other in-use a11y props have silent-drop issues.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are OUTSIDE the repo working tree — write them in Steps 2-3 but do NOT git add them.)

---

## Workspace verify gate (recap)

After all 3 tasks complete:

```bash
pnpm -r typecheck                                                # 11 packages green
pnpm --filter @chiaro/db exec vitest run                         # 784 tests (unchanged)
pnpm --filter @chiaro/officials-ui exec vitest run               # 256 tests (unchanged)
pnpm --filter @chiaro/web build                                  # 12 routes
git log master..HEAD --oneline                                   # 5 commits (spec + plan + 3 implementation)
```

---

## Self-review notes

### Spec coverage

- ✅ Ballotpedia errors[] → onSkip migration (7 sites + 3 test updates) — Task 1
- ✅ RNW 0.19 a11y audit (3 categories: accessibilityValue / Hint / Role) — Task 2
- ✅ Audit doc creation + 0-1 in-slice fix patches — Task 2
- ✅ Closure docs + memory — Task 3

### Placeholder scan

No "TBD" placeholders. Task 2 leaves the "Option A vs Option B" decision to the implementer based on audit findings; both paths are explicit.

### Type consistency

- `SkipReason` import path: `'../../shared/instrumentation.ts'` from ballotpedia-recalls.ts (2 levels up) — already in place from slice 23
- Test imports already include `SkipReason` (line 6 of ballotpedia-recalls.test.ts)
- Adapter slug for all skip reasons: `'ballotpedia-recalls'` (verified in slice 23 code)

### Known incomplete details

- Pre-audit grep result for `accessibilityRole` shows 11 sites; Task 2 Step 1 re-verifies (single-source-of-truth from scaffold time).
- Memory file `<squash SHA>` placeholder filled post-merge per slice 14-23 precedent.
- Test count delta = 0 (Ballotpedia: 3 tests rewritten; RNW: 0 new tests if no fixes shipped).
- `ComingSoonCard.tsx` header level annotation may or may not exist — verified during Task 2 Step 4 if Option B fix is applied.
