# Slice 61 — Consistency/polish batch Design Spec

**Date:** 2026-06-08
**Branch:** `slice-61-polish-batch`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Compressed-to-Mega Slice (~20 files)
**Source:** Audit track **T6** from `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` — **the last track; closes the comprehensive audit.**

## 1. Goal / problem

Remediate the remaining LOW/MED consistency, correctness, a11y, and test-coverage findings. No schema. All findings verified against current code 2026-06-08 (post slices 56–60). **E5 (fetchCatalog zod parse) is moot** — slice 58 deleted `measurementSourceSchema`/`quizQuestionSchema`.

## 2. Findings

### Real bugs

- **B7 — `@chiaro/bills` silent error-swallowing.** The first sub-query in each live fetcher destructures `{ data }` with no `error`: `fetchOfficialSponsoredBills` (`queries.ts:9`, the `bill_sponsors` lookup), `fetchOfficialCosponsoredBills` (`:25`), `fetchOfficialMissedVotes` (`:41`, the `votes` lookup). An RLS denial / DB error returns `[]` instead of throwing. **Fix:** add `error` to each + `if (error) throw error`, matching the second sub-query in each fn.
- **B8 — `state-bills` non-transitive sort.** `queries.ts:84,144` `rows.sort((a, b) => (b.vote.vote_date < a.vote.vote_date ? -1 : 1))` never returns 0 (engine-dependent ordering for equal dates) and `vote_date` is nullable (`null < string` unreliable). **Fix:** `rows.sort((a, b) => (b.vote.vote_date ?? '').localeCompare(a.vote.vote_date ?? ''))` (desc; returns 0 on equality, null-safe). A `.localeCompare(...)` on the `b` value with the `a` value gives descending order.
- **B10 — mobile Sentry drops all telemetry on scrub throw.** `apps/mobile/lib/sentry.ts:40-41` `catch { return null }` discards the entire event if `scrubAddressInPlace` throws. **Fix:** in the catch, return a minimal stripped event preserving signal without the unscrubbed payload — `return { message: event.message, level: event.level } as typeof event` (or the SDK's minimal-event shape). Fail-safe for PII, but keep the crash visible.
- **B11 — `IssueRadarChart` empty-axes.** No guard for `axes.length === 0` → `radarPolygon([])` → `<Polygon points="" />` (invisible/degenerate). **Fix:** early-return a small "no data" placeholder `<View>` when `axes.length === 0`. Add an n=0 (+ n=1) unit test.
- **B12 — mobile `(app)/_layout` flash.** Renders `<BrandDrawer/>` (full app chrome) while `calibrationStatus === 'unknown'` during the async `check()`, then redirects uncalibrated users → a visible flash of the app before `/calibrate`. **Fix:** while `calibrationStatus === 'unknown'`, render a loading placeholder (an `ActivityIndicator`, mirroring the root `_layout`'s `!loaded` gate) instead of `<BrandDrawer/>`.

### Accessibility

- **C5 — issue CTAs lack the web smart-anchor.** `RepAlignmentStrip` (`onSetup` → `/issues`) + `MyIssuesCard` (`onEdit` → `/issues`) are plain `Pressable`s. **Fix:** thread an optional `setupHref?`/`editHref?` and render the CTA via the existing `BrandLink` (slice 45) / the smart-anchor pattern on web when an href is supplied (modifier-key passthrough + real `<a>`), falling back to `Pressable` on native / when no href. The consuming app pages pass the `/issues` href.
- **C6 — progress counters not announced.** `TopicPickerScreen` (`N/6`) + `IssueQuizScreen` (`answered/total`) counters have static labels but no live region. **Fix:** add `aria-live="polite"` (web) on the counter `<Text>` so screen readers announce changes.
- **C7 — `MetricCardShell` label drops non-string values.** `accessibilityLabel` yields "Label: " when `value` is a number/node. **Fix:** coerce — `String(value)` for numbers; accept an optional `valueLabel?: string` for ReactNode values (use it when provided).

### Consistency / UX

- **E6 — smart-anchor consolidation.** `BrandLink` (slice 45) is the smart-anchor primitive. Verify which sites still have an inline `createElement('a', …)` smart-anchor copy (slices 14/18 propagated it to ~7 sites; some may already use `BrandLink`) and migrate the remaining inline copies to `BrandLink`. Bounded: only migrate true duplicates of the `BrandLink` behavior; leave sites with genuinely different needs. (If the grep finds the copies already consolidated, E6 is largely closed — note it and skip.)
- **E7 — stale comment.** `apps/web/components/DistrictPanel.tsx` "react-leaflet 4" comment → "react-leaflet 5" (package pins `^5.0.0`).
- **E8 — sign-up success-as-error.** Web `sign-up` surfaces "Check your email…" by `throw new Error(...)`, rendering the happy-path message in `AuthForm`'s danger styling. **Fix:** add a success/info channel to `AuthForm` (e.g. an `onSubmit` that can resolve a `{ notice }` or a separate `notice` prop) so the confirmation renders in a neutral/success tone, not red. Keep the error channel for real errors.
- **E9 — divergent calibrate error mapping.** `/calibrate` maps 400/422/502; `/settings/address` omits the 422 branch. **Fix:** extract a shared `mapCalibrateError(status): string` (in `@chiaro/location` or a web `lib/`) and use it in both, so the messages are identical.

### Tests + nit

- **F7 — thin issues-component tests.** Add: `WatchlistFlag` `money()` `<$1000` (`$950`) + `≥$1000` (`$42k`) branches; `IssueRadarChart` n=0 (placeholder) + n=1 (no crash); `IssueRadarOverlay` a null-`repPos` axis (no throw, drawn at center).
- **E11 — RADAR token comment.** `ui-tokens/alignment.ts` RADAR/RADAR_DARK have `userFill` but no `repFill` (rep polygon is stroke-only/dashed by design). Add a one-line comment confirming the asymmetry is intentional.
- **`StateDonorsEvidence` key warning.** Fix the missing/duplicate React `key` prop flagged in slice 58 (a `.map()` row without a stable `key`).

## 3. Scope

**In:** all of the above (B7, B8, B10, B11, B12, C5, C6, C7, E6, E7, E8, E9, E11, F7, the donors-key fix). **Out:** E5 (moot). No new features; no restyle beyond the E8 success-tone + B11 placeholder. Group into themed commits (bills/state-bills/sentry/radar bugs; a11y; UX; tests).

## 4. Testing

- B7/B8: unit tests asserting the fetchers throw on a sub-query error (B7) + stable desc order incl. equal/null dates (B8) — in the respective package test suites.
- B10: a sentry test where `scrubAddressInPlace` throws → `beforeSend` returns a minimal event (not null).
- B11: the n=0/n=1 IssueRadarChart tests (F7 overlaps).
- B12: extend the mobile nav-guards test (slice 59 `nav-guards.test.tsx`) to assert the loading placeholder renders while status is unknown.
- C5/C6/C7/E8: officials-ui / web render tests asserting the DOM (`href`/`aria-live`/the success-tone element / the coerced label).
- F7: the 3 thin-test additions.
- Everything else covered by `pnpm -r typecheck` + existing tests.

## 5. Verification (Gotcha #30)

`pnpm -r typecheck` · `pnpm --filter @chiaro/bills test` · `@chiaro/state-bills` · `@chiaro/officials-ui` · `@chiaro/ui-tokens` · `@chiaro/web` build + test · `@chiaro/mobile` test. Ship via PR with all 4 CI jobs green.

## 6. Open items for the plan to reconcile against live code

1. **E6:** grep the actual remaining inline `createElement('a', …)` smart-anchor sites (the audit named BioContactLinks/AlignmentChip/TopAmountBreakdown, but slice 18/45 may have changed them) + read `BrandLink`'s API to confirm it's a drop-in for each. If few/none remain, scope E6 down to "C5 uses BrandLink" + note consolidation already done.
2. **C5:** `BrandLink`'s prop surface (does it take `href` + `onPress` + style?) so `RepAlignmentStrip`/`MyIssuesCard` can route their CTA through it; thread the `*Href?` prop through to the consuming app pages (web supplies `/issues`).
3. **E8:** `AuthForm`'s current `onSubmit`/error contract (slice 31/45) — design the success/info channel minimally (a `notice` return or prop), and how `sign-up/page.tsx` currently signals "check your email".
4. **E9:** where `mapCalibrateError` should live (web `lib/` vs `@chiaro/location`) given both `/calibrate` + `/settings/address` consume it; confirm the current per-page status→message strings to unify.
5. **C7:** `MetricCardShell`'s `value` type + whether a `valueLabel?` prop is the cleanest coercion (vs `String(value)` inline).
6. **`StateDonorsEvidence`:** the exact `.map()` missing the `key` (slice 58's noted warning).
7. **B8:** confirm `localeCompare` on the `b`-then-`a` operand order yields DESC (newest first), matching the current intent.
