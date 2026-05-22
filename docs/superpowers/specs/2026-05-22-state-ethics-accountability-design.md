# Sub-slice 5I — State Ethics & Accountability (design)

**Date:** 2026-05-22
**Branch:** `slice-5i-ethics-accountability`
**Scope:** Replace `ComingSoonCard('Ethics & Accountability')` on `/state-officials/[id]` with **two** real cards: `StateFinancialActivityCard` (stock trades + financial disclosures) + `StateConductCard` (ethics complaints + recall/resign/sanction events). **Closes out the state-officials detail-page redesign** — 0 ComingSoonCards remain after this slice.

## Why this slice

`/state-officials/[id]` shipped with 5 `ComingSoonCard` placeholders after slice 5C identity work. Slices 5D (Service Record) → 5E (Finance) → 5F (KPIs) → 5G (Issue Positions) → 5H (Community Presence) have replaced 5 cards across 4 placeholders. This slice replaces the last placeholder (Ethics & Accountability) with **two cards** per user decision — the two-card split groups financial activity separately from conduct/sanctions, which surfaces both more clearly than a 4-section combined card.

## Architecture summary

- **Hybrid adapter pattern (22 adapters):** 5 per-state stock + 5 per-state SOEI disclosures + 5 per-state ethics complaints + 1 OpenStates `end_reason` overlay + 1 Ballotpedia recall scrape + 5 per-state finance-violation event adapters. All v1 stubs.
- **4 new state-side tables** + 1 RLS migration (5 migrations total, 0046–0050).
- **2 new cards** on web + mobile replacing 1 ComingSoonCard.
- **Workspace stays at 10 packages** (new types/queries/hooks slot into `@chiaro/officials` per slice 5E precedent).
- **OpenStates `end_reason` reuse** — leverages slice 5C cached `roles[].end_reason` free-text field for resignation/death detection. Zero new external dependencies for the primary resignation source.

## Schema (migrations 0046–0050)

### Migration 0046 — `state_stock_transactions`

```sql
-- Sub-slice 5I: state-legislator stock transactions. Mirrors federal
-- stock_transactions (migration 0022) but uses RESTRICT FK (audit
-- precedent) + 30-day default filing deadline (most strict state
-- STOCK-Act-analogues are 30d vs federal 45d). source/external_id for
-- multi-adapter dedup per slice 5H pattern.

create table public.state_stock_transactions (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete restrict,
  transaction_date  date not null,
  filing_date       date not null,
  days_late         int generated always as (greatest(filing_date - transaction_date - 30, 0)) stored,
  asset_ticker      text,
  asset_name        text,
  transaction_type  text check (transaction_type in ('purchase','sale','exchange')),
  amount_range_low  numeric(15,2),
  amount_range_high numeric(15,2),
  state             char(2) not null,
  source_url        text not null,
  source            text not null,
  external_id       text,
  ingested_at       timestamptz not null default now(),
  unique (source, external_id)
);

create index state_stock_transactions_official_date_idx
  on public.state_stock_transactions(official_id, transaction_date desc);
create index state_stock_transactions_state_date_idx
  on public.state_stock_transactions(state, transaction_date desc);

comment on column public.state_stock_transactions.days_late is
  'Generated stored column using 30-day deadline. Most strict state STOCK-Act-analogues are 30d. Federal stock_transactions (0022) uses 45d.';
comment on column public.state_stock_transactions.source is
  'Adapter slug: ca-fppc | ny-jcope | fl-coe | tx-tec | mi-board.';
```

### Migration 0047 — `state_financial_disclosures`

