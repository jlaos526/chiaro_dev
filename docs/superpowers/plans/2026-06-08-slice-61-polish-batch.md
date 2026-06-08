# Slice 61 — Consistency/polish batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the remaining LOW/MED audit findings (track T6) — error-swallowing, a non-transitive sort, telemetry loss, a11y gaps, a smart-anchor consolidation, and thin tests — closing the 2026-06-05 comprehensive audit.

**Architecture:** Themed tasks, each a focused commit. Bug fixes are TDD where a test expresses them; a11y/UX add tests asserting DOM/behavior. The smart-anchor work extracts a behavior-only `SmartAnchor` primitive (the existing `BrandLink` is a *styled* text-link, not a drop-in). No schema.

**Tech Stack:** TypeScript, react-native-web, vitest, jest-expo, TanStack Query (mocked), Sentry RN.

**Branch:** `slice-61-polish-batch` (spec `8560e93` committed).

**Conventions:** Sequential implementers (Gotcha #25). E5 is moot (slice 58 deleted those schemas).

---

### Task 1: B7 (`@chiaro/bills` error-swallowing) + B8 (`state-bills` sort)

**Files:**
- Modify: `packages/bills/src/queries.ts`, `packages/state-bills/src/queries.ts`
- Test: `packages/bills/test/...`, `packages/state-bills/test/...`

**B7:** the first sub-query in `fetchOfficialSponsoredBills` (`:9` `const { data: ids } = await client.from('bill_sponsors')…`), `fetchOfficialCosponsoredBills` (`:25`), `fetchOfficialMissedVotes` (`:41` the `votes` lookup) destructures `{ data }` with no `error` → silent `[]`. **B8:** `state-bills/queries.ts:84,144` `rows.sort((a, b) => (b.vote.vote_date < a.vote.vote_date ? -1 : 1))` is non-transitive + null-unsafe.

- [ ] **Step 1: B7 — read** `packages/bills/src/queries.ts` + the test file. For each of the 3 fetchers, change the first sub-query to capture + throw the error:
```ts
const { data: ids, error: idsErr } = await client.from('bill_sponsors')…
if (idsErr) throw idsErr
```
(and the analogous `votes` lookup in `fetchOfficialMissedVotes`). Add/adjust a unit test asserting the fetcher throws when the first sub-query returns an error (mirror the existing `if (error) throw error` second-query test, if present).

- [ ] **Step 2: B8 — read** `packages/state-bills/src/queries.ts:79-95,140-150` + the test. Replace both `rows.sort(...)` lines with:
```ts
rows.sort((a, b) => (b.vote.vote_date ?? '').localeCompare(a.vote.vote_date ?? ''))
```
This is DESC (newest first — `b.localeCompare(a)` orders the larger ISO-date string first), returns 0 on equal dates (transitive), and is null-safe (null → `''` sorts last). Add a test: a fixture with two equal `vote_date`s + one `null` asserts no throw + the null-date row sorts last + stable order.

- [ ] **Step 3: Verify.** `pnpm --filter @chiaro/bills test` + `pnpm --filter @chiaro/state-bills test` + `pnpm -r typecheck`. (bills' integration test env-skips without Supabase — fine.)

- [ ] **Step 4: Commit.**
```bash
git add packages/bills/ packages/state-bills/
git commit -m "fix(slice-61): throw on bills sub-query errors + transitive null-safe state-bills sort (B7,B8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: B10 (mobile Sentry) + B11 (`IssueRadarChart` empty-axes)

**Files:**
- Modify: `apps/mobile/lib/sentry.ts`, `packages/officials-ui/src/issues/IssueRadarChart.tsx`
- Test: `apps/mobile/test/...` (sentry), `packages/officials-ui/test/issues/IssueRadarChart.test.tsx`

**B10:** `apps/mobile/lib/sentry.ts:40-41` `catch { return null }` drops the whole event. **B11:** `IssueRadarChart` has no `axes.length === 0` guard → `radarPolygon([])` → `<Polygon points="" />`.

- [ ] **Step 1: B10 — read** `apps/mobile/lib/sentry.ts`. In the `beforeSend` catch, return a minimal stripped event instead of `null`:
```ts
beforeSend(event) {
  try {
    scrubAddressInPlace(event)
  } catch {
    return { message: event.message, level: event.level } as typeof event
  }
  return event
}
```
Add a test (`apps/mobile/test/sentry.test.ts` or extend an existing one): make `scrubAddressInPlace` throw (e.g. pass an event whose shape trips it, or spy/mock it to throw) → assert `beforeSend` returns a truthy object with `message`/`level` (NOT null). (jest-expo; check how sentry is currently tested — there may be a shared scrubber test.)

- [ ] **Step 2: B11 — read** `packages/officials-ui/src/issues/IssueRadarChart.tsx`. After `const n = axes.length`, add an early guard:
```tsx
  if (n === 0) {
    return (
      <View accessibilityLabel="Issue priorities radar: no data">
        <Text style={{ color: c.grid, fontSize: 12 }}>No issue data yet.</Text>
      </View>
    )
  }
```
(Import `Text` from `react-native` if not already.) Add tests to `IssueRadarChart.test.tsx`: `axes={[]}` → renders the "No issue data" placeholder + no `<polygon>`/throw; `axes={['Solo']}, userValues={[0.5]}` (n=1) → renders without crashing (1 spoke).

- [ ] **Step 3: Verify.** `pnpm --filter @chiaro/mobile test` + `pnpm --filter @chiaro/officials-ui test IssueRadarChart` + `pnpm -r typecheck`.

- [ ] **Step 4: Commit.**
```bash
git add apps/mobile/lib/sentry.ts apps/mobile/test/ packages/officials-ui/src/issues/IssueRadarChart.tsx packages/officials-ui/test/issues/IssueRadarChart.test.tsx
git commit -m "fix(slice-61): sentry keeps minimal event on scrub-throw + radar empty-axes guard (B10,B11)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: B12 (mobile `(app)/_layout` flash)

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Test: `apps/mobile/test/nav-guards.test.tsx` (extend — slice 59 created it)

Context: `(app)/_layout.tsx` renders `<BrandDrawer/>` while `calibrationStatus === 'unknown'` during the async `check()`, then redirects uncalibrated users → a flash of the app before `/calibrate`.

- [ ] **Step 1: Read** `apps/mobile/app/(app)/_layout.tsx`. Add a loading gate BEFORE the `uncalibrated && … → <Redirect>` check and the `<BrandDrawer/>` return:
```tsx
  if (calibrationStatus === 'unknown') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }
```
(Import `ActivityIndicator`, `View` from `react-native`.) This mirrors the root `_layout`'s `!loaded` gate.

- [ ] **Step 2: Extend `nav-guards.test.tsx`** — add a case: render `<AppLayout/>` with the calibration check still pending (status `'unknown'`) → assert it renders the loading placeholder (`ActivityIndicator`) and NOT `<BrandDrawer/>` / `<Redirect>`. (Mock so the async `check()` hasn't resolved yet — e.g. a never-resolving `getItem`/`getUser`, or assert the synchronous initial render before flushing effects.)

- [ ] **Step 3: Verify.** `pnpm --filter @chiaro/mobile test nav-guards` + `pnpm -r typecheck`.

- [ ] **Step 4: Commit.**
```bash
git add "apps/mobile/app/(app)/_layout.tsx" apps/mobile/test/nav-guards.test.tsx
git commit -m "fix(slice-61): mobile app layout shows loading gate while calibration status unknown (B12)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: C5 + E6 — extract `SmartAnchor`, apply to issue CTAs, migrate 3 named sites

**Files:**
- Create: `packages/officials-ui/src/primitives/SmartAnchor.tsx` + test
- Modify: `packages/officials-ui/src/issues/RepAlignmentStrip.tsx`, `MyIssuesCard.tsx` (C5) + the consuming app pages that pass the CTA href
- Modify: `packages/officials-ui/src/bio/BioContactLinks.tsx`, `cards/AlignmentChip.tsx`, `finance/TopAmountBreakdown.tsx` (E6 — the 3 audit-named copies)

Context: `BrandLink` (`primitives/BrandLink.tsx`) is a *styled* text-link, not a drop-in for chips/cards/CTAs. Extract a **behavior-only** `SmartAnchor`: on web renders `<a href>` with the modifier-key-passthrough `onClick` and NO imposed visual style (so the caller's existing styling shows); native renders a `Pressable` (role=link) wrapping the children. The 8 inline smart-anchor copies (the modifier-key `onClick`) can migrate to it; this slice migrates the **3 audit-named** ones + uses it for C5. (The other 5 — `OfficialsCard`/`OfficialsList`/`SettingsNavRow`/`AuthCrossLink`/`BioAlignmentChipRow` — are consistent; note them as a future consolidation, out of scope here.)

- [ ] **Step 1: Read** `BrandLink.tsx` (the modifier-key onClick logic to mirror) + the 3 named sites + `RepAlignmentStrip.tsx`/`MyIssuesCard.tsx` (their CTA rendering) to see each one's existing smart-anchor inline + styling.

- [ ] **Step 2: Create `SmartAnchor.tsx`** (behavior-only) + its test:
```tsx
'use client'
import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable } from 'react-native'

export interface SmartAnchorProps {
  children: ReactNode
  href: string
  onPress?: () => void
  /** passthrough style for the rendered <a> / Pressable (caller owns visuals) */
  style?: Record<string, unknown>
  accessibilityLabel?: string
}

/** Behavior-only smart anchor (slice 14/18 pattern, style-agnostic — unlike the
 *  styled BrandLink). Web: real <a href> with modifier-key passthrough
 *  (cmd/ctrl/shift/middle fall through to the browser; plain left-click →
 *  preventDefault + onPress). Native: Pressable role=link. Caller supplies
 *  the visual style. */
export function SmartAnchor({ children, href, onPress, style, accessibilityLabel }: SmartAnchorProps): React.JSX.Element {
  if (Platform.OS === 'web') {
    return createElement('a', {
      href,
      'aria-label': accessibilityLabel,
      onClick: (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
        e.preventDefault()
        onPress ? onPress() : Linking.openURL(href).catch(() => {})
      },
      style: { textDecoration: 'none', color: 'inherit', ...style },
    }, children)
  }
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel}
      onPress={() => (onPress ? onPress() : Linking.openURL(href).catch(() => {}))} style={style}>
      {children}
    </Pressable>
  )
}
```
Export from `packages/officials-ui/src/index.ts`. Test (web jsdom): renders `<a href>`; a plain click `preventDefault`s + calls `onPress`; a `{ metaKey: true }` click does NOT call `onPress` (falls through). (Mirror `BrandLink.test.tsx` / `AlignmentChip.test.tsx` modifier-key assertions.)

- [ ] **Step 3: C5 — issue CTAs.** In `RepAlignmentStrip.tsx`: add an optional `setupHref?: string` prop; where the CTA `<Pressable onPress={onSetup}>` renders, when `setupHref` is provided on web, wrap/replace with `<SmartAnchor href={setupHref} onPress={onSetup} style={…}>` (keep the existing visual). In `MyIssuesCard.tsx`: same with `editHref?: string` for the `onEdit` CTA. Thread the `*Href?` props through `RepAlignmentSection` (which renders `RepAlignmentStrip`) and the home `MyIssuesCard` consumer so the **web** app pages pass `/issues` (native passes nothing → Pressable fallback). Read how the slice-52/14 `chipHref`/`rowHref` callback props are threaded (same convention) and mirror it.

- [ ] **Step 4: E6 — migrate the 3 named sites** (`BioContactLinks`, `AlignmentChip`, `TopAmountBreakdown`): replace each file's inline `createElement('a', {…modifier onClick…})` block with `<SmartAnchor href={…} onPress={…} style={…} accessibilityLabel={…}>`, preserving the exact href/onPress/style/label each currently uses. The rendered DOM should be equivalent (real `<a>` + modifier passthrough). Run each component's existing test after to confirm no regression (these have smart-anchor tests from slice 14/18).

- [ ] **Step 5: Verify.** `pnpm --filter @chiaro/officials-ui test` + `pnpm --filter @chiaro/web test` + `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/mobile test` + `pnpm -r typecheck`. Confirm the 3 migrated sites' existing modifier-key tests still pass.

- [ ] **Step 6: Commit.**
```bash
git add packages/officials-ui/ apps/web/ apps/mobile/
git commit -m "refactor(slice-61): extract SmartAnchor; issue CTAs + 3 sites use it (C5,E6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: C6 (`aria-live` counters) + C7 (`MetricCardShell` label)

