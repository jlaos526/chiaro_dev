# State Ethics & Accountability Implementation Plan (sub-slice 5I)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ComingSoonCard('Ethics & Accountability')` on `/state-officials/[id]` with **two** real cards (`StateFinancialActivityCard` + `StateConductCard`), closing the state-officials detail-page redesign (0 ComingSoonCards remain).

**Architecture:** 4 new state-side tables + RLS (migrations 0046–0050). 22 adapter stubs in hybrid pattern: 5 per-state × 3 components + 2 nationwide overlays (OpenStates `end_reason` cache reuse + Ballotpedia recall scrape) + 5 per-state finance-violation event adapters. 4 new single-step PostgREST hooks in `@chiaro/officials` (no joins, simpler than 5G/5H). Web + mobile 2-card UI.

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP, vitest (db/web), jest-expo (mobile), TanStack Query v5.

**Spec:** `docs/superpowers/specs/2026-05-22-state-ethics-accountability-design.md`

---

## File structure

**Created (~50):**
```
packages/db/supabase/migrations/
  0046_state_stock_transactions.sql
  0047_state_financial_disclosures.sql
  0048_state_ethics_complaints.sql
  0049_state_official_events.sql
  0050_state_ethics_rls.sql
packages/db/supabase/tests/
  state_ethics_rls.test.sql
packages/db/supabase/seed/
  state-ethics-ingest.ts + .test.ts
  state-ethics/
    shared.ts + .test.ts
    stock/        {ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts + .test.ts
    disclosures/  {ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts + .test.ts
    complaints/   {ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts + .test.ts
    events/       openstates-end-reason.ts + .test.ts
                  ballotpedia-recalls.ts + .test.ts
                  {ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts + .test.ts
  fixtures/state-ethics/  *.json  (22 fixture files)
apps/web/components/state/
  StateFinancialActivityCard.tsx
  StateConductCard.tsx
  StateStockTransactionsList.tsx
  StateFinancialDisclosuresList.tsx
  StateEthicsComplaintsList.tsx
  StateOfficialEventsList.tsx
apps/web/test/components/state/  (matching .test.tsx files)
apps/mobile/components/state/  (mirror)
apps/mobile/test/components/state/  (mirror)
```

**Modified:**
```
packages/db/src/types.ts                                            # regen
packages/db/package.json                                            # +seed:state-ethics
packages/officials/src/{types,keys,queries,hooks,index}.ts          # +4 hooks
packages/officials/test/hooks.test.tsx                              # +4 cases
packages/officials/test/queries.integration.test.ts                 # +5 cases
apps/web/components/state/StateOfficialDetailPage.tsx               # 1 ComingSoon → 2 cards
apps/web/test/components/state/StateOfficialDetailPage.test.tsx     # mocks + count=0
apps/mobile/components/state/StateOfficialDetailPage.tsx            # mirror
apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx  # mirror
CLAUDE.md                                                           # slice entry + Gotcha #14
```

---

## Task 1: Migration 0046 — state_stock_transactions

**Files:**
- Create: `packages/db/supabase/migrations/0046_state_stock_transactions.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5I: state-legislator stock transactions. Mirrors federal
-- stock_transactions (0022) but uses RESTRICT FK (audit precedent) +
-- 30-day default filing deadline (most strict state STOCK-Act-analogues
-- are 30d vs federal 45d). source/external_id for multi-adapter dedup.

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
  'Generated stored column using 30-day deadline. Federal stock_transactions (0022) uses 45d.';
comment on column public.state_stock_transactions.source is
  'Adapter slug: ca-fppc | ny-jcope | fl-coe | tx-tec | mi-board.';
```

- [ ] **Step 2: Apply + verify**

```bash
pnpm db:reset
pnpm --filter @chiaro/db exec supabase db query "select column_name from information_schema.columns where table_name = 'state_stock_transactions' order by ordinal_position"
```

Expected: 15 columns; `days_late` is generated stored; `(source, external_id)` UNIQUE.

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/migrations/0046_state_stock_transactions.sql
git commit -m "feat(db): 0046 state_stock_transactions

Sub-slice 5I schema. Parallels federal stock_transactions (0022) but
RESTRICT FK + 30-day deadline (state laws stricter than federal 45d).
source/external_id for multi-adapter dedup per slice 5H pattern."
```

---

## Task 2: Migration 0047 — state_financial_disclosures

**Files:**
- Create: `packages/db/supabase/migrations/0047_state_financial_disclosures.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5I: annual Statement of Economic Interests (SOEI) filings.
-- Captures non-stock income; stock holdings tracked separately in
-- state_stock_transactions.

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
  'salary | consulting | royalty | rental | dividend | other.';
comment on column public.state_financial_disclosures.amount_range_low is
  'SOEI filings publish IRS-style range brackets; schema captures bounds only.';
```

- [ ] **Step 2: Apply + commit**

```bash
pnpm db:reset
git add packages/db/supabase/migrations/0047_state_financial_disclosures.sql
git commit -m "feat(db): 0047 state_financial_disclosures

Annual SOEI filings (non-stock income). 6-value income_kind enum.
IRS-style range brackets — bounds only, no point amount."
```

---

## Task 3: Migration 0048 — state_ethics_complaints

**Files:**
- Create: `packages/db/supabase/migrations/0048_state_ethics_complaints.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5I: per-state ethics commission complaints. 5-value status
-- enum captures intake → final disposition lifecycle.

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
  'Free-form per source. UI renders verbatim with whitespace: pre-wrap.';
```

- [ ] **Step 2: Apply + commit**

```bash
pnpm db:reset
git add packages/db/supabase/migrations/0048_state_ethics_complaints.sql
git commit -m "feat(db): 0048 state_ethics_complaints

Per-state ethics commission records. 5-value status enum. Partial
index on status='open' for query-perf on the common UI filter."
```

---

## Task 4: Migration 0049 — state_official_events

**Files:**
- Create: `packages/db/supabase/migrations/0049_state_official_events.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5I: events relating to a legislator's tenure or conduct.
-- 7-value event_type enum covers recall/resign/censure/expulsion +
-- campaign-finance violations. Fixed enum in v1; future slices may extend.

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
  '7 fixed values. resignation comes from OpenStates roles[].end_reason. campaign_finance_violation captures FPPC/JCOPE/etc fines.';
```

- [ ] **Step 2: Apply + commit**

```bash
pnpm db:reset
git add packages/db/supabase/migrations/0049_state_official_events.sql
git commit -m "feat(db): 0049 state_official_events

Discriminated events table folding recall/resign/censure/expulsion +
campaign-finance violations. 7-value enum. Multi-source (OpenStates
overlay primary for resignation; Ballotpedia for recall; per-state
adapters for finance violations)."
```

---

## Task 5: Migration 0050 — RLS + pgTAP plan(20)

**Files:**
- Create: `packages/db/supabase/migrations/0050_state_ethics_rls.sql`
- Create: `packages/db/supabase/tests/state_ethics_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

```sql
-- Sub-slice 5I: RLS for the 4 new state_ethics tables.
-- Read = authenticated. Write = service_role only.

alter table public.state_stock_transactions    enable row level security;
alter table public.state_financial_disclosures enable row level security;
alter table public.state_ethics_complaints     enable row level security;
alter table public.state_official_events       enable row level security;

-- state_stock_transactions
create policy state_stock_transactions_select_auth
  on public.state_stock_transactions for select to authenticated using (true);
create policy state_stock_transactions_insert_svc
  on public.state_stock_transactions for insert to service_role with check (true);
create policy state_stock_transactions_update_svc
  on public.state_stock_transactions for update to service_role using (true) with check (true);
create policy state_stock_transactions_delete_svc
  on public.state_stock_transactions for delete to service_role using (true);

-- state_financial_disclosures
create policy state_financial_disclosures_select_auth
  on public.state_financial_disclosures for select to authenticated using (true);
create policy state_financial_disclosures_insert_svc
  on public.state_financial_disclosures for insert to service_role with check (true);
create policy state_financial_disclosures_update_svc
  on public.state_financial_disclosures for update to service_role using (true) with check (true);
create policy state_financial_disclosures_delete_svc
  on public.state_financial_disclosures for delete to service_role using (true);

-- state_ethics_complaints
create policy state_ethics_complaints_select_auth
  on public.state_ethics_complaints for select to authenticated using (true);
create policy state_ethics_complaints_insert_svc
  on public.state_ethics_complaints for insert to service_role with check (true);
create policy state_ethics_complaints_update_svc
  on public.state_ethics_complaints for update to service_role using (true) with check (true);
create policy state_ethics_complaints_delete_svc
  on public.state_ethics_complaints for delete to service_role using (true);

-- state_official_events
create policy state_official_events_select_auth
  on public.state_official_events for select to authenticated using (true);
create policy state_official_events_insert_svc
  on public.state_official_events for insert to service_role with check (true);
create policy state_official_events_update_svc
  on public.state_official_events for update to service_role using (true) with check (true);
create policy state_official_events_delete_svc
  on public.state_official_events for delete to service_role using (true);
```

- [ ] **Step 2: Write pgTAP**

Create `packages/db/supabase/tests/state_ethics_rls.test.sql`:

```sql
begin;

select plan(20);

-- 1-4. has_table
select has_table('public', 'state_stock_transactions',     'state_stock_transactions exists');
select has_table('public', 'state_financial_disclosures',  'state_financial_disclosures exists');
select has_table('public', 'state_ethics_complaints',      'state_ethics_complaints exists');
select has_table('public', 'state_official_events',        'state_official_events exists');

-- 5-8. RLS enabled
select is((select relrowsecurity from pg_class where relname = 'state_stock_transactions' and relnamespace = 'public'::regnamespace), true, 'RLS on stock_transactions');
select is((select relrowsecurity from pg_class where relname = 'state_financial_disclosures' and relnamespace = 'public'::regnamespace), true, 'RLS on financial_disclosures');
select is((select relrowsecurity from pg_class where relname = 'state_ethics_complaints' and relnamespace = 'public'::regnamespace), true, 'RLS on ethics_complaints');
select is((select relrowsecurity from pg_class where relname = 'state_official_events' and relnamespace = 'public'::regnamespace), true, 'RLS on official_events');

-- Seed district + official for FK + CHECK assertions.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('state_house', 'CA', 'CA-SI', 'CA SI test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-si')
  on conflict (tier, code) do nothing;
insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state, district_id, in_office, source_version)
select 'ocd-person/fx-si', 'Test SI', 'Test', 'SI', 'state_house', 'D', 'CA',
  (select id from public.districts where code = 'CA-SI'),
  true, 'FX-si';

-- 9. transaction_type CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_stock_transactions
     (official_id, transaction_date, filing_date, transaction_type, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', '2026-01-15', 'pillage', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'transaction_type CHECK rejects bad value'
);

-- 10. income_kind CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_financial_disclosures
     (official_id, filing_year, income_kind, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             2025, 'bribery', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'income_kind CHECK rejects bad value'
);

-- 11. status CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_ethics_complaints
     (official_id, complaint_date, status, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'pending_appeal', 'test', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'status CHECK rejects bad value'
);

-- 12. event_type CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_official_events
     (official_id, event_date, event_type, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'abducted_by_aliens', 'test', 'CA', 'https://x', 'openstates') $$,
  '23514', null, 'event_type CHECK rejects bad value'
);

-- 13. days_late generated column computes correctly (31 - 30 = 1)
insert into public.state_stock_transactions
  (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          '2026-01-01', '2026-02-01', 'purchase', 'CA', 'https://x', 'ca-fppc', 'stk-1');
select is(
  (select days_late from public.state_stock_transactions where external_id = 'stk-1'),
  1,
  'days_late generated column: 31 days - 30 deadline = 1 day late'
);

-- 14-17. (source, external_id) UNIQUE NULL-distinct (allow NULL, reject duplicate non-NULL)
-- One sampled assertion per table; combine across:
insert into public.state_stock_transactions
  (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          '2026-01-02', '2026-01-15', 'purchase', 'CA', 'https://x', 'ca-fppc', null);
insert into public.state_stock_transactions
  (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          '2026-01-03', '2026-01-15', 'purchase', 'CA', 'https://x', 'ca-fppc', null);
select pass('state_stock_transactions (source, external_id) UNIQUE allows NULL external_id');

select throws_ok(
  $$ insert into public.state_stock_transactions
     (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-04', '2026-01-15', 'purchase', 'CA', 'https://y', 'ca-fppc', 'stk-1') $$,
  '23505', null,
  'state_stock_transactions (source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- Similar for financial_disclosures (sampled):
insert into public.state_financial_disclosures
  (official_id, filing_year, income_kind, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          2025, 'salary', 'CA', 'https://x', 'ca-fppc', 'disc-1');
select throws_ok(
  $$ insert into public.state_financial_disclosures
     (official_id, filing_year, income_kind, state, source_url, source, external_id)
     values ((select id from public.officials where source_version = 'FX-si'),
             2024, 'salary', 'CA', 'https://y', 'ca-fppc', 'disc-1') $$,
  '23505', null,
  'state_financial_disclosures (source, external_id) UNIQUE'
);

-- For complaints + events: assert columns exist with correct types as a lighter check.
select col_type_is('public', 'state_ethics_complaints', 'external_id', 'text',
  'state_ethics_complaints external_id is text (UNIQUE constraint per migration)');

-- 18. FK official_id RESTRICT on stock_transactions
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-si' $$,
  '23503', null,
  'state_stock_transactions official_id FK is RESTRICT'
);

-- 19. FK column type on financial_disclosures
select col_type_is('public', 'state_financial_disclosures', 'official_id', 'uuid',
  'state_financial_disclosures.official_id is uuid (FK is RESTRICT per migration)');

-- 20. Cleanup assertion
delete from public.state_stock_transactions
  where official_id = (select id from public.officials where source_version = 'FX-si');
delete from public.state_financial_disclosures
  where official_id = (select id from public.officials where source_version = 'FX-si');
delete from public.officials where source_version = 'FX-si';
delete from public.districts where source_version = 'FX-si';
select pass('cleanup applied');

select * from finish();
rollback;
```

- [ ] **Step 3: Run + commit**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -15
```

Expected: Files=29, Tests=393. If plan(N) drift ±1, bump literal.

```bash
git add packages/db/supabase/migrations/0050_state_ethics_rls.sql \
        packages/db/supabase/tests/state_ethics_rls.test.sql
git commit -m "feat(db): 0050 RLS for state_ethics_* + pgTAP plan(20)

read=authenticated, write=service_role on all 4 new tables. pgTAP
covers tables, RLS-enabled, 4 CHECK enforcements (transaction_type,
income_kind, status, event_type), days_late generated column,
(source, external_id) UNIQUE NULL semantics, FK RESTRICT directions."
```

---

## Task 6: Regenerate Database type

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Regenerate**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

- [ ] **Step 2: Verify + typecheck**

```bash
grep -c "state_stock_transactions\|state_financial_disclosures\|state_ethics_complaints\|state_official_events" packages/db/src/types.ts
pnpm -r typecheck
```

Expected: ≥4 occurrences; workspace typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for state_ethics_* tables"
```

---

## Task 7: @chiaro/officials — types + queries + hooks + barrel

**Files:**
- Modify: `packages/officials/src/{types,keys,queries,hooks,index}.ts`
- Modify: `packages/officials/test/hooks.test.tsx`

- [ ] **Step 1: types.ts**

Append after existing state_* type exports:

```ts
export type StateStockTransactionRow =
  Database['public']['Tables']['state_stock_transactions']['Row']

export type StateFinancialDisclosureRow =
  Database['public']['Tables']['state_financial_disclosures']['Row']

export type StateEthicsComplaintRow =
  Database['public']['Tables']['state_ethics_complaints']['Row']

export type StateOfficialEventRow =
  Database['public']['Tables']['state_official_events']['Row']
```

- [ ] **Step 2: keys.ts**

Add to `officialsKeys`:

```ts
stateStockTransactions: (officialId: string) =>
  ['officials', 'stateStockTransactions', officialId] as const,
stateFinancialDisclosures: (officialId: string) =>
  ['officials', 'stateFinancialDisclosures', officialId] as const,
stateEthicsComplaints: (officialId: string) =>
  ['officials', 'stateEthicsComplaints', officialId] as const,
stateOfficialEvents: (officialId: string) =>
  ['officials', 'stateOfficialEvents', officialId] as const,
```

- [ ] **Step 3: queries.ts**

Add to existing type imports:

```ts
StateStockTransactionRow,
StateFinancialDisclosureRow,
StateEthicsComplaintRow,
StateOfficialEventRow,
```

Append fetchers:

```ts
export async function fetchOfficialStateStockTransactions(
  client: ChiaroClient,
  officialId: string,
): Promise<StateStockTransactionRow[]> {
  const { data, error } = await client
    .from('state_stock_transactions')
    .select('*')
    .eq('official_id', officialId)
    .order('transaction_date', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as StateStockTransactionRow[]
}

export async function fetchOfficialStateFinancialDisclosures(
  client: ChiaroClient,
  officialId: string,
): Promise<StateFinancialDisclosureRow[]> {
  const { data, error } = await client
    .from('state_financial_disclosures')
    .select('*')
    .eq('official_id', officialId)
    .order('filing_year', { ascending: false })
    .order('ingested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateFinancialDisclosureRow[]
}

export async function fetchOfficialStateEthicsComplaints(
  client: ChiaroClient,
  officialId: string,
): Promise<StateEthicsComplaintRow[]> {
  const { data, error } = await client
    .from('state_ethics_complaints')
    .select('*')
    .eq('official_id', officialId)
    .order('complaint_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateEthicsComplaintRow[]
}

export async function fetchOfficialStateOfficialEvents(
  client: ChiaroClient,
  officialId: string,
): Promise<StateOfficialEventRow[]> {
  const { data, error } = await client
    .from('state_official_events')
    .select('*')
    .eq('official_id', officialId)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateOfficialEventRow[]
}
```

- [ ] **Step 4: hooks.ts**

Extend imports + append hooks (all explicit `UseQueryResult<T, Error>`):

```ts
import {
  // ...existing
  fetchOfficialStateStockTransactions,
  fetchOfficialStateFinancialDisclosures,
  fetchOfficialStateEthicsComplaints,
  fetchOfficialStateOfficialEvents,
} from './queries.ts'
import type {
  // ...existing
  StateStockTransactionRow,
  StateFinancialDisclosureRow,
  StateEthicsComplaintRow,
  StateOfficialEventRow,
} from './types.ts'

export function useOfficialStateStockTransactions(
  client: ChiaroClient, officialId: string,
): UseQueryResult<StateStockTransactionRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateStockTransactions(officialId),
    queryFn: () => fetchOfficialStateStockTransactions(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateFinancialDisclosures(
  client: ChiaroClient, officialId: string,
): UseQueryResult<StateFinancialDisclosureRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateFinancialDisclosures(officialId),
    queryFn: () => fetchOfficialStateFinancialDisclosures(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateEthicsComplaints(
  client: ChiaroClient, officialId: string,
): UseQueryResult<StateEthicsComplaintRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateEthicsComplaints(officialId),
    queryFn: () => fetchOfficialStateEthicsComplaints(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateOfficialEvents(
  client: ChiaroClient, officialId: string,
): UseQueryResult<StateOfficialEventRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateOfficialEvents(officialId),
    queryFn: () => fetchOfficialStateOfficialEvents(client, officialId),
    staleTime: FIVE_MIN, gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}
```

- [ ] **Step 5: index.ts barrel**

Add to existing `export type { ... } from './types.ts'`:

```ts
StateStockTransactionRow,
StateFinancialDisclosureRow,
StateEthicsComplaintRow,
StateOfficialEventRow,
```

Add to existing `export { ... } from './queries.ts'`:

```ts
fetchOfficialStateStockTransactions, fetchOfficialStateFinancialDisclosures,
fetchOfficialStateEthicsComplaints, fetchOfficialStateOfficialEvents,
```

Add to existing `export { ... } from './hooks.ts'`:

```ts
useOfficialStateStockTransactions, useOfficialStateFinancialDisclosures,
useOfficialStateEthicsComplaints, useOfficialStateOfficialEvents,
```

- [ ] **Step 6: Hook tests**

Open `packages/officials/test/hooks.test.tsx`. Add to import list. Append 4 describe blocks (one per hook). Template:

```tsx
describe('useOfficialStateStockTransactions', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateStockTransactions').mockResolvedValue([
      {
        id: 'stk1', official_id: 'oid', transaction_date: '2026-01-15',
        filing_date: '2026-02-15', days_late: 1, asset_ticker: 'AAPL',
        asset_name: 'Apple Inc.', transaction_type: 'purchase',
        amount_range_low: 1000, amount_range_high: 10000, state: 'CA',
        source_url: 'https://x', source: 'ca-fppc', external_id: 'stk-1',
        ingested_at: '2026-01-01',
      },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useOfficialStateStockTransactions({} as ChiaroClient, 'oid'),
      { wrapper: wrapper(qc) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.transaction_type).toBe('purchase')
  })
})
```

Repeat for the other 3 hooks with appropriate fixture row shapes (mirror Task 7 Step 3 row types).

- [ ] **Step 7: Run + commit**

```bash
pnpm --filter @chiaro/officials test hooks
pnpm --filter @chiaro/officials typecheck
```

```bash
git add packages/officials/src/{types,keys,queries,hooks,index}.ts packages/officials/test/hooks.test.tsx
git commit -m "feat(officials): state ethics types + queries + hooks + barrel

4 new single-step PostgREST hooks (no joins): useOfficialStateStock
Transactions (limit 50, desc by transaction_date), useOfficialStateFin
ancialDisclosures (desc by filing_year then ingested_at), useOfficial
StateEthicsComplaints (desc by complaint_date), useOfficialStateOfficial
Events (desc by event_date).

All 4 explicit UseQueryResult<T, Error> return annotations (TS2742 fix).
index.ts barrel re-exports up front. 4 new vitest cases."
```

---

## Task 8: state-ethics/shared.ts adapter interface + 4 helpers

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/shared.ts`
- Create: `packages/db/supabase/seed/state-ethics/shared.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/.gitkeep`

- [ ] **Step 1: Create fixture dir**

```bash
mkdir -p packages/db/supabase/seed/fixtures/state-ethics
```

Create empty `.gitkeep`.

- [ ] **Step 2: Write shared.ts**

```ts
import type { Client } from 'pg'

export type EthicsComponent = 'stock' | 'disclosures' | 'complaints' | 'events'

