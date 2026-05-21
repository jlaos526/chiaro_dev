# State Performance Metrics + KPIs Design (sub-slice 5F)

> **Status:** Design approved 2026-05-21. Implementation plan generated separately by `superpowers:writing-plans`.

## Goal

Add real state-legislator performance metrics ("KPIs / ROI") to `/state-officials/[id]`, computable from the data already ingested through slices 5C–5E. Replace the slice-5D `committee_chair_count = 0` MVP stub with real values (via new OpenStates committees ingest). Add five new metrics that capture legislative effectiveness, output, and influence. Document state-by-state variance so the metrics surface honestly when data is sparse.

The remaining `ComingSoonCard`s on `/state-officials/[id]` (`Issue Positions`, `Community Presence`, `Ethics & Accountability`) stay deferred — each is its own data-ingest problem and gets its own future slice.

## Architecture

```
seed:openstates-committees-fetch --year=YYYY [--state=XX] [--force]
  │
  └─ openstates-committees-fetch.ts (paginates v3 /committees + 7-day on-disk cache)
       │
       └─ writes JSON envelopes to .cache/openstates-committees/<state>-<committee-id>.json

seed:openstates-committees-ingest
  │
  └─ openstates-committees-ingest.ts (parses cache → upserts memberships)
       │
       └─ state_committee_memberships (NEW table; rows by official × committee × session × role)

seed:state-metrics-recompute --session=YYYY  (EXISTING script, EXTENDED)
  │
  └─ recompute-state-metrics.ts EXTENDS to populate 5 new columns +
     replace committee_chair_count stub. Existing party_unity_state stub unchanged.
       │
       └─ official_metrics (5 new nullable columns added by migration 0039)

Web/mobile UI:
  StateServiceRecordCard EXTENDED with "Performance metrics" subsection
    (5 new ScalarRows below existing bills/votes/attendance/party-unity rows,
     plus conditional committee_chair_count row when data exists)
```

**Workspace placement.** Committee ingest scripts live in `packages/db/supabase/seed/` alongside slice 5D state-bills ingest. The new `state_committee_memberships` row type lands in `@chiaro/officials` (alongside slice-5E state finance types). **Workspace stays at 10 packages.**

**No new env vars.** `OPENSTATES_API_KEY` already exists (slice 5D Task 28).

## Schema

### Migration 0037 — `state_committee_memberships.sql`

```sql
create table public.state_committee_memberships (
  id                       uuid primary key default gen_random_uuid(),
  official_id              uuid not null references public.officials(id) on delete restrict,
  openstates_committee_id  text not null,
  committee_name           text not null,
  state                    char(2) not null,
  chamber                  public.official_chamber not null,
  session                  text,
  role                     text not null check (role in ('chair', 'vice_chair', 'member')),
  source_url               text not null,
  ingested_at              timestamptz not null default now(),
  unique (official_id, openstates_committee_id, session, role)
);

create index state_committee_memberships_official_idx
  on public.state_committee_memberships(official_id);
create index state_committee_memberships_committee_idx
  on public.state_committee_memberships(openstates_committee_id);
```

**FK conventions** match [[project_chiaro_audit_2026_05_19_closure]]: `officials.id` → `RESTRICT` (preserves history). `chamber` reuses the existing `official_chamber` enum (5 values per slice 5C). `session` is text + nullable: some states report committee assignments without session timing; treat NULL-session memberships as "currently held."

**Role taxonomy.** v1 supports `chair | vice_chair | member`. Other state-specific roles (ranking minority member, ex-officio, etc.) fold into `member` for v1. Only `chair` counts toward `committee_chair_count` — `vice_chair` is tracked but does NOT count (intent: capture the leadership position, not deputy positions).

**Subcommittee handling.** OpenStates exposes a `parent_id` on subcommittees. v1 treats each committee row as independent (no hierarchy reflected in the schema). Chair-of-subcommittee counts toward `committee_chair_count` identically to chair-of-full-committee. Trade-off: simpler v1; potential metric inflation. Documented in Known limitations.

### Migration 0038 — `state_committee_memberships_rls.sql`