**Files:**
- Modify: `packages/officials-ui/src/issues/TopicPickerScreen.tsx`, `IssueQuizScreen.tsx` (C6), `cards/MetricCardShell.tsx` (C7)
- Test: extend the respective tests

- [ ] **Step 1: C6 — read** `TopicPickerScreen.tsx` + `IssueQuizScreen.tsx`; find the progress-counter `<Text>` (the `N/6` / `answered/total`). Add `aria-live="polite"` to each (web direct prop; native ignores). Optionally add an `accessibilityLiveRegion="polite"` for native parity.

- [ ] **Step 2: C7 — `MetricCardShell.tsx:115`** — `accessibilityLabel={\`${renderedLabel}: ${typeof value === 'string' ? value : ''}\`}` drops numbers/nodes. Add an optional `valueLabel?: string` to the props and compute:
```tsx
const valueText = props.valueLabel ?? (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
// accessibilityLabel={`${renderedLabel}: ${valueText}`}
```
(So a numeric `value` reads "Label: 42"; a ReactNode `value` uses the caller-supplied `valueLabel` when present, else falls back to '' as before.)

- [ ] **Step 3: Tests** — TopicPicker/IssueQuiz: assert the counter `<Text>` has `aria-live="polite"` (DOM attr). MetricCardShell: render with a numeric `value` → assert `accessibilityLabel` (→ `aria-label`) contains the number; render with `valueLabel` → assert it's used.