export interface NormalizedStockTransaction {
  official_openstates_person_id: string
  transaction_date: string
  filing_date: string
  asset_ticker?: string
  asset_name?: string
  transaction_type: 'purchase' | 'sale' | 'exchange'
  amount_range_low?: number
  amount_range_high?: number
  state: string
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedFinancialDisclosure {
  official_openstates_person_id: string
  filing_year: number
  filing_date?: string
  income_source?: string
  income_kind?: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
  state: string
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedEthicsComplaint {
  official_openstates_person_id: string
  complaint_date: string
  status: 'open' | 'dismissed' | 'settled' | 'sanctioned' | 'closed_no_action'
  disposition?: string
  summary: string
  state: string
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedOfficialEvent {
  official_openstates_person_id: string
  event_date: string
  event_type: 'recall_attempt' | 'recall_succeeded' | 'recall_failed'
    | 'resignation' | 'censure' | 'expulsion' | 'campaign_finance_violation'
  outcome?: string
  summary: string
  state: string
  source_url: string
  source: string
  external_id?: string
}

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

async function resolveOfficial(
  client: Client, openstates_person_id: string,
): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [openstates_person_id],
  )
  return r.rowCount === 0 ? null : r.rows[0]!.id
}

export async function upsertStockTransaction(
  client: Client, t: NormalizedStockTransaction,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, t.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_stock_transactions (
      official_id, transaction_date, filing_date, asset_ticker, asset_name,
      transaction_type, amount_range_low, amount_range_high,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    on conflict (source, external_id) where external_id is not null
    do update set
      transaction_date = excluded.transaction_date,
      filing_date      = excluded.filing_date,
      asset_ticker     = excluded.asset_ticker,
      asset_name       = excluded.asset_name,
      transaction_type = excluded.transaction_type,
      amount_range_low = excluded.amount_range_low,
      amount_range_high= excluded.amount_range_high,
      source_url       = excluded.source_url,
      ingested_at      = now()
  `, [
    officialId, t.transaction_date, t.filing_date, t.asset_ticker ?? null,
    t.asset_name ?? null, t.transaction_type,
    t.amount_range_low ?? null, t.amount_range_high ?? null,
    t.state, t.source_url, t.source, t.external_id ?? null,
  ])
  return true
}

export async function upsertFinancialDisclosure(
  client: Client, d: NormalizedFinancialDisclosure,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, d.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_financial_disclosures (
      official_id, filing_year, filing_date, income_source, income_kind,
      amount_range_low, amount_range_high,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    on conflict (source, external_id) where external_id is not null
    do update set
      filing_year      = excluded.filing_year,
      filing_date      = excluded.filing_date,
      income_source    = excluded.income_source,
      income_kind      = excluded.income_kind,
      amount_range_low = excluded.amount_range_low,
      amount_range_high= excluded.amount_range_high,
      source_url       = excluded.source_url,
      ingested_at      = now()
  `, [
    officialId, d.filing_year, d.filing_date ?? null,
    d.income_source ?? null, d.income_kind ?? null,
    d.amount_range_low ?? null, d.amount_range_high ?? null,
    d.state, d.source_url, d.source, d.external_id ?? null,
  ])
  return true
}

export async function upsertEthicsComplaint(
  client: Client, c: NormalizedEthicsComplaint,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, c.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_ethics_complaints (
      official_id, complaint_date, status, disposition, summary,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict (source, external_id) where external_id is not null
    do update set
      status      = excluded.status,
      disposition = excluded.disposition,
      summary     = excluded.summary,
      source_url  = excluded.source_url,
      ingested_at = now()
  `, [
    officialId, c.complaint_date, c.status,
    c.disposition ?? null, c.summary,
    c.state, c.source_url, c.source, c.external_id ?? null,
  ])
  return true
}

export async function upsertOfficialEvent(
  client: Client, e: NormalizedOfficialEvent,
): Promise<boolean> {
  const officialId = await resolveOfficial(client, e.official_openstates_person_id)
  if (!officialId) return false
  await client.query(`
    insert into public.state_official_events (
      official_id, event_date, event_type, outcome, summary,
      state, source_url, source, external_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict (source, external_id) where external_id is not null
    do update set
      event_type  = excluded.event_type,
      outcome     = excluded.outcome,
      summary     = excluded.summary,
      source_url  = excluded.source_url,
      ingested_at = now()
  `, [
    officialId, e.event_date, e.event_type,
    e.outcome ?? null, e.summary,
    e.state, e.source_url, e.source, e.external_id ?? null,
  ])
  return true
}
```

- [ ] **Step 3: Write shared.test.ts**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import {
  upsertStockTransaction,
  upsertFinancialDisclosure,
  upsertEthicsComplaint,
  upsertOfficialEvent,
} from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-SES', 'CA SES test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-ses')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-ses', 'Test SES', 'Test', 'SES', 'state_house', 'D', 'CA',
      d.id, true, 'FX-ses'
    from public.districts d where d.code = 'CA-SES'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_stock_transactions    where official_id = $1', [officialId])
  await client.query('delete from public.state_financial_disclosures where official_id = $1', [officialId])
  await client.query('delete from public.state_ethics_complaints     where official_id = $1', [officialId])
  await client.query('delete from public.state_official_events       where official_id = $1', [officialId])
  await client.query("delete from public.officials where source_version = 'FX-ses'")
  await client.query("delete from public.districts where source_version = 'FX-ses'")
  await client.end()
})

describe('upsertStockTransaction', () => {
  it('inserts row for known official', async () => {
    const ok = await upsertStockTransaction(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      transaction_date: '2026-01-01', filing_date: '2026-01-15',
      transaction_type: 'purchase', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc', external_id: 'stk-1',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown official', async () => {
    const ok = await upsertStockTransaction(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      transaction_date: '2026-01-01', filing_date: '2026-01-15',
      transaction_type: 'purchase', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc',
    })
    expect(ok).toBe(false)
  })
  it('idempotent on (source, external_id)', async () => {
    await upsertStockTransaction(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      transaction_date: '2026-01-01', filing_date: '2026-01-15',
      transaction_type: 'purchase', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc', external_id: 'stk-2',
    })
    await upsertStockTransaction(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      transaction_date: '2026-01-01', filing_date: '2026-01-15',
      transaction_type: 'sale', state: 'CA',
      source_url: 'https://y', source: 'ca-fppc', external_id: 'stk-2',
    })
    const r = await client.query<{ c: number; type: string }>(
      "select count(*)::int as c, max(transaction_type) as type from public.state_stock_transactions where external_id = 'stk-2'")
    expect(r.rows[0]!.c).toBe(1)
    expect(r.rows[0]!.type).toBe('sale')
  })
})

describe('upsertFinancialDisclosure', () => {
  it('inserts row', async () => {
    const ok = await upsertFinancialDisclosure(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      filing_year: 2025, income_kind: 'salary', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown', async () => {
    const ok = await upsertFinancialDisclosure(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      filing_year: 2025, income_kind: 'salary', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc',
    })
    expect(ok).toBe(false)
  })
})

describe('upsertEthicsComplaint', () => {
  it('inserts row', async () => {
    const ok = await upsertEthicsComplaint(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      complaint_date: '2026-01-01', status: 'open',
      summary: 'Test complaint', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown', async () => {
    const ok = await upsertEthicsComplaint(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      complaint_date: '2026-01-01', status: 'open',
      summary: 'Test', state: 'CA',
      source_url: 'https://x', source: 'ca-fppc',
    })
    expect(ok).toBe(false)
  })
})

describe('upsertOfficialEvent', () => {
  it('inserts row', async () => {
    const ok = await upsertOfficialEvent(client, {
      official_openstates_person_id: 'ocd-person/fx-ses',
      event_date: '2026-01-01', event_type: 'resignation',
      summary: 'Resigned for personal reasons', state: 'CA',
      source_url: 'https://x', source: 'openstates-end-reason',
    })
    expect(ok).toBe(true)
  })
  it('returns false for unknown', async () => {
    const ok = await upsertOfficialEvent(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      event_date: '2026-01-01', event_type: 'resignation',
      summary: 'Test', state: 'CA',
      source_url: 'https://x', source: 'openstates-end-reason',
    })
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/shared'
pnpm --filter @chiaro/db typecheck
```

Expected: 10 cases pass.

```bash
git add packages/db/supabase/seed/state-ethics/shared.ts \
        packages/db/supabase/seed/state-ethics/shared.test.ts \
        packages/db/supabase/seed/fixtures/state-ethics/.gitkeep
git commit -m "feat(db): state-ethics/shared.ts adapter interface + 4 helpers

EthicsComponent type + 4 normalized envelope types + adapter interface.
Helpers: upsertStockTransaction, upsertFinancialDisclosure, upsertEthics
Complaint, upsertOfficialEvent. All resolve openstates_person_id ->
officials.id, return false on unknown. ON CONFLICT (source, external_id)
WHERE external_id IS NOT NULL pattern per slice 5H Gotcha #13.

10 vitest cases against real local Supabase."
```

---

## Task 9: OpenStates `end_reason` events adapter

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts`
- Create: `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/events-openstates.json`

This is the **substantive** events adapter — it walks slice 5C cached OpenStates people files and extracts resignation/death events. Production-path code (not just a stub).

- [ ] **Step 1: Inspect slice 5C cache structure**

```bash
ls packages/db/supabase/seed/.cache/openstates/ 2>/dev/null || ls packages/db/supabase/seed/fixtures/openstates 2>/dev/null
grep -l "end_reason\|end_date" packages/db/supabase/seed/state-officials-ingest.ts packages/db/supabase/seed/openstates-people-fetch.ts 2>/dev/null
```

Determine the actual cache file layout. If slice 5C stored people as YAML files keyed by openstates_person_id, the adapter walks those. If as JSON, same approach. Adapt accordingly.

- [ ] **Step 2: Create fixture**

`fixtures/state-ethics/events-openstates.json`:

```json
{
  "events": [
    { "official_openstates_person_id": "ocd-person/fx-ev-ca-1", "event_date": "2025-11-15", "event_type": "resignation", "outcome": "Resigned for personal reasons", "summary": "Resignation per OpenStates roles[].end_reason='resigned'", "state": "CA", "source_url": "https://openstates.org/person/ocd-person/fx-ev-ca-1/", "source": "openstates-end-reason", "external_id": "openstates-end-reason:ocd-person/fx-ev-ca-1:2025-11-15" },
    { "official_openstates_person_id": "ocd-person/fx-ev-ny-1", "event_date": "2025-09-01", "event_type": "resignation", "outcome": "Death (per OpenStates end_reason='died')", "summary": "Deceased per OpenStates roles[].end_reason", "state": "NY", "source_url": "https://openstates.org/person/ocd-person/fx-ev-ny-1/", "source": "openstates-end-reason", "external_id": "openstates-end-reason:ocd-person/fx-ev-ny-1:2025-09-01" }
  ]
}
```

- [ ] **Step 3: Implement adapter**

```ts
import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function peopleCacheDir(): string {
  return process.env.OPENSTATES_PEOPLE_CACHE_DIR
    ?? join(process.cwd(), 'packages', 'db', 'supabase', 'seed', '.cache', 'openstates', 'people')
}

const RESIGN_RE = /resign/i
const DEATH_RE  = /(death|died|deceased)/i

interface OpenStatesPerson {
  id: string
  name: string
  roles?: Array<{
    type?: string
    jurisdiction?: string
    end_date?: string
    end_reason?: string
  }>
}

/**
 * Reads slice 5C cached OpenStates people files and emits resignation
 * events for any role with end_reason matching /resign/i or
 * /(death|died|deceased)/i.
 *
 * Returns [] when cache dir absent (v1 stub fallback).
 */
export const openstatesEndReason: StateEthicsAdapter = {
  slug: 'openstates-end-reason',
  component: 'events',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()

    const dir = peopleCacheDir()
    if (!existsSync(dir)) return []

    const out: NormalizedOfficialEvent[] = []
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return []
    }

    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.yml')) continue
      let person: OpenStatesPerson
      try {
        const raw = await readFile(join(dir, file), 'utf8')
        // For v1 we assume JSON. Slice 5C may cache YAML; production
        // operator wires a YAML parser if needed.
        person = JSON.parse(raw) as OpenStatesPerson
      } catch {
        continue
      }
      if (!person.roles) continue
      for (const role of person.roles) {
        if (!role.end_date || !role.end_reason) continue
        if (opts.state && role.jurisdiction !== opts.state) continue

        const isResign = RESIGN_RE.test(role.end_reason)
        const isDeath  = DEATH_RE.test(role.end_reason)
        if (!isResign && !isDeath) continue

        const stateMatch = role.jurisdiction?.match(/^[A-Z]{2}$/)
        const state = stateMatch ? role.jurisdiction! : opts.state ?? ''
        if (!state) continue

        out.push({
          official_openstates_person_id: person.id,
          event_date: role.end_date,
          event_type: 'resignation',
          outcome: isDeath
            ? `Death (per OpenStates end_reason='${role.end_reason}')`
            : `Resignation (per OpenStates end_reason='${role.end_reason}')`,
          summary: isDeath
            ? `Deceased per OpenStates roles[].end_reason`
            : `Resignation per OpenStates roles[].end_reason='${role.end_reason}'`,
          state,
          source_url: `https://openstates.org/person/${person.id}/`,
          source: 'openstates-end-reason',
          external_id: `openstates-end-reason:${person.id}:${role.end_date}`,
        })
      }
    }
    return out
  },
}
```

- [ ] **Step 4: Test**

```ts
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openstatesEndReason } from './openstates-end-reason.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', 'events-openstates.json')

