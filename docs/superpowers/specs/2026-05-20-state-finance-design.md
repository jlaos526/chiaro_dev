# State Campaign Finance Design (sub-slice 5E)

> **Status:** Design approved 2026-05-20. Implementation plan generated separately by `superpowers:writing-plans`.

## Goal

Surface state campaign finance data on `/state-officials/[id]` — replace slice 5C's `ComingSoonCard('Finance')` with a real `StateFinanceCard` showing total raised, total disbursed, small-donor %, in-state % (when derivable) plus a top-10 individual donor list. Five states ship in v1: California, New York, Florida, Texas, Michigan — same set as slice 5D's bill augment adapters. Other 45 states deferred (per-state-adapter pattern remains extensible).

## Architecture

```
seed:state-finance --cycle=YYYY [--state=XX] [--skip-on-error]
  │
  └─ state-finance-ingest.ts (orchestrator)
       │
       ├─ state-finance/fetch-ca.ts  (Cal-Access XML)
       ├─ state-finance/fetch-ny.ts  (NYSBOE JSON API)
       ├─ state-finance/fetch-fl.ts  (FL DOE HTML scrape)
       ├─ state-finance/fetch-tx.ts  (TX Ethics CFOR CSV)
       └─ state-finance/fetch-mi.ts  (MI BOE CSV)
            │
            └─ upserts state_finance_summaries (1 per official+cycle)
                + cascade-replaces state_finance_individual_donors (top 10)
```

**Per-adapter isolation:** mirrors slice 5D's `state-bills-enrich.ts`. One adapter's failure (thrown or in-stats errors) doesn't abort others when `--skip-on-error` is set. Without the flag, the orchestrator throws on first failure.

**Workspace placement:** state-finance queries + hooks live in `@chiaro/officials`, alongside existing federal-finance queries. Slice 5D's `@chiaro/state-bills` precedent does NOT extend here — bills/votes are a domain unto themselves with their own query patterns (sponsored/cosponsored/votes), but finance is "more rows in the official's finance area." Single source of truth for everything-tied-to-an-official. Workspace stays at 10 packages.

**Data flow:**

```
state public site → adapter (fetch + normalize) → orchestrator → state_finance_* tables
                                                                     │
@chiaro/officials queries ←─────────────────────────────────────────┘
       │
       └─ TanStack hooks (5min staleTime, 30min gcTime)
              │
              └─ <StateFinanceCard> + <StateDonorsEvidence>
                   │
                   └─ /state-officials/[id] (replaces ComingSoonCard('Finance'))
```

## Schema

### Migration 0035 — `state_finance.sql`

```sql
create table public.state_finance_summaries (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete restrict,
  cycle             text not null,
  total_raised      numeric(15,2),
  total_disbursed   numeric(15,2),
  small_donor_pct   numeric(5,2),
  in_state_pct      numeric(5,2),
  source            text not null,
  source_url        text not null,
  ingested_at       timestamptz not null default now(),
  unique (official_id, cycle)
);

create table public.state_finance_individual_donors (
  state_finance_summary_id uuid not null
    references public.state_finance_summaries(id) on delete cascade,
  rank                     smallint not null check (rank between 1 and 10),
  donor_name               text not null,
  amount                   numeric(15,2) not null,
  employer                 text,
  occupation               text,
  city                     text,
  donor_state              text,
  primary key (state_finance_summary_id, rank)
);

create index state_finance_summaries_official_idx
  on public.state_finance_summaries(official_id, cycle);
create index state_finance_individual_donors_summary_idx
  on public.state_finance_individual_donors(state_finance_summary_id);
```

**FK conventions** (per project_chiaro_audit_2026_05_19_closure):
- `state_finance_summaries.official_id` → `RESTRICT` (preserves finance history if an official row is removed)
- `state_finance_individual_donors.state_finance_summary_id` → `CASCADE` (donors are strict subordinates)