- [ ] **Step 4: Verify.** `pnpm --filter @chiaro/officials-ui test "TopicPicker|IssueQuiz|MetricCardShell"` (pass as separate args) + `pnpm -r typecheck`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/
git commit -m "fix(slice-61): aria-live progress counters + MetricCardShell label coercion (C6,C7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: E7 (comment) + E8 (`AuthForm` success channel) + E9 (`mapCalibrateError`)

**Files:**
- Modify: `apps/web/components/DistrictPanel.tsx` (E7)
- Modify: `packages/officials-ui/src/auth/AuthForm.tsx`, `apps/web/app/sign-up/page.tsx` (E8) + `AuthForm.test.tsx`
- Create: `apps/web/lib/calibrate-error.ts` + Modify: `apps/web/app/calibrate/page.tsx`, `apps/web/app/settings/address/page.tsx` (E9)

- [ ] **Step 1: E7** — in `apps/web/components/DistrictPanel.tsx`, update the stale comment "react-leaflet 4" → "react-leaflet 5" (the package pins `^5.0.0`).

- [ ] **Step 2: E8 — `AuthForm`.** Widen `onSubmit` to `(vals) => Promise<void | { notice: string }>`. Add a `notice` state + a neutral/success-styled banner (use `semantic.alert.success` or a muted info tone — NOT `alert.danger`); in `handleSubmit`, `const result = await props.onSubmit(...)` and if `result && 'notice' in result` set `notice` (+ clear `error`). The error banner stays for thrown errors. In `apps/web/app/sign-up/page.tsx`, change the email-confirmation path from `throw new Error('Check your email…')` to `return { notice: 'Check your email to confirm your account.' }` (keep the real `signUp` error as a `throw`). Extend `AuthForm.test.tsx`: an `onSubmit` resolving `{ notice }` → the notice text renders in the success/info element (not the danger banner); a throwing `onSubmit` → the danger banner.

