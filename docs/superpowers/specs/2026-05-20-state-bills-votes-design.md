# State Bills + Votes — Design Spec (sub-slice 5D)

**Date:** 2026-05-20
**Status:** Design — pending plan
**Scope:** Ingest state legislators' bills + votes via OpenStates baseline (50 states) + 5 per-state public API augments (CA, NY, FL, TX, MI). Populate new `state_*` tables. Extend `official_metrics` with 3 state-specific columns. Replace slice 5C's Service Record `ComingSoonCard` on `/state-officials/[id]` with a real `StateServiceRecordCard`.
**Predecessors:** Slice 4 (federal bills + votes + metrics), Slice 5C (state legislators identity), Slice 5B (Sentry telemetry — auto-captures route + ingest errors).
**Followers:** Sub-slice 5D.5 (per-state augment for remaining ~5 public-API states), 5E (state campaign finance), 5F (state scorecards + state-level metrics).

---

## Goal

A state legislator's bill sponsorship + vote record is visible on `/state-officials/[id]` via a real Service Record card. The card shows tenure + bills sponsored/cosponsored count + votes voted/missed + attendance %, with inline `EvidenceExpand` drilling into actual state bills + state votes. OpenStates provides the 50-state baseline; CA / NY / FL / TX / MI augment with display-enrichment fields (status sub-stage, hearing dates, fiscal impact, party vote splits) and feed new metric columns (committee_chair_count, fiscal_impact_total, party_unity_state).

## Out of scope