**Field semantics:**
- `cycle` is raw text. Per-state formats: CA `'2023-2024'` (biennial), NY `'2024'` (annual reporting), TX `'2024'`, MI `'2023-2024'`. Do not normalize.
- `total_raised` / `total_disbursed`: nullable when the state doesn't surface aggregates (rare; default to non-null).
- `small_donor_pct` (donations < $200): nullable. Derivable from donor-level data where the state provides it. CA + MI typically yes; NY + TX partial; FL often unavailable.
- `in_state_pct`: nullable. % of dollars from in-state donors. Derivable when adapter has donor city/state. Same per-state availability profile as small_donor_pct.
- `source`: free text, conventionally one of `'ca-cal-access' | 'ny-nysboe' | 'fl-doe' | 'tx-ethics' | 'mi-boe'`. Records which adapter populated the row, enables targeted re-ingest.
- `source_url`: canonical URL on the state site for this filing (linked from the UI).

**Donor row:**
- `donor_state` is the donor's reported residency state (2-letter), NOT the parent legislator's state. Used to derive `in_state_pct`.
- `rank` is 1-based; capped at 10 per `(summary, rank)` unique by check constraint.

### Migration 0036 — `state_finance_rls.sql`

RLS policies (match slice 5D pattern):
- `state_finance_summaries`: SELECT for `authenticated`, INSERT/UPDATE/DELETE for `service_role` only
- `state_finance_individual_donors`: same

pgTAP file `state_finance_rls.test.sql` ~15 assertions:
- Tables exist with expected column types
- RLS enabled
- `anon` cannot SELECT; `authenticated` can; `service_role` can SELECT/INSERT/DELETE
- `official_id` FK behavior on delete (RESTRICT raises)
- Cascade behavior: deleting a summary deletes its donors
- `(official_id, cycle)` unique constraint enforced
- `rank` check constraint enforced (`rank between 1 and 10`)

## Per-state adapter pattern

### `state-finance/shared.ts`

```ts
export type FinanceState = 'CA' | 'NY' | 'FL' | 'TX' | 'MI'

export interface StateFinanceAdapter {
  state: FinanceState
  fetch(opts: { client: Client; cycle: string }): Promise<StateFinanceStats>
}

export interface StateFinanceStats {
  state: FinanceState
  summariesUpserted: number
  donorsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]   // legislators on the state filing but missing from officials table
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/** Upsert a single summary by (official_id, cycle); cascade-replace donors. */
export async function upsertStateFinance(
  client: Client,
  key: { official_id: string; cycle: string },
  summary: { total_raised: number|null; total_disbursed: number|null;
             small_donor_pct: number|null; in_state_pct: number|null;
             source: string; source_url: string },
  donors: Array<{ rank: number; donor_name: string; amount: number;
                  employer?: string|null; occupation?: string|null;
                  city?: string|null; donor_state?: string|null }>,
): Promise<void>
```

The `upsertStateFinance` helper is the canonical writer — each adapter calls it once per matched official. It:
1. UPSERTs the summary row by `(official_id, cycle)`, returning the summary id
2. DELETEs all existing donors for that summary id
3. INSERTs the supplied donors (capped at 10 by the adapter; helper trusts the input)

### Per-state adapters

Five adapter files, each implementing `StateFinanceAdapter`:

| File | Source | Format | Match strategy |
|---|---|---|---|
| `fetch-ca.ts` | https://cal-access.sos.ca.gov/ | XML bulk (~100MB+) | name + chamber + district |
| `fetch-ny.ts` | https://publicreporting.elections.ny.gov/ | JSON REST API | filer_id ↔ name+chamber |
| `fetch-fl.ts` | https://dos.elections.myflorida.com/ | HTML scrape | name + chamber + district |
| `fetch-tx.ts` | https://www.ethics.state.tx.us/ | CSV bulk downloads | filer_id ↔ name |
| `fetch-mi.ts` | https://miboecfr.nictusa.com/ | CSV bulk downloads | committee → candidate name → official |