describe('openstatesEndReason adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await openstatesEndReason.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { event_type?: string }).event_type).toBe('resignation')
  })

  it('production stub returns empty array when cache absent', async () => {
    process.env.OPENSTATES_PEOPLE_CACHE_DIR = '/nonexistent/path'
    const events = await openstatesEndReason.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
    delete process.env.OPENSTATES_PEOPLE_CACHE_DIR
  })

  it('reports correct slug + component', () => {
    expect(openstatesEndReason.slug).toBe('openstates-end-reason')
    expect(openstatesEndReason.component).toBe('events')
  })

  it('covered_states contains all 50', () => {
    expect(openstatesEndReason.covered_states.length).toBe(50)
  })
})
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/events/openstates-end-reason'
pnpm --filter @chiaro/db typecheck

git add packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts \
        packages/db/supabase/seed/state-ethics/events/openstates-end-reason.test.ts \
        packages/db/supabase/seed/fixtures/state-ethics/events-openstates.json
git commit -m "feat(seed): openstates-end-reason events adapter

PRIMARY resignation/death source. Reuses slice 5C cached OpenStates
people files (.cache/openstates/people/<id>.json). Case-insensitive
match on /resign/i + /(death|died|deceased)/i; NULL end_reason or
other values skipped. external_id stable per (person_id, end_date).
OPENSTATES_PEOPLE_CACHE_DIR env override.

4 vitest cases."
```

---

## Task 10: Ballotpedia recalls events adapter + 5 per-state finance-violation event adapters (bundled)

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/events/ballotpedia-recalls.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/state-ethics/events/{ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/events-ballotpedia.json`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/events-{ca,ny,fl,tx,mi}.json`

6 adapter files all stubbing `[]` in production; tests use `opts.fetcher` injection.

- [ ] **Step 1: Create 6 fixtures**

`events-ballotpedia.json`:
```json
{ "events": [
  { "official_openstates_person_id": "ocd-person/fx-rec-ca-1", "event_date": "2024-03-15", "event_type": "recall_failed", "outcome": "Recall failed at petition stage", "summary": "Petition fell short of signature threshold", "state": "CA", "source_url": "https://ballotpedia.org/Recall_X", "source": "ballotpedia", "external_id": "ballotpedia:Recall_X" }
]}
```

`events-ca.json`:
```json
{ "events": [
  { "official_openstates_person_id": "ocd-person/fx-fpv-ca-1", "event_date": "2025-06-01", "event_type": "campaign_finance_violation", "outcome": "$2500 fine", "summary": "FPPC fine for late campaign finance filing", "state": "CA", "source_url": "https://fppc.ca.gov/x", "source": "ca-fppc", "external_id": "ca-fppc-violation-1" }
]}
```

Repeat for NY/FL/TX/MI (1 event each, different `source` and `external_id`).

- [ ] **Step 2: Implement Ballotpedia adapter**

```ts
import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export const ballotpediaRecalls: StateEthicsAdapter = {
  slug: 'ballotpedia',
  component: 'events',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires ballotpedia.org/State_legislative_recalls HTML scrape.
    return []
  },
}
```

- [ ] **Step 3: Implement 5 per-state finance-violation event adapters**

Template `events/ca-fppc.ts`:

```ts
import type { StateEthicsAdapter, NormalizedOfficialEvent } from '../shared.ts'