```sql
-- Sub-slice 5I: annual Statement of Economic Interests (SOEI) filings.
-- All 50 states require some form of annual disclosure but each agency
-- publishes independently. SOEI captures non-stock income: salary,
-- consulting, royalties, rentals, dividends.

create table public.state_financial_disclosures (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete restrict,
  filing_year       int not null,
  filing_date       date,
  income_source     text,
  income_kind       text check (income_kind in ('salary','consulting','royalty','rental','dividend','other')),
  amount_range_low  numeric(15,2),
  amount_range_high numeric(15,2),
  state             char(2) not null,
  source_url        text not null,
  source            text not null,
  external_id       text,
  ingested_at       timestamptz not null default now(),
  unique (source, external_id)
);

create index state_financial_disclosures_official_year_idx
  on public.state_financial_disclosures(official_id, filing_year desc);
create index state_financial_disclosures_state_year_idx
  on public.state_financial_disclosures(state, filing_year desc);

comment on column public.state_financial_disclosures.income_kind is
  'salary | consulting | royalty | rental | dividend | other. Stock holdings tracked separately in state_stock_transactions.';
comment on column public.state_financial_disclosures.amount_range_low is
  'SOEI filings publish IRS-style range brackets ($1k-$10k, etc.). Schema captures range bounds only; no point amount.';
```

### Migration 0048 — `state_ethics_complaints`

```sql
-- Sub-slice 5I: per-state ethics commission complaints. Status enum
-- captures the typical lifecycle from open intake to final disposition.

create table public.state_ethics_complaints (
  id              uuid primary key default gen_random_uuid(),
  official_id     uuid not null references public.officials(id) on delete restrict,
  complaint_date  date not null,
  status          text not null check (status in ('open','dismissed','settled','sanctioned','closed_no_action')),
  disposition     text,
  summary         text not null,
  state           char(2) not null,
  source_url      text not null,
  source          text not null,
  external_id     text,
  ingested_at     timestamptz not null default now(),
  unique (source, external_id)
);

create index state_ethics_complaints_official_date_idx
  on public.state_ethics_complaints(official_id, complaint_date desc);
create index state_ethics_complaints_status_idx
  on public.state_ethics_complaints(status) where status = 'open';

comment on column public.state_ethics_complaints.summary is
  'Free-form per source. UI renders verbatim with whitespace: pre-wrap. No LLM normalization in v1.';
comment on column public.state_ethics_complaints.disposition is
  'Free-form ("Reprimand", "$5000 fine", null when status=open). Surfaces under expand in UI.';
```

### Migration 0049 — `state_official_events`

```sql
-- Sub-slice 5I: events relating to a legislator's tenure or conduct.
-- Folds recall/resign/censure/expulsion + campaign-finance violations
-- into a single discriminated table — they all answer "what changed
-- about this official's status?" Event_type enum is fixed at 7 values
-- in v1; future slices may extend.

create table public.state_official_events (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete restrict,
  event_date  date not null,
  event_type  text not null check (event_type in (
    'recall_attempt','recall_succeeded','recall_failed',
    'resignation','censure','expulsion',
    'campaign_finance_violation'
  )),
  outcome     text,
  summary     text not null,
  state       char(2) not null,
  source_url  text not null,
  source      text not null,
  external_id text,
  ingested_at timestamptz not null default now(),
  unique (source, external_id)
);

create index state_official_events_official_date_idx
  on public.state_official_events(official_id, event_date desc);
create index state_official_events_type_date_idx
  on public.state_official_events(event_type, event_date desc);

comment on column public.state_official_events.event_type is
  '7 fixed values. recall_attempt = filing only (no election held), recall_succeeded/failed = post-election. resignation comes from OpenStates roles[].end_reason. campaign_finance_violation captures FPPC/JCOPE/etc. fines.';
```

### Migration 0050 — RLS + pgTAP plan(20)

`alter table … enable row level security` on all 4 new tables. Read = `authenticated`, write = `service_role`. Matches slice 5D/5E/5F/5G/5H RLS convention.

**pgTAP** (`state_ethics_rls.test.sql`):

- 4 × `has_table`
- 4 × `is(relrowsecurity, true)`
- 1 × `transaction_type` CHECK rejects bad value
- 1 × `income_kind` CHECK rejects bad value
- 1 × `status` CHECK rejects bad value
- 1 × `event_type` CHECK rejects bad value
- 1 × `state_stock_transactions.days_late` generated column computes correctly
- 4 × `(source, external_id)` UNIQUE NULL-distinct semantics (one per table)
- 3 × FK `official_id` RESTRICT (sampled across 3 of 4 tables — col_type_is for the 4th)

Total = 20 plans. After this slice: 373 + 20 = 393 across 29 files.

## Adapter architecture

### File layout