**Matching strategy:** Each adapter implements its own join against the `officials` table. State filings rarely carry OpenStates IDs; name + state + chamber + district is the standard heuristic. Mismatches surface to `stats.officialsUnmatched[]` — logged, not a hard failure. Operator triages.

**Test fixtures** under `fixtures/state-finance/`:
- `ca-sample.xml` — 2 legislators, each with 3 donors
- `ny-sample.json` — 2 legislators, each with 2 donors
- `fl-sample.html` — 1 legislator, 4 donors
- `tx-sample.csv` — 2 legislators, sparse donor data
- `mi-sample.csv` — 2 legislators, full donor data

Each adapter test: ~5 cases against its fixture. Real local Supabase for upsert verification (slice 5D pattern).

### Orchestrator `state-finance-ingest.ts`

```ts
export interface IngestStateFinanceOpts {
  cycle: string
  state?: FinanceState          // when set: only run this adapter
  skipOnError?: boolean
  adapters?: StateFinanceAdapter[]  // test injection
  client?: Client
}

export interface IngestStateFinanceStats {
  cycle: string
  statesAttempted: number
  statesOk: number
  totalSummariesUpserted: number
  totalDonorsUpserted: number
  totalOfficialsUnmatched: number
  byState: StateFinanceStats[]
}
```

CLI: `pnpm seed:state-finance --cycle=YYYY [--state=XX] [--skip-on-error]`

Vitest cases (~6):
- Happy path: all 5 adapters run, aggregated stats returned
- `--state=CA`: only CA adapter dispatched
- Per-adapter error isolation with `--skip-on-error`
- Default abort on first error
- Idempotent re-run: same fixtures → same row counts
- Missing officials surface to `totalOfficialsUnmatched`

## UI components

### `apps/web/components/state/StateFinanceCard.tsx`

```tsx
'use client'
import { isStateLevel, useOfficialStateFinanceSummary, useOfficialStateDonors } from '@chiaro/officials'
// ... layout uses ScalarRow + <details open><StateDonorsEvidence/></details>
```

**Layout:**
- Header: "Finance" + cycle label + source pill (e.g. "Cal-Access")
- 4 ScalarRows: Total raised, Total disbursed, Small-donor %, In-state %
- Expandable `<details open>`: "Top donors (N)" → `<StateDonorsEvidence>`

**Chamber-gated** (returns null for federal officials). **Hooks called unconditionally**, return `null` AFTER per [[project-chiaro-slice5d-state-bills]] item 6.

**No-data path:** when summary is `undefined`, render single-line italic "No state finance data yet for this legislator". Matches slice 5D `StateBillsEvidence` empty-state copy.

**Null-field rendering:** any null scalar renders as "—" (em dash). NOT "0" — distinguishes "no data" from "actually zero."

### `apps/web/components/state/StateDonorsEvidence.tsx`

Top-10 list with show-5-more toggle (mirror slice 5D `StateBillsEvidence` exactly). Each row:
- `donor_name` (bold, left)
- `$amount` formatted with thousands separators (right-aligned)
- Secondary line: `employer · occupation · city, donor_state` — omits null fields gracefully (no double-separator on missing values)

`testID="state-donors-evidence"` for parent test querySelector access.

### Hooks in `@chiaro/officials`

```ts
// packages/officials/src/hooks.ts (extends existing)
export function useOfficialStateFinanceSummary(
  client: ChiaroClient, officialId: string,
): UseQueryResult<StateFinanceSummaryRow | null, Error>

export function useOfficialStateDonors(
  client: ChiaroClient, officialId: string,
): UseQueryResult<StateFinanceIndividualDonorRow[], Error>
```

Both 5min staleTime / 30min gcTime per project convention. Return latest cycle (most-recent `ingested_at`) when multiple exist.

