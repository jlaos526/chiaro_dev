# Slice 52 — Issue Priorities + Radar — Design Spec

**Date:** 2026-05-31
**Branch:** `slice-52-issue-priorities-feature`
**Tier:** Mega Slice (~45–55 files, full web + mobile parity)
**Status:** Brainstorm complete (18 decisions locked). Awaiting spec review → plan.

---

## 1. Summary

A signed-in user runs a sequential 5-step flow: picks ≤6 **topics** from an extensible 13-topic catalog → picks 1+ **lenses** (stances + watchlists) per topic → takes a **Yes/No quiz** → sees a 6-axis **radar** of their issue priorities → on every representative's detail page, the user's selected topics/stances drive a personalized **alignment strip** (overall % + 6 axis dots + tap-to-expand you-vs-rep radar overlay) and **★ priority tags** highlighting matching content across cards.

This is the first **citizen-side** issue feature in Chiaro. Everything "issue"-related today is official-side (how a rep rates). Slice 52 adds "which issues matter to *me*, and how does each rep align with them."

---

## 2. Goals & non-goals

**Goals**
- Extensible, neutral topic catalog (admin adds rows; no code change for new topics).
- Objectively-measurable scoring: every scored lens maps to real data already in the DB (scorecard ratings + bill votes).
- A taken-once-but-editable quiz that yields a 0–100 user position per stance.
- A transparent, explainable alignment % per rep (no black-box similarity).
- Full web + mobile parity in one slice (per locked decision B).