```
packages/db/supabase/seed/state-ethics/
  shared.ts                          # types + 4 upsert helpers
  shared.test.ts                     # ~10 vitest cases
  stock/
    ca-fppc.ts + .test.ts            # CA Fair Political Practices Commission
    ny-jcope.ts + .test.ts           # NY Joint Commission on Public Ethics
    fl-coe.ts + .test.ts             # FL Commission on Ethics
    tx-tec.ts + .test.ts             # TX Ethics Commission
    mi-board.ts + .test.ts           # MI Board of Ethics
  disclosures/
    ca-fppc.ts + .test.ts
    ny-jcope.ts + .test.ts
    fl-coe.ts + .test.ts
    tx-tec.ts + .test.ts
    mi-board.ts + .test.ts
  complaints/
    ca-fppc.ts + .test.ts
    ny-jcope.ts + .test.ts
    fl-coe.ts + .test.ts
    tx-tec.ts + .test.ts
    mi-board.ts + .test.ts
  events/
    openstates-end-reason.ts + .test.ts   # PRIMARY resignation/death source — reuses slice 5C cache
    ballotpedia-recalls.ts + .test.ts     # PRIMARY recall/expulsion source — HTML scrape stub
    ca-fppc.ts + .test.ts                 # per-state campaign-finance violations
    ny-jcope.ts + .test.ts
    fl-coe.ts + .test.ts
    tx-tec.ts + .test.ts
    mi-board.ts + .test.ts
state-ethics-ingest.ts                # orchestrator
state-ethics-ingest.test.ts           # 6 vitest cases
fixtures/state-ethics/                # 22 fixture JSON files
```

**22 adapters total.** All v1 stubs returning `[]`; production parsers per (source, agency) are operator follow-up.

### Adapter interfaces (shared.ts)

```ts
export type EthicsComponent = 'stock' | 'disclosures' | 'complaints' | 'events'

export interface NormalizedStockTransaction { /* mirrors state_stock_transactions row sans id/days_late/ingested_at; official_openstates_person_id resolves to official_id */ }
export interface NormalizedFinancialDisclosure { /* mirrors state_financial_disclosures row */ }
export interface NormalizedEthicsComplaint { /* mirrors state_ethics_complaints row */ }
export interface NormalizedOfficialEvent { /* mirrors state_official_events row */ }

export interface StateEthicsAdapter {
  slug: string
  component: EthicsComponent
  covered_states: string[]
  fetchEvents(opts: {
    client: Client
    state?: string
    fetcher?: () => Promise<unknown[]>
  }): Promise<Array<
    NormalizedStockTransaction | NormalizedFinancialDisclosure |
    NormalizedEthicsComplaint | NormalizedOfficialEvent
  >>
}

export interface StateEthicsStats {
  component: EthicsComponent
  adapter_slug: string
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}
```

Plus 4 UPSERT helpers (`upsertStockTransaction`, `upsertFinancialDisclosure`, `upsertEthicsComplaint`, `upsertOfficialEvent`), each resolving `official_openstates_person_id` → `officials.id` and ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL.

### Events component dispatch order

1. **`openstates-end-reason`** runs FIRST — walks slice 5C `roles[].end_reason` cache, emits `event_type='resignation'` rows for legislators with `end_reason ~* 'resign'` or `'death'`. Free, already cached. Per slice 5H TownHallProject-first pattern.
2. **`ballotpedia-recalls`** runs second — HTML scrape stub for `ballotpedia.org/State_legislative_recalls`. Emits `event_type='recall_attempt|recall_succeeded|recall_failed'`. Ships with `--skip-on-error` so HTML breakage doesn't block per-state adapters.
3. **5 per-state finance-violation adapters** run third — emit `event_type='campaign_finance_violation'` from per-state ethics commission fine records.

### CLI

```bash
pnpm seed:state-ethics --component=stock|disclosures|complaints|events|all [--state=XX] [--skip-on-error]
```

Per-adapter isolation matches slice 5G/5H — thrown errors land in `byAdapter[N].errors[]`; `--skip-on-error` keeps siblings running.

### Per-source quirks documentation