Query-key factory entries in `packages/officials/src/keys.ts`:
```ts
officialsKeys.stateFinanceSummary(officialId)
officialsKeys.stateDonors(officialId)
```

Types in `packages/officials/src/types.ts`:
```ts
export type StateFinanceSummaryRow = Database['public']['Tables']['state_finance_summaries']['Row']
export type StateFinanceIndividualDonorRow = Database['public']['Tables']['state_finance_individual_donors']['Row']
```

Zod schemas in `packages/officials/src/schemas.ts` only if adapter external payloads need validation (adapters handle that themselves; library code uses Database-derived types).

### Mobile parity

`apps/mobile/components/state/StateFinanceCard.tsx` + `StateDonorsEvidence.tsx` mirror web with RN primitives (`View`, `Text`, `Pressable`, `Linking`). Same testIDs. Mobile uses the singleton `supabase` import from `@/lib/supabase`, not a hook (per [[project-chiaro-slice5d-state-bills]] item 11).

### Swap in `StateOfficialDetailPage.tsx` (web + mobile)

```tsx
const PLACEHOLDER_CATEGORIES = ['Issue Positions', 'Community Presence', 'Ethics & Accountability'] as const

<section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <StateServiceRecordCard official={official} />
  <StateFinanceCard official={official} />     {/* new */}
  {PLACEHOLDER_CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
</section>
```

Parent-component tests need the 3-mock-+-wrap pattern from slice 5D (mock `@/lib/supabase/client`, mock the new hooks, wrap in `QueryClientProvider`).

## Testing strategy

### pgTAP

- New file `state_finance_rls.test.sql` ~15 assertions
- Total pgTAP plan: 305 (current) + 15 = 320 across 24 files

### Vitest (db)

- Per-state adapter tests: 5 files × ~5 cases = ~25 cases
- Orchestrator integration: ~6 cases
- New @chiaro/officials hooks test: ~4 cases (mock fetchers, verify hook call shape)

### Web vitest

- `StateFinanceCard.test.tsx` ~7 cases (renders / null-data / chamber-gate / cycle label / source pill / hooks called unconditionally / embeds DonorsEvidence)
- `StateDonorsEvidence.test.tsx` ~5 cases (top-N display / show-more / amount formatting / null-field graceful / empty-list copy)
- `StateOfficialDetailPage.test.tsx` extended: mock new hooks, expect 3 placeholders (was 4 after slice 5D, now 3)

### Mobile jest-expo

- Same component test coverage as web: ~12 cases total

### Integration test extension

`packages/officials/test/queries.integration.test.ts` (already extended in slice 5D) gets:
- beforeAll: 1 `state_finance_summaries` row + 2 `state_finance_individual_donors` rows for the existing test state-asm
- afterAll: FK-ordered cleanup (donors → summaries → existing state_bill_* cleanup → officials → districts)
- 1 new case: anon RLS can read `state_finance_individual_donors` joined to summaries for the test asm

## Known limitations

1. **Per-state field availability varies.** `small_donor_pct` and `in_state_pct` derivable for CA + MI (donor-level data); partial for NY + TX; often unavailable for FL. Adapter computes if data permits; else NULL. UI renders "—" for nulls.
2. **Official matching is per-adapter and heuristic.** State filings rarely carry `openstates_person_id`. Each adapter implements its own name + state + chamber + (optional district) match. Mismatches surface to `stats.officialsUnmatched[]` — logged, not a hard failure.
3. **Cycle is operator-provided.** No auto-discovery of "current cycle per state." Operator runs `pnpm seed:state-finance --cycle=2024` (or per-state via `--state=CA --cycle=2023-2024`). Common values documented in CLAUDE.md gotcha #10.
4. **Donor names are not stable identifiers.** No cross-cycle donor dedup. Each cycle stands alone.
5. **No `official_metrics` integration.** Total raised does NOT feed `recompute-state-metrics.ts`. Aggregated finance metrics are slice 5F scope.
6. **Other 45 states deferred.** Adapter pattern is extensible; future per-state adapters land as needed.
7. **FL is fragile.** FL DOE is HTML-scrape only; expect parser maintenance churn. Realistic: FL adapter may need updates when DOE markup changes. Skips gracefully with `skipReason: 'FL DOE markup changed, parser needs update'` when broken.
8. **No federal-finance integration.** A legislator with both federal (`finance_summaries`) and state (`state_finance_summaries`) records — UI shows whichever applies to current chamber. No cross-linking.