RLS matches slice 5C/5D/5E pattern: read = `authenticated`, write = `service_role` only. New pgTAP file `state_committee_memberships_rls.test.sql` with `plan(12)`:

- Table existence
- RLS enabled
- `role` CHECK rejects unknown values
- FK to `officials.id` is RESTRICT
- Unique constraint `(official_id, openstates_committee_id, session, role)`
- Both indexes exist
- Anon SELECT denied / authenticated SELECT allowed / service_role INSERT allowed / service_role DELETE allowed (covered as pass-placeholders; pg-level role-switch is awkward in pgTAP — same posture as slice 5E gotchas)

### Migration 0039 — `state_metrics_5f_columns.sql`

```sql
alter table public.official_metrics
  add column bills_passed_count               int,
  add column hearings_held_count              int,
  add column subject_breadth                  int,
  add column bill_passage_rate                numeric(5,2),    -- pct, 0.00–100.00
  add column fiscal_impact_per_dollar_raised  numeric(10,4);   -- wide precision; tiny → large ratios
```

All five columns nullable. `bill_passage_rate` uses `numeric(5,2)` matching `attendance_pct`. `fiscal_impact_per_dollar_raised` uses `numeric(10,4)` to handle small fractions (cents-per-dollar) up to large multiples without overflow.

pgTAP file `state_metrics_5f_columns.test.sql` with `plan(8)`: each of the 5 columns exists with the expected precision, plus 3 existence assertions for the pre-slice-5F columns to anchor the test.

**Total pgTAP delta:** +20 plans across 2 new files. Workspace pgTAP: 321 → 341 across 26 files.

## Committee ingest pipeline

### `openstates-committees-fetch.ts`

Mirrors slice 5D `openstates-v3-fetch.ts` shape:

- Hits `https://v3.openstates.org/committees?jurisdiction=ocd-jurisdiction/country:us/state:XX/government&page=N` paginated
- 7-day mtime TTL on cache files at `.cache/openstates-committees/<state>-<committee-uuid>.json`
- `--force` bypasses TTL
- 429 retry with `Retry-After` header + exponential backoff (5 attempts, 1s..16s)
- Library export `fetchOpenStatesCommittees({ state, cacheDir, apiKey, force, fetcher, ttlMs })` for tests
- Per-state mode via `--state=XX`; default iterates known states from a small `KNOWN_STATES_2025` map (CA, NY, FL, TX, MI, NE — same 5+1 as slice 5E plus NE for unicameral coverage)

Test file: `openstates-committees-fetch.test.ts` ~8 cases (happy path, pagination, TTL skip, TTL expiry, --force bypass, 429 retry, missing API key, prune behavior).

### `openstates-committees-ingest.ts`

Reads JSON envelopes from cache, upserts to `state_committee_memberships`:

```ts
export interface IngestCommitteesOpts {
  cacheDir?: string
  state?: FinanceState | 'NE'   // FinanceState from shared = CA|NY|FL|TX|MI; add 'NE' for unicameral
  client?: Client
}

export interface IngestCommitteesStats {
  committeesProcessed: number
  membershipsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]   // names + person_ids missing from public.officials
  errors: string[]               // joint-chamber skip, parse errors, etc.
}
```

For each committee envelope:
1. Resolve each `memberships[i].person_id` against `public.officials.openstates_person_id`. Mismatches → `officialsUnmatched[]`.
2. Map OpenStates role string to enum: `'chair' → 'chair'`, `'vice_chair' | 'vice chair' | 'vice-chair' → 'vice_chair'`, everything else → `'member'`.
3. Upsert by `(official_id, openstates_committee_id, session, role)` unique key.
4. Skip + log if `chamber` is `'joint'` or unknown.

Test file: `openstates-committees-ingest.test.ts` ~6 cases (chair role mapping, vice-chair role mapping, unmatched officials surfaced, idempotent re-upsert, joint-chamber skip, unique constraint).

### Two new pnpm scripts

```json
"seed:openstates-committees-fetch":  "tsx supabase/seed/openstates-committees-fetch.ts",
"seed:openstates-committees-ingest": "tsx supabase/seed/openstates-committees-ingest.ts"
```

### Fixture files