export const caFppcEvents: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'events',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedOfficialEvent[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

Repeat for `ny-jcope.ts` (export `nyJcopeEvents`), `fl-coe.ts` (`flCoeEvents`), `tx-tec.ts` (`txTecEvents`), `mi-board.ts` (`miBoardEvents`).

- [ ] **Step 4: Implement 6 test files**

Template — adapt fixture path + export + slug + component:

```ts
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { <exportName> } from './<file>.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-ethics', '<fixture>.json')

describe('<slug> adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await <exportName>.fetchEvents({
      client: {} as never, fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
  })

  it('production stub returns empty array', async () => {
    const events = await <exportName>.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(<exportName>.slug).toBe('<slug>')
    expect(<exportName>.component).toBe('events')
  })

  it('covered_states valid', () => {
    expect(<exportName>.covered_states.length).toBeGreaterThan(0)
    for (const s of <exportName>.covered_states) expect(s).toMatch(/^[A-Z]{2}$/)
  })
})
```

For ballotpedia test, the covered_states length assertion expects 50.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/events'
pnpm --filter @chiaro/db typecheck
```

Expected: Task 9's 4 cases + this task's 6 × 4 = 24 cases = 28 total in events/.

```bash
git add packages/db/supabase/seed/state-ethics/events/ \
        packages/db/supabase/seed/fixtures/state-ethics/events-*.json
git commit -m "feat(seed): ballotpedia + 5 per-state event adapters

ballotpedia: nationwide recall/expulsion scrape stub (covers all 50;
production parser ballotpedia.org/State_legislative_recalls HTML).

5 per-state finance-violation event adapters (ca-fppc, ny-jcope,
fl-coe, tx-tec, mi-board). Slug-sharing with stock/disclosures/
complaints components disambiguated by (slug, component) tuple in
orchestrator.

24 vitest cases (6 files x 4)."
```

---

## Task 11: 5 per-state stock-transaction adapters (bundled)

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/stock/{ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/stock-{ca,ny,fl,tx,mi}.json`

- [ ] **Step 1: Create 5 fixtures**

`stock-ca.json`:
```json
{ "events": [
  { "official_openstates_person_id": "ocd-person/fx-stk-ca-1", "transaction_date": "2026-01-15", "filing_date": "2026-02-10", "asset_ticker": "AAPL", "asset_name": "Apple Inc.", "transaction_type": "purchase", "amount_range_low": 1000, "amount_range_high": 10000, "state": "CA", "source_url": "https://fppc.ca.gov/x", "source": "ca-fppc", "external_id": "ca-fppc-stk-1" }
]}
```

Repeat for NY/FL/TX/MI (single transaction each, distinct fixture).

- [ ] **Step 2: Implement 5 adapters**

Template `stock/ca-fppc.ts`:

```ts
import type { StateEthicsAdapter, NormalizedStockTransaction } from '../shared.ts'

export const caFppcStock: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'stock',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStockTransaction[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

Repeat for `ny-jcope.ts` (export `nyJcopeStock`), `fl-coe.ts` (`flCoeStock`), `tx-tec.ts` (`txTecStock`), `mi-board.ts` (`miBoardStock`).

- [ ] **Step 3: Implement 5 test files**

Same scaffold as Task 10 Step 4, swap `component='stock'`. 4 cases each.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/stock'
pnpm --filter @chiaro/db typecheck
```

Expected: 20 cases.

```bash
git add packages/db/supabase/seed/state-ethics/stock/ \
        packages/db/supabase/seed/fixtures/state-ethics/stock-*.json
git commit -m "feat(seed): 5 per-state stock-transaction adapters

ca-fppc, ny-jcope, fl-coe, tx-tec, mi-board — all v1 stubs returning
[]. Operator wires per-agency STOCK-Act-analogue scrapers.

Note: slug 'ca-fppc' shared across stock/disclosures/complaints/events;
disambiguated by (slug, component) in orchestrator.

20 vitest cases."
```

---

## Task 12: 5 per-state financial-disclosure adapters (bundled)

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/disclosures/{ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/disclosures-{ca,ny,fl,tx,mi}.json`

Identical structure to Task 11 but `component='disclosures'`.

- [ ] **Step 1: Create 5 fixtures**

`disclosures-ca.json`:
```json
{ "events": [
  { "official_openstates_person_id": "ocd-person/fx-disc-ca-1", "filing_year": 2024, "filing_date": "2025-04-01", "income_source": "Smith Consulting LLC", "income_kind": "consulting", "amount_range_low": 10000, "amount_range_high": 100000, "state": "CA", "source_url": "https://fppc.ca.gov/x", "source": "ca-fppc", "external_id": "ca-fppc-disc-1" }
]}
```

Repeat for NY/FL/TX/MI.

- [ ] **Step 2: Implement 5 adapters**

Template `disclosures/ca-fppc.ts`:

```ts
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

export const caFppcDisclosures: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'disclosures',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedFinancialDisclosure[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

Repeat: `nyJcopeDisclosures`, `flCoeDisclosures`, `txTecDisclosures`, `miBoardDisclosures`.

- [ ] **Step 3: Implement 5 test files**

Same scaffold as Task 11. Component='disclosures'. 4 cases each.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/disclosures'
pnpm --filter @chiaro/db typecheck

git add packages/db/supabase/seed/state-ethics/disclosures/ \
        packages/db/supabase/seed/fixtures/state-ethics/disclosures-*.json
git commit -m "feat(seed): 5 per-state financial-disclosure adapters

ca-fppc, ny-jcope, fl-coe, tx-tec, mi-board — all v1 stubs. Operator
wires per-agency SOEI scrapers.

20 vitest cases."
```

---

## Task 13: 5 per-state ethics-complaint adapters (bundled)

**Files:**
- Create: `packages/db/supabase/seed/state-ethics/complaints/{ca-fppc,ny-jcope,fl-coe,tx-tec,mi-board}.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-ethics/complaints-{ca,ny,fl,tx,mi}.json`

Identical to Tasks 11+12 but `component='complaints'`.

- [ ] **Step 1: Create 5 fixtures**

`complaints-ca.json`:
```json
{ "events": [
  { "official_openstates_person_id": "ocd-person/fx-comp-ca-1", "complaint_date": "2025-05-15", "status": "open", "summary": "Failure to disclose conflict of interest on AB-1234", "state": "CA", "source_url": "https://fppc.ca.gov/x", "source": "ca-fppc", "external_id": "ca-fppc-comp-1" }
]}
```

Repeat for NY/FL/TX/MI.

- [ ] **Step 2: Implement 5 adapters**

Template `complaints/ca-fppc.ts`:

```ts
import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

export const caFppcComplaints: StateEthicsAdapter = {
  slug: 'ca-fppc',
  component: 'complaints',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

Repeat: `nyJcopeComplaints`, `flCoeComplaints`, `txTecComplaints`, `miBoardComplaints`.

- [ ] **Step 3: Implement 5 test files**

Same scaffold. Component='complaints'. 4 cases each.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-ethics/complaints'
pnpm --filter @chiaro/db typecheck

git add packages/db/supabase/seed/state-ethics/complaints/ \
        packages/db/supabase/seed/fixtures/state-ethics/complaints-*.json
git commit -m "feat(seed): 5 per-state ethics-complaint adapters

ca-fppc, ny-jcope, fl-coe, tx-tec, mi-board — all v1 stubs. Operator
wires per-agency complaint-record scrapers.

20 vitest cases."
```

---

## Task 14: state-ethics-ingest orchestrator + pnpm script

**Files:**
- Create: `packages/db/supabase/seed/state-ethics-ingest.ts` + `.test.ts`
- Modify: `packages/db/package.json` (+1 script)

- [ ] **Step 1: Failing test**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateEthics } from './state-ethics-ingest.ts'
import type { StateEthicsAdapter } from './state-ethics/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => { client = new Client({ connectionString: DB_URL }); await client.connect() })
afterEach(async () => { await client.end() })

function mkAdapter(overrides: Partial<StateEthicsAdapter>): StateEthicsAdapter {
  return {
    slug: 'test', component: 'stock', covered_states: ['CA'],
    async fetchEvents() { return [] }, ...overrides,
  }
}

describe('ingestStateEthics', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', component: 'stock' }),
      mkAdapter({ slug: 'b', component: 'complaints' }),
    ]
    const stats = await ingestStateEthics({ client, adapters })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
  })

  it('--component filter restricts', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', component: 'stock',     async fetchEvents() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', component: 'complaints', async fetchEvents() { calls.push('b'); return [] } }),
    ]
    await ingestStateEthics({ client, component: 'stock', adapters })
    expect(calls).toEqual(['a'])
  })

  it('--state filter passes state + filters covered_states', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({ slug: 'a', covered_states: ['CA'], async fetchEvents(o) { calls.push({ slug: 'a', state: o.state }); return [] } }),
      mkAdapter({ slug: 'b', covered_states: ['NY'], async fetchEvents() { calls.push({ slug: 'b' }); return [] } }),
    ]
    await ingestStateEthics({ client, state: 'CA', adapters })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('skipOnError: one throws, others run', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchEvents() { throw new Error('a broke') } }),
      mkAdapter({ slug: 'b', async fetchEvents() { return [] } }),
    ]
    const stats = await ingestStateEthics({ client, skipOnError: true, adapters })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byAdapter.find(s => s.adapter_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default: throw aborts', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchEvents() { throw new Error('boom') } }),
      mkAdapter({ slug: 'b', async fetchEvents() { return [] } }),
    ]
    await expect(ingestStateEthics({ client, adapters })).rejects.toThrow(/boom/)
  })

  it('--component=all runs all 4 components', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', component: 'stock',        async fetchEvents() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', component: 'disclosures',  async fetchEvents() { calls.push('b'); return [] } }),
      mkAdapter({ slug: 'c', component: 'complaints',   async fetchEvents() { calls.push('c'); return [] } }),
      mkAdapter({ slug: 'd', component: 'events',       async fetchEvents() { calls.push('d'); return [] } }),
    ]
    await ingestStateEthics({ client, component: 'all', adapters })
    expect(calls).toEqual(['a', 'b', 'c', 'd'])
  })
})
```

- [ ] **Step 2: Implement orchestrator**

```ts
import { Client } from 'pg'
import {
  type EthicsComponent, type StateEthicsAdapter, type StateEthicsStats,
  upsertStockTransaction, upsertFinancialDisclosure,
  upsertEthicsComplaint, upsertOfficialEvent,
  type NormalizedStockTransaction, type NormalizedFinancialDisclosure,
  type NormalizedEthicsComplaint, type NormalizedOfficialEvent,
} from './state-ethics/shared.ts'
import { openstatesEndReason } from './state-ethics/events/openstates-end-reason.ts'
import { ballotpediaRecalls }  from './state-ethics/events/ballotpedia-recalls.ts'
import { caFppcEvents, nyJcopeEvents, flCoeEvents, txTecEvents, miBoardEvents }
  from './state-ethics/events/index.ts'  // see Step 3 for barrel
import { caFppcStock, nyJcopeStock, flCoeStock, txTecStock, miBoardStock }
  from './state-ethics/stock/index.ts'
import { caFppcDisclosures, nyJcopeDisclosures, flCoeDisclosures, txTecDisclosures, miBoardDisclosures }
  from './state-ethics/disclosures/index.ts'
import { caFppcComplaints, nyJcopeComplaints, flCoeComplaints, txTecComplaints, miBoardComplaints }
  from './state-ethics/complaints/index.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateEthicsAdapter[] = [
  // stock
  caFppcStock, nyJcopeStock, flCoeStock, txTecStock, miBoardStock,
  // disclosures
  caFppcDisclosures, nyJcopeDisclosures, flCoeDisclosures, txTecDisclosures, miBoardDisclosures,
  // complaints
  caFppcComplaints, nyJcopeComplaints, flCoeComplaints, txTecComplaints, miBoardComplaints,
  // events — OpenStates FIRST (resignation/death), then Ballotpedia (recalls), then per-state finance violations
  openstatesEndReason, ballotpediaRecalls,
  caFppcEvents, nyJcopeEvents, flCoeEvents, txTecEvents, miBoardEvents,
]

export interface IngestStateEthicsOpts {
  component?: EthicsComponent | 'all'
  state?: string
  skipOnError?: boolean
  adapters?: StateEthicsAdapter[]
  client?: Client
}

export interface IngestStateEthicsStats {
  adaptersAttempted: number
  adaptersOk: number
  totalRowsUpserted: number
  totalOfficialsUnmatched: number
  byAdapter: StateEthicsStats[]
}

export async function ingestStateEthics(
  opts: IngestStateEthicsOpts,
): Promise<IngestStateEthicsStats> {
  let adapters = opts.adapters ?? ADAPTERS_DEFAULT
  const wantedComponent = opts.component && opts.component !== 'all' ? opts.component : undefined
  if (wantedComponent) {
    adapters = adapters.filter(a => a.component === wantedComponent)
  }
  if (opts.state) {
    adapters = adapters.filter(a => a.covered_states.includes(opts.state!))
  }

  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byAdapter: StateEthicsStats[] = []
  try {
    for (const adapter of adapters) {
      const adapterStats: StateEthicsStats = {
        component: adapter.component,
        adapter_slug: adapter.slug,
        rowsUpserted: 0, officialsMatched: 0, officialsUnmatched: [],
        errors: [],
      }
      try {
        const events = await adapter.fetchEvents({ client, state: opts.state })
        for (const event of events) {
          let ok = false
          if (adapter.component === 'stock') {
            ok = await upsertStockTransaction(client, event as NormalizedStockTransaction)
          } else if (adapter.component === 'disclosures') {
            ok = await upsertFinancialDisclosure(client, event as NormalizedFinancialDisclosure)
          } else if (adapter.component === 'complaints') {
            ok = await upsertEthicsComplaint(client, event as NormalizedEthicsComplaint)
          } else if (adapter.component === 'events') {
            ok = await upsertOfficialEvent(client, event as NormalizedOfficialEvent)
          }
          if (ok) {
            adapterStats.rowsUpserted += 1
            adapterStats.officialsMatched += 1
          } else {
            const pid = (event as { official_openstates_person_id?: string }).official_openstates_person_id
            if (pid) adapterStats.officialsUnmatched.push(pid)
          }
        }
        byAdapter.push(adapterStats)
      } catch (err) {
        adapterStats.errors.push((err as Error).message)
        byAdapter.push(adapterStats)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    adaptersAttempted:        byAdapter.length,
    adaptersOk:               byAdapter.filter(s => s.errors.length === 0).length,
    totalRowsUpserted:        byAdapter.reduce((a, s) => a + s.rowsUpserted, 0),
    totalOfficialsUnmatched:  byAdapter.reduce((a, s) => a + s.officialsUnmatched.length, 0),
    byAdapter,
  }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const componentArg = process.argv.find(a => a.startsWith('--component='))
  const stateArg     = process.argv.find(a => a.startsWith('--state='))
  const skipOnError  = process.argv.includes('--skip-on-error')

  const component = componentArg
    ? componentArg.split('=')[1] as EthicsComponent | 'all'
    : 'all'
  const state = stateArg ? stateArg.split('=')[1] : undefined

  ingestStateEthics({ component, state, skipOnError })
    .then(stats => {
      console.log(`State ethics ingest summary:`)
      console.log(`  adapters attempted:        ${stats.adaptersAttempted}`)
      console.log(`  adapters ok:               ${stats.adaptersOk}`)
      console.log(`  total rows upserted:       ${stats.totalRowsUpserted}`)
      console.log(`  total officials unmatched: ${stats.totalOfficialsUnmatched}`)
      for (const s of stats.byAdapter) {
        const tag = s.errors.length > 0 ? `errors=${s.errors.length}` : 'ok'
        console.log(`  ${s.component}:${s.adapter_slug}: ${s.rowsUpserted} rows / ${tag}`)
      }
      process.exit(stats.adaptersOk === stats.adaptersAttempted ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 3: Create barrel files for each component dir**

Create `packages/db/supabase/seed/state-ethics/stock/index.ts`:
```ts
export { caFppcStock }      from './ca-fppc.ts'
export { nyJcopeStock }     from './ny-jcope.ts'
export { flCoeStock }       from './fl-coe.ts'
export { txTecStock }       from './tx-tec.ts'
export { miBoardStock }     from './mi-board.ts'
```

Similar `disclosures/index.ts`, `complaints/index.ts`, `events/index.ts` (events barrel exports caFppcEvents, nyJcopeEvents, flCoeEvents, txTecEvents, miBoardEvents — NOT openstatesEndReason or ballotpediaRecalls, which orchestrator imports directly).

- [ ] **Step 4: Add pnpm script**

Open `packages/db/package.json`. Append after `seed:state-community`:

```json
"seed:state-ethics": "tsx supabase/seed/state-ethics-ingest.ts",
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/db test state-ethics-ingest
pnpm --filter @chiaro/db typecheck
```

Expected: 6/6 cases pass.

```bash
git add packages/db/supabase/seed/state-ethics-ingest.ts \
        packages/db/supabase/seed/state-ethics-ingest.test.ts \
        packages/db/supabase/seed/state-ethics/*/index.ts \
        packages/db/package.json
git commit -m "feat(db): state-ethics-ingest orchestrator + pnpm script

Dispatches all 22 adapters (5 stock + 5 disclosures + 5 complaints +
2 nationwide events + 5 per-state events). Filters via --component=
stock|disclosures|complaints|events|all + --state=XX. Events dispatch
order: OpenStates first → Ballotpedia second → per-state finance-
violation adapters third (per slice 5H TownHallProject-first
precedent).

Per-adapter isolation: thrown errors land in byAdapter[N].errors;
--skip-on-error keeps siblings running.

CLI: pnpm seed:state-ethics --component=... [--state=XX] [--skip-on-error]

6 vitest cases."
```

---

## Tasks 15–18 outline (continued in part 2)

Due to plan length, the remaining tasks are documented in the same plan file but I'll outline them here for navigation:

- **Task 15:** Web 4 sub-list components (StateStockTransactionsList, StateFinancialDisclosuresList, StateEthicsComplaintsList, StateOfficialEventsList) — pure-props, ~8 vitest cases total
- **Task 16:** Web 2 cards (StateFinancialActivityCard, StateConductCard) + detail-page swap — ~10 vitest cases, decrement ComingSoonCard count to 0
- **Task 17:** Mobile parity — 4 sub-lists + 2 cards + swap
- **Task 18:** Officials integration test extension — +5 cases (RLS denied/allowed × 4 tables + 1 fetcher verification)
- **Task 19:** CLAUDE.md updates — slice 5I entry + Quick start +pnpm seed:state-ethics + Gotcha #14
- **Task 20:** Final verify + memory + handoff via finishing-a-development-branch skill

Detailed code for Tasks 15–20 follows the same patterns as slice 5H Tasks 13–18. Cross-reference:
- Task 15 mirrors slice 5H Task 13 (web sub-lists with Pressable rows + collapse logic)
- Task 16 mirrors slice 5H Task 14 but with **2** card files instead of 1 (StateFinancialActivityCard + StateConductCard)
- Task 17 mirrors slice 5H Task 15 (mobile, mutable-mock pattern)
- Task 18 mirrors slice 5H Task 16 (officials integration)
- Task 19 mirrors slice 5H Task 17 (CLAUDE.md)
- Task 20 mirrors slice 5H Task 18 (verify + handoff)

For each implementer dispatch, instructor reads the corresponding slice 5H task from `docs/superpowers/plans/2026-05-21-state-community-presence.md` and adapts:
- 4 hooks instead of 3 (add `useOfficialStateOfficialEvents`)
- 2 cards instead of 1
- Decrement PLACEHOLDER_CATEGORIES to `[]` (not just removing one element)
- Color semantics: warning for `days_late > 0` + `status='open'`; error for `'sanctioned'` + `'expulsion'` + `'recall_succeeded'`; success for `'dismissed'` + `'closed_no_action'`

Plan continues below with explicit code for each task. (Implementer subagents should treat the slice 5H plan as the reference template + this plan's spec section as the differential.)

---

## Task 15: Web 4 sub-list components

**Files:**
- Create: `apps/web/components/state/StateStockTransactionsList.tsx` + `.test.tsx`
- Create: `apps/web/components/state/StateFinancialDisclosuresList.tsx` + `.test.tsx`
- Create: `apps/web/components/state/StateEthicsComplaintsList.tsx` + `.test.tsx`
- Create: `apps/web/components/state/StateOfficialEventsList.tsx` + `.test.tsx`

All 4 are pure-props components taking `rows` prop; parent card owns the hooks.

- [ ] **Step 1: Inspect tokens + slice 5H precedent**

```bash
cat apps/web/components/state/StateTownHallsList.tsx | head -30
```

Confirm `COLORS.signal.success`, `COLORS.signal.warning`, `COLORS.signal.error`, `COLORS.neutral.surface/border/textMuted/background`, `COLORS.brand.text` exist.

- [ ] **Step 2: Implement StateStockTransactionsList**

```tsx
'use client'

import type { StateStockTransactionRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateStockTransactionRow[] }

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', sale: 'Sale', exchange: 'Exchange',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export function StateStockTransactionsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No stock transactions on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <a key={r.id} href={r.source_url} target="_blank" rel="noopener noreferrer"
           style={{
             display: 'flex', justifyContent: 'space-between', gap: 12,
             padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
             borderRadius: 6, fontSize: 13, textDecoration: 'none', color: COLORS.brand.text,
           }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>
              {r.transaction_date} · {r.asset_ticker ?? r.asset_name ?? 'Unknown asset'}
            </div>
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {r.transaction_type ? TYPE_LABEL[r.transaction_type] ?? r.transaction_type : 'Type n/a'}
              {' · '}{formatAmountRange(Number(r.amount_range_low ?? null), Number(r.amount_range_high ?? null))}
            </div>
          </div>
          {(r.days_late ?? 0) > 0 && (
            <span style={{
              alignSelf: 'center', fontSize: 11, fontWeight: 600,
              color: COLORS.signal.warning,
              padding: '2px 6px', borderRadius: 4,
              backgroundColor: `${COLORS.signal.warning}22`,
            }}>
              {r.days_late}d late
            </span>
          )}
        </a>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 3: Implement StateFinancialDisclosuresList**

```tsx
'use client'

import type { StateFinancialDisclosureRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateFinancialDisclosureRow[] }

const KIND_LABEL: Record<string, string> = {
  salary: 'Salary', consulting: 'Consulting', royalty: 'Royalty',
  rental: 'Rental', dividend: 'Dividend', other: 'Other',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export function StateFinancialDisclosuresList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No financial disclosures on file.</div>
  }
  // Group by filing_year
  const byYear = new Map<number, StateFinancialDisclosureRow[]>()
  for (const r of rows) {
    if (!byYear.has(r.filing_year)) byYear.set(r.filing_year, [])
    byYear.get(r.filing_year)!.push(r)
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 12px' }}>
      {years.map(year => (
        <div key={year}>
          <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.brand.text, marginBottom: 4 }}>
            {year} ({byYear.get(year)!.length} disclosure{byYear.get(year)!.length === 1 ? '' : 's'})
          </div>
          {byYear.get(year)!.map(r => (
            <div key={r.id} style={{
              padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
              borderRadius: 6, fontSize: 13, marginBottom: 4,
            }}>
              <div style={{ fontWeight: 500, color: COLORS.brand.text }}>
                {r.income_source ?? '(unspecified source)'}
              </div>
              <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
                {r.income_kind ? KIND_LABEL[r.income_kind] ?? r.income_kind : 'Kind n/a'}
                {' · '}{formatAmountRange(Number(r.amount_range_low ?? null), Number(r.amount_range_high ?? null))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 4: Implement StateEthicsComplaintsList**

```tsx
'use client'

import type { StateEthicsComplaintRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateEthicsComplaintRow[] }

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', dismissed: 'Dismissed', settled: 'Settled',
  sanctioned: 'Sanctioned', closed_no_action: 'Closed (no action)',
}

function statusColor(status: string): string {
  if (status === 'open')           return COLORS.signal.warning
  if (status === 'sanctioned')     return COLORS.signal.error
  if (status === 'dismissed' || status === 'closed_no_action') return COLORS.signal.success
  return COLORS.neutral.textMuted
}

export function StateEthicsComplaintsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No ethics complaints on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <div key={r.id} style={{
          padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 500, color: COLORS.brand.text }}>{r.complaint_date}</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: statusColor(r.status),
              padding: '2px 6px', borderRadius: 4,
              backgroundColor: `${statusColor(r.status)}22`,
            }}>
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
          </div>
          <div style={{
            fontSize: 12, color: COLORS.brand.text, whiteSpace: 'pre-wrap',
          }}>
            {r.summary}
          </div>
          {r.disposition && (
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4, fontStyle: 'italic' }}>
              Disposition: {r.disposition}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 5: Implement StateOfficialEventsList**

```tsx
'use client'

import type { StateOfficialEventRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateOfficialEventRow[] }

const TYPE_LABEL: Record<string, string> = {
  recall_attempt:             'Recall attempt',
  recall_succeeded:           'Recall succeeded',
  recall_failed:              'Recall failed',
  resignation:                'Resignation',
  censure:                    'Censure',
  expulsion:                  'Expulsion',
  campaign_finance_violation: 'Finance violation',
}

function typeColor(type: string): string {
  if (type === 'expulsion' || type === 'recall_succeeded') return COLORS.signal.error
  if (type === 'censure' || type === 'campaign_finance_violation') return COLORS.signal.warning
  if (type === 'recall_failed') return COLORS.signal.success
  return COLORS.neutral.textMuted
}

export function StateOfficialEventsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No sanctions or tenure events on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <a key={r.id} href={r.source_url} target="_blank" rel="noopener noreferrer"
           style={{
             padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
             borderRadius: 6, fontSize: 13, textDecoration: 'none',
             color: COLORS.brand.text, display: 'block',
           }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>{r.event_date}</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: typeColor(r.event_type),
              padding: '2px 6px', borderRadius: 4,
              backgroundColor: `${typeColor(r.event_type)}22`,
            }}>
              {TYPE_LABEL[r.event_type] ?? r.event_type}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.brand.text, whiteSpace: 'pre-wrap' }}>
            {r.summary}
          </div>
          {r.outcome && (
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4, fontStyle: 'italic' }}>
              {r.outcome}
            </div>
          )}
        </a>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 6: Tests (4 files × ~2-3 cases)**

Test scaffolds mirror slice 5H Task 13 tests. Each test file:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { <ListComponent> } from '@/components/state/<file>'

describe('<ListComponent>', () => {
  it('renders empty state', () => {
    const { getByText } = render(<<ListComponent> rows={[]} />)
    expect(getByText(/No <thing> on file/i)).toBeTruthy()
  })

  it('renders rows', () => {
    const rows = [/* representative fixture row matching the row type */] as never[]
    const { getByText } = render(<<ListComponent> rows={rows} />)
    expect(getByText(/<expected text from fixture>/i)).toBeTruthy()
  })

  // 3rd case for components with special logic:
  // - StockTransactionsList: renders "Nd late" chip when days_late > 0
  // - DisclosuresList: groups multi-year rows into year sections
  // - ComplaintsList: renders status chip with correct color (sample assertion)
  // - EventsList: renders type chip with correct color
})
```

- [ ] **Step 7: Run + commit**

```bash
pnpm --filter @chiaro/web test 'state/State(StockTransactions|FinancialDisclosures|EthicsComplaints|OfficialEvents)List'
pnpm --filter @chiaro/web typecheck
```

```bash
git add apps/web/components/state/State{StockTransactions,FinancialDisclosures,EthicsComplaints,OfficialEvents}List.tsx \
        apps/web/test/components/state/State{StockTransactions,FinancialDisclosures,EthicsComplaints,OfficialEvents}List.test.tsx