| Deferred to | What |
|---|---|
| Sub-slice 5D.5 | Per-state augment adapters for the next ~5 states (PA, NJ, MA, WA, OH or similar — public APIs verified per state) |
| Sub-slice 5E | State campaign finance |
| Sub-slice 5F | State scorecards + Issue Positions / Community Presence / Ethics & Accountability category cards remain `ComingSoonCard` |
| Out entirely | NH multi-word district legislators (still unmatched from 5C); bills tied to unmatched legislators get logged as orphans + skipped. Federal slice-4 routes + UI untouched. |

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data source baseline | OpenStates bulk YAML / v3 API | Free, 50-state coverage, same provider contract as 5C state legislators |
| Per-state augment scope (5D) | CA leginfo, NY api.nysenate.gov, FL Senate+House, TX capitol, MI legislature | ~40% of US population; matches existing top-5 state populations |
| Augment surface | Display enrichment + new state-specific metric columns | User answer: status_substage, hearing dates, fiscal impact, party splits + 3 new metric scalars |
| Schema | Parallel `state_*` tables | Type-safe per-state augment columns; federal tables untouched; cleanest separation |
| Domain package | New `@chiaro/state-bills` (workspace grows to 10) | Clean federal/state separation at JS layer; mirrors `@chiaro/bills` shape exactly |
| UI display | Combined Service Record card (slice-5C placeholder swapped) | Matches slice-5C's existing 5-category layout; no detail-page restructuring |
| Slice scope | Single comprehensive slice (~3-5 weeks, ~30 tasks) | User-confirmed acceptable risk; federal slice 4 set the precedent |
| Bills+votes orchestrator | One orchestrator with `--skip-bills` / `--skip-votes` flags | Matches federal `bills-votes-ingest.ts` precedent; FK consistency (votes → bills); surgical re-run via flags |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Data sources                                                       │
│                                                                     │
│  Baseline (50 states):                                              │
│    OpenStates bulk data — bills, sponsors, subjects, votes,         │
│      vote_positions. Source pin TBD at implementation Task 1:       │
│      candidates are openstates/data GitHub repo (mirrors            │
│      openstates/people pattern from 5C if it exists) OR             │
│      open.pluralpolicy.com/data bulk CSV/JSON OR v3 API fallback.   │
│      Bulk preferred over API to bypass 500/day rate limit.          │
│                                                                     │
│  Per-state augment (5 states):                                      │
│    CA   leginfo.legislature.ca.gov                                  │
│    NY   api.nysenate.gov (requires NY_SENATE_API_KEY)               │
│    FL   flsenate.gov/Tracker/API + myfloridahouse.gov               │
│    TX   capitol.texas.gov (limited API + FTP bulk)                  │
│    MI   legislature.mi.gov                                          │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ CLI seed scripts (operator-run)
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│  packages/db/supabase/seed/                                         │
│   state-bills-votes-ingest.ts          (OpenStates baseline)        │
│      --skip-bills / --skip-votes flags                              │
│   state-bills-enrich.ts                (orchestrator → 5 adapters)  │
│   state-bills/enrich-{ca,ny,fl,tx,mi}.ts                            │
│   state-bills/shared.ts                (StateEnrichAdapter)         │
│   recompute-state-metrics.ts           (state-side scalars)         │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ upserts via service-role
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│  DB tables (new, 5):                                                │
│   public.state_bills          (+ augment fields nullable)           │
│   public.state_bill_sponsors  FK → state_bills, → officials         │
│   public.state_bill_subjects  FK → state_bills                      │
│   public.state_votes          FK → state_bills RESTRICT             │
│   public.state_vote_positions FK → state_votes, → officials         │
│                                                                     │
│  Extended table:                                                    │
│   public.official_metrics + 3 columns:                              │
│     committee_chair_count int                                       │
│     fiscal_impact_total numeric(15,2)                               │
│     party_unity_state numeric(5,2)                                  │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ TanStack hooks
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│  @chiaro/state-bills (NEW package — mirrors @chiaro/bills)          │
│   src/{types,queries,keys,hooks,schemas}.ts                         │
│   Federal @chiaro/bills untouched                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│  apps/web/components/state/StateServiceRecordCard.tsx (new)         │
│  apps/mobile/components/state/StateServiceRecordCard.tsx (new)      │
│   replaces slice 5C ComingSoonCard("Service Record")                │
│   shows: tenure + bills sponsored/cosponsored +                     │
│          votes voted/missed + attendance %                          │
│   inline EvidenceExpand:                                             │
│      StateBillsEvidence  (sponsored/cosponsored lists)              │
│      StateVotesEvidence  (vote list with party split when present)  │
└────────────────────────────────────────────────────────────────────┘
```

## Components

### New files

**Database (8):**
```
packages/db/supabase/migrations/
  0030_state_bills.sql                # state_bills + state_bill_sponsors + state_bill_subjects (3 tables)
  0031_state_bills_rls.sql            # RLS for the 3 above
  0032_state_votes.sql                # state_votes + state_vote_positions
  0033_state_votes_rls.sql            # RLS for the 2 above
  0034_official_metrics_state_columns.sql  # +committee_chair_count, +fiscal_impact_total, +party_unity_state

packages/db/supabase/tests/
  state_bills_rls.test.sql            # ~25 plans
  state_votes_rls.test.sql            # ~20 plans
  official_metrics_state_columns.test.sql  # ~8 plans
```

**Seed pipeline (~12 files):**
```
packages/db/supabase/seed/
  state-bills-votes-ingest.ts         # OpenStates baseline orchestrator (bills + votes)
  state-bills-votes-ingest.test.ts    # ~15 vitest cases
  state-bills-enrich.ts               # Orchestrator dispatching to 5 adapters
  state-bills-enrich.test.ts          # ~10 cases
  state-bills/
    shared.ts                         # StateEnrichAdapter interface
    enrich-ca.ts                      # CA leginfo augment
    enrich-ca.test.ts                 # ~5 cases
    enrich-ny.ts                      # NY api.nysenate.gov augment
    enrich-ny.test.ts                 # ~5 cases
    enrich-fl.ts                      # FL Senate + House APIs
    enrich-fl.test.ts                 # ~5 cases
    enrich-tx.ts                      # TX capitol
    enrich-tx.test.ts                 # ~5 cases
    enrich-mi.ts                      # MI legislature
    enrich-mi.test.ts                 # ~5 cases
  recompute-state-metrics.ts          # State-side scalar pipeline
  recompute-state-metrics.test.ts     # ~10 cases
  fixtures/openstates-bills/          # OpenStates fixture YAMLs
    ca-sample-bill-AB123.yml
    ca-sample-bill-SB45.yml
    ca-sample-vote-roll.yml
    ne-sample-bill-LB100.yml
    md-sample-bill-HB1.yml
  fixtures/state-bills-enrich/         # per-state-adapter JSON fixtures
    ca-leginfo-AB123.json
    ny-senate-S5678.json
    fl-senate-SB9.json
    tx-capitol-HB1.json
    mi-legislature-SB2.json
