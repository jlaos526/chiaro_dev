# Finance Placeholders — Design Spec

**Date:** 2026-05-18
**Status:** Shipped 2026-05-18 via PR #4 (`1f73a46`)
**Scope:** Replace the two soft-beige placeholder sub-cascades in the Finance category ("Individual Donors" and "Top Organizations") with full UI + DB + live OpenSecrets ingest. Refactor `IndustryBreakdown` into a generalized `TopAmountBreakdown` and reuse across all three Finance bar-chart sub-cascades.
**Predecessor:** [BioHeader + Cards Polish](2026-05-18-bioheader-cards-polish-design.md) (merged 2026-05-18 as PR #3)

---

## Goal

The officials-detail redesign (PR #2, merged 2026-05-18) shipped the Finance category with two `placeholder={true}` sub-cascades carrying the copy "data coming slice 5+":

- **Individual Donors** — under the Contributors sub-section, sibling to PACs.
- **Top Organizations** — under the Top Donor sub-section, sibling to Top Industries.

This slice replaces both with real UI + real data. Behind the scenes that means:

- Two new OpenSecrets API endpoints (`candContrib`, `candOrgs`) wired into the existing finance-ingest pipeline.
- Two new DB tables (`finance_individual_donors`, `finance_top_organizations`) as cascading children of `finance_summaries`, mirroring the existing `finance_industry_top` / `finance_pac_contributions` shape.
- Two new sub-cascade bodies in `FinanceCategory` using the same bar-chart pattern the existing Top Industries sub-cascade uses.

Both bar charts come from a single generalized component (`TopAmountBreakdown`) refactored from today's `IndustryBreakdown`, so the three Finance bar-chart sub-cascades share one well-tested implementation.

---

## Out of scope

- **Migrating PACs to bars.** PACs sub-cascade today renders list rows. Within the Contributors sub-section that creates a mixed pattern (list rows for PACs, bars for Individual Donors). Accepted as an observed asymmetry; not refactored here.
- **Per-entity deep-links.** Individual Donors don't have stable OpenSecrets per-donor pages; Top Organizations do, but for symmetry both sub-cascades only link to the parent finance-summary URL in this slice.
- **Committee Work placeholder.** Different data source (Congress.gov committees endpoint). Separate slice queued after this one.
- **Indiv/PAC split column.** Top Organizations from OpenSecrets returns a per-org breakdown of "individual contributions vs PAC contributions"; layout choice (option B from the brainstorm) drops this info-density in favor of bars. Could revisit if needed.

---

## UI — locked decisions

The user picked option B from the 2026-05-18 brainstorm mockups: bar-chart pattern identical to the existing Top Industries sub-cascade (`apps/web/components/finance/IndustryBreakdown.tsx`). Both new sub-cascades:

- Show top 5 by dollar amount by default
- Provide a pill-chevron toggle to "Show 5 more" → top 10
- Row 1 emphasis (bolder + slightly larger name)
- Single Finance-green horizontal bar per row, width scaled to row's amount / max amount
- "$X.XM" or "$XXK" formatting via existing `formatMoney` helper
- "→ full breakdown on OpenSecrets" link to `summary.source_url` at the bottom

Within `FinanceCategory.tsx` placement:

```
FinanceSummaryStrip
FinanceSubSectionHeading "Contributors"       (sage)
  SubCascadeBar "PACs"                        (list rows, unchanged)
  SubCascadeBar "Individual Donors"           ← NEW (TopAmountBreakdown, bars)
FinanceSubSectionHeading "Top Donor..."       (mint)
  SubCascadeBar "Top Industries"              (TopAmountBreakdown, bars — call-site migrated)
  SubCascadeBar "Top Organizations"           ← NEW (TopAmountBreakdown, bars)
```

---

## Architecture

The slice spans three layers, each change additive:

```
ingest:    OpenSecrets adapter (existing)     → + 2 new endpoints (candContrib, candOrgs)
              ↓                                 → extends FinanceSnapshot interface
           finance-ingest.ts (existing)       → + 2 new upsert blocks (delete-then-insert)
              ↓
DB:        finance_summaries (existing)
              ├─ finance_industry_top         (existing, unchanged)
              ├─ finance_pac_contributions    (existing, unchanged)
              ├─ finance_individual_donors    NEW (migration 0024)
              └─ finance_top_organizations    NEW (migration 0024)
              ↓
query:     useOfficialFinance (existing)      → + joins for 2 new child tables
              ↓
UI:        FinanceCategory (existing)         → 2 placeholder SubCascadeBars become real
              ↓
              TopAmountBreakdown              REFACTORED from IndustryBreakdown
                Three call sites: Top Industries (existing) + Individual Donors (new) + Top Organizations (new)
```

OpenSecrets free-tier ingest budget: 200 calls/day. Existing ingest already uses 4 endpoints × ~550 officials = ~2200 calls = ~11 days for a full Congress sweep. Adding 2 endpoints lifts that to ~3300 calls = ~17 days. Daily-spread orchestration is unchanged; just runs longer per cycle refresh.

No client/server boundary changes. No new TanStack hooks. No new pages.

---

## Component changes

### Refactored: `apps/web/components/finance/IndustryBreakdown.tsx` → `TopAmountBreakdown.tsx`

Prop shape changes:

```diff
 interface IndustryBreakdownProps {
-  rows: ReadonlyArray<{ industry: string; amount: number }>
+  rows: ReadonlyArray<{ label: string; amount: number }>
+  noun: { singular: string; plural: string }
   sourceUrl?: string
 }
```

Internal copy parameterized:

- Toggle reads `Show 5 more ${noun.plural}` when collapsed, `Show less` when expanded.
- Counter unchanged: `5 of N shown` / `N of N shown`.
- External link unchanged: `→ full breakdown on OpenSecrets`.

Rest of the rendering logic (row 1 emphasis, bar widths, formatting, layout) is untouched.

Existing call site in `FinanceCategory.tsx` for Top Industries migrates to `rows: industries.map(i => ({ label: i.industry, amount: i.amount }))` + `noun={{ singular: 'industry', plural: 'industries' }}`. Functionally identical.

### Modified: `packages/db/supabase/seed/opensecrets-adapter.ts`

Extends `FinanceSnapshot` interface:

```diff
 export interface FinanceSnapshot {
   ...
   industries: Array<{ rank: number; industry: string; amount: number }>
   pacs:       Array<{ pac_name: string; pac_fec_id: string | null; amount: number }>
+  individual_donors: Array<{ rank: number; donor_name: string; amount: number; employer: string | null; occupation: string | null }>
+  top_organizations: Array<{ rank: number; org_name: string; amount: number }>
 }
```

Adds 2 new fetches inside the existing `Promise.all`:

```ts
const contribUrl   = `${API_BASE}?method=candContrib&cid=${cid}&cycle=${cycle}&apikey=${apiKey}&output=json`
const orgsUrl      = `${API_BASE}?method=candOrgs&cid=${cid}&cycle=${cycle}&apikey=${apiKey}&output=json`
```

Each new endpoint's parse wrapped in its own `try/catch` so a malformed response for one doesn't drop the snapshot — failed endpoint returns an empty array; remaining 5 endpoints' data still saves. Same fixture-mode path (`opts?.fixturePath`) covers both new endpoints.

**Ingest cap: top 10 per category.** OpenSecrets returns up to 25 contributors and 20 organizations per official; the adapter slices each array to `.slice(0, 10)` before returning. Matches the UI cap (top 10 toggle), keeps the child tables small, and makes the PK `(finance_summary_id, rank)` enforce `rank ∈ [1, 10]` implicitly.

### Modified: `packages/db/supabase/seed/finance-ingest.ts`

After the existing `delete + insert` blocks for `finance_industry_top` and `finance_pac_contributions`, add two new blocks for the new child tables. Same atomic-transaction pattern. Idempotent re-runs.

### Modified: `packages/officials/src/queries.ts`

`fetchOfficialFinance` extends its supabase select with two new joined arrays:

```diff
 .from('finance_summaries')
 .select(`
   *,
   industries:finance_industry_top(*),
   pacs:finance_pac_contributions(*),
+  individualDonors:finance_individual_donors(*),
+  topOrgs:finance_top_organizations(*)
 `)
```

Order by `rank` ascending applied to both new arrays via `.order('rank', { foreignTable: '...' })`. Return shape becomes `{ summary, industries, pacs, individualDonors, topOrgs }`.

### Modified: `packages/officials/src/types.ts`

Extends the `OfficialFinance` type with:

```ts
individualDonors: Array<{ rank: number; donor_name: string; amount: number; employer: string | null; occupation: string | null }>
topOrgs: Array<{ rank: number; org_name: string; amount: number }>
```

### Modified: `apps/web/components/performance/categories/FinanceCategory.tsx`

Two changes:

1. **Top Industries call site migrates** — `<IndustryBreakdown rows={industries} sourceUrl={summary.source_url} />` becomes `<TopAmountBreakdown rows={industries.map(i => ({ label: i.industry, amount: i.amount }))} noun={{ singular: 'industry', plural: 'industries' }} sourceUrl={summary.source_url} />`.

2. **Two placeholder SubCascadeBar blocks become real** — drop `placeholder={true}`, drop the `data coming slice 5+` teasers, replace teasers with computed strings (e.g. `"$28K average across 10 donors"` for Individual Donors, `"Acme Industries leads"` for Top Organizations). Each renders `<TopAmountBreakdown>` inside the SubCascadeBar body when expanded.

### New: `packages/db/supabase/migrations/0024_finance_individuals_and_orgs.sql`

```sql
create table public.finance_individual_donors (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank smallint not null,
  donor_name text not null,
  amount numeric not null,
  employer text,
  occupation text,
  primary key (finance_summary_id, rank)
);

create table public.finance_top_organizations (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank smallint not null,
  org_name text not null,
  amount numeric not null,
  primary key (finance_summary_id, rank)
);

create index finance_individual_donors_summary_idx on public.finance_individual_donors(finance_summary_id);
create index finance_top_organizations_summary_idx on public.finance_top_organizations(finance_summary_id);
```

### New: `packages/db/supabase/migrations/0025_finance_individuals_and_orgs_rls.sql`

Mirrors `finance_industry_top` / `finance_pac_contributions` RLS — `public` role can `select`, no other operations.

```sql
alter table public.finance_individual_donors enable row level security;
alter table public.finance_top_organizations enable row level security;

create policy "Public read finance_individual_donors"
  on public.finance_individual_donors for select to public using (true);

create policy "Public read finance_top_organizations"
  on public.finance_top_organizations for select to public using (true);
```

---

## Data flow

### Ingest pipeline (daily — `pnpm seed:finance`)

```
for each official in officials where opensecrets_id is not null:
  snapshot = fetchFinanceSnapshot(cid, '2024', OPENSECRETS_KEY)
    → 6 parallel HTTP calls (candSummary, candIndustry, candPacs, candIndByState, candContrib, candOrgs)
    → returns { ..., individual_donors: [...], top_organizations: [...] }
  begin tx:
    upsert finance_summaries (existing)
    delete + insert finance_industry_top (existing)
    delete + insert finance_pac_contributions (existing)
    delete + insert finance_individual_donors        ← NEW
    delete + insert finance_top_organizations        ← NEW
  commit
```

OpenSecrets 200/day rate limit → ~33 officials/day at 6 calls each. Full Congress (~550 officials) backfill: ~17 days at current rate. Same daily-spread orchestration as today.

### Query (client — TanStack via `useOfficialFinance`)

```ts
useOfficialFinance(client, officialId, '2024')
  → supabase.from('finance_summaries')
      .select('*, industries(*), pacs(*), individualDonors(*), topOrgs(*)')
      .eq('official_id', officialId).eq('cycle', '2024')
      .single()
  → returns { summary, industries, pacs, individualDonors, topOrgs }
```

Eager-loaded together. Sub-cascade open/close state purely client-side; no new fetch when expanded.

### UI render path

```
FinanceCategory
  └─ render Contributors section
       ├─ PACs SubCascadeBar
       │    └─ open: existing PAC list (unchanged)
       └─ Individual Donors SubCascadeBar
            └─ open: <TopAmountBreakdown rows={mapDonors} noun={donors} sourceUrl={...} />
  └─ render Top Donor section
       ├─ Top Industries SubCascadeBar
       │    └─ open: <TopAmountBreakdown rows={mapIndustries} noun={industries} sourceUrl={...} />  ← migrated
       └─ Top Organizations SubCascadeBar
            └─ open: <TopAmountBreakdown rows={mapOrgs} noun={organizations} sourceUrl={...} />
```

---

## Error handling + edge cases

- **OpenSecrets 429 rate-limit.** Existing adapter pattern handles retry-with-backoff. Two new endpoints inherit.
- **Per-endpoint parse failure.** Each of the 6 endpoint fetches wrapped in its own `try/catch`. Failed endpoint returns empty array for its field; remaining endpoints' data still saves to its child tables.
- **Endpoint missing entirely.** OpenSecrets occasionally omits an endpoint (new members, special-election winners pre-cycle). Defensive `?.` chains return empty arrays; UI sub-cascade still expands but `TopAmountBreakdown` renders no rows + no toggle.
- **No `finance_summaries` row at all.** Existing FinanceCategory empty-state (`"No OpenSecrets data ingested for 2024 · → search OpenSecrets"`) still fires. No change for officials without ingest yet.
- **`individual_donors: []` or `top_organizations: []`.** Sub-cascade renders empty; `TopAmountBreakdown` shows no rows, no bars, no toggle (toggle only renders when `rows.length > 5`), but still renders the "→ full breakdown on OpenSecrets" link.
- **Migration safety.** Both tables added in additive migration. No destructive changes. No data backfill required — next ingest sweep populates.
- **Cascade-delete on summary removal.** When a `finance_summaries` row is deleted (cycle rollover or official removed), both new child tables clean up via `on delete cascade`. pgTAP test verifies.
- **Idempotent re-ingest.** Delete-then-insert pattern on children inside transaction → re-running ingest for same (official, cycle) replaces all rows atomically.
- **Migrated Top Industries test — fixture shape change.** Existing 8 tests of `IndustryBreakdown.test.tsx` migrate to the new `{ label, amount }` shape + `noun` prop. Original assertions on "Show 5 more industries" still pass when passing `noun={{ singular: 'industry', plural: 'industries' }}`.

---

## Testing

### Refactored/migrated unit tests

- `apps/web/test/components/finance/IndustryBreakdown.test.tsx` → renamed `TopAmountBreakdown.test.tsx`:
  - All 8 existing test cases migrate, fixture rows updated to `{ label, amount }` shape, all assertions pass `noun={{ singular: 'industry', plural: 'industries' }}`.
  - 1 new case: `noun={{ singular: 'donor', plural: 'donors' }}` → toggle reads "Show 5 more donors". Confirms parameterization.

### New backend tests

- `packages/db/supabase/seed/opensecrets-adapter.test.ts` (extend):
  - Fixture-mode test: snapshot includes `individual_donors[]` with rank-ordered rows (top 10 by amount).
  - Fixture-mode test: snapshot includes `top_organizations[]` with rank-ordered rows (top 10 by amount).
  - One endpoint failing returns empty array for that field but populates the rest.
- `packages/db/supabase/seed/finance-ingest.test.ts` (extend):
  - Verify `finance_individual_donors` + `finance_top_organizations` rows upserted with correct ranks.
  - Verify idempotency: re-run ingest → row count stays ≤10 per parent per child.
  - Verify cascade-delete: delete parent `finance_summaries` → both child tables empty for that summary.

### New pgTAP

- `packages/db/supabase/tests/migrations/0024_finance_individuals_and_orgs.test.sql`:
  - Both tables exist with expected columns and types.
  - PK is `(finance_summary_id, rank)` on each.
  - FK to `finance_summaries.id` is `on delete cascade`.
  - Indexes on `finance_summary_id` exist.
- `packages/db/supabase/tests/migrations/0025_finance_individuals_and_orgs_rls.test.sql`:
  - `public` role can `select` from both tables.
  - `public` role cannot `insert` / `update` / `delete`.

### Manual smoke

- Re-run `pnpm seed:finance` against Mike Carey (audit-fixture target — already has OpenSecrets CID).
- Visit `/officials/<carey-id>` → Finance category:
  - "Individual Donors" sub-cascade expands into bars (no longer soft-beige placeholder)
  - "Top Organizations" sub-cascade expands into bars
  - "Top Industries" still works (regression check)
- Visit `/officials/<moreno-id>` (senator, no fixture) → Finance empty-state still fires.

### Tooling

No new test infrastructure needed. Vitest + pgTAP + JSX automatic + shared `test/setup.ts` cleanup all in place.

---

## Acceptance criteria

After implementation:

1. ✅ `/officials/[id]` Finance category renders both Individual Donors + Top Organizations as real sub-cascades (no more soft-beige placeholders).
2. ✅ Both sub-cascades render `TopAmountBreakdown` bars with top 5 default + "Show 5 more" toggle to top 10.
3. ✅ Top Industries sub-cascade continues to render correctly (migrated to the same shared component).
4. ✅ `pnpm seed:finance` populates `finance_individual_donors` + `finance_top_organizations` rows when the official has OpenSecrets CID.
5. ✅ Each of the two new child tables (`finance_individual_donors`, `finance_top_organizations`) has at most 10 rows per (official, cycle). Existing `finance_industry_top` continues to store up to 25 rows (unchanged).
6. ✅ Cascade-delete of `finance_summaries` row removes child rows in both new tables.
7. ✅ Empty-state: officials without ingest still see the existing "No OpenSecrets data..." copy. Officials with ingest but no donors/orgs see expanded sub-cascade with no rows + source link.
8. ✅ Per-endpoint parse failure leaves other endpoints' data intact.
9. ✅ `pnpm -r typecheck` clean.
10. ✅ `pnpm --filter @chiaro/web build` succeeds.
11. ✅ All new + migrated unit tests green.
12. ✅ New pgTAP tests pass against fresh local Supabase + the new migration.
