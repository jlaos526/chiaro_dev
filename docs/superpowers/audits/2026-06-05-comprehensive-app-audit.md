# Comprehensive App Audit — 2026-06-05

**Trigger:** User request after the issue-priorities feature track (slices 52–54) + the TIGER-cache CI fix (slice 55) completed, with no single obvious queued slice remaining.
**Method:** 6 parallel read-only auditors (Opus 4.8) — one per surface: web app, mobile app, `officials-ui` detail cards, `officials-ui` foundation, domain packages, DB layer. Findings deduped below. The 3 DB security/data-integrity headlines (A1–A3) were hand-verified against the migrations before this doc was written.
**Status:** Findings doc. Remediation tracks proposed at the end; the controller picks fix order with the user.
**Status update (2026-06-08): ALL 6 remediation tracks shipped — T1 slice 56, T2 slice 57, T3 slice 58, T4 slice 60, T5 slice 59, T6 slice 61. Audit closed.**

---

## Severity tally
- **High:** 8 (B1, B2, B3, B4, C1, D1, D2, D3) + 1 verified-security (A1)
- **Medium:** ~22
- **Low:** ~20

Net read: the app is **structurally healthy** (clean RSC/island separation, universal RLS, SECURITY DEFINER discipline, no inline-hex regressions in `app/`, mode-aware `issues/` components). The real exposure is concentrated in **(a) one RLS misconfiguration, (b) the state-card family's NULL/loading handling, (c) a project-wide card-heading a11y gap, and (d) accreted dead surface area** (whole hook/query families shipped ahead of consumers).

---

## A. Security & data integrity (DB) — HAND-VERIFIED

- **A1 [HIGH · security] `user_districts` SELECT policy leaks cross-user location** — `migrations/0006_user_districts.sql:14-17` is `to authenticated using (true)`, so any logged-in user can read every other user's `(user_id, district_id)` rows — a de-anonymizing "who lives in which district" signal. The sibling `user_locations` (`0005:11-15`) correctly scopes `using (id = (select auth.uid()))`. **Fix:** new append-only migration scoping the policy to `user_id = (select auth.uid())` + a pgTAP cross-user-denial assertion mirroring `user_locations_rls.test.sql`.
- **A2 [MEDIUM · security] `rep_stance_score` granted to `anon`** — `0056:168` grants `to authenticated, anon` on a SECURITY DEFINER fn that reads authenticated-only state tables (`state_scorecard_ratings` 0041, `state_votes`/`state_vote_positions` 0033). An unauthenticated caller can invoke it directly and extract aggregate scorecard/vote signal the table RLS deliberately gates. No in-app anon caller exists (`get_rep_issue_alignment`, the only consumer, is authenticated-only). **Fix:** `revoke execute on function public.rep_stance_score(uuid,jsonb) from anon;`.
- **A3 [MEDIUM · data-integrity] No DB-side bounds on `position`/`importance`** — `0056:32-33` declares `position numeric(5,2)` + `importance smallint` with no CHECK; `save_user_issue_selections` (`0056:54-56`, SECURITY DEFINER, granted to authenticated) inserts them unvalidated. The 0–100 / {1,2} bounds live only in `packages/issues/src/schemas.ts:24-25`. A direct RPC caller can store `position=500` (within `numeric(5,2)`) or a negative `importance`, which feeds `get_rep_issue_alignment`'s `100 - abs(position - rep)` → `alignmentPct` outside [0,100] and skewed `overallPct`. **Fix:** `check (position is null or position between 0 and 100)` + `check (importance between 1 and 2)` (or clamp inside the RPC).
- **A4 [LOW · security] `touch_updated_at()` does not pin `search_path`** — `0001_profiles.sql:29-32`; the only public fn missing it. SECURITY INVOKER so not an escalation vector, but trips the Supabase function-search-path linter. **Fix:** `set search_path = ''` + qualify references.
- **A5 [LOW · test] `save_user_issue_selections` auth-guard untested** — `tests/save_user_issue_selections.test.sql` covers happy-path + atomic-replace but not the `auth.uid() IS NULL → raise` branch; sibling security-critical fns do test their guards.
- **A6 [docs] federal-public / state-authenticated read asymmetry undocumented** — federal catalog tables (0023 etc.) are `using(true)` (anon-readable); all state tables (0033/0041/0050) are `to authenticated`. Likely intentional (federal = public marketing surface) but undocumented, and the root of A2. **Fix:** document the public-read boundary in CLAUDE.md, then make function grants consistent with it.