```

**New package `@chiaro/state-bills`:**
```
packages/state-bills/
  package.json
  tsconfig.json                       # extends ../../tsconfig.base.json
  vitest.config.ts                    # restoreMocks: true (per slice-5B audit)
  src/
    index.ts                          # re-exports
    types.ts                          # StateBillRow, StateVoteRow, joined types
    queries.ts                        # 7 fetchers
    keys.ts                           # TanStack key factory
    hooks.ts                          # 7 useQuery wrappers
    schemas.ts                        # zod for OpenStates + per-state API payloads
  test/
    queries.integration.test.ts       # ~8 cases
    hooks.test.tsx                    # ~3 cases
    keys.test.ts                      # ~4 cases
```

**Web UI (3 components + 3 tests):**
```
apps/web/components/state/
  StateServiceRecordCard.tsx          # REAL Service Record (replaces ComingSoonCard)
  StateBillsEvidence.tsx              # inline EvidenceExpand for bills list
  StateVotesEvidence.tsx              # inline EvidenceExpand for votes list
apps/web/test/components/state/
  StateServiceRecordCard.test.tsx     # ~8 cases
  StateBillsEvidence.test.tsx         # ~5 cases
  StateVotesEvidence.test.tsx         # ~5 cases
```

**Mobile mirrors (3 components + 3 tests):**
```
apps/mobile/components/state/
  StateServiceRecordCard.tsx
  StateBillsEvidence.tsx
  StateVotesEvidence.tsx
apps/mobile/test/components/state/
  StateServiceRecordCard.test.tsx
  StateBillsEvidence.test.tsx
  StateVotesEvidence.test.tsx
```

### Modified files

```
packages/db/src/types.ts              # regenerated after migrations
packages/db/package.json              # +4 seed scripts:
                                     #   seed:state-bills-votes
                                     #   seed:state-bills-enrich
                                     #   seed:state-metrics-recompute
                                     #   seed:state-bills-full (wrapper of the 3)

packages/officials/src/types.ts       # OfficialMetricsRow extended (auto via Database type)

apps/web/components/state/StateOfficialDetailPage.tsx
                                      # Replace ComingSoonCard("Service Record") with
                                      #   <StateServiceRecordCard official={...} />
                                      # Other 4 ComingSoonCards unchanged
apps/mobile/components/state/StateOfficialDetailPage.tsx
                                      # mirror swap

apps/web/.env.example                  # +NY_SENATE_API_KEY
.env.example                          # +NY_SENATE_API_KEY (operator-facing)

CLAUDE.md                             # +Slice 5D entry
                                     # Migration range: 0001-0034
                                     # pgTAP count: 250 → ~303
                                     # Workspace package count: 9 → 10
                                     # Quick-start: +seed:state-bills-full
                                     # Env-var table: +NY_SENATE_API_KEY
                                     # New Gotcha #9: state bills/votes data sources
                                     #   (OpenStates baseline + 5 per-state adapters;
                                     #    session id formats per state;
                                     #    FK restrict on state_votes→state_bills preserves
                                     #    vote history; state_vote_positions ON DELETE
                                     #    RESTRICT on officials per slice-5C 0026 precedent)