git commit -m "feat(web): 4 sub-list components for ethics & accountability

StateStockTransactionsList: clickable rows + Nd-late warning chip
StateFinancialDisclosuresList: grouped by filing_year
StateEthicsComplaintsList: status chip (warning open / error sanctioned
  / success dismissed) + disposition under expand
StateOfficialEventsList: event_type chip (error expulsion+recall_
  succeeded / warning censure+finance_violation / success recall_failed)
  + outcome subline

All pure-props. Tokens from @chiaro/ui-tokens (signal/neutral/brand
vocabulary). ~11 vitest cases."
```

---

## Task 16: Web 2 cards (StateFinancialActivityCard + StateConductCard) + detail-page swap

**Files:**
- Create: `apps/web/components/state/StateFinancialActivityCard.tsx` + `.test.tsx`
- Create: `apps/web/components/state/StateConductCard.tsx` + `.test.tsx`
- Modify: `apps/web/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Implement StateFinancialActivityCard**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialStateStockTransactions,
  useOfficialStateFinancialDisclosures,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateStockTransactionsList } from './StateStockTransactionsList'
import { StateFinancialDisclosuresList } from './StateFinancialDisclosuresList'

interface Props { officialId: string }

export function StateFinancialActivityCard({ officialId }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const stock       = useOfficialStateStockTransactions(client, officialId)
  const disclosures = useOfficialStateFinancialDisclosures(client, officialId)

  const [openStock, setOpenStock] = useState(false)
  const [openDisc,  setOpenDisc]  = useState(false)

  if (stock.isLoading || disclosures.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Financial Activity</h2>
        <div style={mutedStyle}>Loading financial activity…</div>
      </section>
    )
  }

  const stockCount = stock.data?.length ?? null
  const discCount  = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null
  const allEmpty   = stockCount === 0 && discCount === 0

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Financial Activity</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No stock or financial-disclosure records on file for this legislator.
        </div>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Financial Activity</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {stockCount != null ? `${stockCount} stock trade${stockCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {discCount  != null ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (${latestYear})` : ''}` : '—'}
      </div>

      <Subsection label={`Stock trades (${stockCount ?? '—'})`} open={openStock} onToggle={() => setOpenStock(v => !v)}>
        <StateStockTransactionsList rows={stock.data ?? []} />
      </Subsection>

      <Subsection label={`Financial disclosures (${discCount ?? '—'})`} open={openDisc} onToggle={() => setOpenDisc(v => !v)}>
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
```

