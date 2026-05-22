# Chiaro

Civic-engagement app: address → districts → elected officials → (future) bills + votes. pnpm workspaces + Turborepo monorepo; Next.js 15 + React 19 (web), Expo + react-native (mobile), Supabase Postgres + PostGIS + Edge Functions (backend).

## Quick start

```bash
pnpm install                           # workspace deps; uses pnpm 9.x

# Local backend
pnpm db:start                          # boot local Supabase (port 54321; DB 54322)
pnpm db:reset                          # apply all migrations 0001–0041
pnpm db:test                           # pgTAP suite (341 tests across 26 files)
pnpm seed:tiger                        # ingest TIGER 2024 district geometries (~5–15 min, ~51 Census shapefiles)
pnpm seed:officials                    # ingest federal officials from Congress.gov v3 (requires CONGRESS_GOV_API_KEY)
pnpm seed:state-officials              # ingest state legislators from openstates/people YAML repo (no API key)
pnpm seed:state-scorecards --session=20252026     # ingest 5 per-org state scorecards (stubs in v1)
pnpm seed:state-community --component=halls|offices|hearings|all   # ingest community-presence data (stubs in v1)
pnpm seed:state-ethics --component=stock|disclosures|complaints|events|all   # ingest ethics records (stubs in v1)
pnpm seed:state-bills-full             # ingest state bills + votes + per-state augment + state metrics
pnpm seed:state-finance --cycle=2024 --skip-on-error   # state campaign finance (5 states: CA NY FL TX MI)
pnpm seed:openstates-committees-fetch --state=CA   # one state at a time; repeat per state
pnpm seed:openstates-committees-ingest             # parse cache → state_committee_memberships
pnpm seed:state-metrics-recompute --session=2024   # populates new KPI columns

# App dev
pnpm --filter @chiaro/web dev          # Next.js on http://localhost:3000
pnpm --filter @chiaro/mobile dev       # Expo Metro

# Verify before push
pnpm -r typecheck                      # 10 packages
pnpm test                              # full workspace tests via turbo (see Gotchas: don't use `pnpm -r test`)
pnpm --filter @chiaro/web build        # Next 15 build
```

## Architecture

```
apps/
  web/                # Next 15 App Router, RSC + 'use client' islands
  mobile/             # Expo Router (typedRoutes), iOS + Android
packages/
  db/                 # Supabase migrations, Database type, seed scripts (TIGER + Congress.gov + scorecards + finance), Edge Functions
  supabase-client/    # ChiaroClient wrapper + auth helpers (signUp/signIn/getSession)
  profile/            # citizen profile domain (queries + types)
  location/           # districts + user_locations (queries, TanStack hooks, district groups, schema)
  officials/          # federal officials domain (queries, TanStack hooks, types, zod schemas, finance + metrics)
  bills/              # bills + votes domain (queries, TanStack hooks, types)
  state-bills/        # state bills + votes domain (queries, TanStack hooks, types, schemas)
  ui-tokens/          # shared design tokens (COLORS, MAP_COLORS, PARTY_COLOR/LABEL/SHORT, PARTY_SHORT, SCORECARD_LEAN_*)
```

Dependency direction is strict — see Gotchas #4.

## Slices delivered

