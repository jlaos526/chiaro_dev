# 2026-06-10 — Optimization roadmap (slices from the whole-app audit)

Source: `docs/superpowers/audits/2026-06-10-app-optimization-audit.md` (55 confirmed C0–C54, 22 unverified U0–U21, 6 strategic gaps G1–G6, 1 refuted). Draft allocation was adversarially reviewed by two critic agents (coverage + sequencing); all blocking and important critiques are incorporated (EAS pipeline pulled to Wave 1, CI-speedup merged first, Next bump isolated, Sentry/fetcher/lint file-seam collisions resolved, tier labels corrected).

Tiers: **Patch** (≤3 files) / **Compressed** (4–7) / **Mega** (~8–20, design in PR description) / **Full** (brainstorm→spec→plan→subagents). Slice numbers are working numbers (next master slice = 62); renumber freely if reordered. Every slice merges via PR with green CI (Gotcha #30).

> **Revision 2026-07-12:** Waves 1+2 shipped (S62–S78; S73 parked) + S79 shipped. The Wave-3 table below is superseded for execution order by the **"Revision 2026-07-12 — Wave-3 re-plan"** section at the end of this doc. The original tables stand as the historical allocation record.

**Standing notes**
- *Brainstorm-gate boundary:* the paused quiz-redesign brainstorm owns visual-identity decisions. Slices 64–66 ship correctness/ergonomics minimums only (HIG-minimum sizes, functional placeholder splash/icon from the slice-32 logo geometry); final visual art routes through the design track.
- *Sequential-merge clusters:* S63 → S70 → S71 share `next.config.mjs`/Sentry configs — merge strictly in order, rebase between. S74 depends on S66's fetcher signatures. S75 must not touch fetchers S79 consolidates (scope rule inside S75).
- *Day-1 user actions (for S64):* provision `EXPO_TOKEN` repo secret; decide on Apple Developer credentials (iOS device testing is blocked on them — pending since slice 5).

---

## Wave 1 — now (device-test readiness + silent damage + cheap big wins)

| # | Slice | Tier | Contents | Value |
|---|-------|------|----------|-------|
| S62 | Next.js security bump | Patch | U16 | `next` ≥15.5.18: closes HIGH middleware-bypass + DoS advisories aimed at exactly our auth architecture. One-file PR, unbisectable-regression risk avoided by isolating it. |
| S63 | CI throughput + DX pins | Compressed | C40, C43, C39, U13, U10 | Parallelize the 4 serialized jobs (~18 → ~9 min), pin `supabase/setup-cli`, fix Sentry source-map env wiring, stop cross-commit test-cache replay, skipIf for env-less integration suites. Merged first so every later slice compounds the saving. |
| S64 | Device-evaluation enablement (reshaped 2026-06-11) | Compressed | C53, C14-partial, runbook | User has an Android Studio PC + a MacBook (latest macOS) — local dev-client builds (`expo run:android`/`run:ios`) replace EAS cloud as the primary evaluation path (iOS Simulator needs NO Apple account; free-team covers USB iPhone). Ships: per-machine evaluation runbook (`docs/superpowers/mobile-evaluation-runbook.md`), DoD-checklist refresh (+ state-officials + issues sections), `.env.example` Android `10.0.2.2` note, C53 purpose-string/encryption fix + flat brand splash bg (C14 artwork stays design-track). **C45 (CI EAS workflow) deferred to Wave 3 / Track F** — still useful for distribution, no longer evaluation-blocking. |
| S65 | Mobile screen-shell correctness | Mega | U1, C8+U0, U3, U6, U5, U2-rider | The device-test blockers: calibration-gate dead-end (status recheck on nav), scroll containers in the shared shells, dark-mode list text, sign-up notice channel, KeyboardAvoidingView + touch targets (same shell files), RefreshControl + retry affordance rider. One pass over the shells instead of three. |
| S66 | Mobile startup + network hygiene | Compressed-to-Mega | C10, C15, C13 | Parallelize cold-start gates and hoist the per-fetcher `auth.getUser()` round-trip out of the shared packages (benefits web too — S74 builds on these signatures), home profile fetch into TanStack, expo-image portraits. |
| S67 | Payload diet | Compressed | C1+C16, C9, C17 | The biggest byte wins: simplified `districts_geojson` view (~90%+ of a multi-MB fetch, both platforms) + senate S1/S2 dedupe + mobile re-projection memo, and the missed-votes congress-wide download rewrite (worst single query; also mobile-visible). |
| S68 | Ingest silent-corruption fixes | Mega | C31, C33 (+ row repair), G3, C38 | Stop ongoing damage: mobilize 0-rows bug, district-offices idempotency + cleanup of ~450 duplicated rows, name-resolver ambiguity guard (`resolve_ambiguous` SkipReason — the mis-attribution reputational risk), root delegations for 12 seed commands. |
| S69 | DB/auth + edge hardening | Compressed | U17, U19, U20, C54+U18 | Rate-limit check before GeocodIO spend, profiles SELECT scoped, PUBLIC-execute revokes on 4 DEFINER functions, password policy 8+ in config.toml (+ email-confirmation decision — sign-up copy already promises it). Mirrors the slice-56 shape (1 migration + edge tweak + pgTAP). |
| S70 | Web bundle + Sentry consolidation | Compressed-to-Mega | C0, C51, C52, C2 + C27-partial, C6-partial, U2-web rider | `bundleSizeOptimizations` (~35% of First Load is Sentry on an error-only config), breadcrumb scrub + tunnelRoute decision, beforeSend parity with the slice-61 mobile fix, officials-ui `sideEffects` + deep-import convention doc, next/font Inter (partial: the 3 Inter-first primitives — RNW `<Text>` threading deferred to S80), minimal global `error.tsx`. All Sentry-config edits in ONE slice to avoid the 3-way `next.config.mjs` collision. |
| S71 | Web headers + config residue | Compressed | C47, C50, U21, C48-check | Security headers, sign-out localhost fallback, Sentry scrubber covers issue-selection keys (political-opinion data), and the 1-hour live CORS check that decides whether C48 needs a fix at all. |

## Wave 2 — experience + launch readiness

| # | Slice | Tier | Contents | Value |
|---|-------|------|----------|-------|
| S72 | Lint/format adoption | Compressed (+ isolated reformat commit) | C41 | Biome or ESLint+Prettier across 12 packages; the one-time repo-wide format lands as its own commit, EARLY — before the big Wave-3 slices open, so everything after ships pre-formatted instead of rebasing through a late reformat. |
| S73 | Account deletion + truthful privacy | Mega (design in PR required) | G2 | Delete-account RPC/Edge Function + Settings danger-zone (web+mobile) + privacy-page rewrite naming the actual tables + sign-up consent line. App Store 5.1.1(v) hard blocker; deletion-semantics decision (cascade vs anonymize) documented in the PR design section. |
| S74 | Web session/middleware caching | Compressed | C3+C49 (middleware half), C5 | Calibration status cached in a cookie instead of a per-request DB probe, `cache()`-deduped getUser, server-fed nav-rail props (kills the 200px layout shift + 3 client calls). Depends on S66's fetcher signatures. |
| S75 | Detail-page fetch hygiene | Compressed-to-Mega | C12, C11, C19, C20-subset | `enabled`-gating for collapsed subsections, state-votes cap + show-more windowing, `state_bill_subjects` index + waterfall bounds, `.limit` caps — **scope rule:** only fetchers S79 will not consolidate (C18's list enumerates them); C22 moved to S79 where the embed shape is decided. |
| S76 | Drop push_tokens | Patch | G6 (moots C23) | Schema-only orphan with zero app consumers since slice 3; migration + pgTAP + `db:gen-types` regen per the slice-13 table-drop precedent. Includes the one-time table-level consumer audit. |
| S77 | Dead-surface purge + constants | Mega | C24, C28, C30, C29 | Delete the orphaned MetricCardShell subsystem (zero consumers, kept absorbing reskin work), delete legacy COLORS + fix the CLAUDE.md rule that still mandates it, shared CURRENT_CONGRESS/CURRENT_CYCLE constant, document the officials/state-bills package boundary. Slice-58 deletion-only precedent; per-symbol re-grep (Gotcha #20). |
| S78 | Seam cast cleanup | Compressed | C26 | The 18 `router.push(... as never)` typedRoutes defeats (incl. the broken Settings links), 2 vestigial `supabase as never` client casts, 7 PostgREST double-casts. Mechanical and independent — can be pulled earlier as filler. |

## Wave 3 — structural

| # | Slice | Tier | Contents | Value |
|---|-------|------|----------|-------|
| S79 | SSR prefetch + round-trip collapse | Full | C4, C18, C22, C7 | HydrationBoundary + server prefetch for detail pages; collapse ~29/~22 round-trips via embeds/RPC; home N+1 embed; SmartAnchor → next/link (covers C7 fully). Plan must stage C4-then-C18. |
| S80 | Card-shell unification | Full | C25, U2-structural, C27-remainder, C6-remainder | Shared 3-branch card shell + sub-list generic across the 12 federal/state cards (kills the drift class — inverted backgrounds, missing NULL handling), error-vs-empty distinction rides the shell, barrel split/layering decision, RNW text primitive carries the Inter fontFamily. Staged shell-first in the plan. |
| S81 | Ingest ops robustness | Mega | C36, C37, C35, C34 | One fetchWithRetry adopted everywhere, on-disk caching for the heaviest fetchers, stub-vs-production visibility in orchestrator output, operator runbook + persisted skip telemetry. Pairs naturally with backlog item U7 (user-facing freshness signal) if scope allows. |
| S82 | Senate disclosure parsers | Full | C32 | Real Senate eFD search replacing the stub — `seed:federal-ptrs`/`fds` currently ingest House data only, silently. |
| S83 | Playwright E2E foundations | Full | U8 | Minimal harness against local Supabase: signup→calibrate→home, officials detail, quiz save→alignment strip. CI already has every prerequisite. |
| S84 | Contract tests + a11y automation | Compressed | U9, U11 | PostgREST contract layer for the 12 never-executed fetchers (embed/column/RLS drift detection) + vitest-axe over officials-ui's real-DOM renders. |
| S85 | Maestro mobile flows | Compressed | U14 | Mobile E2E skeleton — schedule once S64's builds exist. |
| S86 | DX leftovers | Compressed | C42, C44, C46 | Windows CI smoke job (the Gotcha #28 bug class is Windows-only), renovate + pin fixes, root README. |

## Strategic items (own conversations, not slices)

- **G1 — staging-deploy spike.** Hosted Supabase + deployed web, timeboxed; the breakage list is the deliverable. Schedule before any public-launch work; several Wave-1 fixes (headers, Sentry tunnel, auth config) only prove out against it.
- **G4 — product analytics.** ~5 privacy-respecting funnel events (no stance/topic payloads). **Trigger:** schedule as a Compressed slice the moment the quiz-redesign brainstorm resumes; must land no later than the redesign's first implementation slice or its hypotheses are untestable.
- **G5 — i18n decision.** One-paragraph commitment (English-only v1 vs string-table for new components) inside the quiz-redesign spec.

## Backlog (unscheduled, revisit after Wave 2)

- C21 — rep_stance_score caching/materialization (deferred until scale warrants)
- U4 — IA gaps: /officials missing state legislators; Issues flow has no nav entry (needs a product decision; flag during the quiz-redesign brainstorm)
- U7 — data-trust surface ("as of" timestamps + source attribution; pairs with S81)
- U12 — visual regression harness
- U15 — coverage measurement

## Allocation completeness

All 83 items accounted for: C0–C54 and U0–U21 each appear in exactly one slice (with stated merges: C8+U0, C54+U18, C1+C16; stated splits: U2 → S65-rider/S70-web/S80-structural, C27 → S70-partial/S80-remainder, C6 → S70-partial/S80-remainder, C3+C49 → S66-fetchers/S74-middleware), C23 is mooted by S76, and G1–G6 are either slices (G2→S73, G3→S68, G6→S76) or strategic items (G1, G4, G5). The 1 refuted finding is excluded.

---

## Revision 2026-07-12 — Wave-3 re-plan (post-S79 skeptical review)

**Status at revision:** Waves 1+2 complete (S62–S78; S73 parked per the portfolio horizon), S79 shipped (#52 `2ca36c1`) — Wave 3 open. This section re-sequences the remainder after a fresh-eyes review against the locked goal (**personal/portfolio quality; no external users imminent; solo operator; staging on Supabase free tier + Vercel**). It supersedes the Wave-3 table above for execution order; the original allocation stays as the record.

### What the review found

1. **Audit staleness is now measurable.** U9 (fetcher contract coverage) is ~half mooted: S75 proved the 3 state-vote fetchers against live PostgREST; S79 proved finance, state donors, hearings, catalog, sponsored/cosponsored (federal + state), and the fetchMyOfficials card-data embed. **Rule going forward: re-verify a slice's audit findings at slice-open** — 18+ slices have landed since the 2026-06-10 audit, and any Wave-3 slice executed as-written risks re-doing or rediscovering shipped work.
2. **A falsified assumption.** The 159-item Android DoD eval has been "user-side, in parallel" since 2026-06-11 with zero runs. S85 (Maestro) and every mobile-parity claim rest on it. It needs an explicit scheduling decision, not a standing assumption.
3. **Goal-alignment gap.** The items that most affect a portfolio reviewer's experience — staging free-tier idle-pause (DB asleep at the demo link), the core flow requiring a *real home address* with no sample-address path, no password reset / confirmation-resend (staging has confirmations ON), the Issues flow having **no navigation entry** (U4), `/officials` missing state legislators (U4), root README buried in S86, legal pages saying "last updated: placeholder" — had no owning slice, while data-completeness and test-infra slices did.
4. **Process gap.** Branch protection (require build/db/test) is still unconfigured after the S72 red-merge incident. It is a 2-minute settings change; flip it before the next merge. (Settings task, not a slice.)
5. **Top risks (likelihood × impact):** (1) Wave-3 goal drift — S82–S86 mostly don't move the demo; (2) the Android-eval assumption staying false; (3) S80 scope blow-up (same shape as slices 10 and 33–37, which grew mid-flight); (4) staging asleep at demo time; (5) Playwright economics (GeocodIO spend or Edge-Function mock; the U17 60s throttle will 429 reused test users); (6) external-site drift vs S81/S82 with no alerting consumer yet.

### Re-sequenced Wave 3 (execution order)

| # | Slice | Tier | Contents | Notes |
|---|-------|------|----------|-------|
| S79.5 | **Demo readiness** | Compressed-to-Mega | Staging keep-alive (free-tier idle-pause: scheduled ping or paid-tier decision); sample-address demo path (reviewers won't type a real residence); resend-confirmation or full password reset (neither exists; deferred since slice 31); **U4 both halves** (Issues nav entry + `/officials` state legislators); root README + screenshots (pulled forward from S86); one Lighthouse before/after capture on the live origin (the S67/S70/S79 perf story currently has no measured evidence); legal placeholder copy pass | Highest goal-alignment per hour on the board. Rider: flip **branch protection** ON first (settings change, precedes the slice's own PR). |
| S80 | Card-shell unification | Full | As originally scoped (C25, U2-structural, C27/C6-remainders, BrandTextInput `as never` survivor) **plus** the queued Sentry items: `global-error.tsx` + the SDK deprecations (`instrumentation-client.ts`, `disableLogger` → `webpack.treeshake.removeDebugLogging`) ride here to avoid another config-collision slice | Hidden-complexity warning: the shared shell must absorb the slice-57 heading contract, slice-65 native ScrollView/RefreshControl wiring, Gotcha #22 aria-expanded, Gotcha #15 *intentional* federal/state asymmetries, and **S79 hydration semantics** (web cards now mount WITH data — a loading-first shell will flash on every hydrated page). Error-vs-empty visuals = a design decision → visual-companion loop. C6-remainder (RNW `<Text>` Inter threading) is first overboard if the slice swells. |
| S81 | Ingest ops + cadence | Mega | C36 (uniform fetchWithRetry), C37 (on-disk caching — relearn Gotcha #31: producer/consumer path match, rolling keys), C35 (stub-vs-production visibility), C34 (scheduler + runbook + **persisted skip telemetry with an alerting consumer** — telemetry nobody reads recreates C31 at the ops layer); U7 freshness surface if scope allows | Pulled ahead of the test slices: the C34 scheduler **incidentally solves staging idle-pause durably** (S79.5 ships the stopgap). Two decisions must be written down in the PR: where cron runs (GH Actions implies hosted-DB write creds as repo secrets — branch protection must be ON first) and credential custody. |
| — | **Quiz-redesign design loop (opens NOW, parallel)** | Full (brainstorm gate) | Resume `project_chiaro_quiz_ui_brainstorm` visual-companion iterations **overlapping S80/S81 engineering** — the gate is user design approval, i.e. user attention, so serializing it after Wave 3 wastes the scarce resource. G4 analytics rides its first implementation slice; G5 i18n paragraph in its spec. | Hard-gate unchanged: no implementation code until design approved. |
| S83 | Playwright E2E + a11y | Full | U8 (signup→calibrate→home, officials detail, quiz save→alignment strip) **+ U11 vitest-axe folded in** (from dissolved S84) | The harness decisions are the real work: target env, CI seed fixtures, auth-user provisioning, GeocodIO mock (the U17 throttle 429s repeated calibrations for a reused user), middleware `chiaro_calibrated` cookie interplay. The three journeys are trivial after that. |
| — | U9 residue | Riders | The still-uncovered fetchers (metrics, leadership history, town halls, state offices/disclosures, the 3 issues RPCs) land as **integration-suite riders on whichever slice next touches them** — the per-package live-PostgREST suite is the established pattern (S75/S79 precedent) | **S84 is dissolved**: half its scope shipped piecemeal; a standalone "contract layer" would duplicate the existing pattern. |
| S82 | Senate disclosure parsers | Full | C32 unchanged | **Deferred behind quiz + S83**: data-completeness on a low-traffic surface; the work is external-site archaeology (CSRF'd POST search, pagination, per-filer PDF variance), not parsing. Revisit once S81's alerting exists so drift isn't silent. |
| S85 | Maestro mobile flows | — | U14 | **Parked** until the first *manual* DoD eval run exists — automating flows never validated on-device is backwards. Requires an explicit user scheduling decision to un-park. |
| S86 | DX leftovers | Patch | C42 (Windows CI smoke), C44 (renovate + pins) | README removed (→ S79.5). Backlog-grade; execute opportunistically. |

### Standing decisions recorded at this revision

- **Apple Developer credentials: no purchase for the portfolio horizon.** The recurring "Day-1 decision" note (pending since slice 5) is closed; revisit only if a store submission ever becomes a goal (which also un-parks S73 account deletion — an App Store 5.1.1(v) hard blocker).
- **CLAUDE.md growth is a real cost.** Slice entries now run ~1k words each and every session pays the token bill. A compaction pass (collapse slices 1–61 into an era summary; keep Waves 1–3 detail) is a candidate Patch — schedule before it becomes urgent.
- **Fragile assumptions to re-check each slice-open:** audit accuracy (see #1), free-tier adequacy, "no users" (the moment the portfolio link circulates there ARE users — no password reset, parked account deletion, placeholder legal), scraper/API stability (no alerting until S81).
- **The single biggest risk, named:** goal drift — finishing S86 with a technically excellent app that is asleep at the link, whose flagship feature has no visible entry, and whose repo has no README telling a reviewer what they're looking at. S79.5 exists to kill this failure class first.