**Verified clean (DB):** all 6 SECURITY DEFINER fns (`handle_new_user`, `apply_calibration`, `save_user_issue_selections`, `rep_stance_score`, `get_rep_issue_alignment`, `get_rep_watchlist_flags`) pin `search_path = public` + `auth.uid()`-guard; ON CONFLICT partial-index predicate (Gotcha #27) repeated everywhere; RLS enabled on 100% of current tables; `get_rep_issue_alignment` 0059 NULL-handling correct; calibrate-location edge fn verifies JWT via `getUser()` before the service-role RPC.

---

## B. Correctness bugs (user-facing)

- **B1 [HIGH · bug] `state-officials/[id]` missing not-found guard** — `apps/web/app/state-officials/[id]/page.tsx:16` calls `fetchOfficial` (which `throw`s on a PostgREST `.single()` miss, `packages/officials/src/queries.ts:54`); a stale/garbage ID surfaces a 500/error-boundary instead of the federal page's graceful `redirect('/')`. **Fix:** try/catch → `redirect('/')`, mirroring the federal page.
- **B2 [HIGH · bug] mobile detail screens hard-paint `#fff`** — `apps/mobile/app/(app)/officials/[id].tsx:67` + `state-officials/[id].tsx:34` set `backgroundColor: '#fff'` on the SafeAreaView (inline-hex violation + dark-mode break: the shared cards repaint via `useBrandTokens()` but sit on a permanently-white page → dark cards on white). The only two inline-hex sites in the mobile tree. **Fix:** `useBrandTokens().semantic.bg.app`.
- **B3 [HIGH · bug] `StateServiceRecordCard` fabricates zeros for NULL metrics** — `src/state/StateServiceRecordCard.tsx:91-94` uses `bills_sponsored_count ?? 0` etc., rendering "0 sponsored bills" when data is un-ingested (violates NULL ≠ 0), while the same card's Performance block correctly uses `fmtCount` → "—". **Fix:** route the top 6 rows through the existing `fmtCount`/`fmtPct` helpers.
- **B4 [HIGH · bug] `StateServiceRecordCard` has no `isLoading` guard** — unlike every sibling composite card, it never checks `.isLoading` on its 3 queries, so it paints zeros while in flight then flips to real values. **Fix:** add an early loading branch mirroring `FederalServiceRecordCard:40`.
- **B5 [MEDIUM · bug] `StateFinanceCard` no `isLoading` guard** — only `!summary`, so it shows the "No state finance data yet" empty state during load, then flips populated. **Fix:** `if (summaryQ.isLoading) return <loading>` before the empty check.
- **B6 [MEDIUM · bug] state evidence rows `openURL` without null guard** — `StateOfficialEventsList:50`, `StateBillsEvidence:39`, `StateVotesEvidence:56` press straight into `Linking.openURL(r.source_url)`; federal lists use the safer `url ? Pressable : View` pattern. Null/empty `source_url` → still-pressable row + silent `openURL('')` reject. **Fix:** adopt the federal guard.
- **B7 [MEDIUM · bug] `@chiaro/bills` sub-queries swallow PostgREST errors** — `packages/bills/src/queries.ts` destructures only `{ data }` (no `error`) on `bill_subjects`/`bill_sponsors`/`votes`/`vote_positions` lookups (lines 20/29/48/49/67/82/98/134/137/140/143), so an RLS denial returns `[]` instead of throwing. Every other package throws consistently. **Fix:** `if (error) throw error` on each sub-query.
- **B8 [MEDIUM · bug] `state-bills` sort comparator non-transitive + nullable date** — `packages/state-bills/src/queries.ts:93,153` `(b.vote.vote_date < a.vote.vote_date ? -1 : 1)` never returns 0 (engine-dependent ordering for equal dates) and `vote_date` is nullable (`null < string` unreliable). **Fix:** `(a.vote.vote_date ?? '').localeCompare(...)` returning 0 on equality.
- **B9 [LOW · bug] `allEmpty` mis-evaluates on NULL** — `StateConductCard.tsx:52` / `StateCommunityPresenceCard.tsx:57` compute `count === 0`, which is `false` when a count is `null` (data not ingested) → renders the populated card with "—" instead of the empty state. **Fix:** `(c ?? 0) === 0` or document intent.
- **B10 [LOW · bug] mobile Sentry drops all telemetry on scrub throw** — `apps/mobile/lib/sentry.ts:37-44` `beforeSend` returns `null` (drops the whole event) if `scrubAddressInPlace` throws. Fail-closed for PII is fine but losing all signal is heavy. **Fix:** send a minimal stripped event instead of `null`.
- **B11 [LOW · bug] `IssueRadarChart` empty-axes unguarded** — `src/issues/IssueRadarChart.tsx:46` `radarPolygon([])` → `<Polygon points="" />`. No crash but an invisible/degenerate chart for an all-watchlist selection. **Fix:** early-return a "no data" placeholder for `axes.length === 0` + an n=0/1 unit test.
- **B12 [LOW · bug] mobile app-layout flashes full app during calibration check** — `apps/mobile/app/(app)/_layout.tsx:11,38` renders `<BrandDrawer />` while `calibrationStatus === 'unknown'`, then redirects uncalibrated users → visible flash. **Fix:** render a loading placeholder while status is unknown.
- **B13 [LOW · bug] middleware calibrate-redirect allowList missing `/issues` + `/legal`** — `apps/web/middleware.ts:35`; an authenticated-but-uncalibrated user is bounced from the issues flow (which Settings + home deep-link to) and legal pages. **Fix:** confirm intent; add `/issues` + `/legal` if reachable pre-calibration. (Also: the redirect runs a `user_locations` count query on every non-allowlisted nav — perf.)

---

## C. Accessibility

- **C1 [HIGH · a11y] No card title is a heading** — every federal/state card title (~12 cards, e.g. `FederalServiceRecordCard:43`, `StateConductCard:41`) renders as a styled plain `<Text>` with no `accessibilityRole="header"`; `ComingSoonCard:36` is the only one that sets it. The entire detail page is a flat text wall to assistive tech with zero heading navigation. **Fix:** add `accessibilityRole="header"` + `accessibilityLevel={2}` to every card-title `<Text>` (the RN-types augmentation already exists, slice 25).
- **C2 [MEDIUM · a11y] `aria-expanded` missing on evidence toggles** — `TopAmountBreakdown` + `CardSubsection` correctly pair `accessibilityState` + direct `aria-expanded` (Gotcha #22), but `StateBillsEvidence:51`, `StateVotesEvidence:78`, `StateDonorsEvidence:66`, `StateIssuePositionsCard:129`, `EvidenceExpand:56` set only `accessibilityState` → silently no-ops on web. **Fix:** add `aria-expanded={expanded}` + `accessibilityRole="button"`.
- **C3 [MEDIUM · a11y] `IssueRadarChart` axis labels never rendered** — `src/issues/IssueRadarChart.tsx:53` takes `axes: string[]` but `axes.map((_, i) => …)` discards the label and draws only spokes; the only AT signal is a generic container label. Sighted + AT users can't tell which spike is which topic. **Fix:** render `<SvgText>` at each vertex, or compose the labels into the container `accessibilityLabel`.
- **C4 [MEDIUM · a11y] web `officials/[id]` has no page heading landmark** — `apps/web/app/officials/[id]/page.tsx:122-141` wraps content in raw `<main>` + inline `<div>`s with no `<h1>`; BioHeader is the first content. **Fix:** wrap in `BrandPageScreen` or add an `<h1>` for the official's name.
- **C5 [LOW · a11y] issue-flow CTAs lack web smart-anchor** — `RepAlignmentStrip:44` (`onSetup`) + `MyIssuesCard:96` (`onEdit`) navigate into `/issues` but are plain `Pressable`s; `OfficialsCard` already supports `rowHref`/`chipHref`. They lose middle-click-new-tab / status-bar preview / prefetch on web. **Fix:** thread `setupHref?`/`editHref?` + apply the `createElement('a',…)` pattern.
- **C6 [LOW · a11y] progress counters not announced** — `TopicPickerScreen:45` (`N/6`) + `IssueQuizScreen:126` (`answered/total`) have static labels but no `aria-live`. **Fix:** add `aria-live="polite"`.
- **C7 [LOW · a11y] `MetricCardShell` accessibilityLabel drops non-string values** — `src/cards/MetricCardShell.tsx:115` yields "Bills passed: " when `value` is a node/number. **Fix:** `String(value)` + optional `valueLabel?`.

---

## D. Dead code / unused surface

- **D1 [HIGH · deadcode] `@chiaro/bills` federal bill-browsing surface — 0 consumers** — `useBills`/`fetchBills`, `useBill`/`fetchBill`, `useBillVotes`/`fetchBillVotes`, `useOfficialVotesOnSubject`/`fetchOfficialVotesOnSubject` (`index.ts:15-19`) are imported only by their own tests; live cards use only the sponsored/cosponsored/missed hooks. ~8 symbols + their key-factory entries. **Fix:** delete or mark deliberately-unconsumed.
- **D2 [HIGH · deadcode] `@chiaro/state-bills` per-bill detail surface — 0 consumers** — `fetchStateBill`/`useStateBill` + `fetchStateBillVotes`/`useStateBillVotes` (`index.ts:6,8`) built but never wired. **Fix:** remove (+ the inline votes key).
- **D3 [HIGH · deadcode] mobile `lib/derivations/` orphaned** — `teasers.ts` (all 6 fns), `finance.ts` `pacPercent`, `service-record.ts` `tenureByChamber`/`yearsBetween` have zero mobile consumers (only `firstElectedYear` is used); copied during slice-5 parity, orphaned by slice 6/10's move to `@chiaro/officials-ui`. No tests pin them. **Fix:** delete `finance.ts`, `teasers.ts`, the tenure block in `service-record.ts`.
- **D4 [MEDIUM · deadcode] `EvidenceExpand` component unused** — `src/cards/EvidenceExpand.tsx` is barrel-exported but no card consumes it; `StateIssuePositionsCard` + evidence panels roll their own inline expand. **Fix:** delete, OR migrate the duplicated inline expand logic onto it (the natural shared abstraction — also closes C2).
- **D5 [MEDIUM · deadcode] `StateCommitteeMembershipRow` type unused** — `packages/officials/src/types.ts:14`/`index.ts:9`, no query/hook/component reads it. **Fix:** remove or wire.
- **D6 [MEDIUM · deadcode] `quizQuestionSchema` + `measurementSourceSchema` no runtime consumer** — `packages/issues/src/schemas.ts:3,13` referenced only by their own tests; the `QuizQuestion`/`MeasurementSource` *types* are used, the zod schemas are not. **Fix:** either delete, or wire them into `fetchCatalog`'s Json-column parse (closes E5 too).
- **D7 [LOW · deadcode] `IssueFlowProvider.hydrate()` redundant** — `src/issues/IssueFlowProvider.tsx:49,140` exposed + memoized but no consumer calls it; provider already hydrates from `initialSelections` at mount. **Fix:** drop from the context contract or document the re-hydrate use case.

---

## E. Consistency / dark-mode residue / type-safety

- **E1 [MEDIUM · consistency] `DistrictPanel`/`DistrictMap` use `COLORS.*` not `useBrandTokens()`** — web `components/DistrictMap.tsx:56` + `DistrictPanel.tsx:58`, mobile `components/DistrictPanel.tsx:10,71-72`. The last `COLORS.*` consumers in the apps → the district panel/map legend stay light-gray in dark mode. **Fix:** migrate both platforms to `useBrandTokens()` (closes the last `COLORS.*` app residue).
- **E2 [MEDIUM · consistency] `location/groups.ts` `TIER_COLOR` inline hex** — `:12-19` hardcodes 6 hexes (some duplicate `COLORS.brand.*`), violating the inline-hex rule + no dark parity. **Fix:** add a `DISTRICT_TIER_COLOR` token (light/dark) in `@chiaro/ui-tokens`.
- **E3 [MEDIUM · consistency] 2 state finance fetchers not re-exported** — `packages/officials/src/index.ts:41`; `fetchOfficialStateFinanceSummary` + `fetchOfficialStateDonors` query fns are omitted while every sibling fetcher (and both their hooks) is exported. **Fix:** add to the re-export block.
- **E4 [MEDIUM · type-safety] `state-bills` `normalizeBill(row as never)`** — `packages/state-bills/src/queries.ts:36,57,70` casts the joined Supabase result through `never`, fully defeating type-checking on the join shape. **Fix:** type the select result + cast to that.
- **E5 [LOW · consistency] `fetchCatalog` double-casts + no zod parse** — `packages/issues/src/queries.ts:11` trusts `Json` columns blindly despite the schemas existing. **Fix:** parse with the existing zod schemas at the boundary (gives D6's schemas real consumers).
- **E6 [LOW · consistency] smart-anchor `createElement('a',…)` copy-pasted 3×** — `BioContactLinks:33-62`, `AlignmentChip:57-82`, `TopAmountBreakdown:121-142`. Rule-of-three hit. **Fix:** extract a `<SmartAnchor>` web primitive.
- **E7 [LOW · docs] stale `react-leaflet 4` comment** — `apps/web/components/DistrictPanel.tsx:16` (pinned `^5.0.0`).
- **E8 [LOW · consistency] sign-up "check your email" rendered as form error** — `apps/web/app/sign-up/page.tsx:15` `throw new Error(...)` shows the happy-path message in danger styling. **Fix:** add a success/info channel to `AuthForm`.
- **E9 [LOW · consistency] calibrate vs settings/address divergent error mapping** — `/calibrate` handles 400/422/502; `/settings/address` omits the 422 branch. **Fix:** extract a shared `mapCalibrateError(status)`.
- **E10 [LOW · consistency] `useStateBillVotes` inline key literal** — `packages/state-bills/src/hooks.ts:87` `['state-bills','votes',billId]` instead of the factory (moot if D2 deletes it).
- **E11 [LOW · consistency] `RADAR` token has no `repFill`** — `packages/ui-tokens/src/alignment.ts:77-89` defines `userFill` but rep is stroke-only; undocumented asymmetry. **Fix:** confirm intentional + comment, or add `repFill`.

---

## F. Test coverage gaps

- **F1 [MEDIUM · test] web island-composed routes untested** — no render/redirect test for `issues`, `officials/[id]`, `state-officials/[id]`, `calibrate`, `settings`, `sign-in`, `sign-up` — the exact bug class that broke before (home-page test). **Fix:** add smoke tests mocking islands/hooks like `home-page.test.tsx`.
- **F2 [MEDIUM · test] web cross-route guard untested at page level** — `apps/web/test/app/officials-route-guards.test.tsx` only asserts the `isStateLevel` predicate, not the page branch (this is where B1 hides). **Fix:** page-level redirect test.
- **F3 [MEDIUM · test] mobile calibrate/GPS flow untested** — the app's most logic-heavy route (status→message mapping + `getCurrentLocation` GPS path) has no mobile test. **Fix:** jest-expo test (top-level `jest.mock`, no resetModules per Gotcha #11).
- **F4 [MEDIUM · test] mobile nav guards untested** — root auth redirect + app calibration gate (lockout/loophole surface). **Fix:** assert redirect fires for uncalibrated + exemptions for `/settings` + `/calibrate`.
- **F5 [MEDIUM · test] `RepAlignmentSection` no test** — the data-wiring container composing `useRepAlignment` + `useMySelections` + overlay state; its expand guard must stay in lockstep with `RepAlignmentStrip`. **Fix:** add `RepAlignmentSection.test.tsx`.
- **F6 [LOW · test] mobile home `subCascadeSlug` nav untested** — the multi-branch URL builder at `(app)/index.tsx:62-68`.
- **F7 [LOW · test] thin issues-component tests** — `WatchlistFlag` 1 test (add `<$1000`/`>=$1000` branches), `IssueRadarChart` n=0/1 untested, `IssueRadarOverlay` null-`repPos` untested.

---

## Verified-clean areas (no action)
- **Web:** RSC/island separation textbook; auth/cookie handling (middleware `getUser()` refresh, brand-mode cookie SSR-read) correct; zero inline hex in `app/`; no secret leaks.
- **Mobile:** no rules-of-hooks violations; clean drawer nav; correct redirect-guard logic (the gaps are flash B12 + test coverage, not correctness).
- **`issues/` components:** uniformly mode-aware via `useBrandTokens()`/`useRadarColors()`; 13 test files; pure/unit-testable radar geometry correctly kept out of the barrel.
- **DB:** see §A "Verified clean."
- **Domain packages:** the types/queries/keys/hooks/schemas shape holds across all 8; error-throwing uniform except B7; ui-tokens light/dark parity solid.

---

## Proposed remediation tracks (slice backlog)

| Track | Findings | Tier | Note |
|---|---|---|---|
| **T1 — Security & data-integrity hardening** | A1–A5 | Compressed Slice | ✅ SHIPPED (slice 56). 1 append-only migration + pgTAP + revoke + 2 CHECKs + search_path. **Recommended first** — verified, small, security. |
| **T2 — State-card correctness + detail-page a11y** | B3, B4, B5, B6, B9, C1, C2, C3, C4 | Mega Slice | ✅ SHIPPED (slice 57). The state-card NULL/loading bugs + the project-wide card-heading gap. Highest user-facing quality lift. |
| **T3 — Dead-code purge** | D1–D7 (+ E10) | Compressed Slice | ✅ SHIPPED (slice 58). Low-risk deletion; reduces surface (slice-49 precedent). Verify zero consumers per symbol first (Gotcha #20 discipline). |
| **T4 — Dark-mode residue + token hygiene** | E1, E2, E3, E4, E11 | Compressed Slice | ✅ SHIPPED (slice 60). Closes the last `COLORS.*`/inline-hex app residue + the `as never` cast. |
| **T5 — Route bug-fixes + test coverage** | B1, B2, B13, F1–F6 | Mega Slice | ✅ SHIPPED (slice 59). Fixes the two HIGH route bugs + back-fills the missing render/guard tests. |
| **T6 — Consistency & polish batch** | B7, B8, B10, B11, B12, C5, C6, C7, E5–E9, F7 | Compressed Slice | ✅ SHIPPED (slice 61). Remaining low-severity correctness + consistency. |

Tracks are independent and can ship in any order; T1 → T2 → T3 is the recommended sequence (security first, then the biggest quality lift, then the cleanup).

**Clean-area caveat:** "0 consumers" dead-code findings (D1–D6) and the RLS finding (A1) were grep/inspection-verified by the auditors + controller, but each fix slice should re-confirm at implementation time before deleting/altering (Gotcha #20).