- [ ] **Step 2: Implement StateConductCard**

Identical Subsection helper + cardStyle/titleStyle/mutedStyle. Differences from Step 1:

```tsx
import {
  useOfficialStateEthicsComplaints,
  useOfficialStateOfficialEvents,
} from '@chiaro/officials'
import { StateEthicsComplaintsList } from './StateEthicsComplaintsList'
import { StateOfficialEventsList } from './StateOfficialEventsList'

export function StateConductCard({ officialId }: Props) {
  const client    = useMemo(() => createSupabaseBrowserClient(), [])
  const complaints = useOfficialStateEthicsComplaints(client, officialId)
  const events     = useOfficialStateOfficialEvents(client, officialId)
  // [loading + state + Subsection scaffold identical to Card 1]
  if (complaints.isLoading || events.isLoading) {
    return <section style={cardStyle}><h2 style={titleStyle}>Conduct & Sanctions</h2><div style={mutedStyle}>Loading conduct records…</div></section>
  }
  const complaintCount = complaints.data?.length ?? null
  const openCount = complaints.data?.filter(r => r.status === 'open').length ?? 0
  const eventCount = events.data?.length ?? null
  const allEmpty = complaintCount === 0 && eventCount === 0
  if (allEmpty) {
    return <section style={cardStyle}><h2 style={titleStyle}>Conduct & Sanctions</h2><div style={{ ...mutedStyle, fontStyle: 'italic' }}>No ethics complaints or conduct events on record for this legislator.</div></section>
  }
  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Conduct & Sanctions</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {complaintCount != null ? `${complaintCount} complaint${complaintCount === 1 ? '' : 's'} (${openCount} open)` : '—'} ·{' '}
        {eventCount     != null ? `${eventCount} event${eventCount === 1 ? '' : 's'}` : '—'}
      </div>
      <Subsection label={`Ethics complaints (${complaintCount ?? '—'})`} open={openComplaints} onToggle={() => setOpenComplaints(v => !v)}>
        <StateEthicsComplaintsList rows={complaints.data ?? []} />
      </Subsection>
      <Subsection label={`Sanctions / recall / resignation (${eventCount ?? '—'})`} open={openEvents} onToggle={() => setOpenEvents(v => !v)}>
        <StateOfficialEventsList rows={events.data ?? []} />
      </Subsection>
    </section>
  )
}
```

(Full file mirrors Step 1 with the 2 different hook calls + 2 different Subsection labels.)

- [ ] **Step 3: Test scaffolds (4 cases per card = 8 cases)**

Mirror slice 5H web card test scaffold (Task 14 Step 2). Mock both hooks via `vi.mock` factory + closured `vi.fn()`. Per card: 4 cases — empty state / summary counts / expand interaction / loading state.

- [ ] **Step 4: Detail-page swap**

```tsx
// Find:
<ComingSoonCard title="Ethics & Accountability" />

// Replace with:
<StateFinancialActivityCard officialId={official.id} />
<StateConductCard officialId={official.id} />
```

Add 2 imports.

Update `PLACEHOLDER_CATEGORIES` array to `[]` (empty — this slice closes the redesign).

Update detail-page test:
- Add hook mocks for 4 new hooks (all return `{ data: [], isLoading: false, isSuccess: true }`)
- Update any placeholder-count assertion to **0**
- Add positive assertion that both new card titles render

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/web test 'state/State(FinancialActivity|Conduct)Card|state/StateOfficialDetailPage'
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build
```

Expected: all green; Next 15 build clean.

```bash
git add apps/web/components/state/StateFinancialActivityCard.tsx \
        apps/web/components/state/StateConductCard.tsx \
        apps/web/test/components/state/StateFinancialActivityCard.test.tsx \
        apps/web/test/components/state/StateConductCard.test.tsx \
        apps/web/components/state/StateOfficialDetailPage.tsx \
        apps/web/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(web): StateFinancialActivityCard + StateConductCard + swap

Replaces ComingSoonCard('Ethics & Accountability') with 2 cards (per
spec 2-card-split decision). State-officials detail page now has 0
ComingSoonCard placeholders — closes the redesign begun in slice 5C.

StateFinancialActivityCard: stock + disclosures, 2 collapsible subsections.
StateConductCard: complaints + events, '(N open)' inline count.

Both cards distinguish em-dash NULL from numeric 0 counts. 8 + 1
adjusted detail-page count = 9 vitest cases."
```

---

## Task 17: Mobile parity (4 sub-lists + 2 cards + swap)

**Files:**
- Create: `apps/mobile/components/state/State{StockTransactions,FinancialDisclosures,EthicsComplaints,OfficialEvents}List.tsx`
- Create: `apps/mobile/components/state/State{FinancialActivity,Conduct}Card.tsx`
- Create: `apps/mobile/test/components/state/State{FinancialActivity,Conduct}Card.test.tsx`
- Modify: `apps/mobile/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Implement 4 RN sub-list components**

Mirror Task 15 web components with RN primitives (`Pressable`, `View`, `Text`, `Linking`, `StyleSheet`).

`StateStockTransactionsList.tsx`:

```tsx
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import type { StateStockTransactionRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', sale: 'Sale', exchange: 'Exchange',
}
function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

interface Props { rows: StateStockTransactionRow[] }

export function StateStockTransactionsList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No stock transactions on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <Pressable key={r.id} onPress={() => Linking.openURL(r.source_url)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {r.transaction_date} · {r.asset_ticker ?? r.asset_name ?? 'Unknown asset'}
            </Text>
            <Text style={styles.meta}>
              {r.transaction_type ? TYPE_LABEL[r.transaction_type] ?? r.transaction_type : 'Type n/a'}
              {' · '}{formatAmountRange(Number(r.amount_range_low ?? null), Number(r.amount_range_high ?? null))}
            </Text>
          </View>
          {(r.days_late ?? 0) > 0 && (
            <Text style={[styles.chip, { color: COLORS.signal.warning, backgroundColor: `${COLORS.signal.warning}22` }]}>
              {r.days_late}d late
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list:  { gap: 6, padding: 8 },
  row:   { flexDirection: 'row', backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8, gap: 8 },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta:  { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  chip:  { fontSize: 11, fontWeight: '600', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'center' },
})
```

Similar RN ports for `StateFinancialDisclosuresList`, `StateEthicsComplaintsList`, `StateOfficialEventsList` — mirror Task 15 logic with RN primitives. Use newlines (`\n`) in `Text` children for multi-line content (vs `<br/>` in web).

- [ ] **Step 2: Implement 2 RN cards**

```tsx
// StateFinancialActivityCard.tsx
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import {
  useOfficialStateStockTransactions,
  useOfficialStateFinancialDisclosures,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateStockTransactionsList } from './StateStockTransactionsList'
import { StateFinancialDisclosuresList } from './StateFinancialDisclosuresList'
import type { ReactNode } from 'react'

interface Props { officialId: string }

export function StateFinancialActivityCard({ officialId }: Props) {
  const stock       = useOfficialStateStockTransactions(supabase, officialId)
  const disclosures = useOfficialStateFinancialDisclosures(supabase, officialId)
  const [openStock, setOpenStock] = useState(false)
  const [openDisc,  setOpenDisc]  = useState(false)

  if (stock.isLoading || disclosures.isLoading) {
    return <View style={styles.card}><Text style={styles.title}>Financial Activity</Text><Text style={styles.muted}>Loading financial activity…</Text></View>
  }
  const stockCount = stock.data?.length ?? null
  const discCount  = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null
  if (stockCount === 0 && discCount === 0) {
    return <View style={styles.card}><Text style={styles.title}>Financial Activity</Text><Text style={[styles.muted, { fontStyle: 'italic' }]}>No stock or financial-disclosure records on file for this legislator.</Text></View>
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Financial Activity</Text>
      <Text style={styles.summary}>
        {stockCount != null ? `${stockCount} stock trade${stockCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {discCount  != null ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (${latestYear})` : ''}` : '—'}
      </Text>
      <Subsection label={`Stock trades (${stockCount ?? '—'})`} open={openStock} onToggle={() => setOpenStock(v => !v)}>
        <StateStockTransactionsList rows={stock.data ?? []} />
      </Subsection>
      <Subsection label={`Financial disclosures (${discCount ?? '—'})`} open={openDisc} onToggle={() => setOpenDisc(v => !v)}>
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
      </Subsection>
    </View>
  )
}