**`openstates-end-reason` adapter:**
- Source: slice 5C `.cache/openstates/people/*.yml` (or equivalent JSON cache; verify location at Task 1)
- `roles[].end_reason` is free-text — case-insensitive matching: `/resign/i` → `resignation`, `/(death|died|deceased)/i` → emits event_type as `resignation` with summary noting death. NULL or empty → assumes "term_end" (skip emit).
- Coverage = full 50 states. Recency = whenever operator last ran `pnpm seed:state-officials`.
- External_id: `openstates-end-reason:${openstates_person_id}:${end_date}` for stable dedup.

**`ballotpedia-recalls` adapter:**
- Source: `ballotpedia.org/State_legislative_recalls` index + per-state pages
- HTML scrape only — official API is sales-gated (developer.ballotpedia.org, contact-sales pricing). Ballotpedia ToS allows research scraping with rate-limiting.
- Coverage = 50 states historically (1913–present, 205 lawmakers as of 2025).
- Mid-year + year-end content updates; expect HTML structure to drift. Production-run with `--skip-on-error`.
- External_id: derived from per-recall Ballotpedia URL slug.

## Domain layer (@chiaro/officials)

### Types

```ts
export type StateStockTransactionRow    = Database['public']['Tables']['state_stock_transactions']['Row']
export type StateFinancialDisclosureRow = Database['public']['Tables']['state_financial_disclosures']['Row']
export type StateEthicsComplaintRow     = Database['public']['Tables']['state_ethics_complaints']['Row']
export type StateOfficialEventRow       = Database['public']['Tables']['state_official_events']['Row']
```

### Query keys

```ts
officialsKeys.stateStockTransactions    = (id) => ['officials', 'stateStockTransactions',    id] as const
officialsKeys.stateFinancialDisclosures = (id) => ['officials', 'stateFinancialDisclosures', id] as const
officialsKeys.stateEthicsComplaints     = (id) => ['officials', 'stateEthicsComplaints',     id] as const
officialsKeys.stateOfficialEvents       = (id) => ['officials', 'stateOfficialEvents',       id] as const
```

### Fetchers + hooks

All 4 are single-step PostgREST (no joins, no 2-step workarounds — simpler than 5G/5H).

```ts
fetchOfficialStateStockTransactions(client, officialId)
  → server-side `.limit(50)` + .order('transaction_date', desc)
useOfficialStateStockTransactions(client, officialId): UseQueryResult<StateStockTransactionRow[], Error>

fetchOfficialStateFinancialDisclosures(client, officialId)
  → .order('filing_year', desc), then .order('ingested_at', desc)
useOfficialStateFinancialDisclosures(client, officialId): UseQueryResult<StateFinancialDisclosureRow[], Error>

fetchOfficialStateEthicsComplaints(client, officialId)
  → .order('complaint_date', desc)
useOfficialStateEthicsComplaints(client, officialId): UseQueryResult<StateEthicsComplaintRow[], Error>

fetchOfficialStateOfficialEvents(client, officialId)
  → .order('event_date', desc)
useOfficialStateOfficialEvents(client, officialId): UseQueryResult<StateOfficialEventRow[], Error>
```

All 4 hooks use explicit `UseQueryResult<T, Error>` return annotations (TS2742 fix). Standard 5min staleTime / 30min gcTime. Barrel re-exports added to `packages/officials/src/index.ts` up front (slice 5E lesson).

## UI: Two cards (replacing 1 ComingSoonCard)

### Card 1: `StateFinancialActivityCard` ("Financial Activity")

Composes `useOfficialStateStockTransactions` + `useOfficialStateFinancialDisclosures`.

**Header summary:** `N stock trades · K disclosures (YYYY)` — em-dash NULL convention per [[feedback-null-vs-zero-metrics]]; numeric `0` when array is empty.

**2 collapsible subsections (collapsed by default):**
- **Stock trades** → `StateStockTransactionsList`: transaction date · asset (ticker + name) · type chip (purchase/sale/exchange) · amount range bracket · "filed N days late" warning chip when `days_late > 0`
- **Financial disclosures** → `StateFinancialDisclosuresList`: grouped by `filing_year` (descending); each year header shows year + total disclosure count; rows show income_source + kind chip + amount range bracket

### Card 2: `StateConductCard` ("Conduct & Sanctions")

Composes `useOfficialStateEthicsComplaints` + `useOfficialStateOfficialEvents`.