- [ ] **Step 3: E9 — read** `apps/web/app/calibrate/page.tsx` + `apps/web/app/settings/address/page.tsx`; note each one's `status → message` mapping (calibrate has 400/422/502; settings/address omits 422). Create `apps/web/lib/calibrate-error.ts`:
```ts
export function mapCalibrateError(status: number | undefined): string {
  if (status === 400) return "We couldn't find that address. Double-check spelling."
  if (status === 422) return "We can't resolve districts for that location yet."
  if (status === 502) return 'Address lookup is temporarily unavailable. Try again.'
  return 'Something went wrong. Try again.'
}
```
(Use the EXACT strings the calibrate page currently uses — read them first; align settings/address to match.) Replace both pages' inline status→message logic with `mapCalibrateError(status)`. Add a tiny unit test for the 4 branches.

- [ ] **Step 4: Verify.** `pnpm --filter @chiaro/officials-ui test AuthForm` + `pnpm --filter @chiaro/web test` + `pnpm --filter @chiaro/web build` + `pnpm -r typecheck`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/src/auth/ apps/web/
git commit -m "fix(slice-61): DistrictPanel comment + AuthForm success channel + shared mapCalibrateError (E7,E8,E9)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: F7 (thin tests) + E11 (RADAR comment) + `StateDonorsEvidence` key