function Subsection({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}><Text style={styles.subsectionLabel}>{open ? '▾' : '▸'} {label}</Text></Pressable>
      {open && <View>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  card:    { backgroundColor: COLORS.neutral.background, borderColor: COLORS.neutral.border, borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 16 },
  title:   { fontSize: 18, fontWeight: '600', marginBottom: 12, color: COLORS.brand.text },
  muted:   { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
  subsection:      { borderTopWidth: 1, borderTopColor: COLORS.neutral.border, paddingTop: 8 },
  subsectionLabel: { color: COLORS.brand.text, fontSize: 14, fontWeight: '500', paddingVertical: 6 },
})
```

`StateConductCard.tsx`: mirror structure with `useOfficialStateEthicsComplaints` + `useOfficialStateOfficialEvents`. Header summary: `${complaintCount} complaint(s) (${openCount} open) · ${eventCount} event(s)`.

- [ ] **Step 3: Tests (2 cards × 4 cases = 8 cases)**

Mirror slice 5H mobile card test pattern. Each card: mutable mocks for both hooks + `mockLoading` flags reset in `beforeEach`. 4 cases — empty / summary / expand / loading.

- [ ] **Step 4: Detail-page swap**

```tsx
// Find:
<ComingSoonCard title="Ethics & Accountability" />

// Replace with:
<StateFinancialActivityCard officialId={official.id} />
<StateConductCard officialId={official.id} />
```

Set `PLACEHOLDER_CATEGORIES = []` (was `['Ethics & Accountability']` after slice 5H).

Update mobile detail-page test: add 4 hook mocks to existing `jest.mock('@chiaro/officials', …)`; placeholder-count assertion → 0; add positive assertions for both new card titles.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/mobile test 'state/State(FinancialActivity|Conduct)Card|state/StateOfficialDetailPage'
pnpm --filter @chiaro/mobile typecheck
```

```bash
git add apps/mobile/components/state/State{StockTransactions,FinancialDisclosures,EthicsComplaints,OfficialEvents}List.tsx \
        apps/mobile/components/state/State{FinancialActivity,Conduct,OfficialDetailPage}Card.tsx \
        apps/mobile/test/components/state/State{FinancialActivity,Conduct,OfficialDetailPage}.test.tsx
git commit -m "feat(mobile): StateFinancialActivityCard + StateConductCard + 4 sub-lists + swap

Mobile parity with web Task 16. RN primitives (Pressable, View, Text,
Linking). Per slice 5F lesson, jest-expo uses mutable mocks +
beforeEach reset.

PLACEHOLDER_CATEGORIES now [] — 0 ComingSoonCards remain on
/state-officials/[id]. State-officials detail-page redesign closed.

8 vitest cases."
```

---

## Task 18: Officials integration test extension

**Files:**
- Modify: `packages/officials/test/queries.integration.test.ts`

- [ ] **Step 1: Append describe block**

```ts
describe('state_ethics_* RLS + 4 fetchers', () => {
  let officialIdLocal: string
  let stockId: string
  let discId: string
  let complaintId: string
  let eventId: string

  beforeAll(async () => {
    const off = await svc.from('officials').select('id').eq('chamber', 'state_house').limit(1).single()
    if (off.error) throw off.error
    officialIdLocal = off.data!.id

    const s = await svc.from('state_stock_transactions').insert({
      official_id: officialIdLocal, transaction_date: '2026-01-01',
      filing_date: '2026-01-15', transaction_type: 'purchase',
      state: 'CA', source_url: 'https://x', source: 'integ', external_id: 'integ-stk',
    }).select('id').single()
    if (s.error) throw s.error
    stockId = s.data!.id

    const d = await svc.from('state_financial_disclosures').insert({
      official_id: officialIdLocal, filing_year: 2025,
      income_kind: 'salary', state: 'CA',
      source_url: 'https://x', source: 'integ', external_id: 'integ-disc',
    }).select('id').single()
    if (d.error) throw d.error
    discId = d.data!.id

    const c = await svc.from('state_ethics_complaints').insert({
      official_id: officialIdLocal, complaint_date: '2026-01-01',
      status: 'open', summary: 'integration test complaint',
      state: 'CA', source_url: 'https://x', source: 'integ', external_id: 'integ-comp',
    }).select('id').single()
    if (c.error) throw c.error
    complaintId = c.data!.id

    const e = await svc.from('state_official_events').insert({
      official_id: officialIdLocal, event_date: '2026-01-01',
      event_type: 'censure', summary: 'integration test event',
      state: 'CA', source_url: 'https://x', source: 'integ', external_id: 'integ-evt',
    }).select('id').single()
    if (e.error) throw e.error
    eventId = e.data!.id
  })

  afterAll(async () => {
    await svc.from('state_stock_transactions')    .delete().eq('id', stockId)
    await svc.from('state_financial_disclosures') .delete().eq('id', discId)
    await svc.from('state_ethics_complaints')     .delete().eq('id', complaintId)
    await svc.from('state_official_events')       .delete().eq('id', eventId)
  })

  it('authd SELECT allowed on all 4 tables', async () => {
    const s = await anon.from('state_stock_transactions').select('*').eq('id', stockId)
    expect(s.data).toHaveLength(1)
    const d = await anon.from('state_financial_disclosures').select('*').eq('id', discId)
    expect(d.data).toHaveLength(1)
    const c = await anon.from('state_ethics_complaints').select('*').eq('id', complaintId)
    expect(c.data).toHaveLength(1)
    const e = await anon.from('state_official_events').select('*').eq('id', eventId)
    expect(e.data).toHaveLength(1)
  })

  it('anon SELECT denied (RLS empty array, representative table)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const unauth = createClient(
      process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, storageKey: 'unauth-5i-integ' } },
    )
    const { data } = await unauth.from('state_stock_transactions').select('*').eq('id', stockId)
    expect(data ?? []).toHaveLength(0)
  })

  it('fetchOfficialStateStockTransactions retrieves rows', async () => {
    const { fetchOfficialStateStockTransactions } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateStockTransactions(anon as never, officialIdLocal)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.find(r => r.id === stockId)).toBeDefined()
  })

  it('fetchOfficialStateEthicsComplaints retrieves rows', async () => {
    const { fetchOfficialStateEthicsComplaints } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateEthicsComplaints(anon as never, officialIdLocal)
    expect(rows.find(r => r.id === complaintId)).toBeDefined()
  })

  it('fetchOfficialStateOfficialEvents retrieves rows', async () => {
    const { fetchOfficialStateOfficialEvents } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateOfficialEvents(anon as never, officialIdLocal)
    expect(rows.find(r => r.id === eventId)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run + commit**

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  pnpm --filter @chiaro/officials test queries.integration
```

```bash
git add packages/officials/test/queries.integration.test.ts
git commit -m "test(officials): state_ethics_* RLS + 4 fetchers integration

5 new cases: authd SELECT allowed × 4 tables (sampled 1 per table),
anon SELECT denied (representative table), 3 fetcher verifications
(stock, complaints, events). Uses ephemeral unauth client per
slice 5G/5H storageKey-isolation pattern."
```

---

## Task 19: CLAUDE.md updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Slice entry**

In `## Slices delivered`, after slice 5H entry, append:

```markdown
- **Sub-slice 5I — state ethics & accountability** (2026-05-22): hybrid adapter pattern (22 stubs across 4 components). Migrations 0046 (state_stock_transactions), 0047 (state_financial_disclosures), 0048 (state_ethics_complaints), 0049 (state_official_events), 0050 (RLS). Replaces `ComingSoonCard('Ethics & Accountability')` with **2 cards** (`StateFinancialActivityCard` + `StateConductCard`) on web + mobile — **closes the state-officials detail-page redesign** (0 ComingSoonCards remain). 4 new single-step PostgREST hooks in `@chiaro/officials`. OpenStates `roles[].end_reason` cache reuse (slice 5C infrastructure) is the primary resignation/death source — zero new external dependency. Ballotpedia HTML scrape stub for recalls. After this slice: state-officials detail page complete; future work shifts to operator parser-wiring + federal-side parity.
```

- [ ] **Step 2: Quick start**

After existing `pnpm seed:state-community` line, append:

```bash
pnpm seed:state-ethics --component=stock|disclosures|complaints|events|all   # ingest ethics records (stubs in v1)
```

- [ ] **Step 3: Gotcha #14**

After Gotcha #13, append:

```markdown
14. **state_official_events folds 7 distinct event categories into one table.** event_type enum: recall_attempt | recall_succeeded | recall_failed | resignation | censure | expulsion | campaign_finance_violation. Multiple adapters write to this table — OpenStates `end_reason` cache (slice 5C reuse) is primary for resignation/death (matches `/resign/i` and `/(death|died|deceased)/i`; NULL → assume term_end + skip emit); Ballotpedia HTML scrape is primary for recall/expulsion; per-state ethics-commission adapters (ca-fppc etc.) emit campaign_finance_violation rows. Dispatch order: OpenStates first → Ballotpedia second → per-state third. Same `(source, external_id) UNIQUE WHERE external_id IS NOT NULL` dedup semantics as slice 5H (Gotcha #13).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 5I entry + 7-event-types gotcha + Quick start

5I slice entry. Gotcha #14 documents the 7-value event_type enum +
multi-adapter dispatch ordering for state_official_events. New
seed:state-ethics CLI. **0 ComingSoonCards remain** on
/state-officials/[id] after this slice."
```

---

## Task 20: Final verify + memory + handoff

**Files:**
- None (verification + memory writes only)

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @chiaro/web build
pnpm db:reset
pnpm db:test 2>&1 | tail -15
```

Expected:
- All 10 packages typecheck clean
- All package test scripts pass (TIGER 4-failures expected per gotcha #6; officials-ingest threshold-guard flake re-runs green per slice 5H verify lesson)
- Next 15 build clean
- All migrations 0001–0050 apply
- pgTAP Files=29, Tests=393

- [ ] **Step 2: Branch state**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: ~22-25 commits on `slice-5i-ethics-accountability` ahead of master.

- [ ] **Step 3: Durable-lessons memory**

Write `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice5i_ethics_accountability.md` capturing:
- Final squash SHA (after merge)
- 2-card-split design rationale (4 signals × 2 cards instead of 1 card × 4 subsections)
- 22-adapter count + per-component breakdown
- OpenStates cache reuse from slice 5C as primary resignation source
- Ballotpedia as HTML-scrape-only stub (API sales-gated)
- 7-value event_type discriminator
- `days_late` 30-day default vs federal 45-day
- 12 known limitations from spec
- **State-officials detail-page redesign closed** (0 ComingSoonCards remaining)

Update `MEMORY.md` index with one-line entry.

- [ ] **Step 4: Hand off via finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch`. Recommended: option 1 (squash merge to master locally), matching prior 8 sub-slices.

---

## Verification Checklist (post-Task 20)

- [ ] 4 new tables exist; RLS enabled on all 4; correct FK directions (RESTRICT to officials.id)
- [ ] `state_stock_transactions.days_late` is generated stored using 30-day deadline
- [ ] 22 adapters compile + tested + return `[]` from production stub
- [ ] Orchestrator dispatches all 22 adapters with `--component` / `--state` / `--skip-on-error` filters
- [ ] OpenStates `end_reason` adapter walks slice 5C cache (no new external dependency)
- [ ] Web + mobile 2 cards (`StateFinancialActivityCard` + `StateConductCard`) mount on `/state-officials/[id]`
- [ ] **PLACEHOLDER_CATEGORIES is now `[]`** — 0 ComingSoonCards remain
- [ ] Signal-color chips: warning for late filings + open complaints; error for sanctioned + expulsion + recall_succeeded; success for dismissed + closed_no_action + recall_failed
- [ ] Workspace typecheck clean across all 10 packages
- [ ] pgTAP total plans bumped by 20 (373 → 393) across 29 files
- [ ] No new env vars required
- [ ] State-officials detail-page redesign closed; future work shifts to operator parser-wiring

## Known v1 limitations carried over from spec

1. All 22 adapters ship as stubs returning `[]`; production parsers per (source, agency) are operator follow-up.
2. State coverage = core 5 + OpenStates 50-state + Ballotpedia 50-state. Other 45 states' per-state adapters out of v1.
3. `days_late` uses uniform 30-day deadline; actual state laws range 24–45 days.
4. `(source, external_id)` UNIQUE allows NULL external_id (NULLs distinct).
5. OpenStates `end_reason` is free-text; case-insensitive matching on resign/death tokens; NULL → skip emit.
6. Ballotpedia HTML structure most-likely-to-drift; ship with `--skip-on-error`.
7. Ballotpedia API is sales-gated; v1 uses HTML scrape only.
8. Ethics complaint `summary` rendered verbatim with `whitespace: pre-wrap`; no LLM normalization.
9. Campaign finance violations modeled as `state_official_events.event_type='campaign_finance_violation'`, not in `state_finance_summaries` (5E).
10. SOEI bracket bounds only — no point amount.
11. `state_official_events.event_type` enum fixed at 7 values.
12. RLS matches slice 5D-5H pattern; federal `stock_transactions` (0022) stays CASCADE (not retroactively flipped).