**Header summary:** `N complaints (M open) · K events` — `M open` counted client-side from rows with `status='open'`.

**2 collapsible subsections (collapsed by default):**
- **Ethics complaints** → `StateEthicsComplaintsList`: complaint date · status chip (semantic color) · summary; disposition shown under expand
- **Sanctions / recall / resignation** → `StateOfficialEventsList`: event_type chip · event_date · outcome · summary

### Unified empty-state

When BOTH sub-hooks in a card return empty arrays, render a brief muted message in the card body instead of empty subsections:
- Card 1 empty: "No stock or financial-disclosure records on file for this legislator."
- Card 2 empty: "No ethics complaints or conduct events on record for this legislator."

### Color semantics (`@chiaro/ui-tokens`)

- `COLORS.signal.warning` for `days_late > 0` chip + complaint `status='open'`
- `COLORS.signal.error` for complaint `status='sanctioned'` + event `event_type IN ('expulsion', 'recall_succeeded')`
- `COLORS.signal.success` for complaint `status='dismissed' | 'closed_no_action'`
- `COLORS.neutral.textMuted` for dates/metadata
- `COLORS.brand.text` for primary text

Per slice 5G token-vocabulary discovery — NOT `COLORS.semantic.*` or `neutral.slate*`.

### Detail-page swap

In `apps/{web,mobile}/components/state/StateOfficialDetailPage.tsx`, find `<ComingSoonCard title="Ethics & Accountability" />` and replace with:

```tsx
<StateFinancialActivityCard officialId={official.id} />
<StateConductCard officialId={official.id} />
```