- **Slice 1 — auth + profile** (2026-05-05): signup/signin, profile completion. Migrations 0001–0002.
- **Slice 2 — location calibration** (2026-05-07, PR #1 `5988f6e`): GeocodIO Edge Function, districts ingest, Leaflet/react-native-maps. Migrations 0003–0008.
- **Slice 3 — officials** (2026-05-15): federal house + senate via Congress.gov v3, TanStack Query hooks, home card + list + detail (web + mobile). Migrations 0009–0013.
- **Slice 3.5 — cleanup** (2026-05-15): DistrictPanel TanStack migration, inline color → `@chiaro/ui-tokens`, on-device DoD checklist, CI test hygiene.
- **Slice 4 — bills/votes/metrics + officials detail redesign** (2026-05-17, PR #2 `f8009c0`): bills + votes ingest from Congress.gov, scorecards (10 adapters), finance summaries + industries + PACs from OpenSecrets/OpenFEC, official_metrics + recompute pipeline, officials detail redesign with collapsible categories. Migrations 0014–0023. `@chiaro/bills` added.
- **Slice 4 follow-ups** (2026-05-18): BioHeader + cards polish (PR #3 `d6da6d5`), Finance placeholders — Individual Donors + Top Organizations (PR #4 `1f73a46`). Migrations 0024–0025.
- **Slice 5A — calibrate hardening** (2026-05-18): atomic `apply_calibration` RPC with 60s per-user rate limit (`e59bfd4`), TIGER ingest retry/resume/partial-success (`a133d70`), `@chiaro/location` constants lift (`ff60650`).
- **Slice 5 mobile DoD parity** (2026-05-18, PR #5 `2a2c2e5`): port officials-detail redesign + bio polish + finance placeholders to RN. On-device DoD smoke still pending devices.
- **Slice 5B — Sentry telemetry** (2026-05-19, PR #6 `4d9280e`): error-only Sentry across web (`@sentry/nextjs@10`) + mobile (`@sentry/react-native@8`) + edge (`npm:@sentry/deno@8`) with PII scrubbing (recursive `/^address/i` redaction, WeakSet cycle guard).
- **Test hygiene follow-ups** (2026-05-19): scorecards producer-side cleanup (PR #7 `65b2165`), 3 inert district leaks in stock-watcher/town-halls/recompute-metrics (PR #8 `cf6eb05`).
- **Sub-slice 5C — state officials identity** (2026-05-19): OpenStates ingest of US state legislators (state house + state senate + NE unicameral) via the `openstates/people` GitHub YAML repo. Calibrated users see state reps alongside federal on home + new `/state-officials/[id]` route with 5 federal-only categories rendered as `ComingSoonCard` placeholders. Migrations 0028 (chamber enum 5-value expand) + 0029 (openstates_person_id + district_code + title columns, party CHECK relaxed). 19 new pgTAP plans across 2 new files + ~60 new vitest cases.
- **Sub-slice 5D — state bills + votes** (2026-05-20): OpenStates v3-API baseline ingest of state legislators' bills + votes + 5 per-state public-API augment adapters (CA leginfo, NY senate API, FL Senate+House, TX capitol, MI legislature). New `@chiaro/state-bills` package (workspace 9 → 10). Migrations 0030–0034: `state_bills` + `state_bill_sponsors` + `state_bill_subjects` + `state_votes` + `state_vote_positions` tables + 3 new `official_metrics` columns (`committee_chair_count`, `fiscal_impact_total`, `party_unity_state`). `/state-officials/[id]` Service Record card becomes real (composes `useOfficialMetrics` + `useOfficialSponsoredStateBills` + `useOfficialStateVotes`). NY adapter skips gracefully without `NY_SENATE_API_KEY`. 55 new pgTAP plans across 3 new files + ~46 new vitest cases (db) + ~10 web + ~18 mobile.
- **Sub-slice 5E — state campaign finance** (2026-05-21): per-state adapters (CA Cal-Access, NY NYSBOE, FL DOE, TX Ethics, MI BOE) writing to `state_finance_summaries` + `state_finance_individual_donors`. Replaces `ComingSoonCard('Finance')` on `/state-officials/[id]` with real `StateFinanceCard` + `StateDonorsEvidence` panels (web + mobile). Migrations 0035 + 0036. State finance queries live in `@chiaro/officials` alongside federal finance (workspace stays at 10). 5 adapter test files + 1 orchestrator integration test + ~37 vitest cases (db) + ~12 web + ~12 mobile + 1 new pgTAP file (16 plans).
- **Sub-slice 5F — state performance metrics + KPIs** (2026-05-21): real `committee_chair_count` via new OpenStates committees ingest (state_committee_memberships table + fetcher + ingest scripts). 5 new KPI columns on `official_metrics`: bills_passed_count (status heuristic), hearings_held_count, subject_breadth, bill_passage_rate (E1), fiscal_impact_per_dollar_raised (E2, descriptive ROI ratio). UI: StateServiceRecordCard (web + mobile) extended with "Performance metrics" subsection — 5 new rows + conditional committee chair seats row (hidden when NULL). Migrations 0037–0039. `party_unity_state` stub UNCHANGED (deferred). 2 new pgTAP files (12 + 8 plans = 20). Workspace stays at 10.
- **Sub-slice 5G — state issue positions** (2026-05-21): per-org adapter pattern for state-leg scorecards (ACLU + LCV + NRA + Planned Parenthood + AFP). Migrations 0040 (`state_scorecard_orgs` + `state_scorecard_ratings`) + 0041 (RLS). New `StateIssuePositionsCard` web + mobile replaces `ComingSoonCard('Issue Positions')` on `/state-officials/[id]`. New `useOfficialStateVotesOnSubject` hook in `@chiaro/state-bills` joins votes by subject candidates. 5 adapters ship as stubs returning `[]`; production parsers per (org, state) are operator follow-up.
- **Sub-slice 5H — state community presence** (2026-05-22): hybrid adapter pattern (TownHallProject nationwide overlay + 5 per-state stubs × 2 components + OpenStates v3 committee-hearings reuse from 5F). Migrations 0042 (state_town_halls), 0043 (state_district_offices), 0044 (state_committee_hearings + attendance M:N), 0045 (RLS). New `StateCommunityPresenceCard` web + mobile replaces `ComingSoonCard('Community Presence')` on `/state-officials/[id]`. 3 new hooks in `@chiaro/officials`. 11 adapters ship as stubs; operator wires production parsers per (source, state). After this slice: only Ethics & Accountability ComingSoonCard remains.
- **Sub-slice 5I — state ethics & accountability** (2026-05-22): hybrid adapter pattern (22 stubs across 4 components). Migrations 0046 (state_stock_transactions), 0047 (state_financial_disclosures), 0048 (state_ethics_complaints), 0049 (state_official_events), 0050 (RLS). Replaces `ComingSoonCard('Ethics & Accountability')` with **2 cards** (`StateFinancialActivityCard` + `StateConductCard`) on web + mobile — **closes the state-officials detail-page redesign** (0 ComingSoonCards remain). 4 new single-step PostgREST hooks in `@chiaro/officials`. OpenStates `roles[].end_reason` cache reuse (slice 5C infrastructure) is the primary resignation/death source — zero new external dependency. Ballotpedia HTML scrape stub for recalls. After this slice: state-officials detail page complete; future work shifts to operator parser-wiring + federal-side parity.

Specs live in `docs/superpowers/specs/`. Plans in `docs/superpowers/plans/`. Audits in `docs/superpowers/audits/`. Mobile DoD checklist at `docs/superpowers/mobile-dod-checklist.md`.

## Environment variables

| Var | Needed by | Notes |
|---|---|---|
| `CONGRESS_GOV_API_KEY` | `pnpm seed:officials`, `pnpm seed:bills-votes` | Free signup at api.data.gov. Server-side only. |
| `GEOCODIO_KEY` | `calibrate-location` Edge Function + slice 2/5A live integration tests | Required for real address resolution. CI gets it from a repo secret. |
| `OPENSECRETS_API_KEY` | `pnpm seed:scorecards` + finance ingest | Free signup at opensecrets.org. Server-side only. |
| `OPENFEC_API_KEY` | `pnpm seed:finance` (individual donors + top orgs) | Free signup at api.open.fec.gov. Server-side only. |
| `SUPABASE_DB_URL` | Seed scripts | Defaults to local Supabase (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` | Integration tests (officials, location, bills, profile) | Pull locally via `supabase status --output env --workdir packages/db`. CI captures from `supabase status` output of the workflow-started instance. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web` build | Build collects page data even without a live backend; placeholder strings are fine. |
| `NEXT_PUBLIC_SITE_URL` | `apps/web` sign-out redirect | Optional; falls back to request origin. |
| `AUDIT_TARGET_BIOGUIDE` | `pnpm seed:audit-fixture-attach` | Optional; defaults to `P000197`. |
| `SENTRY_AUTH_TOKEN` | Web + mobile CI source-map upload | Stored as GitHub secret + EAS project secret. SDK no-ops without it. |
| `NEXT_PUBLIC_SENTRY_DSN_WEB` | Web Sentry init (browser + server + edge runtimes) | Public-by-design. SDK no-ops if absent. |
| `EXPO_PUBLIC_SENTRY_DSN_MOBILE` | Mobile Sentry init | Public-by-design. Active in dev-client / preview / production builds, NOT Expo Go. |
| `SENTRY_DSN_EDGE` | Edge Function Sentry init via `withSentry` wrapper | Set as Supabase secret. SDK no-ops if absent. |
| `NY_SENATE_API_KEY` | `pnpm seed:state-bills-enrich` (NY adapter) | Free signup at legislation.nysenate.gov/keyOptions. Server-side only. Optional — NY augment skipped gracefully without it. |
| `OPENSTATES_API_KEY` | `pnpm seed:openstates-v3-fetch` | Free signup at openstates.org/accounts/profile (500 req/day). Server-side only. Required by the v3 fetcher; the loader/orchestrator runs fine without it (uses pre-populated cache dir or fixtures). |

See `.env.example` files at repo root, `apps/web/`, and `apps/mobile/`.

## Testing

- **pgTAP**: `pnpm db:test` → 341 tests across 26 files. Requires `pnpm db:start` and `pnpm db:reset`. Some tests (TIGER ingest assertions) require `pnpm seed:tiger` to have run first.
- **Vitest**: `pnpm test` → turbo-managed, runs each package's test script. Officials/location/bills/profile integration tests need Supabase env vars exported first.
- **CI** (`.github/workflows/ci.yml`): 4 jobs — `db` (migrations + pgTAP + 9 fixture-ingest suites: officials, legislators, bills/votes, scorecards, finance, salary-residency, town-halls, stock-watcher, recompute-metrics), `build` (Next 15 + Sentry source-map upload when secret present), `functions` (Deno tests for Edge Function + shared Sentry helper), `test` (full workspace tests). Each job boots a fresh local Supabase via `supabase/setup-cli`.

## Gotchas

1. **Supabase JS `storageKey` collision** — if you `createClient(url, anonKey)` and `createClient(url, serviceKey)` in the same process without explicit `auth.storageKey` per client, both share the default key. Calling `anon.auth.signInWithPassword(...)` overwrites the `svc` client's session, and subsequent `svc.from(t).delete()` returns HTTP 403 silently. `svc.auth.admin.*` still works because it uses the API key directly. The `Multiple GoTrueClient instances detected` warning is the bug signal. Pass `{ auth: { persistSession: false, storageKey: 'unique-string' } }` to each `createClient`. See `packages/officials/test/queries.integration.test.ts:24–35` for the pattern.

2. **TIGER district code format** — house: `${STATE}-${2-digit zero-padded number}` (`CA-12`, `CA-01`). At-large house: `${STATE}-AL` (`WY-AL`, NOT `${STATE}-0`). Senate: two rows per state with codes `${STATE}-S1` and `${STATE}-S2` (same geometry; officials-ingest collapses both lookups to a single `federal_senate:${STATE}` key). See `packages/db/supabase/seed/tiger-config.ts:33–37` and `officials-ingest.ts` `districtKey()` / `loadDistrictMap()`.

3. **PostGIS column types are strict** — `districts.geometry` is `geography(MultiPolygon, 4326)`. A bare `POLYGON(...)` literal fails the type check. Always use `MULTIPOLYGON(((...)))` in test seeds. `user_locations.home_location` is `geography(Point, 4326)` — use `POINT(...)`.

4. **Workspace dependency direction is one-way** — `@chiaro/officials` depends on `@chiaro/db` (for `Database` type), so `@chiaro/db` may NOT import from `@chiaro/officials`. Turborepo refuses to build cyclic workspace deps. Congress.gov-specific normalize logic lives in `packages/db/supabase/seed/normalize.ts`, NOT in `@chiaro/officials`.

5. **Officials ingest defensive guards** — `officials-ingest.ts` enforces pre-flight count check (`MIN_HOUSE_COUNT=400`, `MIN_SENATE_COUNT=95`) + threshold guard on deactivations. If a re-ingest would deactivate >max(5, 1% of active), the script aborts and prints `Refusing to deactivate N officials … re-run with --allow-deactivations=N`. Pass `--allow-deactivations=N` (exact match required) to acknowledge an expected mass-deactivation event like a congressional turnover.

6. **TIGER seed is a prerequisite for full pgTAP green** — `pnpm db:reset` alone leaves `tiger_ingest.test.sql` tests failing (it `plan(7)`s row-count assertions that require TIGER data). CI's `db` job runs `seed:tiger` before `db:test`. Locally, expect up to 7 failures in that file unless you also ran `seed:tiger`.

7. **`pnpm test` not `pnpm -r test`** — `pnpm -r test` runs packages in parallel and races on the shared local Supabase, causing intermittent failures (e.g., the ingest happy-path's deactivation sweeps officials seeded by a parallel test). The canonical command is `pnpm test`, which goes through turbo and respects `^test` topological serialization (see `turbo.json`). If you must use pnpm-recursive directly: `pnpm -r --workspace-concurrency=1 test`.

8. **State-legislator data sources have known quirks** —
   - **OpenStates `openstates/people` GitHub YAML repo is the source of truth**, not the v3 API. Free, no rate limits, audit trail via git diffs.
   - **NE is unicameral**: chamber=`state_legislature`, party often `Nonpartisan`. The state_senate UI label still says "State Senator" by design.
   - **MD multi-member districts** (1A/1B/1C): all delegates share the same `district_id` (matched to `MD-01` via `state-leg-config.ts`). Multiple officials per district is legitimate.
   - **NH multi-word district codes** (e.g. "Rockingham 5") aren't normalizable to TIGER `STATE-N` format — `state-leg-config.ts` returns null, ingest logs to `stats.unmatchedDistricts` + skips. Documented as a known limitation.
   - **AK uses letter-only districts** (`A`, `B`...): code is `AK-<letter>`, not zero-padded.
   - **Party values** are no longer CHECK-constrained as of migration 0029 — state legislators include Nonpartisan (NE), DFL (MN), Working Families, Progressive (VT), and minor parties.
   - **DC + territories** (Guam, USVI, NMI, AS) are NOT covered by OpenStates and intentionally skipped.
   - **`district_tier` enum does NOT include `state_legislature`** — only `official_chamber` was expanded in migration 0028. NE district rows live under `state_senate` tier (matching TIGER's natural representation), and the officials table holds `chamber='state_legislature'`. Bridge logic lives in `state-officials-ingest.ts`.

9. **State bills + votes data sources have known quirks** —
   - **OpenStates v3 API at https://v3.openstates.org/bills is the baseline source for 50 states** (slice 5D Task 1 source pin). The `openstates/data` GitHub repo doesn't exist; the `open.pluralpolicy.com` bulk endpoint is paywalled. Free tier rate-limited to 500/day. Production fetch + 7-day on-disk cache lives in `seed/openstates-v3-fetch.ts` and writes both bill + vote envelopes (extracted from `?include=...,votes`) to `packages/db/supabase/seed/.cache/openstates/` (gitignored). Three CLI entry points: `pnpm seed:openstates-v3-fetch --state=XX --session=YYYY [--force]` (single-state), `pnpm seed:openstates-v3-fetch-all --year=YYYY [--skip-on-error]` (all known states for a year — currently CA/NY/FL/TX/MI for 2025), `pnpm seed:openstates-v3-cache-prune [--ttl-days=N]` (housekeep). Then `OPENSTATES_BILLS_DATA_DIR=…/.cache/openstates pnpm seed:state-bills-votes` ingests bills + votes from cache. Loader at `openstates-bills-loader.ts` accepts JSON (production cache) or YAML (test fixtures); same dir-walker filters by `ocd-bill/` vs `ocd-vote/` id prefix.
   - **5 states get per-state-API augment** (CA leginfo, NY senate, FL Senate+House, TX capitol, MI legislature). Adapter pattern under `packages/db/supabase/seed/state-bills/enrich-*.ts`. Each adapter isolated — one failure doesn't abort others.
   - **NY requires `NY_SENATE_API_KEY`** env var. Adapter skips gracefully (with `skipReason`) without it.
   - **`session` field is text — format varies per state**: CA `'20252026'` (biennial), NY `'2025'` (annual), MD `'2025rs'` (regular session suffix), TX `'89R'` (legislature-numbered), MI `'2025-2026'`. Don't normalize — preserve raw.
   - **`state_votes.bill_id` uses `ON DELETE RESTRICT`** (preserves vote history if a bill row is later deleted). Per slice-5C 0026 audit precedent. Sponsor/subject tables `CASCADE`.
   - **`augmented_from` column tracks which per-state adapter populated augment fields** (`'ca-leginfo'`, `'ny-senate-api'`, etc). Re-running an adapter overwrites prior augment values.
   - **`recompute-state-metrics.ts` placeholders**: `committee_chair_count = 0` and `party_unity_state = 100 when voted >= 3` are MVP stubs. Real implementations require committee + party-roll-call data not yet ingested. Refine in sub-slice 5F.
   - **NH multi-word district legislators (still unmatched from 5C)**: their bills get logged to `stats.unmatchedBills` in `state-bills-votes-ingest` and skipped. Follow-up.
   - **`--skip-bills` / `--skip-votes` flags** on `seed:state-bills-votes` for surgical re-runs. `--skip-bills` requires bills already present in DB (vote FK references them).

10. **State finance data sources have known quirks** —
    - **Each state has its own public filing site, all free + scrape-friendly to varying degrees.** Adapter slugs: `ca-cal-access`, `ny-nysboe`, `fl-doe`, `tx-ethics`, `mi-boe`. The slug lives in `state_finance_summaries.source` and identifies which adapter populated the row.
    - **No paid aggregator (FollowTheMoney, etc.) integrated.** Adding the other 45 states means writing per-state adapters. The pattern in `packages/db/supabase/seed/state-finance/` is extensible.
    - **Cycle is text, varies per state.** CA `'2023-2024'` (biennial), NY `'2024'` (annual), TX `'2024'`, MI `'2023-2024'`. Per slice 5D session-format precedent — don't normalize.
    - **`small_donor_pct` (<$200) + `in_state_pct` not universally available.** CA + MI derive both from donor-level data; NY + TX partial; FL often unavailable. Adapter sets to NULL when data isn't derivable; UI renders `—` for NULL (NOT `0` — distinguishes "no data" from "actually zero").
    - **Official matching is per-adapter heuristic.** State filings rarely carry `openstates_person_id`. Adapters use `resolveOfficialByName(client, { full_name, state, chamber })` — case-insensitive exact match. Mismatches surface to `stats.officialsUnmatched[]`; logged not fatal. Operator triages.
    - **FL DOE is HTML-scrape only and most likely to break.** The `defaultFetcher` for `fetch-fl.ts` is fragile; expect maintenance churn. Production-run with `--skip-on-error` so FL drift doesn't block other states.
    - **No `official_metrics` integration in 5E.** Total raised does NOT feed `recompute-state-metrics.ts`. Aggregated finance metrics are slice 5F scope.
    - **`--state=XX` flag for surgical re-runs.** After fixing a per-state parser issue: `pnpm seed:state-finance --cycle=2024 --state=FL`.
    - **`source_url`** on every summary row links to the state's canonical filing detail page. UI surfaces it as the source pill ("Cal-Access" etc.) — clickthrough to be added in a future UI polish task.
    - **All 5 adapters ship with stub `defaultFetcher` returning `[]`.** Real source parsers (CA XML, NY API, FL HTML, TX/MI CSV) are operator follow-up work. Tests inject fetchers returning normalized fixture envelopes (slice 5D enrich pattern).

11. **State performance KPIs have known limitations** —
    - **`party_unity_state` is still a stub** (`= 100 when voted >= 3, else NULL`). Real majority-of-same-party-peers computation deferred to a future slice. Tracked.
    - **`bills_passed_count` is a heuristic.** Substring match on `state_bills.status` against `'%signed%' | '%enacted%' | '%became law%' | '%passed%governor%' | '%chaptered%'` (CA convention). Per-state status conventions vary; false negatives possible. Acceptable v1 (conservative under-count, not over-count).
    - **`hearings_held_count` underreports when augment adapter doesn't populate hearing_date.** CA + NY + MI generally populate; FL + TX sparse. Reads as `0` (not NULL) in sparse-state cases.
    - **`fiscal_impact_per_dollar_raised` is descriptive, NOT normative.** UI labels neutrally ("Fiscal impact / $"). High ratio ≠ "good ROI" — could mean "delivered a lot for cheap" OR "introduced budget-busting bills without raising much." Don't editorialize in copy.
    - **`committee_chair_count` NULL semantics.** NULL when no rows in `state_committee_memberships` for the official's state (data not ingested). 0 means "ingested, this official is not a chair." UI hides the row when NULL.
    - **Subcommittees count identically to full committees** in `committee_chair_count`. v1 trade-off; documented.
    - **Role normalization is lossy.** OpenStates roles like "Ranking Member", "Ex Officio", "Vice Chairwoman" fold to `'member'` or `'vice_chair'` per `normalizeRole()`. Original strings discarded.
    - **Joint committees skipped** when OpenStates `chamber` is `'joint'` or non-standard. Logged to `stats.errors[]`; ingest continues with other committees.
    - **NULL-session uniqueness gap.** The unique constraint `(official_id, openstates_committee_id, session, role)` doesn't deduplicate when `session` is NULL (default Postgres treats NULLs as distinct). The ingest (`openstates-committees-ingest.ts`) works around this with a manual `select ... where session is not distinct from $4` lookup before insert. If the workaround drifts, NULL-session memberships could accumulate duplicate rows on re-runs.
    - **OpenStates committee data freshness: 7-day cache.** Operator re-runs `seed:openstates-committees-fetch` after committee turnover (start of session, mid-session chair changes).
    - **`fiscal_impact_per_dollar_raised` cycle alignment.** Numerator (`fiscal_impact_total`) is session-filtered; denominator (`total_raised`) is latest-cycle finance. Not the same time window — descriptive ratio, not a rigorous time-aligned metric. Document for future tightening.
    - **jest-expo + `jest.resetModules() + jest.doMock + require()` pattern crashes.** Triggers `Cannot read properties of null (reading 'useState')` because module reset invalidates React's identity for the post-reset re-import. Workaround used in `apps/mobile/test/components/state/StateServiceRecordCard.test.tsx`: a mutable `let mockMetrics = DEFAULT_METRICS` reset in `beforeEach`, with the `jest.mock` factory closing over the variable. Same per-test fixtures, idiomatic for jest-expo.

12. **State scorecards adapter pattern is per-org, not per-state** — distinct from slices 5D/5E/5F which use per-state adapters. The 5 orgs (`aclu`, `lcv`, `nra`, `planned-parenthood`, `afp`) each span N states via `covered_states[]`. v1 adapters return `[]` (operator wires per-state parsers); orchestrator iterates `covered_states` and UPSERTs per-state `state_scorecard_orgs` rows. NRA grades letters mapped to numeric via `letterToNumeric()` (A=100..F=20) at write side; UI reverse-maps via `numericToLetterGrade()` for display.

13. **state_town_halls dedup uses (source, external_id) UNIQUE WHERE external_id IS NOT NULL** — NULLs are distinct per Postgres default, so adapters that omit `external_id` get fresh rows on every re-ingest. TownHallProject sets `external_id` for stable dedup; per-state augment adapters SHOULD set deterministic `external_id` derived from the source page (e.g. URL hash) to avoid bloat. Reverse: orchestrator runs TownHallProject FIRST so per-state adapters can either supplement or selectively UPSERT against TownHallProject rows.

14. **state_official_events folds 7 distinct event categories into one table.** event_type enum: recall_attempt | recall_succeeded | recall_failed | resignation | censure | expulsion | campaign_finance_violation. Multiple adapters write to this table — OpenStates `end_reason` cache (slice 5C reuse) is primary for resignation/death (matches `/resign/i` and `/(death|died|deceased)/i`; NULL → assume term_end + skip emit); Ballotpedia HTML scrape is primary for recall/expulsion; per-state ethics-commission adapters (ca-fppc etc.) emit campaign_finance_violation rows. Dispatch order: OpenStates first → Ballotpedia second → per-state third. Same `(source, external_id) UNIQUE WHERE external_id IS NOT NULL` dedup semantics as slice 5H (Gotcha #13).

## Code style

- TypeScript strict mode everywhere (`tsc --noEmit`).
- ES2022 / ESNext modules; `moduleResolution: "Bundler"` + `allowImportingTsExtensions: true` — relative imports use the `.ts` extension (e.g. `./types.ts`, not `./types`).
- Domain packages follow a stable shape: `types.ts` (Database-derived row types + domain types), `queries.ts` (raw async fetchers taking a `ChiaroClient`), `keys.ts` (TanStack hierarchical query-key factory), `hooks.ts` (TanStack `useQuery` wrappers, 5 min staleTime / 30 min gcTime), `schemas.ts` (zod for external-payload validation).
- Inline hex colors are forbidden — pull from `@chiaro/ui-tokens` (`COLORS.brand.*`, `COLORS.neutral.*`, `MAP_COLORS.*`, `PARTY_*`).
- pnpm version pinned via `packageManager: pnpm@9.12.0`.

## Memory + spec-driven workflow

This project uses the superpowers brainstorming → writing-plans → subagent-driven-development workflow. New slices land as: spec at `docs/superpowers/specs/YYYY-MM-DD-<slice>-design.md`, plan at `docs/superpowers/plans/YYYY-MM-DD-<slice>.md`, then per-task implementer + spec-reviewer + code-quality-reviewer subagents. Audits at `docs/superpowers/audits/YYYY-MM-DD-audit.md` track follow-ups between slices.