`packages/db/supabase/seed/fixtures/openstates-committees/` with 3 JSON files:
- `ca-sample.json` — 2 committees, 5 members (1 chair, 1 vice-chair, 3 members)
- `ny-sample.json` — 1 committee, 3 members
- `ne-sample.json` — 1 committee with `chamber: 'state_legislature'` (unicameral coverage)

## KPI catalog

This catalog is the durable answer to the design ask "express state-level data that gauge performance, similar to KPIs/ROI for elected officials." It captures each metric's purpose, computation, and per-state caveats.

### `committee_chair_count` (refines slice-5D stub `= 0`)

| | |
|---|---|
| **Purpose** | Leadership position indicator. Chairs control committee agendas + bill referral. |
| **Source** | `state_committee_memberships` (new table, this slice) |
| **SQL** | `select count(*) from state_committee_memberships where official_id = $1 and role = 'chair'` |
| **NULL semantics** | NULL when no rows in `state_committee_memberships` for this official's state (data not ingested). Distinguishes "0 chairs" from "data not yet ingested." Concretely: in recompute, query `count(*) from state_committee_memberships where state = $official_state`; if zero, write NULL not 0. |
| **State variance** | NE works (`chamber = state_legislature`). OpenStates coverage varies — large states (CA, NY, TX) well-populated; smaller states partial. |
| **UI** | Row hidden when value is NULL (consistent with how slice 5D handles `party_unity_state` NULL). |

### `bills_passed_count`