Detail-page tests update placeholder-count assertion to 0 (this slice closes the ComingSoonCard set). The `PLACEHOLDER_CATEGORIES` array (referenced in slice 5H mobile implementer's report) becomes `[]`.

### Mobile parity

Mobile components mirror web with RN primitives. Per [[feedback-jest-expo-dynamic-mock-pattern]]: each card test uses mutable `let mockX = DEFAULT` reset in `beforeEach` (4 mocks per card to cover the 2 hooks × success/loading paths).

## Testing matrix

**pgTAP** (20 new plans, 1 new file): see migration 0050.

**Vitest db tests** (~80 cases):
- `shared.test.ts`: ~10 cases (4 upsert helpers × happy + idempotent + unknown-official)
- 22 adapter test files × 4 cases = 84 cases (use bundled implementer dispatch like slice 5G Tasks 8-12 for the 5-adapter clusters)
- `state-ethics-ingest.test.ts`: 6 cases (orchestrator)

**Vitest officials**: +4 hook test cases (one per new hook).

**Vitest web**: ~16 cases — 2 cards × ~5 each + 4 sub-list components × ~2 each.

**Jest-expo**: ~10 mobile cases (2 cards + 4 sub-lists).

**Officials integration**: +5 cases (anon SELECT denied × 1 representative table + authd SELECT allowed × 4 tables + fetcher × 1 verification).

## Acceptance criteria (15)

1. Migrations 0046–0050 apply cleanly; 4 new tables present with RESTRICT FK to officials.id.
2. RLS enabled on all 4 tables (read=authenticated, write=service_role).
3. `state_stock_transactions.days_late` is a generated stored column using 30-day deadline.
4. All 4 tables have `(source, external_id)` UNIQUE with NULL-distinct semantics.
5. 22 adapters compile + tested + return `[]` from production stub.
6. `openstates-end-reason` adapter walks slice 5C cache (no new external dependency); free + already-on-disk.
7. `openstates-end-reason` runs FIRST in events dispatch order; ballotpedia-recalls second; per-state finance-violation adapters third.
8. Slug reuse across components (e.g., `ca-fppc` in stock + disclosures + complaints + events) disambiguated by `(slug, component)` in orchestrator.
9. `pnpm seed:state-ethics --component=stock|disclosures|complaints|events|all [--state=XX] [--skip-on-error]` works.
10. 4 new hooks resolve correctly; all single-step PostgREST.
11. Web + mobile `StateFinancialActivityCard` + `StateConductCard` both mount on `/state-officials/[id]` (one ComingSoonCard becomes two cards).
12. Header summary rows use em-dash NULL convention; "0 records" rendered numerically when array is empty.
13. Both cards render unified empty-state message when ALL sub-hooks are empty.
14. Signal-color chips: warning for late filings + open complaints; error for sanctioned + expulsion + recall_succeeded; success for dismissed + closed_no_action.
15. `pnpm -r typecheck` clean across 10 packages; Next 15 build clean; pgTAP 393 across 29 files. **`PLACEHOLDER_CATEGORIES` on `/state-officials/[id]` becomes empty — 0 ComingSoonCards remain** after this slice.

## Known v1 limitations (12)

1. All 22 adapters ship as stubs returning `[]`; production parsers per (source, agency) are operator follow-up.
2. State coverage = core 5 (CA/NY/FL/TX/MI) + OpenStates 50-state overlay + Ballotpedia 50-state overlay. Other 45 states' per-state adapters out of v1.
3. `days_late` uses uniform 30-day deadline; actual state laws range 24–45 days. Documented as approximation.
4. `(source, external_id)` UNIQUE allows NULL external_id (NULLs distinct). Adapters that omit external_id get fresh rows on every re-ingest — per slice 5H Gotcha #13.
5. **OpenStates `end_reason` is free-text** — case-insensitive matching on `/resign/i` and `/(death|died|deceased)/i`. NULL or other values → assume "term_end" (skip emit). Documented per-source quirk.
6. **Ballotpedia accuracy depends on community-maintained pages** — recall events may lag by weeks; HTML structure most-likely-to-drift; ship `--skip-on-error` per slice 5E FL DOE precedent.
7. Ballotpedia API is sales-gated (contact `developer.ballotpedia.org`). V1 uses HTML scrape only.
8. Ethics complaint `summary` is free-form per source; no LLM normalization. UI renders verbatim with `whitespace: pre-wrap`.
9. Campaign finance violations modeled as `state_official_events.event_type='campaign_finance_violation'`, NOT in `state_finance_summaries` (slice 5E). Separates "ingested money raised" from "enforcement actions."
10. SOEI filings publish IRS-style brackets ($1k–$10k, $10k–$100k, etc.); schema captures range bounds only — no point amount.
11. `state_official_events.event_type` enum is fixed at 7 values. Future states with exotic event categories (MA "Right to Know" complaints, etc.) fold into closest match or extend enum in a future migration.
12. RLS matches slice 5D-5H pattern (read=authenticated, write=service_role); no fine-grained policies. Federal `stock_transactions` (migration 0022) stays CASCADE; state-side mirrors with RESTRICT (not retroactively flipped).

## Out of scope

- LLM normalization of complaint summaries / disposition text.
- Notification/alerting for new ethics-complaint filings.
- Inflation-adjusted amount ranges (raw range bounds shipped as-is).
- Cross-jurisdiction sanction matching (e.g., legislator A in CA also sanctioned in NY).
- Federal `stock_transactions` retroactive FK flip from CASCADE to RESTRICT (slice 5xx audit follow-up).

## Estimated scope

**~22-24 tasks across 7 phases:**

- **Phase A** (5 tasks): migrations 0046–0050 + types regen
- **Phase B** (1 task): @chiaro/officials types + queries + hooks + barrel + 4 hook tests
- **Phase C** (2 tasks): shared.ts + 1 OpenStates `end_reason` cache-walking adapter (substantive — touches slice 5C cache)
- **Phase D** (~5 bundled tasks): 4 per-state adapter clusters (stock × 5, disclosures × 5, complaints × 5, finance-violation events × 5) + 1 Ballotpedia adapter + orchestrator. Bundled dispatch like slice 5G adapters.
- **Phase E** (4 tasks): Web — 4 sub-list components, 2 cards, detail-page swap
- **Phase F** (3 tasks): Mobile parity + swap
- **Phase G** (3 tasks): officials integration + CLAUDE.md + final verify + memory + branch handoff

Plan should anticipate ~3000-line plan doc with verbatim code blocks per task.

**This slice closes out the state-officials detail-page redesign** (0 ComingSoonCards remaining). Sub-slices 5J+ would address follow-ups: production parser wiring, federal-side `Community Presence` parity, audit cleanups (federal FK flips, structured `hours_text`, 12-month town-hall window tunability).