```

### Schema details

**`state_bills`:**
```sql
create table public.state_bills (
  id                       uuid primary key default gen_random_uuid(),
  openstates_bill_id       text unique not null,     -- ocd-bill/<uuid>
  state                    text not null,            -- 'CA'
  session                  text not null,            -- '20252026' (varies per state)
  bill_type                text not null,            -- 'AB', 'SB', 'HB' (varies per state)
  number                   int  not null,
  title                    text not null,
  status                   text,                      -- OpenStates normalized status
  introduced_date          date,
  latest_action            text,
  latest_action_date       date,
  source_url               text not null,
  openstates_url           text not null,
  -- Augment fields (nullable, populated by per-state enrichment):
  status_substage          text,                      -- e.g. 'Senate Appropriations Committee'
  hearing_date             date,
  fiscal_impact_amount     numeric(15,2),
  party_vote_split         jsonb,                     -- {"D-yes": 12, "D-no": 0, ...}
  augmented_from           text,                      -- 'ca-leginfo' | 'ny-senate-api' | ...
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (state, session, bill_type, number)
);
create index state_bills_state_session_idx on public.state_bills(state, session);
```

**`state_bill_sponsors`:**
```sql
create table public.state_bill_sponsors (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.state_bills(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete restrict,
  role        text not null check (role in ('sponsor', 'cosponsor')),
  added_date  date,
  unique (bill_id, official_id, role)
);
create index state_bill_sponsors_official_idx on public.state_bill_sponsors(official_id);
```

**`state_bill_subjects`:**
```sql
create table public.state_bill_subjects (
  bill_id  uuid not null references public.state_bills(id) on delete cascade,
  subject  text not null,
  primary key (bill_id, subject)
);
```

**`state_votes`:**
```sql
create table public.state_votes (
  id                  uuid primary key default gen_random_uuid(),
  openstates_vote_id  text unique not null,
  bill_id             uuid not null references public.state_bills(id) on delete restrict,
  state               text not null,
  session             text not null,
  chamber             public.official_chamber not null
    check (chamber in ('state_house','state_senate','state_legislature')),
  vote_date           date not null,
  question            text not null,
  result              text not null,                  -- 'passed' | 'failed' | etc
  source_url          text not null,
  party_vote_split    jsonb,                          -- augment field
  created_at          timestamptz not null default now()
);
create index state_votes_state_session_chamber_date_idx
  on public.state_votes(state, session, chamber, vote_date desc);
```

**`state_vote_positions`:**
```sql
create table public.state_vote_positions (
  id          uuid primary key default gen_random_uuid(),
  vote_id     uuid not null references public.state_votes(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete restrict,
  position    text not null
    check (position in ('yes','no','abstain','not_voting','present')),
  unique (vote_id, official_id)
);
create index state_vote_positions_official_idx on public.state_vote_positions(official_id);
```

**`official_metrics` extension (migration 0034):**
```sql
alter table public.official_metrics
  add column if not exists committee_chair_count int,
  add column if not exists fiscal_impact_total   numeric(15,2),
  add column if not exists party_unity_state     numeric(5,2);
```

Federal `official_metrics` rows have NULL for all 3 new columns; state recompute populates them.

### Per-state-adapter pattern

Mirrors slice-4 scorecards orchestrator:

```ts
// packages/db/supabase/seed/state-bills/shared.ts
export interface StateEnrichAdapter {
  state: 'CA' | 'NY' | 'FL' | 'TX' | 'MI'
  enrich(opts: { client: pg.Client; session: string }): Promise<EnrichStats>
}
export interface EnrichStats {
  state: string
  billsUpdated: number
  errors: string[]
  skipped?: boolean             // e.g., missing API key
}
```

Each adapter (`enrich-ca.ts` through `enrich-mi.ts`) implements the interface, isolated to its own state. Orchestrator dispatches sequentially (avoid per-state-API rate limit cross-contamination).

## Data flow

1. **Operator runs `pnpm seed:state-bills-votes`** — OpenStates baseline orchestrator:
   - Pulls bills + sponsors + subjects + votes + vote_positions from the openstates bulk YAML (cached locally per session)
   - Iterates 50 states; per-state isolation via try/catch
   - Upserts into `state_bills` keyed by `openstates_bill_id`
   - Upserts sponsors/subjects/votes/positions as children
   - Defensive guards: pre-flight count + deactivation threshold + `--allow-deletions=N`
   - Optional `--skip-bills` / `--skip-votes` flags for surgical re-run
2. **Operator runs `pnpm seed:state-bills-enrich`** — augment orchestrator:
   - Dispatches to 5 adapters (CA, NY, FL, TX, MI)
   - Each adapter fetches its state's API, maps to augment fields, UPDATEs `state_bills` rows
   - Sets `augmented_from` column to track which enricher ran
   - Per-adapter isolation (one failure doesn't abort others)
3. **Operator runs `pnpm seed:state-metrics-recompute`** — state-side scalars:
   - For each state official, joins `state_bill_sponsors` (sponsored count) + `state_vote_positions` (voted/missed counts) + `state_bills` (fiscal impact)
   - Computes `bills_sponsored_count`, `bills_cosponsored_count`, `votes_voted_count`, `votes_missed_count`, `total_roll_calls`, `attendance_pct`, `committee_chair_count`, `fiscal_impact_total`, `party_unity_state`
   - UPSERTs into `public.official_metrics` keyed by `official_id` (existing slice-4 table)
4. **Or one wrapper:** `pnpm seed:state-bills-full` runs all 3 in sequence with a single exit code.
5. **User opens `/state-officials/[id]`:**
   - `useOfficial(id)` (existing slice 5C hook) returns the official
   - `useOfficialSponsoredStateBills(officialId)` (new from `@chiaro/state-bills`) returns sponsored bills
   - `useOfficialCosponsoredStateBills(officialId)` returns cosponsored bills
   - `useOfficialStateVotes(officialId)` returns vote positions
   - `useOfficialMetrics(officialId)` (existing) returns the scalar row, now including state columns
   - `StateServiceRecordCard` renders all of it; `StateBillsEvidence` + `StateVotesEvidence` are inline EvidenceExpand panels

## Error handling

[See Section 4 above — full coverage. Key items:]

- **Ingest pipeline:** YAML fetch / parse failures retry 3× + log + continue; FK-mismatch votes (unknown bill_id) log to `unmatched_bills` and skip; defensive guards (pre-flight count, deactivation threshold) gate any DB writes; per-state isolation via try/catch.
- **Per-state adapters:** API failures retry 5× per adapter; missing API keys (NY) skip gracefully with warning; per-adapter isolation.
- **Recompute pipeline:** idempotent UPSERT; NULL for empty data (attendance_pct = NULL when 0 votes, party_unity_state = NULL when <3 votes).
- **Migrations 0030-0034:** pure additive; existing federal data untouched; CHECK + UNIQUE constraints enforce data integrity.
- **Frontend:** empty arrays render "0", null augment fields hide (don't render placeholder rows); existing TanStack loading/error patterns.
- **RLS:** all new tables read=authenticated, write=service_role only.
- **Sentry telemetry (slice 5B):** existing init catches uncaught errors automatically; no new wiring.
- **PII:** none (state bills are fully public); no scrubbing concerns.

## Testing

[See Section 5 above — full inventory. Summary:]

- **3 new pgTAP files, ~53 plans** (state_bills_rls + state_votes_rls + official_metrics_state_columns). Total pgTAP: **303 plans across 23 files**.
- **~60 new vitest cases** for seed pipeline (orchestrators + 5 per-state adapters + recompute)
- **~15 new vitest cases** for `@chiaro/state-bills` package (queries + hooks + keys)
- **~18 new vitest cases** for web UI (StateServiceRecordCard + 2 evidence components)
- **~18 new vitest cases** for mobile UI (mirrors)
- **No new live integration tests** — fixture-based against deterministic YAML/JSON

## Acceptance criteria

1. Migrations 0030-0034 apply cleanly via `pnpm db:reset`.
2. 5 new `state_*` tables created with RLS policies (read=authenticated, write=service_role only).
3. `official_metrics` extended with 3 nullable columns; existing federal rows have NULL.
4. `pnpm seed:state-bills-votes` ingests fixture data: 4 bills + 2 votes across CA + NE + MD.
5. `pnpm seed:state-bills-enrich` augments CA rows via enrich-ca adapter; NY skipped gracefully if `NY_SENATE_API_KEY` absent.
6. `pnpm seed:state-metrics-recompute` populates `committee_chair_count`, `fiscal_impact_total`, `party_unity_state` on state officials.
7. Calibrated CA test user (web): Service Record card on `/state-officials/[asm-id]` renders real bills sponsored count + votes voted/missed + attendance %.
8. NE test user: state senator's Service Record renders with chamber=state_legislature labeled "State Senator".
9. `/state-officials/[id]` Service Record category swaps `ComingSoonCard` for `StateServiceRecordCard`; the other 4 placeholders (Issue Positions, Community Presence, Finance, Ethics & Accountability) remain.
10. Mobile parity for items 7-9.
11. All existing federal tests pass unchanged (slice-4 federal flow untouched).
12. `pnpm -r typecheck` clean across all **10 packages** (new `@chiaro/state-bills`).
13. ~150 new vitest cases + 53 new pgTAP plans all green in CI.
14. CLAUDE.md updated: slice 5D entry, migration range 0001-0034, pgTAP count 250 → ~303, package count 9 → 10, new Gotcha #9.
15. Operator pre-flight documented: `pnpm seed:state-bills-full` (wrapper) post-merge.

## Open implementation decision (Task 1)

The implementer's first task is to pin the OpenStates bulk-data source:
- **Option A**: `openstates/data` GitHub repo (if it exists in the openstates/people YAML style — confirm via web fetch or repo browse)
- **Option B**: `open.pluralpolicy.com/data` bulk CSV/JSON
- **Option C**: v3 API endpoints (rate-limited; only as fallback for incremental syncs after a baseline is loaded)

Plan will lock the source after the implementer's verification. If Option A doesn't exist, Option B is the fallback per the 5C research findings.

## Known limitations (documented, not blocking)

- **5 states have per-state enrichment**; the other 45 only have OpenStates baseline. Sub-slice 5D.5 covers the next batch.
- **Party unity calculation requires ≥3 votes**; new sessions early in the term will have NULL for many officials.
- **TX capitol.texas.gov has limited API surface** — augment fields may be sparse for TX bills.
- **OpenStates session id format varies per state** (CA `'20252026'`, NY `'2025'`, etc.). The `session` field is preserved as text.
- **NH multi-word district legislators** still unmatched from 5C; their bills get logged to `unmatched_bills` in the ingest stats + skipped. Follow-up task to add NH district parsing.

## Operator pre-flight (NOT auto-managed by code)

After merging slice 5D:

1. Set `NY_SENATE_API_KEY` env var (or GitHub/EAS secret) if NY augment is desired. Other 4 states (CA, FL, TX, MI) typically don't require keys for public data.
2. Run the wrapper:
   ```bash
   pnpm seed:state-bills-full   # runs ingest + enrich + recompute
   ```
   Or run each phase separately:
   ```bash
   pnpm seed:state-bills-votes
   pnpm seed:state-bills-enrich
   pnpm seed:state-metrics-recompute
   ```
3. Re-run weekly (or set up a workflow) to refresh state bills/votes as the legislative session progresses.

## See also

- [Slice 4 — bills/votes/metrics + officials detail redesign](2026-05-15-slice-4-bills-votes-metrics-design.md)
- [Slice 5C — state officials identity](2026-05-19-state-officials-identity-design.md)
- [Slice 5B — Sentry telemetry](2026-05-18-telemetry-design.md) — captures ingest + frontend errors
- CLAUDE.md gotchas #2 (TIGER district codes), #5 (officials ingest defensive guards), #7 (`pnpm test` not `-r test`), #8 (state legislator data source quirks from 5C)