**Non-goals (this slice)**
- **Watchlist data sources** — watchlist lenses ship configured but with empty evidence; real ingestion is **slice 53** (locked #11).
- **List-level alignment** — alignment badges / sorting on the officials *list* pages and home officials card are a fast-follow, not v1 (keeps the Mega Slice bounded).
- **Precomputed rep scores** — v1 computes alignment on-the-fly; a `rep_stance_scores` materialization is a future perf optimization (§13).
- **Sponsored-bills / committee / cosponsorship measurement source types** — schema allows them (`type` is open), but v1 implements only `scorecard` + `bill-vote` (locked #5).

---

## 3. Locked decisions (condensed reference)

From the paused brainstorm (14) + this session's 4:

1. **MVP scope:** quiz + radar + rep-page tag binding + rep-radar overlay + alignment %. One Mega Slice.
2. **Radar = 6 axes** (hexagon), user-selected from the catalog. Different users → different radar shapes.
3. **13-topic catalog** (slugs stable): `immigration`, `environment`, `law-and-order`, `civil-liberties`→"Personal Freedoms", `civil-rights`→"Equality", `labor`, `abortion-policy`, `gun-policy`, `economy`, `healthcare`, `education`, `housing`, `foreign-policy`.
4. **Topics are neutral; lenses branch from topics.** Lens types: `stance` (scored → axis) and `watchlist` (evidence-only, never scored).
5. **Composite measurement per stance** via `measurement_sources` jsonb (`scorecard` + `bill-vote` in v1; others deferred). Per-source weights sum to 1.0.
6. **Schema Option C — 3 new tables** (`issue_topics`, `issue_lenses`, `user_issue_selections`). *This spec keeps the 3-table lock; see §4.5 for the additive-column refinements.*
7. **"Pro Life" = literal consistent-life-ethic** value_tag (not anti-abortion); a non-locking quick-start chip pre-checks Healthcare + Education + Housing + Foreign Policy.
8. **Stances replace framings.** Each topic carries multiple stances; the user's stance pick sets the axis label/direction (e.g. Gun Policy → "Gun Rights" or "Gun Control").
9. **Presets = non-locking quick-start chips.** Pre-check matching topics/lenses; user freely swaps. v1: hardcoded in app config (not a DB table) — UI sugar.
10. **Sequential 5-step flow:** Welcome/chips → pick ≤6 topics → pick lenses → quiz → radar + save.
11. **Watchlist data deferred to slice 53.**
12. **Lens deep-dive exemplars:** Environment = 4 stances + 1 watchlist; Law & Order = 2 stances + 4 watchlists.
13. **Existing substrate maps cleanly** (10 federal + 5 state scorecard orgs; bill subjects; slice 5I ethics tables for future watchlists).
14. **Topic renames** locked (slugs stable).
15. **Quiz format = YN** (Yes / No / Skip + per-question "extra weight" importance flag; Wahl-O-Mat pattern). ~36 questions.
16. **Platform scope = full web + mobile parity** in this slice.
17. **Rep-page treatment = C (strip + inline tags).** Persistent slim strip under the bio header (% + 6 axis dots, tap → radar overlay) + lightweight ★ tags on matching rows across every relevant card.
18. **Alignment = weighted-agreement** model + two defaults: stance-importance-weighted overall roll-up; dot thresholds 67 / 33.

---

## 4. Data model

### 4.1 Catalog tables

```sql
-- Topics: neutral, extensible, admin-managed
create table public.issue_topics (
  slug          text primary key,
  display_name  text not null,
  description   text not null,
  value_tags    text[] not null default '{}',   -- 'pro-life','liberty','progressive','conservative'
  display_order int  not null default 0,
  active        bool not null default true
);

-- Lenses: 1+ per topic. stance => scored axis contribution; watchlist => evidence only.
create table public.issue_lenses (
  topic_slug          text not null references public.issue_topics(slug) on delete cascade,
  slug                text not null,
  label               text not null,              -- "Conservation", "Gun Rights", "For-Profit Prisons"
  lens_type           text not null check (lens_type in ('stance','watchlist')),
  description         text,
  measurement_sources jsonb not null default '[]',-- stance scoring config (§4.3)
  evidence_sources    jsonb not null default '[]',-- watchlist evidence config (empty in v1)
  quiz_questions      jsonb not null default '[]',-- stance YN statements (§4.3) — ADDITIVE vs locked #6
  display_order       int  not null default 0,
  active              bool not null default true,
  primary key (topic_slug, slug)
);
```

### 4.2 User table

```sql
create table public.user_issue_selections (
  user_id       uuid not null references auth.users(id) on delete cascade,
  topic_slug    text not null references public.issue_topics(slug) on delete cascade,
  lens_slug     text not null,
  display_order int  not null default 0,
  position      numeric(5,2),                     -- ADDITIVE: quiz-derived user position 0–100; NULL for watchlists / unanswered
  importance    smallint not null default 1,      -- ADDITIVE: 1 (normal) or 2 (starred "extra weight")
  selected_at   timestamptz not null default now(),
  foreign key (topic_slug, lens_slug)
    references public.issue_lenses(topic_slug, slug) on delete cascade,
  primary key (user_id, topic_slug, lens_slug)
);
```

### 4.3 jsonb schemas

`issue_lenses.measurement_sources` (stance lenses; per-source `weight` sums to 1.0):
```jsonc
[
  { "type": "scorecard", "weight": 0.6,
    "config": { "orgs": ["lcv","sierra-club"], "scope": "both", "invert": false } },
  { "type": "bill-vote", "weight": 0.4,
    "config": { "subjects": ["Environment","Climate Change"], "agree_position": "yes" } }
]
```
- `scorecard.config.orgs` → slugs in `scorecard_orgs.slug` / `state_scorecard_orgs.slug`. `scope` = `federal|state|both` (which rating table to read by rep tier). `invert` flips a scorecard that scores the opposite direction of the stance.
- `bill-vote.config.subjects` → matched against `bill_subjects.subject` / `state_bill_subjects.subject` (case-insensitive). `agree_position` = the vote value (`yes`/`no`) that counts as agreement with the stance.

`issue_lenses.quiz_questions` (stance lenses only):
```jsonc
[
  { "slug": "public-lands-expand",
    "prompt": "Public lands should be expanded and protected from new development.",
    "agree_direction": 1, "display_order": 0 }
]
```
- `agree_direction` = +1 (Agree pushes the stance position toward 100) or −1 (Agree pushes toward 0).

`issue_lenses.evidence_sources` (watchlist lenses) — shape reserved, **`[]` in v1** (slice 53 fills).

### 4.4 RLS + write path

Mirror `user_locations` (migration 0005): **atomic write via SECURITY DEFINER RPC**, select-self RLS, direct writes revoked.

```sql
alter table public.user_issue_selections enable row level security;

create policy "user_issue_selections_select_self"
  on public.user_issue_selections for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.user_issue_selections from anon, authenticated;

-- Atomic replace of the caller's selections (mirrors apply_calibration).
create function public.save_user_issue_selections(p_selections jsonb)
  returns void language plpgsql security definer set search_path = public as $$
begin
  delete from user_issue_selections where user_id = auth.uid();
  insert into user_issue_selections (user_id, topic_slug, lens_slug, display_order, position, importance)
  select auth.uid(), x.topic_slug, x.lens_slug, x.display_order, x.position, coalesce(x.importance,1)
  from jsonb_to_recordset(p_selections) as x(
    topic_slug text, lens_slug text, display_order int, position numeric, importance smallint);
end $$;
```

Catalog tables (`issue_topics`, `issue_lenses`) are **public read** (RLS allowing `select to anon, authenticated`), writes service-role only (seeded).

### 4.5 Honoring the 3-table lock

Locked decision #6 fixed **Option C = 3 new tables**. This spec keeps exactly **3 new tables** and adds them only **additive columns** rather than spawning new tables:
- `issue_lenses.quiz_questions jsonb` — quiz statements live on the stance lens (consistent with `measurement_sources`/`evidence_sources` already on that table; keeps the catalog admin-editable per the extensibility principle).
- `user_issue_selections.position` + `.importance` — the quiz result is folded onto the user's selection row (a stance the user picked is also the stance they're scored on). No separate `user_stance_positions` table.

Rep scores are **computed, not stored** in v1 (§13) — no `rep_stance_scores` table. **→ This additive-column approach is the main thing to confirm at spec review (§17).**

### 4.6 Migrations

- **0056_issue_priorities.sql** — tables `issue_topics`, `issue_lenses`, `user_issue_selections`; functions `save_user_issue_selections` + `get_rep_issue_alignment` (§13).
- **0057_issue_priorities_rls.sql** — RLS enable + all policies (catalog public-read; `user_issue_selections` select-self) + grants/revokes (split per the project's create-then-RLS convention, e.g. 0040/0041, 0054/0055).

---

## 5. Topic catalog content

Ship all 13 topics. Each topic gets 1+ stance lenses (scored) and optional watchlist lenses (evidence, empty in v1). Stances wire `measurement_sources` to **real** scorecard orgs + bill subjects; a stance with no available data source ships with `measurement_sources: []` and simply doesn't contribute to scoring until wired (logged, not broken).

**Exemplars (locked #12):**
- **Environment** — stances: Conservation, Climate Action, Pro Oil & Gas Drilling, Pollution Regulation; watchlist: Industry Donor Recipients. (`scorecard` → `lcv`, `sierra-club`; `bill-vote` → subjects Environment/Climate.)
- **Law & Order** — stances: Public Safety, Criminal Justice Reform; watchlists: Anti-Fraud & Self-Interest, For-Profit Prisons, Epstein-Related Protectors, SLAPP-Suit Participants (all empty v1).
- **Gun Policy** — stances: Gun Rights (high = expansive 2A; `scorecard` → `nra`), Gun Control (high = strict controls; `bill-vote` → subjects Firearms).

**Authoring scope:** ~30 stance lenses + ~36 YN quiz statements (locked #15 math: ~3 Q/stance × user's avg 2 stances × 6 topics). This is real content work and is **in scope** for the slice. The catalog seed is a dedicated file: `packages/db/supabase/seed/issue-catalog/` → `pnpm seed:issue-catalog`. Federal-vs-state org availability differs (10 federal orgs vs 5 state orgs); `scope` in each scorecard source handles the split.

---

## 6. Quiz (YN) — UX + position derivation

**Interaction** (locked #15): for each statement → **Disagree / Agree / Skip** + an "★ extra weight" toggle. Questions shown are exactly the `quiz_questions` of the stances the user selected in step 3 (adaptive set, ~36 total).

**User position per stance** (consumed by the formula):
- Orient each answered question by `agree_direction`: `oriented = 1` if (Agree & dir=+1) or (Disagree & dir=−1); `oriented = 0` if (Disagree & dir=+1) or (Agree & dir=−1); **Skip → excluded**.
- `position = mean(oriented over non-skipped) × 100` (e.g. agreed with 2 of 3 pro-stance Qs → 67).
- `importance = 2` if the user starred ≥1 of that stance's questions, else `1`.
- A stance with all-skipped questions → `position = NULL` (no signal; excluded from alignment, like a no-data rep stance).

Persisted via `save_user_issue_selections` (one atomic call at step 5).

---

## 7. Alignment formula (weighted agreement — locked #18)

Computed per rep, for the current user's selected **stance** lenses (watchlists never score).

Per selected stance `s`:
- `user_pos[s]` — from the quiz (§6), 0–100.
- `rep_pos[s]` — composite of `measurement_sources` (§13), 0–100, or **NULL** if the rep has no data for any source.
- `agreement[s] = 100 − |user_pos[s] − rep_pos[s]|`  (identical → 100, opposite → 0).
- `w[s] = importance[s]`  (1 or 2).

Roll-ups (NULL stances excluded everywhere — **NULL ≠ 0**):
- **Per-topic / axis** `= Σ(agreement[s]·w[s]) / Σ(w[s])` over that topic's selected stances → radar point + dot:
  - 🟢 aligned ≥ 67 · 🟠 partial 34–66 · 🔴 differs ≤ 33 · ⚪ grey = no rep data.
- **Overall %** `= Σ(agreement[s]·w[s]) / Σ(w[s])` over **all** selected stances (stance-importance-weighted, locked default).

If the user has **no** selections, or the rep has data for **zero** of them → no alignment UI; show a subtle "Set your issue priorities" CTA instead (§8).

---

## 8. Rep-page integration (Option C)

Three shared `officials-ui` components, inserted at 3 composition sites.

**8.1 `RepAlignmentStrip`** — slim bar directly under the bio header: `72% aligned` + 6 axis dots (colored per §7) + "tap to compare ▾". Tapping expands **8.2 `IssueRadarOverlay`** inline (the you-vs-rep hexagon). Renders only when the user has selections and the rep has ≥1 scored axis; otherwise a one-line "Set your issue priorities to see how Rivera aligns →" CTA linking to `/issues`.

**8.3 `IssuePriorityTag`** (`★`) — applied to rows whose subject/org matches a user-selected topic/stance, inside existing cards:
- `FederalIssuePositionsCard` / `StateIssuePositionsCard` — scorecard rows for the user's topics float to top + ★.
- `FederalVotingBillsCard` / `StateServiceRecordCard` — votes on subject-matched bills get ★.
Matching is by the same `measurement_sources` config (org slug / subject) that drives scoring, so tags and the score never disagree.

**Insertion points (after the bio header, before the card cascade):**
- Federal web — `apps/web/app/officials/[id]/page.tsx` after `<BioHeaderClient/>` (line ~124).
- Federal mobile — `apps/mobile/app/(app)/officials/[id].tsx` (parallel).
- State (both platforms) — shared `packages/officials-ui/src/state/StateOfficialDetailPage.tsx` after the bio block.

The strip + radar + tag are all in `officials-ui` (RNW shared, radar via `react-native-svg`).

---

## 9. Onboarding flow + routes + entry points

**5-step flow** (locked #10), each a shared screen component in `officials-ui/src/issues/`, wrapped by thin per-platform routes:
1. **Welcome / quick-start chips** — `IssueWelcomeScreen` (non-locking preset chips, locked #9).
2. **Pick ≤6 topics** — `TopicPickerScreen` (catalog grid, multi-select cap 6).
3. **Pick lenses per topic** — `LensPickerScreen` (per topic: stances + watchlists, multi-select 1+).
4. **Quiz** — `IssueQuizScreen` (YN + importance, adaptive set).
5. **Radar + save** — `IssueRadarResultScreen` (the user's own 6-axis radar; "Save" → `save_user_issue_selections`).

**Routes** (mirror the calibrate precedent):
- Web — `apps/web/app/issues/{page,topics,lenses,quiz,radar}/page.tsx` (client components; wizard state via a shared context/provider or URL params).
- Mobile — `apps/mobile/app/(app)/issues/{index,topics,lenses,quiz,radar}.tsx` (Expo Router).

**Entry points & re-entry:**
- Home: a "Set your issue priorities" CTA card (pre-set) / "Your priorities" radar preview card (post-set, links to edit).
- Settings: a new **Issue Priorities** row → `/issues` (re-run / edit; the flow pre-loads existing selections).
- The flow is **optional** (not gated like calibrate) — users can use the app without it; alignment UI simply doesn't appear until set.

---

## 10. New `@chiaro/issues` package

Standard domain shape (mirrors `@chiaro/location`); workspace 11 → 12.
- `types.ts` — `IssueTopic`, `IssueLens`, `MeasurementSource`, `QuizQuestion`, `UserIssueSelection`, `RepAlignment` (`{ overallPct, axes: { topicSlug, label, alignmentPct, dot, repPosByStance }[] }`).
- `queries.ts` — `fetchTopics`, `fetchLenses`, `fetchMySelections`, `fetchRepAlignment(officialId)` (calls `get_rep_issue_alignment` RPC).
- `mutations.ts` — `saveSelections` (calls `save_user_issue_selections`).
- `keys.ts` — TanStack key factory.
- `hooks.ts` — `useIssueCatalog`, `useMySelections`, `useRepAlignment(officialId)`, `useSaveSelections`.
- `schemas.ts` — zod for the catalog jsonb (`measurementSourceSchema`, `quizQuestionSchema`) + the save payload.
- `index.ts` — barrel.
- `package.json` deps: `@chiaro/db`, `@chiaro/supabase-client`, `zod`; peer `@tanstack/react-query`, `react`.

Dependency direction respected: `@chiaro/issues` → `@chiaro/db` (Database type). Catalog normalize/scoring SQL lives in `packages/db` (the RPC); TS consumes it.

---

## 11. Shared UI components (`officials-ui`)

- `issues/IssueRadarChart.tsx` — `react-native-svg` hexagon: grid + spokes + 1 (own radar) or 2 (overlay) polygons. Props: `axes`, `userValues`, `repValues?`, `size`. Reused by step-5 result, the rep overlay, and home preview.
- `issues/RepAlignmentStrip.tsx`, `issues/IssueRadarOverlay.tsx`, `issues/IssuePriorityTag.tsx` (§8).
- `issues/{IssueWelcomeScreen,TopicPickerScreen,LensPickerScreen,IssueQuizScreen,IssueRadarResultScreen}.tsx` (§9) + a `IssueFlowProvider` for wizard state.
- `issues/MyIssuesCard.tsx` — home/settings radar preview + edit CTA.
- All consume `useBrandTokens()` (dark-mode ready from day one, per slices 33–40). No inline hex.

---

## 12. Design tokens (`@chiaro/ui-tokens`)

New small palette for alignment state (light + dark), since the dot/strip semantics are distinct from the existing `alert` namespace:
- `ALIGNMENT_DOT = { aligned, partial, differs, none }` (🟢/🟠/🔴/⚪) + `_DARK`.
- `RADAR = { grid, userFill, userStroke, repStroke }` + `_DARK`.
- Brand-hooks: `useAlignmentDotColor(level)`, `useRadarColors()` in `officials-ui/brand-hooks.ts`.
Reuse `semantic.*` for strip bg/borders. (Mirrors the slice-37 per-domain-palette + hook pattern; honors the hex-grep rule, Gotcha #29.)

---

## 13. Rep scoring computation (architecture)

**v1: on-the-fly, single source of truth in Postgres.** A SECURITY DEFINER read function:

```sql
get_rep_issue_alignment(p_official_id uuid) returns jsonb
```
Reads the caller's `user_issue_selections` (positions + importance) + that official's tier (federal/state), interprets each selected stance's `measurement_sources`:
- **scorecard** → avg `score` from `scorecard_ratings` (latest congress) or `state_scorecard_ratings` (latest session) for `config.orgs`, `invert` applied.
- **bill-vote** → `% agreement` from the rep's `vote_positions`/`state_vote_positions` on bills whose `bill_subjects.subject` matches `config.subjects`, vs `config.agree_position`.
- Weighted-combine (renormalize over sources that have data) → `rep_pos[s]`, or NULL.
Then applies §7 → returns `{ overallPct, axes:[…] }`. One round trip; auth.uid() scopes the user. Returns null for logged-out/no-selections.

Only **2 source types** in plpgsql v1 → bounded complexity. Tested via **pgTAP** with seeded scorecards/votes (the scoring contract is the highest-value thing to test).

**Deferred:** if per-request cost is too high at scale, precompute `rep_stance_scores(official_id, topic_slug, lens_slug, score, computed_at)` via a `recompute-rep-stance-scores.ts` pipeline (mirrors `official_metrics`) and have the function read that table instead. Out of v1 scope; the function signature stays identical so it's a transparent swap.

---

## 14. Testing strategy

- **pgTAP** (+~30 plans, 428 → ~458): table existence/columns/constraints/RLS for the 3 tables; `save_user_issue_selections` atomic replace + auth scoping; **`get_rep_issue_alignment`** scoring correctness (seed a rep with known scorecards + votes, assert overall % and per-axis dots, incl. NULL-exclusion and invert).
- **vitest** (`@chiaro/issues`): query/hook/schema unit tests; the position-derivation helper (§6) and zod catalog validation.
- **vitest** (`@chiaro/officials-ui`): `IssueRadarChart` polygon math, `RepAlignmentStrip` states (set / unset / no-rep-data), `IssuePriorityTag` matching, the 5 flow screens, `aria-*` parity (RNW gotchas #19/#22). Hex-grep + cross-package consumer test run per Gotcha #29.
- **jest-expo** (`apps/mobile`): the mobile flow screens + detail-page strip (mutable-mock pattern per memory, not `resetModules`).
- **CI**: a `seed:issue-catalog` fixture-ingest suite in the `db` job (mirrors the 9 existing fixture suites) to catch catalog regressions.

---

## 15. File inventory (~50, full parity)

- **DB:** 2 migrations + catalog seed (`issue-catalog/` ~2 files + data) + pgTAP (~3 files). (~7)
- **`@chiaro/issues`:** 8 src + package.json/tsconfig/vitest.config + ~5 tests. (~16)
- **`officials-ui`:** radar + strip + overlay + tag + 5 flow screens + provider + MyIssuesCard (~11) + tests (~11). (~22)
- **`ui-tokens`:** alignment/radar palette + brand-hooks + tests. (~3)
- **apps/web:** 5 `/issues` routes + home/settings entry + officials/[id] insertion. (~7)
- **apps/mobile:** 5 `/issues` routes + home/settings entry + officials/[id] insertion. (~7)
- State detail insertion is shared (1 file edit). CLAUDE.md "Slices delivered" entry.

≈ 50 files — consistent with the Mega Slice estimate.

---

## 16. Deferrals & future slices

- **Slice 53 — watchlist data sources** (separate brainstorm): for-profit-prison donor data, Epstein-related vote histories, SLAPP court records, expanded ethics coverage, recall tagging. Fills the `evidence_sources` shipped empty here.
- List-level alignment badges + sort/filter (home officials card, officials/state-officials lists).
- `rep_stance_scores` precompute (perf).
- `sponsored-bills` / `committee` / `cosponsorship` measurement source types.

---

## 17. Embedded decisions to confirm at spec review

These were resolved *in the spec* (beyond the 18 brainstorm locks) and warrant a sanity-check:
1. **Additive columns instead of new tables (§4.5):** `quiz_questions` jsonb on `issue_lenses`; `position`+`importance` on `user_issue_selections`. Keeps the locked 3-table count. ← primary item.
2. **Scoring lives in a Postgres RPC `get_rep_issue_alignment` (§13)**, computed on-the-fly, no precompute table in v1.
3. **Writes via atomic SECURITY DEFINER RPC** (`save_user_issue_selections`), mirroring `apply_calibration` — not direct RLS inserts.
4. **List-level alignment + watchlist data are OUT of v1** (§2 non-goals; slices 53 / fast-follow).
5. **Quiz-question authoring (~36 statements) is in-scope content** for this slice (§5).

---

## 18. Risks / gotchas

- **plpgsql jsonb interpretation** (§13) is the core implementation risk — keep it to 2 source types; pgTAP it hard.
- **RNW radar SVG** — `react-native-svg` polygons render on web via RNW; verify fill/stroke parity (existing DistrictBadge/Logo precedent de-risks this).
- **NULL ≠ 0** everywhere (no-data stance → grey/excluded, never red/zero) — standing user preference.
- **Federal/state composition asymmetry** (§8) — federal is app-local (2 sites), state is shared (1 site); the strip is shared but inserted thrice. Per Gotcha #15, don't "unify" the detail pages as a side effect.
- **SSR auth context** — `get_rep_issue_alignment` relies on `auth.uid()`; confirm the web server (`@supabase/ssr`) client carries the session on the officials detail RSC.
- **Mega-Slice size** — execute via subagent-driven-development; sequence DB → `@chiaro/issues` → shared UI → routes → integration so each layer is verifiable before the next.
```