| | |
|---|---|
| **Purpose** | "Did anything you sponsored actually become law?" Strongest signal of legislative effectiveness. |
| **Source** | `state_bill_sponsors` (role='sponsor') joined to `state_bills.status` |
| **SQL** | See KPI computation rules section below |
| **NULL semantics** | 0 is legitimate (sponsored bills but none passed). NULL only if SQL fails (shouldn't happen). |
| **State variance** | Substring match on `state_bills.status` field — accuracy depends on per-state augment adapter populating status with recognizable strings. Documented as a heuristic. |
| **Heuristic patterns** | `'%signed%' | '%enacted%' | '%became law%' | '%passed%governor%' | '%chaptered%'` (CA convention). False negatives possible; false positives unlikely. |

### `hearings_held_count`

| | |
|---|---|
| **Purpose** | "Did your sponsored bills get hearings?" Hearings are a prerequisite to passage — measures the bill's procedural progress. |
| **Source** | `state_bill_sponsors` (role='sponsor') joined to `state_bills.hearing_date NOT NULL` |
| **SQL** | `SELECT count(*) FROM state_bill_sponsors sps JOIN state_bills b ON b.id = sps.bill_id WHERE sps.official_id = $1 AND b.session = $2 AND sps.role = 'sponsor' AND b.hearing_date IS NOT NULL` |
| **NULL semantics** | 0 legitimate. NULL when official sponsored zero bills (separate "denominator" case from "no hearings"). |
| **State variance** | Depends on `state_bills.hearing_date` population by per-state augment adapter. CA + NY + MI well-populated; FL + TX sparse. Where adapter doesn't populate, this metric reads as 0 (underreport). Documented. |

### `subject_breadth`

| | |
|---|---|
| **Purpose** | "How many different policy areas do you legislate in?" Single-issue legislators vs generalists. Not a value judgment — both have merit. |
| **Source** | `state_bill_sponsors` joined to `state_bill_subjects` |
| **SQL** | `SELECT count(DISTINCT sbs.subject) FROM state_bill_sponsors sps JOIN state_bills b ON b.id = sps.bill_id JOIN state_bill_subjects sbs ON sbs.bill_id = b.id WHERE sps.official_id = $1 AND b.session = $2 AND sps.role = 'sponsor'` |
| **NULL semantics** | 0 legitimate. NULL when sponsored zero bills. |
| **State variance** | Depends on OpenStates `subject[]` field on bills. Generally well-populated for CA/NY/TX/MI; varies for smaller states. |

### `bill_passage_rate` (E1 — efficiency)

| | |
|---|---|
| **Purpose** | "Of the bills you sponsored, what % passed?" Effectiveness ratio. |
| **Computation** | TS-derived: `bills_passed_count / bills_sponsored_count * 100`, NULL when denominator is 0. |
| **NULL semantics** | NULL when sponsored zero bills (division by zero avoided). |
| **Range** | 0.00–100.00. Stored as `numeric(5,2)`. |
| **State variance** | Inherits from `bills_passed_count` heuristic — states whose `status` field doesn't match the substring patterns will underreport numerator → understate passage rate. |
| **UI display** | `fmtPct()` helper — `'85%'` or `'12.5%'` or `'—'`. |

### `fiscal_impact_per_dollar_raised` (E2 — efficiency, the "ROI" framing)

| | |
|---|---|
| **Purpose** | Descriptive ratio of legislative output (fiscal impact of sponsored bills) to political input (donor dollars raised). |
| **Computation** | TS-derived: `fiscal_impact_total / total_raised`, NULL when `total_raised` is null or 0. |
| **NULL semantics** | NULL when finance not ingested OR `total_raised = 0`. 0 legitimate (raised money, sponsored nothing impactful). |
| **Range** | 0.0001–999999.9999 (stored as `numeric(10,4)`). |
| **State variance** | Numerator depends on per-state augment populating `state_bills.fiscal_impact_amount` (CA + MI good, FL + TX sparse). Denominator depends on slice-5E state finance ingest having run for this state. |
| **Important caveat** | **Descriptive, not normative.** A high ratio could mean either "delivered a lot for cheap" OR "introduced budget-busting bills without much fundraising." UI labels it neutrally ("Fiscal impact / $") with no editorial framing. Documented in gotcha #11. |
| **UI display** | `fmtRatio()` — `'$0.04'` or `'$12,500'` or `'—'`. |

### Unchanged from slice 5D

These metrics already work; no changes in 5F:
- `bills_sponsored_count`, `bills_cosponsored_count` (state_bill_sponsors aggregation)
- `votes_voted_count`, `votes_missed_count`, `total_roll_calls` (state_vote_positions aggregation)
- `attendance_pct` (TS-derived from vote counts)
- `fiscal_impact_total` (sum of state_bills.fiscal_impact_amount for own sponsored bills)

### Deferred from slice 5F

- **`party_unity_state` MVP stub stays.** Currently `= 100 when voted >= 3`, else NULL. Real computation (majority-of-same-party-peers per vote) is non-trivial SQL + per-state-party-roster joins. Out of 5F scope by user selection. Tracked for a future slice.
- **A2 bipartisan vote rate** — same data dependency as real party-unity; deferred together.
- **L1 primary-sponsor ratio, L2 coalition diversity, L3 cross-party cosponsorship** — workable from existing data but deferred to keep 5F focused on the user's explicit ask (workload + efficiency/ROI metrics).
- **W3 alt-formulation using `state_bills.actions[]`** — would require new schema (actions table) + ingest. Heuristic on `status` ships first; refine later.

## UI — extending `StateServiceRecordCard`

### Web (`apps/web/components/state/StateServiceRecordCard.tsx`)

New "Performance metrics" subsection added below the existing service-record rows, above the embedded bills + votes evidence panels:

```tsx
<section style={...cardStyle}>
  {/* existing header + bio + service-record rows unchanged */}

  <h4 style={{
    marginTop: 16, fontSize: 13, fontWeight: 700,
    color: COLORS.brand.text,
  }}>
    Performance metrics
  </h4>
  <dl style={{ margin: 0, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <ScalarRow label="Bills passed"        value={fmtCount(m?.bills_passed_count)} />
    <ScalarRow label="Hearings held"       value={fmtCount(m?.hearings_held_count)} />
    <ScalarRow label="Subject breadth"     value={fmtCount(m?.subject_breadth)} />
    <ScalarRow label="Bill passage rate"   value={fmtPct(m?.bill_passage_rate)} />
    <ScalarRow label="Fiscal impact / $"   value={fmtRatio(m?.fiscal_impact_per_dollar_raised)} />
    {m?.committee_chair_count != null && (
      <ScalarRow label="Committee chair seats" value={String(m.committee_chair_count)} />
    )}
  </dl>

  {/* existing StateBillsEvidence + StateVotesEvidence panels unchanged */}
</section>
```

**Formatting helpers** (reuse existing `fmtCount` + `fmtPct` from the card; add `fmtRatio` for `fiscal_impact_per_dollar_raised`):

- `fmtCount(n)`: NULL → `'—'`; integer → `'12'`
- `fmtPct(n)`: NULL → `'—'`; whole → `'85%'`; fractional → `'85.5%'`
- `fmtRatio(n)`: NULL → `'—'`; `'$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })`

**`committee_chair_count` conditional rendering**: row hidden entirely when value is NULL (matches slice 5D treatment of `party_unity_state` NULL). NULL ≠ 0 in the data model; UI honors the distinction.

### Mobile (`apps/mobile/components/state/StateServiceRecordCard.tsx`)

Same edits with RN primitives (`View` / `Text` instead of `<dl>` / `<dt>` / `<dd>`). Formatting helpers shared with web via component-local utility functions (no shared module; modest duplication is acceptable per slice 5D `INITIAL_ROW_COUNT` precedent).

### Parent test updates

`StateOfficialDetailPage.test.tsx` (web + mobile) — extend the existing `useOfficialMetrics()` mock fixture to include the 5 new fields. No new mocks needed; the card already consumes `useOfficialMetrics` from `@chiaro/officials`.

### Component test additions (5 new cases each, web + mobile)

1. Performance subsection header renders ("Performance metrics")
2. All 5 KPI scalar rows render with formatted values when metrics are populated
3. NULL KPIs render em-dash `'—'`
4. `committee_chair_count != null` shows the row; `== null` hides the row
5. `fiscal_impact_per_dollar_raised` formatting handles small (`'$0.04'`) and large (`'$12,500'`) values

## Testing strategy

### pgTAP

- New file `state_committee_memberships_rls.test.sql` plan(12)
- New file `state_metrics_5f_columns.test.sql` plan(8)
- Total pgTAP plan: 321 (current) + 20 = 341 across 26 files

### Vitest (db)

- `openstates-committees-fetch.test.ts` ~8 cases (mocked fetch, cache TTL, pagination, 429 retry, missing API key, prune)
- `openstates-committees-ingest.test.ts` ~6 cases (chair role mapping, vice-chair role mapping, unmatched officials, idempotent upsert, joint-chamber skip, unique constraint)
- `recompute-state-metrics.test.ts` extended with ~7 new cases: one per new KPI (5) + `committee_chair_count` real-data path (1) + `committee_chair_count` NULL-when-no-data path (1)

### Web vitest

- `StateServiceRecordCard.test.tsx` +5 cases (Performance subsection header, 5-KPI rendering, em-dash for NULL, `committee_chair_count` conditional show/hide, ratio formatting)
- `StateOfficialDetailPage.test.tsx` fixture update — extend `useOfficialMetrics` mock with 5 new fields

### Mobile jest-expo

- Same +5 cases as web with RN primitives

### Integration test extension

`packages/officials/test/queries.integration.test.ts` (already extended in slice 5D + 5E) gets:
- beforeAll: 1 `state_committee_memberships` row (chair role) attached to the slice-5D test state-asm
- afterAll: FK-ordered cleanup (committee_memberships → state_finance → state_bills → officials → districts)
- 1 new test case: anon RLS can read state_committee_memberships joined to officials for the test asm

## Known limitations (documented in CLAUDE.md gotcha #11)

1. **`party_unity_state` stub stays at `= 100 when voted >= 3`.** Real computation deferred (user-selected scope). Tracked as a sub-slice 5G candidate.
2. **`bills_passed_count` heuristic.** Substring match on `state_bills.status` — per-state status conventions differ. Acceptable v1 because false negatives are conservative; false positives unlikely.
3. **`hearings_held_count` depends on per-state augment.** When `state_bills.hearing_date` not populated by adapter, metric reads as 0 (under-report not NULL). CA + NY + MI generally populate; FL + TX sparse.
4. **`fiscal_impact_per_dollar_raised` is descriptive, NOT normative.** UI labels neutrally. High ratio doesn't equal "good ROI." Document.
5. **Subcommittees inflate `committee_chair_count`.** Chair of a subcommittee counts identically to chair of full committee. Documented; v1 trade-off.
6. **Joint committees** logged + skipped during ingest when OpenStates `chamber` is non-standard.
7. **`committee_chair_count` NULL when no state coverage.** UI hides row; doesn't show 0 (distinguishes "0 chairs" from "data not ingested").
8. **OpenStates v3 committee data freshness.** 7-day cache; operator re-runs fetch + ingest after chair turnover.
9. **Roles enum limited to `chair | vice_chair | member`.** State-specific roles (ranking minority, ex-officio) fold into `member`.
10. **Workload depends on session.** All workload metrics filter by `session = $2` — operator selects the session being scored. Defaults to current year if unset (existing recompute behavior).

## Acceptance criteria

1. Migrations 0037 + 0038 + 0039 apply cleanly via `pnpm db:reset`.
2. `pnpm db:test` green: ~341 pgTAP plans across 26 files (includes 2 new files).
3. `pnpm --filter @chiaro/db test` green: ~21 new vitest cases (8 fetch + 6 ingest + 7 recompute extension).
4. `pnpm --filter @chiaro/officials test` green: new integration test case passes; existing tests unaffected.
5. `pnpm --filter @chiaro/web test` green: `StateServiceRecordCard` test +5 cases; `StateOfficialDetailPage` fixture extended.
6. `pnpm --filter @chiaro/mobile test` green: same +5 mobile component cases.
7. `pnpm --filter @chiaro/web build` succeeds: `/state-officials/[id]` route still in manifest.
8. `pnpm -r typecheck`: 10 packages clean.
9. After manual smoke `pnpm seed:openstates-committees-fetch --year=2025 --skip-on-error && pnpm seed:openstates-committees-ingest && pnpm seed:state-metrics-recompute --session=2024`: `state_committee_memberships` populated for at least CA + NY; `official_metrics.committee_chair_count` non-NULL for ≥1 chair per state.
10. `/state-officials/[id]` for a state legislator with ingested data renders the "Performance metrics" subsection with the 5 KPIs.
11. `/state-officials/[id]` for a legislator WITHOUT finance data renders `'—'` for `fiscal_impact_per_dollar_raised` (NULL semantics honored).
12. `/state-officials/[id]` for a state without committee ingest hides the "Committee chair seats" row entirely.
13. Federal `/officials/[id]` unchanged — slice 4 federal metrics flow untouched.
14. `state_committee_memberships.official_id` FK delete behavior verified RESTRICT in pgTAP.
15. Mobile detail page renders the Performance metrics subsection on the same routes.

## Operator pre-flight (post-merge)

```bash
pnpm install                                          # workspace deps unchanged at 10
pnpm db:reset                                         # apply migrations 0001-0039
pnpm db:test                                          # confirm pgTAP green
# Existing pre-reqs unchanged: seed:tiger, seed:officials, seed:state-officials,
# seed:state-bills-full, seed:state-finance.
pnpm seed:openstates-committees-fetch --year=2025 --skip-on-error
pnpm seed:openstates-committees-ingest
pnpm seed:state-metrics-recompute --session=2024
```

The `--skip-on-error` flag is recommended for the first production fetch — OpenStates committee coverage varies per state; the flag lets other states finish if one errors.

---

## Open implementation decisions (resolve in plan)

- **Joint committee handling specifics.** Currently spec'd as "log + skip if chamber is non-standard." Could alternatively split memberships by reported member chamber if OpenStates exposes per-member chamber. Tactical detail; resolve when actual v3 responses are inspected.
- **`subject_breadth` cap.** Some legislators sponsor 50+ bills covering 20+ subjects. No hard cap planned (`int` column). Document that high values are normal for prolific legislators.
- **`fiscal_impact_total` source-of-truth alignment.** Already populated by existing recompute logic; ensure 5F's `fiscal_impact_per_dollar_raised` numerator reads from the same column (not recomputed).
- **Per-state-cycle finance lookup.** Finance data has its own `cycle` field (`'2024'` for NY, `'2023-2024'` for CA, etc). `fiscal_impact_per_dollar_raised` joins finance by `official_id` and picks latest by `ingested_at` (slice 5E query pattern). Acceptable v1; could be tightened to "finance cycle matching the bills session" later.