**Files:**
- Modify: `packages/officials-ui/test/issues/WatchlistFlag.test.tsx`, `IssueRadarOverlay.test.tsx` (F7; IssueRadarChart n=0/1 done in Task 2)
- Modify: `packages/ui-tokens/src/alignment.ts` (E11), `packages/officials-ui/src/state/StateDonorsEvidence.tsx` (key)

- [ ] **Step 1: F7 — `WatchlistFlag`:** add tests for `money()` — a `totalAmount` `< 1000` renders `$<n>` (e.g. `$950`) and `>= 1000` renders `$<k>k` (e.g. `$42k`). Read `WatchlistFlag.tsx` for the exact format. **`IssueRadarOverlay`:** add a test with an axis whose `repPos` is null → no throw, rep vertex drawn at center (assert no crash + the polygon renders). (IssueRadarChart n=0/1 is already covered in Task 2.)

- [ ] **Step 2: E11 — `packages/ui-tokens/src/alignment.ts`** — add a one-line comment above the `RADAR`/`RADAR_DARK` `userFill` entry noting the rep polygon is stroke-only/dashed by design (hence no `repFill`), so the asymmetry is intentional.

- [ ] **Step 3: `StateDonorsEvidence` key** — read `packages/officials-ui/src/state/StateDonorsEvidence.tsx`, find the `.map(...)` rendering donor rows without a stable `key` prop (the slice-58-noted React warning), and add `key={…}` (a stable field like the donor name + index, or an id). Verify no "unique key" warning in its test run.

- [ ] **Step 4: Verify.** `pnpm --filter @chiaro/officials-ui test "WatchlistFlag|IssueRadarOverlay|StateDonorsEvidence"` + `pnpm --filter @chiaro/ui-tokens test` + `pnpm -r typecheck`.