## Acceptance criteria

1. Migrations 0035 + 0036 apply cleanly via `pnpm db:reset`.
2. `pnpm db:test` green: ~320 pgTAP plans across 24 files (includes new `state_finance_rls.test.sql`).
3. `pnpm --filter @chiaro/db test` green: includes 5 adapter tests + 1 orchestrator integration test + ~36 total new cases.
4. `pnpm --filter @chiaro/officials test` green: new hook + new integration test case both pass.
5. `pnpm --filter @chiaro/web test` green: new `StateFinanceCard` + `StateDonorsEvidence` tests pass; `StateOfficialDetailPage` test updated (3 placeholders, not 4).
6. `pnpm --filter @chiaro/mobile test` green: same component test coverage as web.
7. `pnpm --filter @chiaro/web build` succeeds: `/state-officials/[id]` route still in build manifest.
8. `pnpm -r typecheck`: 10 packages clean.
9. Manual smoke (post-merge) against live state sources: `pnpm seed:state-finance --cycle=2024 --skip-on-error` populates `state_finance_summaries` with ≥1 row per non-skipped state. (Automated tests use fixtures; this AC is operator-verified.)
10. `/state-officials/[id]` for a state legislator with finance data renders `StateFinanceCard` with the 4 scalars + top donors list.
11. `/state-officials/[id]` for a state legislator WITHOUT finance data renders the empty-state copy ("No state finance data yet for this legislator").
12. Federal `/officials/[id]` unchanged — slice 4 federal finance flow untouched.
13. `state_finance_summaries.official_id` FK delete behavior verified RESTRICT in pgTAP.
14. `--state=CA` filter runs only the CA adapter (per-adapter isolation verified).
15. Mobile detail page renders `StateFinanceCard` (or empty-state copy) on the same legislator routes.

## Operator pre-flight (post-merge)

```bash
pnpm install                                # workspace deps unchanged at 10
pnpm db:reset                               # apply migrations 0001-0036
pnpm db:test                                # confirm pgTAP green
pnpm seed:tiger                             # if not already cached
pnpm seed:officials                         # federal officials
pnpm seed:state-officials                   # state legislators (from slice 5C)
pnpm seed:state-bills-full                  # state bills + votes + recompute (slice 5D)
pnpm seed:state-finance --cycle=2024 --skip-on-error  # NEW: state campaign finance
```

The `--skip-on-error` flag is recommended for the first production run — FL is most likely to fail (HTML-scrape fragility); the other 4 states should succeed. Re-run individual states surgically via `--state=XX` after fixing any FL parser drift.

---

## Open implementation decisions (resolve in plan)

These don't need design-level decisions but should be flagged for the plan author:

- **CA Cal-Access bulk download strategy.** XML is ~100MB+. Stream-parse vs full-load. Recommend stream-parse via `node:stream` to avoid memory pressure.
- **NY NYSBOE API rate limit.** Document the actual limit if disclosed; assume conservative backoff like slice 5A's TIGER retry.
- **TX Ethics CFOR downloads.** Files updated semi-weekly; cache for 24h to avoid re-download.
- **MI BOE CSV files.** Updated monthly per the disclosure period; same 24h cache OK.
- **FL DOE scraping.** Defensive parser with explicit "if structure changes, log + skip" path. Adapter ships with current-date-snapshot fixture; CI ensures parser handles that shape.

These are tactical and land in plan tasks. The spec commits to the architecture; the plan commits to the tactics.
