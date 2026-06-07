# Slice 57 — State-card correctness + detail-page a11y Design Spec

**Date:** 2026-06-07
**Branch:** `slice-57-state-card-a11y`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Mega Slice (~25–30 files incl. tests)
**Source:** Audit track **T2** from `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`

## 1. Goal / problem

Close the detail-page correctness + accessibility findings from audit track T2. All changes live in `@chiaro/officials-ui` (react-native-web shared package → both web and mobile). No schema work (pgTAP stays 490). The state-card family carries the highest-severity correctness bugs (fabricated NULL zeros, missing loading guards), and the entire detail page is a flat text wall to assistive tech (no card title is a heading).

Scope locked in brainstorming: **all of T2** including C3 (radar axis labels) and C4 (web page heading, folded into C1's h1), with a full **h1/h2/h3** heading hierarchy.

## 2. Groups of changes

### Group 1 — State-card correctness (B3 / B4 / B5 / B9)

- **B3 — `StateServiceRecordCard.tsx:91-94` fabricates zeros for NULL.** The top four rows use `m?.bills_sponsored_count ?? 0` (+ cosponsored / votes_voted / votes_missed). The file already defines `fmtCount` (`:28`) returning `'—'` for null. Fix: wrap those four values in `fmtCount(...)` so un-ingested metrics render "—", matching the card's own Performance-metrics block (`:101-104`). `ScalarRow`'s `value` prop is `number | string`, so the string return is accepted.
- **B4 — `StateServiceRecordCard` has no `isLoading` guard.** Add an early branch mirroring `FederalServiceRecordCard.tsx:40-47`: `if (metrics.isLoading || sponsored.isLoading || votes.isLoading) return <card with title + "Loading service record…">`. Place it after the `isStateLevel` gate (`:54`) so Rules-of-Hooks stay satisfied (all three hooks already run unconditionally above the gate).
- **B5 — `StateFinanceCard.tsx:62` shows the empty state during load.** It only checks `if (!summary)`. Add `if (summaryQ.isLoading) return <loading card>` *before* the `!summary` check (`:61-62`), mirroring the federal pattern.
- **B9 — `allEmpty` mis-evaluates NULL.** `StateConductCard.tsx:52` (`complaintCount === 0 && eventCount === 0`) and `StateCommunityPresenceCard.tsx:57` (3-count version) are `false` when any count is `null` (data not ingested), so an all-NULL rep renders a "—"-filled populated card instead of the empty state. Fix: treat null as empty — `(complaintCount ?? 0) === 0 && (eventCount ?? 0) === 0` (and the 3-count analogue). NULL and 0 both correctly route to the existing "no data on file" empty state.

### Group 2 — Evidence URL guard + aria-expanded (B6 / C2)

- **B6 — unguarded `openURL(source_url)`.** Four state lists press straight into `Linking.openURL(x.source_url).catch(...)`: `StateBillsEvidence.tsx`, `StateOfficialEventsList.tsx`, `StateTownHallsList.tsx`, `StateVotesEvidence.tsx`. Adopt the federal guard from `FederalSponsoredBillsList.tsx:30-35`:
  ```tsx
  const url = row.source_url ?? null
  const Row = url ? Pressable : View
  // <Row {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}>
  ```
  A row with null/empty `source_url` renders as a non-pressable `View` (no dead tap affordance, no `openURL('')` rejection).
- **C2 — show-more toggles drop `aria-expanded` on web.** The 4 live expand toggles — `StateBillsEvidence.tsx` (`:51`), `StateVotesEvidence.tsx`, `StateDonorsEvidence.tsx`, `StateIssuePositionsCard.tsx` — are `<Pressable onPress={() => setExpanded(...)}>` with no expanded-state signal. Add `accessibilityRole="button"` + `accessibilityState={{ expanded }}` + the **direct `aria-expanded={expanded}`** prop (RNW 0.19 does not translate `accessibilityState` → `aria-expanded`; Gotcha #22). `EvidenceExpand.tsx` is dead code (audit D4, no consumers) → **excluded** here; it's slated for T3's purge.

### Group 3 — Heading hierarchy (C1 + C4)

RNW renders `accessibilityRole="header"` + `accessibilityLevel={N}` as `<div role="heading" aria-level="N">` (AT-equivalent to `<hN>`). The RN-types augmentation for `accessibilityLevel` already exists (`packages/officials-ui/src/types/react-native-augment.ts`, slice 25). Hierarchy:

- **h1 — official name.** `BioHeader.tsx:39` (`<Text style={{ fontSize: 24, … }}>{p.fullName}</Text>`) gains `accessibilityRole="header" accessibilityLevel={1}`. This is the page's top heading → **closes C4** (the web `officials/[id]` page had no heading landmark; both web detail pages render BioHeader). The existing `"<name> bio"` region `aria-label` on the outer element stays.
- **h2 — card titles (12 cards).** Add `accessibilityRole="header" accessibilityLevel={2}` to every card-title `<Text>`:
  - Federal: `FederalServiceRecordCard`, `FederalFinanceCard` (3 branch copies: loading/empty/populated), `FederalVotingBillsCard` (3), `FederalIssuePositionsCard` (3), `FederalEthicsAccountabilityCard`, `FederalCommunityPresenceCard`.
  - State: `StateServiceRecordCard` (`:74`), `StateFinanceCard` (2 branch copies), `StateIssuePositionsCard`, `StateFinancialActivityCard`, `StateConductCard`, `StateCommunityPresenceCard`.
  - For cards that render the title in multiple branches (loading/empty/populated), **each** branch's title Text gets the props (a screen-reader user must find the heading regardless of card state).
- **h3 — static in-card sub-section headings.** `accessibilityLevel={3}` on the non-interactive heading Texts that introduce a sub-section. Confirmed set: `StateServiceRecordCard.tsx` "Performance metrics" (`:99`) + the two "View … (N)" evidence headings (`:117`, `:124`). The implementer greps `styles.subheading` / `styles.evidenceHeading` / equivalent static sub-heading Texts across the other cards and applies h3 to each. **Interactive `CardSubsection` toggle labels are NOT headings** (they're buttons and already carry `aria-expanded`).

### Group 4 — Radar axis labels (C3)

`IssueRadarChart.tsx` takes `axes: string[]` (`:10`) but `axes.map((_, i) => …)` (`:53`) discards the label, drawing only spokes; the container `accessibilityLabel` is a generic "Issue priorities radar chart" (`:50`). Fix:
- Render each axis label as a `react-native-svg` `<SvgText>` positioned at `radarPoint(i, n, 1.12, r, cx, cy)` (just outside the unit ring), text-anchored by quadrant (left/middle/right depending on the vertex's x relative to `cx`) so labels don't overrun the chart edge. Mode-aware fill via `useRadarColors()` / `useBrandTokens()` (`semantic.text.muted` or the radar label token). Font size ~10–11.
- Compose the per-axis data into the container `accessibilityLabel` for screen readers (e.g. `"Issue priorities radar: Environment 90%, Economy 40%, …"`) using whatever value vector the chart already has (`userValues`/`alignmentPct`). Keep the existing single-ring/two-polygon rendering unchanged.
- The chart already adds horizontal/vertical padding implicitly via the `r` radius vs the SVG viewBox; the plan confirms the viewBox has room for the 1.12 labels (widen the viewBox or reduce `r` slightly if labels clip).

## 3. Scope

**In:** Groups 1–4 above, all in `packages/officials-ui/src/{state,federal,bio,issues}/` + their tests. **No** app-code change needed for C4 (folded into BioHeader). **No** schema.
**Out:** the other audit tracks (T3 dead-code incl. `EvidenceExpand`; T4 dark-mode residue; T5 route bugs/tests; T6 polish). No restyle of card visuals (Gotcha #15 federal/state asymmetries preserved). No `BrandHeading`/`CardTitle` refactor — props added inline to preserve current structure + minimize risk.

## 4. Testing

`@chiaro/officials-ui` vitest (RNW + jsdom). Per finding:
- **B3:** render `StateServiceRecordCard` with `metrics.data` = null/undefined metric fields → assert the top rows show "—", not "0".
- **B4/B5:** mock the hooks `isLoading: true` → assert the loading branch renders (title + "Loading…") and NOT zeros/empty-state.
- **B9:** all-null counts → assert the empty-state copy renders (not the populated card).
- **B6:** a row with `source_url: null` → assert it renders a non-pressable element (no `onPress`); a row with a url → pressable. (RNW: assert presence/absence of the click affordance.)
- **C2:** expand toggle → assert `aria-expanded` attribute flips `"false"`→`"true"` on press (assert the DOM attribute per Gotcha #22, not the RN prop).
- **C1:** assert each card title renders `role="heading"` + `aria-level="2"`; BioHeader name `aria-level="1"`; the h3 sub-headings `aria-level="3"`.
- **C3:** render `IssueRadarChart` with named axes → assert each label string appears in the output (SvgText) and the container `accessibilityLabel` includes the axis names.

Test count grows ~647 → ~690 (officials-ui). Existing tests that assert the old behavior (e.g. a test pinning "0" for a null state metric, if any) are updated — the implementer greps for them (lesson from slice 56: a test can lock in the wrong behavior).

## 5. RNW gotchas to respect (already established)

- `aria-expanded` needs the **direct prop** alongside `accessibilityState` (Gotcha #22) — assert the DOM attribute in tests.
- Hex in inline styles is normalized to `rgb(...)` by RNW's StyleSheet normalizer — radar label color assertions compare against the rgb form (slice 39 finding).
- `accessibilityLevel` is RN-types-augmented (slice 25); no new augmentation needed.
- `react-native-svg` is stubbed in the officials-ui + apps/web vitest configs (Gotcha #19g) — the stub must render `<SvgText>`/`text` so the C3 label assertions can see the strings (extend the stub if it doesn't already, mirroring slice 46's DistrictBadge `<path>` upgrade).

## 6. Verification (Gotcha #30 — merge via green PR CI)

`pnpm -r typecheck` · `pnpm --filter @chiaro/officials-ui test` · `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test` (render tests — slice-52 lesson) · mobile `pnpm --filter @chiaro/mobile test`. Ship via PR with all 4 CI jobs green.

## 7. Open items for the plan to reconcile against live code

1. Enumerate each card's title-Text branches precisely (FederalFinance/IssuePositions/VotingBills ×3, StateFinance ×2) and confirm no title is rendered via a shared helper that would centralize the prop.
2. Confirm the full h3 static-sub-heading set across all cards (grep `styles.subheading`/`styles.evidenceHeading` + any inline section headers) — Group 3 names `StateServiceRecordCard`'s 3; verify others.
3. Confirm the `react-native-svg` test stub renders `<SvgText>`/`text` (for C3 assertions); extend if needed.
4. Confirm `IssueRadarChart`'s SVG viewBox has room for `1.12`-radius labels; widen viewBox or reduce `r` if they clip (no visual regression to the polygons).
5. Confirm the exact value vector available in `IssueRadarChart` for the `accessibilityLabel` composition (userValues vs alignmentPct vs repValues).
6. Grep for any existing test asserting a state card's NULL metric as "0" or the old `allEmpty` behavior, and update it.