- [ ] **Step 5: Commit.**
```bash
git add packages/officials-ui/ packages/ui-tokens/src/alignment.ts
git commit -m "test(slice-61): WatchlistFlag/IssueRadarOverlay tests + RADAR comment + donors key (F7,E11)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verify-all + closeout

**Files:**
- Modify: `CLAUDE.md` (slice-61 entry), `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` (mark T6 done + add an audit-complete note)

- [ ] **Step 1: Full verification sweep.** Run, expecting green:
- `pnpm -r typecheck`
- `pnpm --filter @chiaro/bills test` · `@chiaro/state-bills` · `@chiaro/officials-ui` · `@chiaro/ui-tokens`
- `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test`
- `pnpm --filter @chiaro/mobile test`
Record the officials-ui / web / mobile test totals.

- [ ] **Step 2: CLAUDE.md** — add the slice-61 entry after the slice-60 entry:
```markdown
- **Slice 61 — Consistency/polish batch (audit T6)** (2026-06-08): Compressed-to-Mega Slice (~22 files). **Closes the 2026-06-05 comprehensive audit (all 6 tracks shipped: T1 s56 / T2 s57 / T3 s58 / T4 s60 / T5 s59 / T6 s61).** Bugs: B7 `@chiaro/bills` live fetchers' first sub-query now `throw`s on error (was silent `[]`); B8 `state-bills` sort → `localeCompare` (transitive + null-safe, was non-transitive `<`); B10 mobile Sentry `beforeSend` returns a minimal `{message,level}` event on a scrub-throw (was `null` — dropped all telemetry); B11 `IssueRadarChart` empty-axes guard (was `<Polygon points="">`); B12 mobile `(app)/_layout` shows an `ActivityIndicator` while `calibrationStatus==='unknown'` (was a `BrandDrawer` flash). a11y: C5 issue CTAs (`RepAlignmentStrip`/`MyIssuesCard`) get the web smart-anchor; C6 `aria-live` on the topic/quiz progress counters; C7 `MetricCardShell` coerces non-string `value` in its label (+ `valueLabel?`). Consistency: E6 new behavior-only `SmartAnchor` primitive (the styled `BrandLink` wasn't a drop-in) — issue CTAs + the 3 audit-named copies (`BioContactLinks`/`AlignmentChip`/`TopAmountBreakdown`) migrate to it (the other 5 smart-anchor sites are consistent, future consolidation); E7 `DistrictPanel` comment 4→5; E8 `AuthForm` gains a success/info channel (`onSubmit` may resolve `{notice}`) so sign-up's "check your email" renders neutral, not red; E9 shared `mapCalibrateError(status)` unifies `/calibrate` + `/settings/address`. Tests: F7 (`WatchlistFlag` money branches, `IssueRadarChart` n=0/1, `IssueRadarOverlay` null-repPos) + the `StateDonorsEvidence` React-key fix. E11 RADAR-token comment (rep stroke-only by design). E5 dropped as moot (slice 58 deleted those schemas). No schema (pgTAP stays 490).
```

- [ ] **Step 3: Mark audit T6 done + audit complete** — in `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`, prepend `✅ SHIPPED (slice 61). ` to the T6 row's Note, and add a top-of-doc note: `**Status update (2026-06-08): all 6 remediation tracks shipped (T1 s56, T2 s57, T3 s58, T4 s60, T5 s59, T6 s61). Audit closed.**`

- [ ] **Step 4: Commit.**
```bash
git add CLAUDE.md docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md
git commit -m "docs(slice-61): CLAUDE.md slice entry + close the comprehensive audit (T6 done)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (controller, after all tasks)
- [ ] All 4 CI jobs green. `git log --oneline master..HEAD` shows spec + plan + Tasks 1–8.
- [ ] PR title: "Slice 61 — Consistency/polish batch (audit T6 — closes the audit)". Squash-merge + delete branch; sync master.

## Notes
- **`SmartAnchor` vs `BrandLink`:** `BrandLink` is a *styled* text-link; `SmartAnchor` is *behavior-only* (caller owns visuals). Don't replace BrandLink usages — only the un-styled smart-anchor copies.
- **E6 bounded:** migrate only the 3 audit-named sites + use for C5; the other 5 are consistent (future consolidation), not in scope.
- **E5 moot:** slice 58 deleted `measurementSourceSchema`/`quizQuestionSchema`; no `fetchCatalog` zod-parse work.
- **Each task greps/updates any existing test that pins the old behavior** (slice-56 lesson).
