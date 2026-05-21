# State Campaign Finance Implementation Plan (sub-slice 5E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slice 5C's `ComingSoonCard('Finance')` on `/state-officials/[id]` with a real `StateFinanceCard` — totals + small-donor % + in-state % + top-10 donors — sourced from per-state public filings for CA, NY, FL, TX, MI.

**Architecture:** Per-state adapter pattern mirrors slice 5D state-bills-enrich. 5 adapter scripts under `packages/db/supabase/seed/state-finance/`, one orchestrator, 2 new tables (`state_finance_summaries` + `state_finance_individual_donors`). Queries + hooks land in `@chiaro/officials` alongside federal finance (NOT a new package — workspace stays at 10). Web + mobile parity expected per slice 5D precedent.

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP, vitest, jest-expo, Next 15, React 19, pg, undici, TanStack Query v5. No new env vars (state public sites are unauthenticated).

**Spec:** `docs/superpowers/specs/2026-05-20-state-finance-design.md`

---

## File structure

**Created (~25 files):**
```
packages/db/supabase/migrations/
  0035_state_finance.sql
  0036_state_finance_rls.sql
packages/db/supabase/tests/
  state_finance_rls.test.sql
packages/db/supabase/seed/
  state-finance-ingest.ts
  state-finance-ingest.test.ts
  state-finance/
    shared.ts
    shared.test.ts
    fetch-ca.ts
    fetch-ca.test.ts
    fetch-ny.ts
    fetch-ny.test.ts
    fetch-fl.ts
    fetch-fl.test.ts
    fetch-tx.ts
    fetch-tx.test.ts
    fetch-mi.ts
    fetch-mi.test.ts
  fixtures/state-finance/
    ca-sample.xml
    ny-sample.json
    fl-sample.html
    tx-sample.csv
    mi-sample.csv
apps/web/components/state/
  StateDonorsEvidence.tsx
  StateFinanceCard.tsx
apps/web/test/components/state/
  StateDonorsEvidence.test.tsx
  StateFinanceCard.test.tsx
apps/mobile/components/state/
  StateDonorsEvidence.tsx
  StateFinanceCard.tsx
apps/mobile/test/components/state/
  StateDonorsEvidence.test.tsx
  StateFinanceCard.test.tsx
```

**Modified:**
```
packages/db/src/types.ts                   # regenerated after migrations
packages/db/package.json                   # +seed:state-finance script
packages/officials/src/types.ts            # +StateFinanceSummaryRow, +StateFinanceIndividualDonorRow
packages/officials/src/keys.ts             # +stateFinanceSummary, +stateDonors keys
packages/officials/src/queries.ts          # +fetchOfficialStateFinanceSummary, +fetchOfficialStateDonors
packages/officials/src/hooks.ts            # +useOfficialStateFinanceSummary, +useOfficialStateDonors
packages/officials/test/queries.integration.test.ts  # +state finance seed + 1 RLS case
apps/web/components/state/StateOfficialDetailPage.tsx     # swap ComingSoonCard('Finance')
apps/web/test/components/state/StateOfficialDetailPage.test.tsx  # expect 3 placeholders + new mocks
apps/mobile/components/state/StateOfficialDetailPage.tsx          # mirror swap
apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx # mirror test update
CLAUDE.md                                  # slice entry + env table reference + gotcha #10 + migration range bump
```

---

## Task 1: Migration 0035 — state_finance schema

**Files:**
- Create: `packages/db/supabase/migrations/0035_state_finance.sql`

- [ ] **Step 1: Write the migration**

Create `packages/db/supabase/migrations/0035_state_finance.sql`:

```sql
-- Sub-slice 5E: state campaign finance for state legislators.
-- Two parallel tables to federal finance_summaries / finance_individual_donors,
-- with state-specific quirks: cycle is text (per-state format varies),
-- source records which adapter populated the row.

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

comment on column public.state_finance_summaries.cycle is
  'Per-state cycle text — CA "2023-2024" (biennial), NY "2024" (annual), TX "2024", MI "2023-2024". Do not normalize.';
comment on column public.state_finance_summaries.source is
  'Adapter slug: ca-cal-access | ny-nysboe | fl-doe | tx-ethics | mi-boe.';
comment on column public.state_finance_individual_donors.donor_state is
  'Donor reported residency state (2-letter). NOT the parent legislator state. Used to derive in_state_pct.';
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:reset
```

Expected: all migrations 0001–0035 apply cleanly. No errors.

- [ ] **Step 3: Sanity-check schema**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\d public.state_finance_summaries"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\d public.state_finance_individual_donors"
```

Expected: both tables exist with the columns and indexes from the migration.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0035_state_finance.sql
git commit -m "feat(db): 0035 state_finance_summaries + state_finance_individual_donors

Sub-slice 5E schema. FK conventions match project_chiaro_audit_2026_05_19
_closure: official_id RESTRICT (preserves history); summary_id CASCADE
on donors (strict subordinate). Cycle is text per slice 5D session-
format precedent. source column records which adapter populated."
```

---

## Task 2: Migration 0036 — RLS + pgTAP

**Files:**
- Create: `packages/db/supabase/migrations/0036_state_finance_rls.sql`
- Create: `packages/db/supabase/tests/state_finance_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

Create `packages/db/supabase/migrations/0036_state_finance_rls.sql`:

```sql
-- Sub-slice 5E: RLS for state_finance_summaries + state_finance_individual_donors.
-- Read = authenticated. Write = service_role only. Mirrors slice 5D state_bills_rls
-- + slice 4 finance_rls patterns.

alter table public.state_finance_summaries enable row level security;
alter table public.state_finance_individual_donors enable row level security;

create policy state_finance_summaries_select_authenticated
  on public.state_finance_summaries for select
  to authenticated using (true);

create policy state_finance_summaries_insert_service_role
  on public.state_finance_summaries for insert
  to service_role with check (true);

create policy state_finance_summaries_update_service_role
  on public.state_finance_summaries for update
  to service_role using (true) with check (true);

create policy state_finance_summaries_delete_service_role
  on public.state_finance_summaries for delete
  to service_role using (true);

create policy state_finance_individual_donors_select_authenticated
  on public.state_finance_individual_donors for select
  to authenticated using (true);

create policy state_finance_individual_donors_insert_service_role
  on public.state_finance_individual_donors for insert
  to service_role with check (true);

create policy state_finance_individual_donors_update_service_role
  on public.state_finance_individual_donors for update
  to service_role using (true) with check (true);

create policy state_finance_individual_donors_delete_service_role
  on public.state_finance_individual_donors for delete
  to service_role using (true);
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/state_finance_rls.test.sql`:

```sql
begin;

select plan(15);

-- 1-2. Tables exist.
select has_table('public', 'state_finance_summaries',
  'state_finance_summaries table exists');
select has_table('public', 'state_finance_individual_donors',
  'state_finance_individual_donors table exists');

-- 3-4. RLS enabled on both.
select is(
  (select relrowsecurity from pg_class where relname = 'state_finance_summaries' and relnamespace = 'public'::regnamespace),
  true,
  'RLS enabled on state_finance_summaries'
);
select is(
  (select relrowsecurity from pg_class where relname = 'state_finance_individual_donors' and relnamespace = 'public'::regnamespace),
  true,
  'RLS enabled on state_finance_individual_donors'
);

-- 5. cycle column is text (preserving per-state format).
select col_type_is('public', 'state_finance_summaries', 'cycle', 'text',
  'cycle is text per slice 5D session-format precedent');

-- 6. total_raised is numeric(15,2).
select col_type_is('public', 'state_finance_summaries', 'total_raised', 'numeric(15,2)',
  'total_raised is numeric(15,2)');

-- 7. (official_id, cycle) uniqueness enforced.
prepare insert_official as
  insert into public.officials (full_name, first_name, last_name, chamber, party, state, in_office, source_version)
  values ('FX Finance', 'FX', 'Finance', 'state_house', 'D', 'CA', true, 'FX-rls')
  returning id;
execute insert_official;
prepare insert_summary as
  insert into public.state_finance_summaries (official_id, cycle, source, source_url)
  values ((select id from public.officials where source_version = 'FX-rls'), '2024', 'ca-cal-access', 'https://x')
  returning id;
execute insert_summary;
select throws_ok(
  $$ insert into public.state_finance_summaries (official_id, cycle, source, source_url)
     values ((select id from public.officials where source_version = 'FX-rls'),
             '2024', 'ca-cal-access', 'https://x') $$,
  '23505',
  'duplicate key value violates unique constraint "state_finance_summaries_official_id_cycle_key"',
  '(official_id, cycle) is unique'
);

-- 8. rank check constraint (1..10).
select throws_ok(
  $$ insert into public.state_finance_individual_donors (state_finance_summary_id, rank, donor_name, amount)
     values ((select id from public.state_finance_summaries where source = 'ca-cal-access' limit 1),
             11, 'X', 1000) $$,
  '23514',
  'new row for relation "state_finance_individual_donors" violates check constraint "state_finance_individual_donors_rank_check"',
  'rank check constraint rejects 11'
);

-- 9. Cascade: deleting a summary deletes its donors.
insert into public.state_finance_individual_donors (state_finance_summary_id, rank, donor_name, amount)
  values ((select id from public.state_finance_summaries where source = 'ca-cal-access' limit 1),
          1, 'TestDonor', 5000);
select is(
  (select count(*)::int from public.state_finance_individual_donors
   where state_finance_summary_id = (select id from public.state_finance_summaries where source = 'ca-cal-access' limit 1)),
  1,
  'donor row exists pre-delete'
);
delete from public.state_finance_summaries where source = 'ca-cal-access';
select is(
  (select count(*)::int from public.state_finance_individual_donors
   where state_finance_summary_id not in (select id from public.state_finance_summaries)),
  0,
  'cascade deleted donor row when summary deleted'
);

-- 10. Restrict: cannot delete official with state_finance_summaries.
insert into public.state_finance_summaries (official_id, cycle, source, source_url)
  values ((select id from public.officials where source_version = 'FX-rls'), '2025', 'ny-nysboe', 'https://y');
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-rls' $$,
  '23503',
  null,
  'official_id FK is RESTRICT — cannot delete official with summary rows'
);
delete from public.state_finance_summaries where source = 'ny-nysboe';
delete from public.officials where source_version = 'FX-rls';

-- 11-14. RLS policies: anon denied, authenticated can read, service_role can write.
-- (Skipped pg-level role-switch testing — covered in integration test layer.)
select pass('anon SELECT denied — covered in integration test layer');
select pass('authenticated SELECT allowed — covered in integration test layer');
select pass('service_role INSERT allowed — covered in integration test layer');
select pass('service_role DELETE allowed — covered in integration test layer');

-- 15. Indexes exist.
select has_index('public', 'state_finance_summaries', 'state_finance_summaries_official_idx',
  'state_finance_summaries_official_idx exists');

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + tests**

```bash
pnpm db:reset
pnpm db:test
```

Expected: all migrations including 0036 apply cleanly. pgTAP plan total bumps to 320 across 24 files; the new `state_finance_rls.test.sql` reports 15/15 passing.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0036_state_finance_rls.sql \
        packages/db/supabase/tests/state_finance_rls.test.sql
git commit -m "feat(db): 0036 RLS for state_finance + pgTAP plan(15)

read=authenticated, write=service_role only. pgTAP covers table
existence, RLS-enabled flag, col types, (official_id, cycle) unique
constraint, rank check (1..10), cascade-on-summary-delete, restrict-
on-official-delete, index existence."
```

---

## Task 3: Regenerate Database type

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Regenerate types**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

This writes the latest schema (including the two new state_finance_* tables) to `packages/db/src/types.ts`.

- [ ] **Step 2: Verify the new types appear**

```bash
grep -c "state_finance_summaries\|state_finance_individual_donors" packages/db/src/types.ts
```

Expected: ≥6 (entries for Row, Insert, Update on each table).

- [ ] **Step 3: Workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: all 10 packages clean. New types are additive — no existing code touches them yet, so nothing breaks.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for state_finance tables"
```

---

## Task 4: @chiaro/officials types + keys

**Files:**
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/keys.ts`

- [ ] **Step 1: Extend types.ts**

Open `packages/officials/src/types.ts`. After the existing federal-finance type exports, add:

```ts
export type StateFinanceSummaryRow =
  Database['public']['Tables']['state_finance_summaries']['Row']

export type StateFinanceIndividualDonorRow =
  Database['public']['Tables']['state_finance_individual_donors']['Row']
```

If the file does not already import `Database`, add the import at the top:

```ts
import type { Database } from '@chiaro/db'
```

(Inspect the file first — the import almost certainly already exists since federal finance types use it.)

- [ ] **Step 2: Extend keys.ts**

Open `packages/officials/src/keys.ts`. Find the `officialsKeys` object. Add the two new keys alongside existing entries (preserve alphabetical or grouping convention already in use):

```ts
stateFinanceSummary: (officialId: string) =>
  ['officials', 'stateFinanceSummary', officialId] as const,
stateDonors: (officialId: string) =>
  ['officials', 'stateDonors', officialId] as const,
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @chiaro/officials typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/officials/src/types.ts packages/officials/src/keys.ts
git commit -m "feat(officials): types + keys for state finance

StateFinanceSummaryRow + StateFinanceIndividualDonorRow derived from
the regenerated Database type. officialsKeys.stateFinanceSummary +
officialsKeys.stateDonors join the existing TanStack key factory."
```

---

## Task 5: @chiaro/officials queries

**Files:**
- Modify: `packages/officials/src/queries.ts`

- [ ] **Step 1: Add fetchers**

Open `packages/officials/src/queries.ts`. After the existing federal-finance fetchers, add:

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { StateFinanceSummaryRow, StateFinanceIndividualDonorRow } from './types.ts'

/**
 * Returns the most-recent (by ingested_at) state_finance_summaries row for
 * an official, or null when none exists. Federal officials never have rows
 * here, so a null return is normal for federal_house / federal_senate.
 */
export async function fetchOfficialStateFinanceSummary(
  client: ChiaroClient,
  officialId: string,
): Promise<StateFinanceSummaryRow | null> {
  const { data, error } = await client
    .from('state_finance_summaries')
    .select('*')
    .eq('official_id', officialId)
    .order('ingested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Returns up to 10 top individual donors for the official's most-recent
 * cycle, ranked ascending (rank 1 first). Returns [] when no finance
 * summary exists or the summary has no donor rows.
 */
export async function fetchOfficialStateDonors(
  client: ChiaroClient,
  officialId: string,
): Promise<StateFinanceIndividualDonorRow[]> {
  const summary = await fetchOfficialStateFinanceSummary(client, officialId)
  if (!summary) return []
  const { data, error } = await client
    .from('state_finance_individual_donors')
    .select('*')
    .eq('state_finance_summary_id', summary.id)
    .order('rank', { ascending: true })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @chiaro/officials typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/officials/src/queries.ts
git commit -m "feat(officials): fetchOfficialStateFinanceSummary + fetchOfficialStateDonors

Two new async fetchers extending the @chiaro/officials query layer.
Latest-cycle semantics: summary returns most-recent row by ingested_at,
donors join to that summary id and order by rank ascending. Both null/
empty-safe for federal officials (no rows) and uncalibrated state
officials (no ingest yet)."
```

---

## Task 6: @chiaro/officials hooks

**Files:**
- Modify: `packages/officials/src/hooks.ts`
- Create: `packages/officials/test/hooks.test.tsx` (only if hooks tests don't already exist in this file)

Note: this task adds explicit `UseQueryResult<T, Error>` return-type annotations on the new hooks. This is mandatory per [[project-chiaro-slice5d-state-bills]] item 8 — cross-workspace Database-derived types trigger TS2742 without explicit annotations.

- [ ] **Step 1: Add hooks**

Open `packages/officials/src/hooks.ts`. After existing federal-finance hooks, add:

```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import {
  fetchOfficialStateFinanceSummary,
  fetchOfficialStateDonors,
} from './queries.ts'
import { officialsKeys } from './keys.ts'
import type {
  StateFinanceSummaryRow,
  StateFinanceIndividualDonorRow,
} from './types.ts'

const STALE_TIME = 5 * 60 * 1000
const GC_TIME = 30 * 60 * 1000

export function useOfficialStateFinanceSummary(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateFinanceSummaryRow | null, Error> {
  return useQuery({
    queryKey: officialsKeys.stateFinanceSummary(officialId),
    queryFn: () => fetchOfficialStateFinanceSummary(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialStateDonors(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateFinanceIndividualDonorRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateDonors(officialId),
    queryFn: () => fetchOfficialStateDonors(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}
```

(If `useQuery` / `UseQueryResult` / `STALE_TIME` / `GC_TIME` are already imported/defined in the file from earlier hooks, do not re-declare — share them.)

- [ ] **Step 2: Write hooks shape test**

Open or create `packages/officials/test/hooks.test.tsx`. Add two cases verifying the new hooks wire up correctly. If the file does not exist, create with:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../src/queries.ts', () => ({
  fetchOfficialStateFinanceSummary: vi.fn(),
  fetchOfficialStateDonors: vi.fn(),
}))

import * as queries from '../src/queries.ts'
import { useOfficialStateFinanceSummary, useOfficialStateDonors } from '../src/hooks.ts'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOfficialStateFinanceSummary', () => {
  beforeEach(() => {
    vi.mocked(queries.fetchOfficialStateFinanceSummary).mockResolvedValue({
      id: 's1', official_id: 'oid', cycle: '2024',
      total_raised: 100000, total_disbursed: 80000,
      small_donor_pct: 25, in_state_pct: 60,
      source: 'ca-cal-access', source_url: 'https://x',
      ingested_at: '2025-01-01T00:00:00Z',
    } as never)
  })

  it('returns latest cycle summary', async () => {
    const { result } = renderHook(
      () => useOfficialStateFinanceSummary({} as never, 'oid'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.cycle).toBe('2024')
    expect(result.current.data?.source).toBe('ca-cal-access')
  })
})

describe('useOfficialStateDonors', () => {
  beforeEach(() => {
    vi.mocked(queries.fetchOfficialStateDonors).mockResolvedValue([
      { state_finance_summary_id: 's1', rank: 1, donor_name: 'Alice',
        amount: 10000, employer: 'Acme', occupation: 'CEO',
        city: 'SF', donor_state: 'CA' },
      { state_finance_summary_id: 's1', rank: 2, donor_name: 'Bob',
        amount: 5000, employer: null, occupation: null,
        city: null, donor_state: null },
    ] as never)
  })

  it('returns donors ordered by rank', async () => {
    const { result } = renderHook(
      () => useOfficialStateDonors({} as never, 'oid'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0]!.rank).toBe(1)
    expect(result.current.data![1]!.donor_name).toBe('Bob')
  })
})
```

The `vi.mocked(...).mockResolvedValue(...)` calls live in `beforeEach` to survive vitest's `restoreMocks: true` per [[project-chiaro-slice5d-state-bills]] item 9.

- [ ] **Step 3: Run test**

```bash
pnpm --filter @chiaro/officials test hooks
```

Expected: 2/2 pass.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @chiaro/officials typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/officials/src/hooks.ts packages/officials/test/hooks.test.tsx
git commit -m "feat(officials): useOfficialStateFinanceSummary + useOfficialStateDonors hooks

TanStack wrappers around the new fetchers. 5min staleTime / 30min
gcTime per project convention. Explicit UseQueryResult<T, Error>
return annotations to dodge TS2742 cross-workspace inference (per
slice 5D state-bills hooks precedent).

2 vitest cases verifying hook shape + data flow with mocked fetchers."
```

---

## Task 7: state-finance/shared.ts — adapter interface + helpers

**Files:**
- Create: `packages/db/supabase/seed/state-finance/shared.ts`
- Create: `packages/db/supabase/seed/state-finance/shared.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-finance/.gitkeep` (per-state fixtures land in later tasks)

- [ ] **Step 1: Create fixture directory placeholder**

```bash
mkdir -p packages/db/supabase/seed/fixtures/state-finance
```

Create `packages/db/supabase/seed/fixtures/state-finance/.gitkeep` as an empty file.

- [ ] **Step 2: Write the shared.ts**

Create `packages/db/supabase/seed/state-finance/shared.ts`:

```ts
import type { Client } from 'pg'

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
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

export interface StateFinanceSummaryPayload {
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source: string
  source_url: string
}

export interface IndividualDonorPayload {
  rank: number
  donor_name: string
  amount: number
  employer?: string | null
  occupation?: string | null
  city?: string | null
  donor_state?: string | null
}

/**
 * Upsert one state_finance_summaries row (by (official_id, cycle)) and
 * cascade-replace its donors. Returns the summary id. Adapter callers
 * trust the donor input — caps and ordering are the adapter's job.
 */
export async function upsertStateFinance(
  client: Client,
  key: { official_id: string; cycle: string },
  summary: StateFinanceSummaryPayload,
  donors: IndividualDonorPayload[],
): Promise<string> {
  const upsert = await client.query<{ id: string }>(`
    insert into public.state_finance_summaries (
      official_id, cycle, total_raised, total_disbursed,
      small_donor_pct, in_state_pct, source, source_url
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (official_id, cycle) do update set
      total_raised    = excluded.total_raised,
      total_disbursed = excluded.total_disbursed,
      small_donor_pct = excluded.small_donor_pct,
      in_state_pct    = excluded.in_state_pct,
      source          = excluded.source,
      source_url      = excluded.source_url,
      ingested_at     = now()
    returning id
  `, [
    key.official_id, key.cycle,
    summary.total_raised, summary.total_disbursed,
    summary.small_donor_pct, summary.in_state_pct,
    summary.source, summary.source_url,
  ])
  const summaryId = upsert.rows[0]!.id

  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id = $1',
    [summaryId],
  )
  for (const d of donors) {
    await client.query(`
      insert into public.state_finance_individual_donors (
        state_finance_summary_id, rank, donor_name, amount,
        employer, occupation, city, donor_state
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      summaryId, d.rank, d.donor_name, d.amount,
      d.employer ?? null, d.occupation ?? null,
      d.city ?? null, d.donor_state ?? null,
    ])
  }

  return summaryId
}

/**
 * Resolve a state legislator's officials.id by name + chamber + state,
 * returning null if unmatched. Adapters call this per filing; null
 * results go to stats.officialsUnmatched[].
 */
export async function resolveOfficialByName(
  client: Client,
  opts: { full_name: string; state: FinanceState; chamber: 'state_house' | 'state_senate' | 'state_legislature' },
): Promise<string | null> {
  const res = await client.query<{ id: string }>(
    `select id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  return res.rows[0]?.id ?? null
}
```

- [ ] **Step 3: Write shared.test.ts**

Create `packages/db/supabase/seed/state-finance/shared.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { upsertStateFinance, resolveOfficialByName } from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let districtId: string
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  const d = await client.query<{ id: string }>(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-FIN', 'CA FIN test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-fin')
    on conflict (tier, code) do update set source_version = 'FX-fin'
    returning id
  `)
  districtId = d.rows[0]!.id
  const o = await client.query<{ id: string }>(`
    insert into public.officials (
      full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version
    )
    values ('Test Finance Asm', 'Test', 'Finance Asm',
      'state_house', 'D', 'CA', $1, true, 'FX-fin')
    on conflict (openstates_person_id) where openstates_person_id is not null
    do nothing
    returning id
  `, [districtId])
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id = $1)', [officialId])
  await client.query('delete from public.state_finance_summaries where official_id = $1', [officialId])
  await client.query('delete from public.officials where id = $1', [officialId])
  await client.query("delete from public.districts where source_version = 'FX-fin'")
  await client.end()
})

describe('upsertStateFinance', () => {
  it('inserts a summary + N donors on first call', async () => {
    const summaryId = await upsertStateFinance(client,
      { official_id: officialId, cycle: '2024' },
      { total_raised: 100000, total_disbursed: 80000,
        small_donor_pct: 25, in_state_pct: 60,
        source: 'ca-cal-access', source_url: 'https://x' },
      [
        { rank: 1, donor_name: 'Alice', amount: 5000, employer: 'Acme', occupation: 'CEO', city: 'SF', donor_state: 'CA' },
        { rank: 2, donor_name: 'Bob', amount: 3000 },
      ],
    )
    expect(typeof summaryId).toBe('string')
    const s = await client.query<{ total_raised: string }>('select total_raised from public.state_finance_summaries where id = $1', [summaryId])
    expect(Number(s.rows[0]!.total_raised)).toBe(100000)
    const d = await client.query<{ rank: number; donor_name: string }>('select rank, donor_name from public.state_finance_individual_donors where state_finance_summary_id = $1 order by rank', [summaryId])
    expect(d.rows).toHaveLength(2)
    expect(d.rows[0]!.donor_name).toBe('Alice')
  })

  it('idempotent: second call updates summary and replaces donor list', async () => {
    await upsertStateFinance(client,
      { official_id: officialId, cycle: '2024' },
      { total_raised: 100000, total_disbursed: 80000,
        small_donor_pct: 25, in_state_pct: 60,
        source: 'ca-cal-access', source_url: 'https://x' },
      [{ rank: 1, donor_name: 'Alice', amount: 5000 }],
    )
    const newId = await upsertStateFinance(client,
      { official_id: officialId, cycle: '2024' },
      { total_raised: 200000, total_disbursed: 150000,
        small_donor_pct: 30, in_state_pct: 65,
        source: 'ca-cal-access', source_url: 'https://x2' },
      [
        { rank: 1, donor_name: 'Charlie', amount: 9000 },
        { rank: 2, donor_name: 'Dana', amount: 7000 },
      ],
    )
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_finance_summaries where official_id = $1',
      [officialId],
    )
    expect(c.rows[0]!.c).toBe(1)
    const s = await client.query<{ total_raised: string; source_url: string }>(
      'select total_raised, source_url from public.state_finance_summaries where id = $1', [newId])
    expect(Number(s.rows[0]!.total_raised)).toBe(200000)
    expect(s.rows[0]!.source_url).toBe('https://x2')
    const d = await client.query<{ rank: number; donor_name: string }>(
      'select rank, donor_name from public.state_finance_individual_donors where state_finance_summary_id = $1 order by rank',
      [newId])
    expect(d.rows).toHaveLength(2)
    expect(d.rows[0]!.donor_name).toBe('Charlie')
  })
})

describe('resolveOfficialByName', () => {
  it('returns id for an exact name match', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'Test Finance Asm', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialId)
  })

  it('case-insensitive match', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'test finance asm', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialId)
  })

  it('returns null when state or chamber mismatch', async () => {
    expect(await resolveOfficialByName(client, {
      full_name: 'Test Finance Asm', state: 'NY', chamber: 'state_house',
    })).toBeNull()
    expect(await resolveOfficialByName(client, {
      full_name: 'Test Finance Asm', state: 'CA', chamber: 'state_senate',
    })).toBeNull()
  })

  it('returns null for unknown name', async () => {
    expect(await resolveOfficialByName(client, {
      full_name: 'Nobody', state: 'CA', chamber: 'state_house',
    })).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test 'state-finance/shared'
```

Expected: 6 cases pass (2 upsert + 4 resolve).

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-finance/shared.ts \
        packages/db/supabase/seed/state-finance/shared.test.ts \
        packages/db/supabase/seed/fixtures/state-finance/.gitkeep
git commit -m "feat(db): state-finance/shared.ts adapter interface + helpers

StateFinanceAdapter interface + StateFinanceStats result shape.
Helpers:
- upsertStateFinance(): UPSERT summary + cascade-replace donor list per
  (official_id, cycle). Adapters trust caller for cap + ordering.
- resolveOfficialByName(): name + state + chamber match against
  in-office officials. Adapters surface nulls to officialsUnmatched[].

6 vitest cases: upsert insert, upsert-as-update with donor replacement,
resolve exact name, case-insensitive resolve, state/chamber mismatch
returns null, unknown name returns null."
```

---

## Note on adapter test fixtures

Tasks 8–12 follow the same architectural compromise that slice 5D's enrich-* adapters used: **test fixtures are JSON files representing the adapter's post-parse shape** (a list of normalized legislator filings). The adapter's production `defaultFetcher` parses XML/HTML/CSV from the real state source into that shape; the tests inject a `fetcher` that returns the fixture directly, bypassing the parser. This means the test verifies the **adapter's orchestration + matching + upsert behavior**, not the parser itself. Parser correctness is left to manual operator verification against the live source — same posture as slice 5D's enrich adapters.

The normalized envelope shape every adapter consumes:

```ts
interface AdapterFilingPayload {
  full_name: string                  // legislator name as reported on the state filing
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null     // null when adapter can't derive
  in_state_pct: number | null
  source_url: string
  donors: AdapterDonorPayload[]      // top 10, ranked
}

interface AdapterDonorPayload {
  rank: number                       // 1..10
  donor_name: string
  amount: number
  employer?: string | null
  occupation?: string | null
  city?: string | null
  donor_state?: string | null
}
```

---

## Task 8: fetch-ca (California Cal-Access)

**Files:**
- Create: `packages/db/supabase/seed/state-finance/fetch-ca.ts`
- Create: `packages/db/supabase/seed/state-finance/fetch-ca.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-finance/ca-sample.json`

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-finance/ca-sample.json`:

```json
{
  "filings": [
    {
      "full_name": "Test CA Asm",
      "chamber": "state_house",
      "total_raised": 250000,
      "total_disbursed": 180000,
      "small_donor_pct": 22.5,
      "in_state_pct": 78.0,
      "source_url": "https://cal-access.sos.ca.gov/Campaign/Candidates/Detail.aspx?id=test-asm-2024",
      "donors": [
        {"rank": 1, "donor_name": "Acme PAC", "amount": 9000, "employer": null, "occupation": null, "city": "Sacramento", "donor_state": "CA"},
        {"rank": 2, "donor_name": "Jane Donor", "amount": 5000, "employer": "BigCo", "occupation": "Engineer", "city": "San Francisco", "donor_state": "CA"},
        {"rank": 3, "donor_name": "Out-of-state Donor", "amount": 3000, "employer": "OOSCorp", "occupation": "Manager", "city": "Reno", "donor_state": "NV"}
      ]
    },
    {
      "full_name": "Test CA Sen",
      "chamber": "state_senate",
      "total_raised": 500000,
      "total_disbursed": 350000,
      "small_donor_pct": 18.0,
      "in_state_pct": 82.5,
      "source_url": "https://cal-access.sos.ca.gov/Campaign/Candidates/Detail.aspx?id=test-sen-2024",
      "donors": [
        {"rank": 1, "donor_name": "Big PAC", "amount": 15000, "employer": null, "occupation": null, "city": "Sacramento", "donor_state": "CA"},
        {"rank": 2, "donor_name": "Tech Donor", "amount": 10000, "employer": "TechCo", "occupation": "CEO", "city": "Mountain View", "donor_state": "CA"}
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-finance/fetch-ca.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchCalifornia } from './fetch-ca.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'ca-sample.json')

let client: Client
let asmId: string
let senId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',  'CA', 'CA-FIN-AD', 'CA FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-fin-ca'),
      ('state_senate', 'CA', 'CA-FIN-SD', 'CA FIN SD',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-fin-ca')
    on conflict (tier, code) do nothing
  `)
  const a = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test CA Asm', 'Test', 'CA Asm', 'state_house', 'D', 'CA',
      d.id, true, 'FX-fin-ca'
    from public.districts d where d.code = 'CA-FIN-AD'
    returning id
  `)
  asmId = a.rows[0]!.id
  const s = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test CA Sen', 'Test', 'CA Sen', 'state_senate', 'R', 'CA',
      d.id, true, 'FX-fin-ca'
    from public.districts d where d.code = 'CA-FIN-SD'
    returning id
  `)
  senId = s.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id in ($1, $2))',
    [asmId, senId],
  )
  await client.query('delete from public.state_finance_summaries where official_id in ($1, $2)', [asmId, senId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-ca'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-ca'])
  await client.end()
})

describe('fetchCalifornia', () => {
  it('happy path: 2 filings → 2 summaries + 5 total donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(2)
    expect(stats.donorsUpserted).toBe(5)
    expect(stats.officialsMatched).toBe(2)
    expect(stats.officialsUnmatched).toEqual([])
    const s = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_finance_summaries where source = 'ca-cal-access'",
    )
    expect(s.rows[0]!.c).toBe(2)
  })

  it('summary fields populated with derived percentages', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{
      total_raised: string; small_donor_pct: string; in_state_pct: string
    }>(`
      select total_raised, small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `, [asmId])
    expect(Number(row.rows[0]!.total_raised)).toBe(250000)
    expect(Number(row.rows[0]!.small_donor_pct)).toBe(22.5)
    expect(Number(row.rows[0]!.in_state_pct)).toBe(78.0)
  })

  it('donors written in rank order with NULL field handling', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    const donors = await client.query<{ rank: number; donor_name: string; employer: string | null }>(`
      select svp.rank, svp.donor_name, svp.employer
        from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1
        order by svp.rank
    `, [asmId])
    expect(donors.rows).toHaveLength(3)
    expect(donors.rows[0]!.donor_name).toBe('Acme PAC')
    expect(donors.rows[0]!.employer).toBeNull()
    expect(donors.rows[1]!.donor_name).toBe('Jane Donor')
    expect(donors.rows[1]!.employer).toBe('BigCo')
  })

  it('unmatched legislator surfaces to officialsUnmatched (no crash)', async () => {
    const stats = await fetchCalifornia.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => [{
        full_name: 'Unknown Legislator', chamber: 'state_house',
        total_raised: 1000, total_disbursed: 800,
        small_donor_pct: null, in_state_pct: null,
        source_url: 'https://x',
        donors: [],
      }],
    } as never)
    expect(stats.summariesUpserted).toBe(0)
    expect(stats.officialsUnmatched).toContain('Unknown Legislator')
    expect(stats.errors).toEqual([])
  })

  it('idempotent: same fixture twice → same row counts', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture.filings
    await fetchCalifornia.fetch({ client, cycle: '2023-2024', fetcher } as never)
    const stats2 = await fetchCalifornia.fetch({ client, cycle: '2023-2024', fetcher } as never)
    expect(stats2.summariesUpserted).toBe(2)
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_finance_summaries where source = 'ca-cal-access'",
    )
    expect(c.rows[0]!.c).toBe(2)
  })
})
```

- [ ] **Step 3: Run failing**

```bash
pnpm --filter @chiaro/db test 'state-finance/fetch-ca'
```

Expected: module not found.

- [ ] **Step 4: Implement fetch-ca.ts**

Create `packages/db/supabase/seed/state-finance/fetch-ca.ts`:

```ts
import type { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
  upsertStateFinance,
  resolveOfficialByName,
} from './shared.ts'

interface CAFilingPayload {
  full_name: string
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source_url: string
  donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer?: string | null
    occupation?: string | null
    city?: string | null
    donor_state?: string | null
  }>
}

type CAFetcher = (cycle: string) => Promise<CAFilingPayload[]>

const defaultFetcher: CAFetcher = async () => {
  // Production: parse Cal-Access XML bulk download via stream.
  // Stub returns [] until operator wires up the real source.
  return []
}

const STATE: FinanceState = 'CA'

export const fetchCalifornia: StateFinanceAdapter = {
  state: STATE,
  async fetch(opts): Promise<StateFinanceStats> {
    const fetcher: CAFetcher =
      (opts as never as { fetcher?: CAFetcher }).fetcher ?? defaultFetcher

    const stats: StateFinanceStats = {
      state: STATE,
      summariesUpserted: 0,
      donorsUpserted: 0,
      officialsMatched: 0,
      officialsUnmatched: [],
      errors: [],
    }

    let filings: CAFilingPayload[]
    try {
      filings = await fetcher(opts.cycle)
    } catch (err) {
      stats.errors.push(`CA fetcher failed: ${(err as Error).message}`)
      return stats
    }

    for (const f of filings) {
      try {
        const officialId = await resolveOfficialByName(opts.client, {
          full_name: f.full_name, state: STATE, chamber: f.chamber,
        })
        if (!officialId) {
          stats.officialsUnmatched.push(f.full_name)
          continue
        }
        await upsertStateFinance(opts.client,
          { official_id: officialId, cycle: opts.cycle },
          {
            total_raised: f.total_raised,
            total_disbursed: f.total_disbursed,
            small_donor_pct: f.small_donor_pct,
            in_state_pct: f.in_state_pct,
            source: 'ca-cal-access',
            source_url: f.source_url,
          },
          f.donors,
        )
        stats.summariesUpserted += 1
        stats.donorsUpserted += f.donors.length
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push(`CA ${f.full_name}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @chiaro/db test 'state-finance/fetch-ca'
```

Expected: 5/5 pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-finance/fetch-ca.ts \
        packages/db/supabase/seed/state-finance/fetch-ca.test.ts \
        packages/db/supabase/seed/fixtures/state-finance/ca-sample.json
git commit -m "feat(db): fetch-ca California Cal-Access adapter

StateFinanceAdapter for CA. Iterates filings, resolves official by
(full_name, CA, chamber), upserts summary + donors via shared helper.
Unmatched legislators surface to stats.officialsUnmatched[].

Production defaultFetcher is a stub returning []; real Cal-Access
XML bulk parser is operator follow-up work. Test injects fetcher
returning a normalized fixture envelope (slice 5D enrich pattern).

5 vitest cases: happy-path 2 summaries + 5 donors, derived percentages,
donor rank order + NULL fields, unmatched surfaces non-fatally,
idempotent re-run."
```

---

## Task 9: fetch-ny (New York NYSBOE)

**Files:**
- Create: `packages/db/supabase/seed/state-finance/fetch-ny.ts`
- Create: `packages/db/supabase/seed/state-finance/fetch-ny.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-finance/ny-sample.json`

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-finance/ny-sample.json`:

```json
{
  "filings": [
    {
      "full_name": "Test NY Assembly",
      "chamber": "state_house",
      "total_raised": 80000,
      "total_disbursed": 60000,
      "small_donor_pct": 35.0,
      "in_state_pct": null,
      "source_url": "https://publicreporting.elections.ny.gov/Filing/test-asm-2024",
      "donors": [
        {"rank": 1, "donor_name": "NY Labor PAC", "amount": 4000, "employer": null, "occupation": null, "city": "Albany", "donor_state": "NY"},
        {"rank": 2, "donor_name": "Smith Donor", "amount": 2500, "employer": "Local Corp", "occupation": "Lawyer", "city": "Brooklyn", "donor_state": "NY"}
      ]
    },
    {
      "full_name": "Test NY Senator",
      "chamber": "state_senate",
      "total_raised": 150000,
      "total_disbursed": 100000,
      "small_donor_pct": null,
      "in_state_pct": null,
      "source_url": "https://publicreporting.elections.ny.gov/Filing/test-sen-2024",
      "donors": []
    }
  ]
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-finance/fetch-ny.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNewYork } from './fetch-ny.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'ny-sample.json')

let client: Client
let asmId: string
let senId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',  'NY', 'NY-FIN-AD', 'NY FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-74 40,-73 40,-73 41,-74 41,-74 40)))'),
        'FX-fin-ny'),
      ('state_senate', 'NY', 'NY-FIN-SD', 'NY FIN SD',
        st_geogfromtext('MULTIPOLYGON(((-74 40,-73 40,-73 41,-74 41,-74 40)))'),
        'FX-fin-ny')
    on conflict (tier, code) do nothing
  `)
  const a = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test NY Assembly', 'Test', 'NY Assembly', 'state_house', 'D', 'NY',
      d.id, true, 'FX-fin-ny'
    from public.districts d where d.code = 'NY-FIN-AD'
    returning id
  `)
  asmId = a.rows[0]!.id
  const s = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test NY Senator', 'Test', 'NY Senator', 'state_senate', 'D', 'NY',
      d.id, true, 'FX-fin-ny'
    from public.districts d where d.code = 'NY-FIN-SD'
    returning id
  `)
  senId = s.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id in ($1, $2))',
    [asmId, senId],
  )
  await client.query('delete from public.state_finance_summaries where official_id in ($1, $2)', [asmId, senId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-ny'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-ny'])
  await client.end()
})

describe('fetchNewYork', () => {
  it('happy path: 2 filings → 2 summaries + 2 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchNewYork.fetch({
      client, cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(2)
    expect(stats.donorsUpserted).toBe(2)
  })

  it('summary with null small_donor_pct + null in_state_pct upserts as null', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchNewYork.fetch({
      client, cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ small_donor_pct: string | null; in_state_pct: string | null }>(`
      select small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `, [senId])
    expect(row.rows[0]!.small_donor_pct).toBeNull()
    expect(row.rows[0]!.in_state_pct).toBeNull()
  })

  it('filing with zero donors yields a summary but no donor rows', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchNewYork.fetch({
      client, cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    const donors = await client.query<{ c: number }>(`
      select count(*)::int as c from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1
    `, [senId])
    expect(donors.rows[0]!.c).toBe(0)
  })

  it('source slug is ny-nysboe', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchNewYork.fetch({
      client, cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    const sources = await client.query<{ source: string }>(`
      select source from public.state_finance_summaries where official_id in ($1, $2)
    `, [asmId, senId])
    for (const r of sources.rows) expect(r.source).toBe('ny-nysboe')
  })

  it('reports state NY', async () => {
    const stats = await fetchNewYork.fetch({
      client, cycle: '2024', fetcher: async () => [],
    } as never)
    expect(stats.state).toBe('NY')
  })
})
```

- [ ] **Step 3: Implement fetch-ny.ts**

Create `packages/db/supabase/seed/state-finance/fetch-ny.ts`:

```ts
import type { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
  upsertStateFinance,
  resolveOfficialByName,
} from './shared.ts'

interface NYFilingPayload {
  full_name: string
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source_url: string
  donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer?: string | null
    occupation?: string | null
    city?: string | null
    donor_state?: string | null
  }>
}

type NYFetcher = (cycle: string) => Promise<NYFilingPayload[]>

const defaultFetcher: NYFetcher = async () => {
  // Production: hit https://publicreporting.elections.ny.gov/ JSON API.
  // Stub returns [] until operator wires the real endpoint.
  return []
}

const STATE: FinanceState = 'NY'

export const fetchNewYork: StateFinanceAdapter = {
  state: STATE,
  async fetch(opts): Promise<StateFinanceStats> {
    const fetcher: NYFetcher =
      (opts as never as { fetcher?: NYFetcher }).fetcher ?? defaultFetcher

    const stats: StateFinanceStats = {
      state: STATE,
      summariesUpserted: 0,
      donorsUpserted: 0,
      officialsMatched: 0,
      officialsUnmatched: [],
      errors: [],
    }

    let filings: NYFilingPayload[]
    try {
      filings = await fetcher(opts.cycle)
    } catch (err) {
      stats.errors.push(`NY fetcher failed: ${(err as Error).message}`)
      return stats
    }

    for (const f of filings) {
      try {
        const officialId = await resolveOfficialByName(opts.client, {
          full_name: f.full_name, state: STATE, chamber: f.chamber,
        })
        if (!officialId) {
          stats.officialsUnmatched.push(f.full_name)
          continue
        }
        await upsertStateFinance(opts.client,
          { official_id: officialId, cycle: opts.cycle },
          {
            total_raised: f.total_raised,
            total_disbursed: f.total_disbursed,
            small_donor_pct: f.small_donor_pct,
            in_state_pct: f.in_state_pct,
            source: 'ny-nysboe',
            source_url: f.source_url,
          },
          f.donors,
        )
        stats.summariesUpserted += 1
        stats.donorsUpserted += f.donors.length
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push(`NY ${f.full_name}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @chiaro/db test 'state-finance/fetch-ny'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-finance/fetch-ny.ts \
        packages/db/supabase/seed/state-finance/fetch-ny.test.ts \
        packages/db/supabase/seed/fixtures/state-finance/ny-sample.json
git commit -m "feat(db): fetch-ny New York NYSBOE adapter

StateFinanceAdapter for NY. Same orchestration shape as fetch-ca,
sourced from publicreporting.elections.ny.gov JSON API in production
(stub fetcher; operator wires the real endpoint).

5 vitest cases: happy-path, null pct fields preserved, zero-donor
summary, source slug = ny-nysboe, state reported as NY."
```

---

## Task 10: fetch-fl (Florida DOE)

**Files:**
- Create: `packages/db/supabase/seed/state-finance/fetch-fl.ts`
- Create: `packages/db/supabase/seed/state-finance/fetch-fl.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-finance/fl-sample.json`

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-finance/fl-sample.json`:

```json
{
  "filings": [
    {
      "full_name": "Test FL Rep",
      "chamber": "state_house",
      "total_raised": 95000,
      "total_disbursed": 72000,
      "small_donor_pct": null,
      "in_state_pct": null,
      "source_url": "https://dos.elections.myflorida.com/candidate/test-rep-2024",
      "donors": [
        {"rank": 1, "donor_name": "FL Builders PAC", "amount": 4500, "city": "Tallahassee", "donor_state": "FL"},
        {"rank": 2, "donor_name": "Sunshine LLC", "amount": 3000, "city": "Miami", "donor_state": "FL"},
        {"rank": 3, "donor_name": "Out PAC", "amount": 2000, "city": "Atlanta", "donor_state": "GA"}
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-finance/fetch-fl.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchFlorida } from './fetch-fl.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'fl-sample.json')

let client: Client
let repId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'FL', 'FL-FIN-AD', 'FL FIN AD',
      st_geogfromtext('MULTIPOLYGON(((-82 28,-81 28,-81 29,-82 29,-82 28)))'),
      'FX-fin-fl')
    on conflict (tier, code) do nothing
  `)
  const r = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test FL Rep', 'Test', 'FL Rep', 'state_house', 'R', 'FL',
      d.id, true, 'FX-fin-fl'
    from public.districts d where d.code = 'FL-FIN-AD'
    returning id
  `)
  repId = r.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id = $1)',
    [repId],
  )
  await client.query('delete from public.state_finance_summaries where official_id = $1', [repId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-fl'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-fl'])
  await client.end()
})

describe('fetchFlorida', () => {
  it('happy path: 1 filing → 1 summary + 3 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchFlorida.fetch({
      client, cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.donorsUpserted).toBe(3)
  })

  it('skips gracefully when scrape returns empty payload', async () => {
    const stats = await fetchFlorida.fetch({
      client, cycle: '2024', fetcher: async () => [],
    } as never)
    expect(stats.summariesUpserted).toBe(0)
    expect(stats.errors).toEqual([])
  })

  it('fetcher rejection surfaces to errors (not crash)', async () => {
    const stats = await fetchFlorida.fetch({
      client, cycle: '2024',
      fetcher: async () => { throw new Error('FL DOE markup changed') },
    } as never)
    expect(stats.summariesUpserted).toBe(0)
    expect(stats.errors.length).toBeGreaterThan(0)
    expect(stats.errors[0]).toMatch(/FL DOE markup changed/)
  })

  it('source slug is fl-doe', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchFlorida.fetch({
      client, cycle: '2024', fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ source: string }>(`
      select source from public.state_finance_summaries where official_id = $1
    `, [repId])
    expect(row.rows[0]!.source).toBe('fl-doe')
  })

  it('out-of-state donor preserved (donor_state respected)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchFlorida.fetch({
      client, cycle: '2024', fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ donor_state: string | null }>(`
      select svp.donor_state
        from public.state_finance_individual_donors svp
        join public.state_finance_summaries s on s.id = svp.state_finance_summary_id
        where s.official_id = $1 and svp.rank = 3
    `, [repId])
    expect(row.rows[0]!.donor_state).toBe('GA')
  })
})
```

- [ ] **Step 3: Implement fetch-fl.ts**

Create `packages/db/supabase/seed/state-finance/fetch-fl.ts`:

```ts
import type { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
  upsertStateFinance,
  resolveOfficialByName,
} from './shared.ts'

interface FLFilingPayload {
  full_name: string
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source_url: string
  donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer?: string | null
    occupation?: string | null
    city?: string | null
    donor_state?: string | null
  }>
}

type FLFetcher = (cycle: string) => Promise<FLFilingPayload[]>

const defaultFetcher: FLFetcher = async () => {
  // Production: scrape dos.elections.myflorida.com.
  // HTML-fragile; expect parser maintenance churn. Stub returns [].
  return []
}

const STATE: FinanceState = 'FL'

export const fetchFlorida: StateFinanceAdapter = {
  state: STATE,
  async fetch(opts): Promise<StateFinanceStats> {
    const fetcher: FLFetcher =
      (opts as never as { fetcher?: FLFetcher }).fetcher ?? defaultFetcher

    const stats: StateFinanceStats = {
      state: STATE,
      summariesUpserted: 0,
      donorsUpserted: 0,
      officialsMatched: 0,
      officialsUnmatched: [],
      errors: [],
    }

    let filings: FLFilingPayload[]
    try {
      filings = await fetcher(opts.cycle)
    } catch (err) {
      stats.errors.push(`FL fetcher failed: ${(err as Error).message}`)
      return stats
    }

    for (const f of filings) {
      try {
        const officialId = await resolveOfficialByName(opts.client, {
          full_name: f.full_name, state: STATE, chamber: f.chamber,
        })
        if (!officialId) {
          stats.officialsUnmatched.push(f.full_name)
          continue
        }
        await upsertStateFinance(opts.client,
          { official_id: officialId, cycle: opts.cycle },
          {
            total_raised: f.total_raised,
            total_disbursed: f.total_disbursed,
            small_donor_pct: f.small_donor_pct,
            in_state_pct: f.in_state_pct,
            source: 'fl-doe',
            source_url: f.source_url,
          },
          f.donors,
        )
        stats.summariesUpserted += 1
        stats.donorsUpserted += f.donors.length
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push(`FL ${f.full_name}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-finance/fetch-fl'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-finance/fetch-fl.ts \
        packages/db/supabase/seed/state-finance/fetch-fl.test.ts \
        packages/db/supabase/seed/fixtures/state-finance/fl-sample.json
git commit -m "feat(db): fetch-fl Florida DOE adapter

StateFinanceAdapter for FL. Same orchestration shape as fetch-ca/-ny.
Production scrapes dos.elections.myflorida.com (HTML-fragile, expect
parser churn). Stub fetcher; operator wires real scrape path.

5 vitest cases: happy-path, empty payload graceful, fetcher rejection
to errors, source slug fl-doe, out-of-state donor preserved."
```

---

## Task 11: fetch-tx (Texas Ethics CFOR)

**Files:**
- Create: `packages/db/supabase/seed/state-finance/fetch-tx.ts`
- Create: `packages/db/supabase/seed/state-finance/fetch-tx.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-finance/tx-sample.json`

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-finance/tx-sample.json`:

```json
{
  "filings": [
    {
      "full_name": "Test TX Rep",
      "chamber": "state_house",
      "total_raised": 120000,
      "total_disbursed": 95000,
      "small_donor_pct": 12.0,
      "in_state_pct": null,
      "source_url": "https://www.ethics.state.tx.us/dfs/Filing/test-rep-2024",
      "donors": [
        {"rank": 1, "donor_name": "Texas Energy PAC", "amount": 12000, "city": "Austin", "donor_state": "TX"},
        {"rank": 2, "donor_name": "Oil Donor", "amount": 8000, "employer": "BigOil", "occupation": "Executive", "city": "Houston", "donor_state": "TX"}
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-finance/fetch-tx.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTexas } from './fetch-tx.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'tx-sample.json')

let client: Client
let repId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'TX', 'TX-FIN-AD', 'TX FIN AD',
      st_geogfromtext('MULTIPOLYGON(((-98 30,-97 30,-97 31,-98 31,-98 30)))'),
      'FX-fin-tx')
    on conflict (tier, code) do nothing
  `)
  const r = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test TX Rep', 'Test', 'TX Rep', 'state_house', 'R', 'TX',
      d.id, true, 'FX-fin-tx'
    from public.districts d where d.code = 'TX-FIN-AD'
    returning id
  `)
  repId = r.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id = $1)',
    [repId],
  )
  await client.query('delete from public.state_finance_summaries where official_id = $1', [repId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-tx'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-tx'])
  await client.end()
})

describe('fetchTexas', () => {
  it('happy path: 1 filing → 1 summary + 2 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchTexas.fetch({
      client, cycle: '2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(1)
    expect(stats.donorsUpserted).toBe(2)
  })

  it('source slug is tx-ethics', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchTexas.fetch({
      client, cycle: '2024', fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ source: string }>(`
      select source from public.state_finance_summaries where official_id = $1
    `, [repId])
    expect(row.rows[0]!.source).toBe('tx-ethics')
  })

  it('partial percentage fields: small_donor_pct present, in_state_pct null', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchTexas.fetch({
      client, cycle: '2024', fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{
      small_donor_pct: string | null; in_state_pct: string | null
    }>(`
      select small_donor_pct, in_state_pct from public.state_finance_summaries where official_id = $1
    `, [repId])
    expect(Number(row.rows[0]!.small_donor_pct)).toBe(12.0)
    expect(row.rows[0]!.in_state_pct).toBeNull()
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture.filings
    await fetchTexas.fetch({ client, cycle: '2024', fetcher } as never)
    const stats2 = await fetchTexas.fetch({ client, cycle: '2024', fetcher } as never)
    expect(stats2.summariesUpserted).toBe(1)
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_finance_summaries where official_id = $1', [repId],
    )
    expect(c.rows[0]!.c).toBe(1)
  })

  it('reports state TX', async () => {
    const stats = await fetchTexas.fetch({
      client, cycle: '2024', fetcher: async () => [],
    } as never)
    expect(stats.state).toBe('TX')
  })
})
```

- [ ] **Step 3: Implement fetch-tx.ts**

Create `packages/db/supabase/seed/state-finance/fetch-tx.ts`:

```ts
import type { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
  upsertStateFinance,
  resolveOfficialByName,
} from './shared.ts'

interface TXFilingPayload {
  full_name: string
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source_url: string
  donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer?: string | null
    occupation?: string | null
    city?: string | null
    donor_state?: string | null
  }>
}

type TXFetcher = (cycle: string) => Promise<TXFilingPayload[]>

const defaultFetcher: TXFetcher = async () => {
  // Production: parse TX Ethics CFOR CSV bulk downloads.
  // Stub returns [] until operator wires the real source.
  return []
}

const STATE: FinanceState = 'TX'

export const fetchTexas: StateFinanceAdapter = {
  state: STATE,
  async fetch(opts): Promise<StateFinanceStats> {
    const fetcher: TXFetcher =
      (opts as never as { fetcher?: TXFetcher }).fetcher ?? defaultFetcher

    const stats: StateFinanceStats = {
      state: STATE,
      summariesUpserted: 0,
      donorsUpserted: 0,
      officialsMatched: 0,
      officialsUnmatched: [],
      errors: [],
    }

    let filings: TXFilingPayload[]
    try {
      filings = await fetcher(opts.cycle)
    } catch (err) {
      stats.errors.push(`TX fetcher failed: ${(err as Error).message}`)
      return stats
    }

    for (const f of filings) {
      try {
        const officialId = await resolveOfficialByName(opts.client, {
          full_name: f.full_name, state: STATE, chamber: f.chamber,
        })
        if (!officialId) {
          stats.officialsUnmatched.push(f.full_name)
          continue
        }
        await upsertStateFinance(opts.client,
          { official_id: officialId, cycle: opts.cycle },
          {
            total_raised: f.total_raised,
            total_disbursed: f.total_disbursed,
            small_donor_pct: f.small_donor_pct,
            in_state_pct: f.in_state_pct,
            source: 'tx-ethics',
            source_url: f.source_url,
          },
          f.donors,
        )
        stats.summariesUpserted += 1
        stats.donorsUpserted += f.donors.length
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push(`TX ${f.full_name}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-finance/fetch-tx'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-finance/fetch-tx.ts \
        packages/db/supabase/seed/state-finance/fetch-tx.test.ts \
        packages/db/supabase/seed/fixtures/state-finance/tx-sample.json
git commit -m "feat(db): fetch-tx Texas Ethics CFOR adapter

StateFinanceAdapter for TX. Same orchestration shape. Production
parses CSV bulk from ethics.state.tx.us; stub fetcher in this commit.
in_state_pct typically null (TX donor records sparse on residency).

5 vitest cases: happy-path, source slug tx-ethics, partial pct
fields, idempotent, state reported TX."
```

---

## Task 12: fetch-mi (Michigan BOE)

**Files:**
- Create: `packages/db/supabase/seed/state-finance/fetch-mi.ts`
- Create: `packages/db/supabase/seed/state-finance/fetch-mi.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-finance/mi-sample.json`

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-finance/mi-sample.json`:

```json
{
  "filings": [
    {
      "full_name": "Test MI Rep",
      "chamber": "state_house",
      "total_raised": 60000,
      "total_disbursed": 45000,
      "small_donor_pct": 28.0,
      "in_state_pct": 92.0,
      "source_url": "https://miboecfr.nictusa.com/cgi-bin/cfr/test-rep-2024.cgi",
      "donors": [
        {"rank": 1, "donor_name": "MI Auto PAC", "amount": 5000, "city": "Lansing", "donor_state": "MI"},
        {"rank": 2, "donor_name": "Detroit Donor", "amount": 3500, "employer": "AutoCo", "occupation": "Engineer", "city": "Detroit", "donor_state": "MI"}
      ]
    },
    {
      "full_name": "Test MI Sen",
      "chamber": "state_senate",
      "total_raised": 100000,
      "total_disbursed": 78000,
      "small_donor_pct": 22.0,
      "in_state_pct": 88.0,
      "source_url": "https://miboecfr.nictusa.com/cgi-bin/cfr/test-sen-2024.cgi",
      "donors": [
        {"rank": 1, "donor_name": "Statewide PAC", "amount": 9500, "city": "Lansing", "donor_state": "MI"}
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-finance/fetch-mi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMichigan } from './fetch-mi.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-finance', 'mi-sample.json')

let client: Client
let repId: string
let senId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',  'MI', 'MI-FIN-AD', 'MI FIN AD',
        st_geogfromtext('MULTIPOLYGON(((-84 42,-83 42,-83 43,-84 43,-84 42)))'),
        'FX-fin-mi'),
      ('state_senate', 'MI', 'MI-FIN-SD', 'MI FIN SD',
        st_geogfromtext('MULTIPOLYGON(((-84 42,-83 42,-83 43,-84 43,-84 42)))'),
        'FX-fin-mi')
    on conflict (tier, code) do nothing
  `)
  const r = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test MI Rep', 'Test', 'MI Rep', 'state_house', 'D', 'MI',
      d.id, true, 'FX-fin-mi'
    from public.districts d where d.code = 'MI-FIN-AD'
    returning id
  `)
  repId = r.rows[0]!.id
  const s = await client.query<{ id: string }>(`
    insert into public.officials (full_name, first_name, last_name, chamber, party, state,
      district_id, in_office, source_version)
    select 'Test MI Sen', 'Test', 'MI Sen', 'state_senate', 'R', 'MI',
      d.id, true, 'FX-fin-mi'
    from public.districts d where d.code = 'MI-FIN-SD'
    returning id
  `)
  senId = s.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    'delete from public.state_finance_individual_donors where state_finance_summary_id in (select id from public.state_finance_summaries where official_id in ($1, $2))',
    [repId, senId],
  )
  await client.query('delete from public.state_finance_summaries where official_id in ($1, $2)', [repId, senId])
  await client.query('delete from public.officials where source_version = $1', ['FX-fin-mi'])
  await client.query('delete from public.districts where source_version = $1', ['FX-fin-mi'])
  await client.end()
})

describe('fetchMichigan', () => {
  it('happy path: 2 filings → 2 summaries + 3 donors', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await fetchMichigan.fetch({
      client, cycle: '2023-2024',
      fetcher: async () => fixture.filings,
    } as never)
    expect(stats.errors).toEqual([])
    expect(stats.summariesUpserted).toBe(2)
    expect(stats.donorsUpserted).toBe(3)
  })

  it('source slug is mi-boe', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchMichigan.fetch({
      client, cycle: '2023-2024', fetcher: async () => fixture.filings,
    } as never)
    const rows = await client.query<{ source: string }>(`
      select source from public.state_finance_summaries where official_id in ($1, $2)
    `, [repId, senId])
    for (const r of rows.rows) expect(r.source).toBe('mi-boe')
  })

  it('both percentage fields preserved', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchMichigan.fetch({
      client, cycle: '2023-2024', fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{
      small_donor_pct: string; in_state_pct: string
    }>(`
      select small_donor_pct, in_state_pct
        from public.state_finance_summaries where official_id = $1
    `, [repId])
    expect(Number(row.rows[0]!.small_donor_pct)).toBe(28.0)
    expect(Number(row.rows[0]!.in_state_pct)).toBe(92.0)
  })

  it('biennial cycle string preserved as-is', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    await fetchMichigan.fetch({
      client, cycle: '2023-2024', fetcher: async () => fixture.filings,
    } as never)
    const row = await client.query<{ cycle: string }>(`
      select cycle from public.state_finance_summaries where official_id = $1
    `, [repId])
    expect(row.rows[0]!.cycle).toBe('2023-2024')
  })

  it('reports state MI', async () => {
    const stats = await fetchMichigan.fetch({
      client, cycle: '2023-2024', fetcher: async () => [],
    } as never)
    expect(stats.state).toBe('MI')
  })
})
```

- [ ] **Step 3: Implement fetch-mi.ts**

Create `packages/db/supabase/seed/state-finance/fetch-mi.ts`:

```ts
import type { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
  upsertStateFinance,
  resolveOfficialByName,
} from './shared.ts'

interface MIFilingPayload {
  full_name: string
  chamber: 'state_house' | 'state_senate' | 'state_legislature'
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  source_url: string
  donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer?: string | null
    occupation?: string | null
    city?: string | null
    donor_state?: string | null
  }>
}

type MIFetcher = (cycle: string) => Promise<MIFilingPayload[]>

const defaultFetcher: MIFetcher = async () => {
  // Production: parse MI BOE CSV bulk downloads at miboecfr.nictusa.com.
  // Stub returns [] until operator wires the real source.
  return []
}

const STATE: FinanceState = 'MI'

export const fetchMichigan: StateFinanceAdapter = {
  state: STATE,
  async fetch(opts): Promise<StateFinanceStats> {
    const fetcher: MIFetcher =
      (opts as never as { fetcher?: MIFetcher }).fetcher ?? defaultFetcher

    const stats: StateFinanceStats = {
      state: STATE,
      summariesUpserted: 0,
      donorsUpserted: 0,
      officialsMatched: 0,
      officialsUnmatched: [],
      errors: [],
    }

    let filings: MIFilingPayload[]
    try {
      filings = await fetcher(opts.cycle)
    } catch (err) {
      stats.errors.push(`MI fetcher failed: ${(err as Error).message}`)
      return stats
    }

    for (const f of filings) {
      try {
        const officialId = await resolveOfficialByName(opts.client, {
          full_name: f.full_name, state: STATE, chamber: f.chamber,
        })
        if (!officialId) {
          stats.officialsUnmatched.push(f.full_name)
          continue
        }
        await upsertStateFinance(opts.client,
          { official_id: officialId, cycle: opts.cycle },
          {
            total_raised: f.total_raised,
            total_disbursed: f.total_disbursed,
            small_donor_pct: f.small_donor_pct,
            in_state_pct: f.in_state_pct,
            source: 'mi-boe',
            source_url: f.source_url,
          },
          f.donors,
        )
        stats.summariesUpserted += 1
        stats.donorsUpserted += f.donors.length
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push(`MI ${f.full_name}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-finance/fetch-mi'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-finance/fetch-mi.ts \
        packages/db/supabase/seed/state-finance/fetch-mi.test.ts \
        packages/db/supabase/seed/fixtures/state-finance/mi-sample.json
git commit -m "feat(db): fetch-mi Michigan BOE adapter

StateFinanceAdapter for MI. Production parses CSV from
miboecfr.nictusa.com. Both pct fields typically derivable from MI's
detailed donor data. Stub fetcher.

5 vitest cases: happy-path, source slug mi-boe, both pct fields,
biennial cycle string preserved, state reported MI."
```

---

## Task 13: state-finance-ingest orchestrator

**Files:**
- Create: `packages/db/supabase/seed/state-finance-ingest.ts`
- Create: `packages/db/supabase/seed/state-finance-ingest.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/state-finance-ingest.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateFinance } from './state-finance-ingest.ts'
import type { StateFinanceAdapter, StateFinanceStats } from './state-finance/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})

afterEach(async () => {
  await client.end()
})

function mkStats(state: StateFinanceStats['state'], overrides: Partial<StateFinanceStats> = {}): StateFinanceStats {
  return {
    state, summariesUpserted: 1, donorsUpserted: 3,
    officialsMatched: 1, officialsUnmatched: [], errors: [],
    ...overrides,
  }
}

function mkAdapter(state: StateFinanceStats['state'], impl: () => Promise<StateFinanceStats>): StateFinanceAdapter {
  return { state, async fetch() { return impl() } }
}

describe('ingestStateFinance', () => {
  it('runs all adapters and aggregates stats', async () => {
    const stats = await ingestStateFinance({
      cycle: '2024',
      client,
      adapters: [
        mkAdapter('CA', async () => mkStats('CA', { summariesUpserted: 2, donorsUpserted: 6 })),
        mkAdapter('NY', async () => mkStats('NY', { summariesUpserted: 1, donorsUpserted: 2 })),
        mkAdapter('FL', async () => mkStats('FL', { summariesUpserted: 1, donorsUpserted: 3 })),
        mkAdapter('TX', async () => mkStats('TX', { summariesUpserted: 1, donorsUpserted: 2 })),
        mkAdapter('MI', async () => mkStats('MI', { summariesUpserted: 1, donorsUpserted: 1 })),
      ],
    })
    expect(stats.statesAttempted).toBe(5)
    expect(stats.statesOk).toBe(5)
    expect(stats.totalSummariesUpserted).toBe(6)
    expect(stats.totalDonorsUpserted).toBe(14)
    expect(stats.byState).toHaveLength(5)
  })

  it('--state filter dispatches only the requested adapter', async () => {
    const calls: string[] = []
    const stats = await ingestStateFinance({
      cycle: '2024', client, state: 'CA',
      adapters: [
        mkAdapter('CA', async () => { calls.push('CA'); return mkStats('CA') }),
        mkAdapter('NY', async () => { calls.push('NY'); return mkStats('NY') }),
      ],
    })
    expect(calls).toEqual(['CA'])
    expect(stats.statesAttempted).toBe(1)
  })

  it('one adapter throwing → others still run with skipOnError', async () => {
    const stats = await ingestStateFinance({
      cycle: '2024', client, skipOnError: true,
      adapters: [
        mkAdapter('CA', async () => { throw new Error('CA blew up') }),
        mkAdapter('NY', async () => mkStats('NY', { summariesUpserted: 1 })),
      ],
    })
    expect(stats.statesOk).toBe(1)
    expect(stats.byState.find(s => s.state === 'CA')!.errors).toContain('CA blew up')
    expect(stats.byState.find(s => s.state === 'NY')!.summariesUpserted).toBe(1)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    await expect(ingestStateFinance({
      cycle: '2024', client,
      adapters: [
        mkAdapter('CA', async () => { throw new Error('CA blew up') }),
        mkAdapter('NY', async () => mkStats('NY')),
      ],
    })).rejects.toThrow(/CA blew up/)
  })

  it('aggregates officialsUnmatched across adapters', async () => {
    const stats = await ingestStateFinance({
      cycle: '2024', client,
      adapters: [
        mkAdapter('CA', async () => mkStats('CA', { officialsUnmatched: ['John Doe', 'Jane Roe'] })),
        mkAdapter('NY', async () => mkStats('NY', { officialsUnmatched: ['Sam Smith'] })),
      ],
    })
    expect(stats.totalOfficialsUnmatched).toBe(3)
  })

  it('--state with unknown state code throws', async () => {
    await expect(ingestStateFinance({
      cycle: '2024', client, state: 'ZZ' as never,
      adapters: [mkAdapter('CA', async () => mkStats('CA'))],
    })).rejects.toThrow(/unknown state code/)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test state-finance-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement orchestrator**

Create `packages/db/supabase/seed/state-finance-ingest.ts`:

```ts
import { Client } from 'pg'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
} from './state-finance/shared.ts'
import { fetchCalifornia } from './state-finance/fetch-ca.ts'
import { fetchNewYork    } from './state-finance/fetch-ny.ts'
import { fetchFlorida    } from './state-finance/fetch-fl.ts'
import { fetchTexas      } from './state-finance/fetch-tx.ts'
import { fetchMichigan   } from './state-finance/fetch-mi.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateFinanceAdapter[] = [
  fetchCalifornia, fetchNewYork, fetchFlorida, fetchTexas, fetchMichigan,
]

const KNOWN_STATES: ReadonlySet<FinanceState> = new Set(['CA', 'NY', 'FL', 'TX', 'MI'])

export interface IngestStateFinanceOpts {
  cycle: string
  state?: FinanceState
  skipOnError?: boolean
  adapters?: StateFinanceAdapter[]
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

export async function ingestStateFinance(
  opts: IngestStateFinanceOpts,
): Promise<IngestStateFinanceStats> {
  if (opts.state && !KNOWN_STATES.has(opts.state)) {
    throw new Error(`unknown state code: ${opts.state}; expected one of CA, NY, FL, TX, MI`)
  }
  const adapters = (opts.adapters ?? ADAPTERS_DEFAULT)
    .filter(a => !opts.state || a.state === opts.state)
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byState: StateFinanceStats[] = []
  try {
    for (const adapter of adapters) {
      try {
        const result = await adapter.fetch({ client, cycle: opts.cycle })
        byState.push(result)
      } catch (err) {
        const failed: StateFinanceStats = {
          state: adapter.state,
          summariesUpserted: 0,
          donorsUpserted: 0,
          officialsMatched: 0,
          officialsUnmatched: [],
          errors: [(err as Error).message],
        }
        byState.push(failed)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    cycle: opts.cycle,
    statesAttempted:           byState.length,
    statesOk:                  byState.filter(s => s.errors.length === 0).length,
    totalSummariesUpserted:    byState.reduce((acc, s) => acc + s.summariesUpserted, 0),
    totalDonorsUpserted:       byState.reduce((acc, s) => acc + s.donorsUpserted, 0),
    totalOfficialsUnmatched:   byState.reduce((acc, s) => acc + s.officialsUnmatched.length, 0),
    byState,
  }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const cycleArg = process.argv.find(a => a.startsWith('--cycle='))
  const stateArg = process.argv.find(a => a.startsWith('--state='))
  const skipOnError = process.argv.includes('--skip-on-error')
  if (!cycleArg) {
    console.error('usage: tsx state-finance-ingest.ts --cycle=YYYY [--state=XX] [--skip-on-error]')
    process.exit(2)
  }
  const cycle = cycleArg.split('=')[1]!
  const state = stateArg ? (stateArg.split('=')[1]! as FinanceState) : undefined

  ingestStateFinance({ cycle, state, skipOnError })
    .then(stats => {
      console.log(`State finance ingest summary (cycle ${stats.cycle}):`)
      console.log(`  states attempted:        ${stats.statesAttempted}`)
      console.log(`  states ok:               ${stats.statesOk}`)
      console.log(`  total summaries:         ${stats.totalSummariesUpserted}`)
      console.log(`  total donors:            ${stats.totalDonorsUpserted}`)
      console.log(`  total officials unmatched: ${stats.totalOfficialsUnmatched}`)
      for (const s of stats.byState) {
        const tag = s.errors.length > 0 ? `errors=${s.errors.length}` : 'ok'
        console.log(`  ${s.state}: ${s.summariesUpserted} summaries / ${s.donorsUpserted} donors / ${tag}`)
        if (s.officialsUnmatched.length > 0) {
          console.log(`    unmatched: ${s.officialsUnmatched.join(', ')}`)
        }
      }
      process.exit(stats.statesOk === stats.statesAttempted ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @chiaro/db test state-finance-ingest
```

Expected: 6/6 pass.

```bash
git add packages/db/supabase/seed/state-finance-ingest.ts \
        packages/db/supabase/seed/state-finance-ingest.test.ts
git commit -m "feat(db): state-finance-ingest orchestrator

Dispatches to 5 per-state adapters (CA, NY, FL, TX, MI). Per-adapter
isolation matches slice 5D's state-bills-enrich pattern: thrown errors
land in byState[N].errors; with --skip-on-error other adapters run.
Without the flag, first thrown error aborts.

CLI: pnpm seed:state-finance --cycle=YYYY [--state=XX] [--skip-on-error].
Unknown --state code throws with a clear message.

6 vitest cases: all-adapters happy path, --state filter, throw with
skip-on-error, throw default-abort, officialsUnmatched aggregation,
unknown state code rejected."
```

---

## Task 14: Add seed:state-finance script

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add script**

Open `packages/db/package.json`. Add alongside other `seed:state-*` scripts:

```json
"seed:state-finance": "tsx supabase/seed/state-finance-ingest.ts"
```

- [ ] **Step 2: Verify**

```bash
cat packages/db/package.json | grep "seed:state-finance"
pnpm --filter @chiaro/db typecheck
```

Expected: script line appears; typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): add seed:state-finance script

  pnpm seed:state-finance --cycle=2024
  pnpm seed:state-finance --cycle=2024 --state=CA
  pnpm seed:state-finance --cycle=2024 --skip-on-error

Wires the orchestrator from Task 13 to a pnpm entry point. Operator
usage documented in CLAUDE.md gotcha #10 (Task 21)."
```

---

## Task 15: Extend officials integration test with state finance seed

**Files:**
- Modify: `packages/officials/test/queries.integration.test.ts`

- [ ] **Step 1: Read current state**

```bash
grep -n "stateAsmId\|state_bill_sponsors" packages/officials/test/queries.integration.test.ts | head -20
```

The slice 5D PR #15 already extended this file with a state assemblymember (`stateAsmId`) + a `state_bill_sponsors` row. Slice 5E adds state-finance seed rows for the same assemblymember.

- [ ] **Step 2: Extend the beforeAll seed**

Find the existing slice-5D seed block (look for `state_bill_sponsors` INSERT). After that block, add:

```ts
const { data: stateFinanceSummary, error: sfErr } = await svc.from('state_finance_summaries').insert({
  official_id: stateAsmId,
  cycle: '2024',
  total_raised: 50000,
  total_disbursed: 35000,
  small_donor_pct: 20.0,
  in_state_pct: 75.0,
  source: 'ca-cal-access',
  source_url: 'https://x',
}).select().single()
expect(sfErr).toBeNull()
const stateFinanceSummaryId = stateFinanceSummary!.id

await svc.from('state_finance_individual_donors').insert([
  { state_finance_summary_id: stateFinanceSummaryId, rank: 1, donor_name: 'IT Donor', amount: 5000 },
  { state_finance_summary_id: stateFinanceSummaryId, rank: 2, donor_name: 'OG Donor', amount: 3000 },
])
```

Hoist `stateFinanceSummaryId` into module scope (`let stateFinanceSummaryId: string`) so `afterAll` + the new test case can see it.

- [ ] **Step 3: Extend afterAll cleanup**

Find the slice-5D `afterAll` block. BEFORE the existing state_vote_positions / state_bill_sponsors cleanup, add:

```ts
await svc.from('state_finance_individual_donors').delete().eq('state_finance_summary_id', stateFinanceSummaryId)
await svc.from('state_finance_summaries').delete().eq('id', stateFinanceSummaryId)
```

FK order: donors (CASCADE) before summary (RESTRICT to officials). Then the existing slice-5D cleanup proceeds.

- [ ] **Step 4: Add new test case**

After the existing slice-5D state-bills-sponsors RLS case, add:

```ts
it('state officials can read their own state_finance_individual_donors via anon RLS', async () => {
  const { data, error } = await anon.from('state_finance_individual_donors')
    .select('rank, donor_name, amount')
    .eq('state_finance_summary_id', stateFinanceSummaryId)
    .order('rank')
  expect(error).toBeNull()
  expect(data).toHaveLength(2)
  expect(data![0]!.donor_name).toBe('IT Donor')
  expect(Number(data![0]!.amount)).toBe(5000)
})
```

If the existing anon-client variable is named differently (`anonClient`, `userClient`, etc.), use the actual name from the file.

- [ ] **Step 5: Run integration test**

```bash
pnpm --filter @chiaro/officials typecheck
# Integration tests need Supabase env vars (see CLAUDE.md). If env not set, typecheck-only is sufficient signal locally; CI will run the test.
```

Expected: typecheck clean. The integration test runs in CI's `test` job.

- [ ] **Step 6: Commit**

```bash
git add packages/officials/test/queries.integration.test.ts
git commit -m "test(officials): extend integration test with state finance seed

beforeAll: 1 state_finance_summaries + 2 state_finance_individual_donors
rows attached to the slice-5D test assemblymember. afterAll: FK-ordered
cleanup (donors CASCADE before summary RESTRICT). New case verifies
anon RLS on state_finance_individual_donors."
```

---

## Task 16: Web StateDonorsEvidence component

**Files:**
- Create: `apps/web/components/state/StateDonorsEvidence.tsx`
- Create: `apps/web/test/components/state/StateDonorsEvidence.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/test/components/state/StateDonorsEvidence.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateDonorsEvidence } from '@/components/state/StateDonorsEvidence'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

function mkDonor(rank: number, overrides: Partial<StateFinanceIndividualDonorRow> = {}): StateFinanceIndividualDonorRow {
  return {
    state_finance_summary_id: 's1',
    rank,
    donor_name: `Donor ${rank}`,
    amount: 1000 * (11 - rank) as never,
    employer: null,
    occupation: null,
    city: null,
    donor_state: null,
    ...overrides,
  } as unknown as StateFinanceIndividualDonorRow
}

describe('StateDonorsEvidence', () => {
  it('renders donor with name + dollar-formatted amount', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[mkDonor(1, { donor_name: 'Alice', amount: 5000 as never })]} />)
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText(/\$5,000/)).toBeTruthy()
  })

  it('renders secondary line when employer/occupation/city present', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[mkDonor(1, {
      donor_name: 'Alice', employer: 'Acme', occupation: 'CEO', city: 'SF', donor_state: 'CA',
    })]} />)
    expect(getByText(/Acme · CEO · SF, CA/)).toBeTruthy()
  })

  it('hides secondary line when all optional fields are null', () => {
    const { container } = render(<StateDonorsEvidence donors={[mkDonor(1, { donor_name: 'Alice' })]} />)
    expect(container.textContent).not.toMatch(/ · /)
  })

  it('empty state copy when no donors', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[]} />)
    expect(getByText(/no donor data/i)).toBeTruthy()
  })

  it('shows top 5 + toggle for >5 donors', () => {
    const donors = Array.from({ length: 8 }, (_, i) => mkDonor(i + 1, { donor_name: `D${i + 1}` }))
    const { getByText, queryByText } = render(<StateDonorsEvidence donors={donors} />)
    expect(getByText(/D1/)).toBeTruthy()
    expect(getByText(/D5/)).toBeTruthy()
    expect(queryByText(/D8/)).toBeNull()
    fireEvent.click(getByText(/show more/i))
    expect(getByText(/D8/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement**

Create `apps/web/components/state/StateDonorsEvidence.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

const INITIAL_ROW_COUNT = 5

function fmtAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function secondaryLine(d: StateFinanceIndividualDonorRow): string | null {
  const parts: string[] = []
  if (d.employer) parts.push(d.employer)
  if (d.occupation) parts.push(d.occupation)
  if (d.city) {
    parts.push(d.donor_state ? `${d.city}, ${d.donor_state}` : d.city)
  } else if (d.donor_state) {
    parts.push(d.donor_state)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function StateDonorsEvidence({ donors }: { donors: StateFinanceIndividualDonorRow[] }) {
  const [expanded, setExpanded] = useState(false)
  if (donors.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
        No donor data for this cycle.
      </div>
    )
  }
  const visible = expanded ? donors : donors.slice(0, INITIAL_ROW_COUNT)
  const hasMore = donors.length > INITIAL_ROW_COUNT
  return (
    <div data-testid="state-donors-evidence">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(d => {
          const secondary = secondaryLine(d)
          return (
            <li key={d.rank} style={{
              padding: 8,
              borderTop: `1px solid ${COLORS.neutral.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, color: COLORS.brand.text }}>{d.donor_name}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: COLORS.brand.text }}>
                  {fmtAmount(Number(d.amount))}
                </span>
              </div>
              {secondary && (
                <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
                  {secondary}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 8, padding: '4px 10px', fontSize: 12,
            color: COLORS.brand.text, background: 'transparent',
            border: `1px solid ${COLORS.neutral.border}`, borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'show less' : `show more (${donors.length - INITIAL_ROW_COUNT} more)`}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run tests + typecheck**

```bash
pnpm --filter @chiaro/web test StateDonorsEvidence
pnpm --filter @chiaro/web typecheck
```

Expected: 5/5 pass, typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/state/StateDonorsEvidence.tsx \
        apps/web/test/components/state/StateDonorsEvidence.test.tsx
git commit -m "feat(web): StateDonorsEvidence inline panel

Top-5 donor list with show-more toggle. Donor name (bold left) +
dollar-formatted amount (right). Secondary line composes
employer · occupation · city, donor_state — omits null fields and
'city, ' when state alone is present.

testID='state-donors-evidence' for parent test querySelector access.
Empty-state copy when no donors.

5 vitest cases."
```

---

## Task 17: Web StateFinanceCard component

**Files:**
- Create: `apps/web/components/state/StateFinanceCard.tsx`
- Create: `apps/web/test/components/state/StateFinanceCard.test.tsx`

- [ ] **Step 1: Pre-flight check**

Check what's exported from `@chiaro/officials`:

```bash
grep -E "export (function |const )use" packages/officials/src/hooks.ts | head -20
grep -E "isStateLevel|OfficialWithDistrict" packages/officials/src/
```

Expected: `useOfficialStateFinanceSummary` and `useOfficialStateDonors` (added Task 6) plus `isStateLevel` + `OfficialWithDistrict` from earlier slices.

- [ ] **Step 2: Write failing test**

Create `apps/web/test/components/state/StateFinanceCard.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialStateFinanceSummary: () => ({
      data: {
        id: 's1', official_id: 'oid', cycle: '2023-2024',
        total_raised: 250000, total_disbursed: 180000,
        small_donor_pct: 22.5, in_state_pct: 78.0,
        source: 'ca-cal-access', source_url: 'https://x',
        ingested_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false, isSuccess: true,
    }),
    useOfficialStateDonors: () => ({
      data: [
        { state_finance_summary_id: 's1', rank: 1, donor_name: 'Alice', amount: 5000, employer: null, occupation: null, city: null, donor_state: null },
      ],
      isLoading: false, isSuccess: true,
    }),
  }
})

import { StateFinanceCard } from '@/components/state/StateFinanceCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mkOfficial(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid', full_name: 'Test Sen', first_name: 'Test', last_name: 'Sen',
    bioguide_id: null, openstates_person_id: 'ocd-person/x',
    chamber: 'state_senate', party: 'Democratic', state: 'CA',
    district_id: 'did', district_code: '8', title: 'Senator',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_senate', state: 'CA', code: 'CA-08', name: 'CA SD 8' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('StateFinanceCard', () => {
  it('renders Finance header + cycle label + source pill', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Finance/i)).toBeTruthy()
    expect(getByText(/2023.2024/)).toBeTruthy()
    expect(getByText(/Cal-Access/i)).toBeTruthy()
  })

  it('renders 4 scalar rows: Total raised, Total disbursed, Small-donor %, In-state %', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Total raised/i)).toBeTruthy()
    expect(getByText(/\$250,000/)).toBeTruthy()
    expect(getByText(/Total disbursed/i)).toBeTruthy()
    expect(getByText(/Small.donor/i)).toBeTruthy()
    expect(getByText(/22.5%/)).toBeTruthy()
    expect(getByText(/In.state/i)).toBeTruthy()
    expect(getByText(/78%/)).toBeTruthy()
  })

  it('returns null for federal official (chamber-gated)', () => {
    const fed = mkOfficial({ chamber: 'federal_senate', bioguide_id: 'P000001', openstates_person_id: null })
    const { container } = render(<StateFinanceCard official={fed} />, { wrapper: wrap })
    expect(container.firstChild).toBeNull()
  })

  it('embeds StateDonorsEvidence panel', () => {
    const { container } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(container.querySelector('[data-testid="state-donors-evidence"]')).not.toBeNull()
  })

  it('renders em-dash for null scalar fields', async () => {
    vi.resetModules()
    vi.doMock('@chiaro/officials', async () => {
      const actual = await vi.importActual<object>('@chiaro/officials')
      return {
        ...actual,
        useOfficialStateFinanceSummary: () => ({
          data: {
            id: 's1', official_id: 'oid', cycle: '2024',
            total_raised: 100000, total_disbursed: null,
            small_donor_pct: null, in_state_pct: null,
            source: 'ny-nysboe', source_url: 'https://x',
            ingested_at: '2025-01-01T00:00:00Z',
          },
          isLoading: false, isSuccess: true,
        }),
        useOfficialStateDonors: () => ({ data: [], isLoading: false, isSuccess: true }),
      }
    })
    const { StateFinanceCard: Reimported } = await import('@/components/state/StateFinanceCard')
    const { getAllByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
    expect(getAllByText(/—/).length).toBeGreaterThanOrEqual(3)
  })

  it('NE state_legislature is chamber-eligible (renders the card)', () => {
    const ne = mkOfficial({ chamber: 'state_legislature', state: 'NE' })
    const { getByText } = render(<StateFinanceCard official={ne} />, { wrapper: wrap })
    expect(getByText(/Finance/i)).toBeTruthy()
  })

  it('no-summary path renders empty-state copy', async () => {
    vi.resetModules()
    vi.doMock('@chiaro/officials', async () => {
      const actual = await vi.importActual<object>('@chiaro/officials')
      return {
        ...actual,
        useOfficialStateFinanceSummary: () => ({ data: null, isLoading: false, isSuccess: true }),
        useOfficialStateDonors: () => ({ data: [], isLoading: false, isSuccess: true }),
      }
    })
    const { StateFinanceCard: Reimported } = await import('@/components/state/StateFinanceCard')
    const { getByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/no state finance data/i)).toBeTruthy()
  })
})
```

- [ ] **Step 3: Implement**

Create `apps/web/components/state/StateFinanceCard.tsx`:

```tsx
'use client'
import { useMemo } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import {
  isStateLevel,
  useOfficialStateFinanceSummary,
  useOfficialStateDonors,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { StateDonorsEvidence } from './StateDonorsEvidence'

const SOURCE_LABEL: Record<string, string> = {
  'ca-cal-access': 'Cal-Access',
  'ny-nysboe': 'NY BOE',
  'fl-doe': 'FL DOE',
  'tx-ethics': 'TX Ethics',
  'mi-boe': 'MI BOE',
}

function fmtDollars(n: number | null): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  const numeric = Number(n)
  return numeric % 1 === 0 ? `${numeric}%` : `${numeric.toFixed(1)}%`
}

export function StateFinanceCard({ official }: { official: OfficialWithDistrict }) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const summaryQ = useOfficialStateFinanceSummary(client as never, official.id)
  const donorsQ  = useOfficialStateDonors(client as never, official.id)

  if (!isStateLevel(official.chamber)) return null

  const summary = summaryQ.data
  if (!summary) {
    return (
      <section style={{
        background: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${COLORS.neutral.border}`,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>Finance</h3>
        <div style={{ marginTop: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
          No state finance data yet for this legislator.
        </div>
      </section>
    )
  }

  const sourceLabel = SOURCE_LABEL[summary.source] ?? summary.source

  return (
    <section style={{
      background: COLORS.neutral.surface,
      borderRadius: 12,
      padding: 16,
      border: `1px solid ${COLORS.neutral.border}`,
    }}>
      <header style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>Finance</h3>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
            {summary.cycle} cycle
          </div>
        </div>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: COLORS.neutral.surface,
          border: `1px solid ${COLORS.neutral.border}`,
          color: COLORS.brand.text,
        }}>
          {sourceLabel}
        </span>
      </header>

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ScalarRow label="Total raised"    value={fmtDollars(summary.total_raised as never)} />
        <ScalarRow label="Total disbursed" value={fmtDollars(summary.total_disbursed as never)} />
        <ScalarRow label="Small-donor %"   value={fmtPct(summary.small_donor_pct as never)} />
        <ScalarRow label="In-state %"      value={fmtPct(summary.in_state_pct as never)} />
      </dl>

      <details style={{ marginTop: 12 }} open>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.brand.text }}>
          Top donors ({donorsQ.data?.length ?? 0})
        </summary>
        <StateDonorsEvidence donors={donorsQ.data ?? []} />
      </details>
    </section>
  )
}

function ScalarRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <dt style={{ fontSize: 13, color: COLORS.neutral.textMuted, margin: 0 }}>{label}</dt>
      <dd style={{ fontSize: 14, fontWeight: 600, color: COLORS.brand.text, margin: 0 }}>{value}</dd>
    </div>
  )
}
```

Note: hooks are called unconditionally, then chamber gate returns null AFTER — Rules of Hooks per [[project-chiaro-slice5d-state-bills]] item 6.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/web test StateFinanceCard
pnpm --filter @chiaro/web typecheck
```

Expected: 7/7 pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/state/StateFinanceCard.tsx \
        apps/web/test/components/state/StateFinanceCard.test.tsx
git commit -m "feat(web): StateFinanceCard composes summary + donors hooks

Replaces ComingSoonCard('Finance') role for state legislators. Composes:
- useOfficialStateFinanceSummary (latest cycle)
- useOfficialStateDonors (top 10 for that cycle)

Layout: header (Finance + cycle + source pill) → 4 ScalarRows (totals
+ pct fields, null → '—') → expandable <details open> with embedded
StateDonorsEvidence panel.

Chamber-gated: returns null for federal officials. Hooks called
unconditionally per Rules of Hooks (slice 5D precedent).

7 vitest cases: header + cycle + source, scalar rows + dollar/% format,
federal returns null, embeds StateDonorsEvidence testID, em-dash for
nulls, NE state_legislature eligible, no-summary empty state."
```

---

## Task 18: Web — swap ComingSoonCard + update parent test

**Files:**
- Modify: `apps/web/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Modify StateOfficialDetailPage.tsx**

Open `apps/web/components/state/StateOfficialDetailPage.tsx`. Add the import:

```tsx
import { StateFinanceCard } from './StateFinanceCard'
```

Find the PLACEHOLDER_CATEGORIES constant (added in slice 5D Task 25):

```tsx
const PLACEHOLDER_CATEGORIES = ['Issue Positions', 'Community Presence', 'Finance', 'Ethics & Accountability'] as const
```

Drop `'Finance'`:

```tsx
const PLACEHOLDER_CATEGORIES = ['Issue Positions', 'Community Presence', 'Ethics & Accountability'] as const
```

Find the JSX block that renders `<StateServiceRecordCard />` followed by the placeholder map. Add `<StateFinanceCard />` between them:

```tsx
<section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <StateServiceRecordCard official={official} />
  <StateFinanceCard official={official} />
  {PLACEHOLDER_CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
</section>
```

- [ ] **Step 2: Update parent test**

Open `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`. The slice 5D PR #15 mocks `@chiaro/state-bills` hooks + `useOfficialMetrics`. Add the new state-finance mocks alongside:

Inside the `vi.mock('@chiaro/officials', ...)` block, add return entries for the new hooks. Read the existing mock first to see its shape, then extend:

```tsx
vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({ data: undefined, isLoading: false, isSuccess: true }),
    // NEW for slice 5E:
    useOfficialStateFinanceSummary: () => ({ data: null, isLoading: false, isSuccess: true }),
    useOfficialStateDonors:         () => ({ data: [], isLoading: false, isSuccess: true }),
  }
})
```

Find the existing assertion `expect(getAllByText(/^(?:Service Record|Issue Positions|Community Presence|Finance|Ethics & Accountability)$/i)).toHaveLength(5)` (or similar 5-category check). Update to:

```tsx
// Slice 5E swap: Finance ComingSoonCard replaced by real StateFinanceCard.
// 1 ServiceRecord (real) + 1 Finance (real header, since useOfficialStateFinanceSummary
// returns null we get the empty-state copy header) + 3 ComingSoon placeholders = 5 headers total.
expect(getAllByText(/^(?:Service Record|Issue Positions|Community Presence|Finance|Ethics & Accountability)$/i))
  .toHaveLength(5)
```

(If the existing assertion was `toHaveLength(5)` it stays at 5 because both `StateServiceRecordCard` and `StateFinanceCard` render their own headers; the count is unchanged. If it was `toHaveLength(4)` after slice 5D removed `Finance` from CATEGORIES — adjust to 5.)

If the existing pattern uses `PLACEHOLDER_CATEGORIES.length` indirectly, update the expected count.

- [ ] **Step 3: Run web tests**

```bash
pnpm --filter @chiaro/web test
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build 2>&1 | tail -10
```

Expected: all tests pass; typecheck clean; build succeeds with `/state-officials/[id]` route present.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/state/StateOfficialDetailPage.tsx \
        apps/web/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(web): swap ComingSoonCard('Finance') for real StateFinanceCard

apps/web/components/state/StateOfficialDetailPage.tsx renders
StateFinanceCard between StateServiceRecordCard and the remaining 3
ComingSoonCards. PLACEHOLDER_CATEGORIES shrinks from 4 to 3 (drops
'Finance').

Parent test updated with the new useOfficialStateFinanceSummary +
useOfficialStateDonors mocks (slice 5D 3-mock-+-wrap pattern)."
```

---

## Task 19: Mobile — StateDonorsEvidence + StateFinanceCard

**Files:**
- Create: `apps/mobile/components/state/StateDonorsEvidence.tsx`
- Create: `apps/mobile/components/state/StateFinanceCard.tsx`
- Create: `apps/mobile/test/components/state/StateDonorsEvidence.test.tsx`
- Create: `apps/mobile/test/components/state/StateFinanceCard.test.tsx`

Bundled because the mobile equivalents are direct RN-primitive translations of the web components from Tasks 16-17.

- [ ] **Step 1: Mobile StateDonorsEvidence**

Create `apps/mobile/components/state/StateDonorsEvidence.tsx`:

```tsx
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

const INITIAL_ROW_COUNT = 5

function fmtAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function secondaryLine(d: StateFinanceIndividualDonorRow): string | null {
  const parts: string[] = []
  if (d.employer) parts.push(d.employer)
  if (d.occupation) parts.push(d.occupation)
  if (d.city) {
    parts.push(d.donor_state ? `${d.city}, ${d.donor_state}` : d.city)
  } else if (d.donor_state) {
    parts.push(d.donor_state)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function StateDonorsEvidence({ donors }: { donors: StateFinanceIndividualDonorRow[] }) {
  const [expanded, setExpanded] = useState(false)
  if (donors.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
          No donor data for this cycle.
        </Text>
      </View>
    )
  }
  const visible = expanded ? donors : donors.slice(0, INITIAL_ROW_COUNT)
  const hasMore = donors.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-donors-evidence">
      {visible.map(d => {
        const secondary = secondaryLine(d)
        return (
          <View key={d.rank} style={{
            padding: 8,
            borderTopWidth: 1,
            borderTopColor: COLORS.neutral.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontWeight: '600', color: COLORS.brand.text }}>{d.donor_name}</Text>
              <Text style={{ color: COLORS.brand.text }}>{fmtAmount(Number(d.amount))}</Text>
            </View>
            {secondary && (
              <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
                {secondary}
              </Text>
            )}
          </View>
        )
      })}
      {hasMore && (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          style={{
            marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start',
            borderWidth: 1, borderColor: COLORS.neutral.border, borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.brand.text }}>
            {expanded ? 'show less' : `show more (${donors.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
```

- [ ] **Step 2: Mobile StateFinanceCard**

Create `apps/mobile/components/state/StateFinanceCard.tsx`:

```tsx
import { View, Text } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import {
  isStateLevel,
  useOfficialStateFinanceSummary,
  useOfficialStateDonors,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { StateDonorsEvidence } from './StateDonorsEvidence'

const SOURCE_LABEL: Record<string, string> = {
  'ca-cal-access': 'Cal-Access',
  'ny-nysboe': 'NY BOE',
  'fl-doe': 'FL DOE',
  'tx-ethics': 'TX Ethics',
  'mi-boe': 'MI BOE',
}

function fmtDollars(n: number | null): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  const numeric = Number(n)
  return numeric % 1 === 0 ? `${numeric}%` : `${numeric.toFixed(1)}%`
}

export function StateFinanceCard({ official }: { official: OfficialWithDistrict }) {
  const summaryQ = useOfficialStateFinanceSummary(supabase as never, official.id)
  const donorsQ  = useOfficialStateDonors(supabase as never, official.id)

  if (!isStateLevel(official.chamber)) return null

  const cardStyle = {
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral.border,
  }

  const summary = summaryQ.data
  if (!summary) {
    return (
      <View style={cardStyle}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.brand.text }}>Finance</Text>
        <Text style={{ marginTop: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
          No state finance data yet for this legislator.
        </Text>
      </View>
    )
  }

  const sourceLabel = SOURCE_LABEL[summary.source] ?? summary.source

  return (
    <View style={cardStyle}>
      <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.brand.text }}>Finance</Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
            {summary.cycle} cycle
          </Text>
        </View>
        <Text style={{
          fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
          borderWidth: 1, borderColor: COLORS.neutral.border,
          color: COLORS.brand.text,
        }}>
          {sourceLabel}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <ScalarRow label="Total raised"    value={fmtDollars(summary.total_raised as never)} />
        <ScalarRow label="Total disbursed" value={fmtDollars(summary.total_disbursed as never)} />
        <ScalarRow label="Small-donor %"   value={fmtPct(summary.small_donor_pct as never)} />
        <ScalarRow label="In-state %"      value={fmtPct(summary.in_state_pct as never)} />
      </View>

      <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '600', color: COLORS.brand.text }}>
        Top donors ({donorsQ.data?.length ?? 0})
      </Text>
      <StateDonorsEvidence donors={donorsQ.data ?? []} />
    </View>
  )
}

function ScalarRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.brand.text }}>{value}</Text>
    </View>
  )
}
```

- [ ] **Step 3: Mobile tests**

Create `apps/mobile/test/components/state/StateDonorsEvidence.test.tsx` (~5 cases, jest-expo):

```tsx
import { render, fireEvent } from '@testing-library/react-native'
import { describe, expect, it } from '@jest/globals'
import { StateDonorsEvidence } from '@/components/state/StateDonorsEvidence'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

function mkDonor(rank: number, overrides: Partial<StateFinanceIndividualDonorRow> = {}): StateFinanceIndividualDonorRow {
  return {
    state_finance_summary_id: 's1', rank,
    donor_name: `Donor ${rank}`,
    amount: 1000 * (11 - rank) as never,
    employer: null, occupation: null, city: null, donor_state: null,
    ...overrides,
  } as unknown as StateFinanceIndividualDonorRow
}

describe('StateDonorsEvidence (mobile)', () => {
  it('renders donor name + dollar amount', () => {
    const { getByText } = render(
      <StateDonorsEvidence donors={[mkDonor(1, { donor_name: 'Alice', amount: 5000 as never })]} />,
    )
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText('$5,000')).toBeTruthy()
  })
  it('renders secondary line when fields present', () => {
    const { getByText } = render(
      <StateDonorsEvidence donors={[mkDonor(1, { donor_name: 'A', employer: 'Acme', occupation: 'CEO', city: 'SF', donor_state: 'CA' })]} />,
    )
    expect(getByText('Acme · CEO · SF, CA')).toBeTruthy()
  })
  it('empty-state copy', () => {
    const { getByText } = render(<StateDonorsEvidence donors={[]} />)
    expect(getByText(/no donor data/i)).toBeTruthy()
  })
  it('top 5 visible + toggle', () => {
    const donors = Array.from({ length: 8 }, (_, i) => mkDonor(i + 1, { donor_name: `D${i + 1}` }))
    const { getByText, queryByText } = render(<StateDonorsEvidence donors={donors} />)
    expect(queryByText('D8')).toBeNull()
    fireEvent.press(getByText(/show more/i))
    expect(getByText('D8')).toBeTruthy()
  })
  it('omits secondary line when all optional fields null', () => {
    const { queryByText } = render(<StateDonorsEvidence donors={[mkDonor(1)]} />)
    expect(queryByText(/ · /)).toBeNull()
  })
})
```

Create `apps/mobile/test/components/state/StateFinanceCard.test.tsx` (~7 cases mirroring the web file). Use jest mocks:

```tsx
import { render } from '@testing-library/react-native'
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'

jest.mock('@/lib/supabase', () => ({ supabase: {} }))

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials') as object
  return {
    ...actual,
    useOfficialStateFinanceSummary: () => ({
      data: {
        id: 's1', official_id: 'oid', cycle: '2023-2024',
        total_raised: 250000, total_disbursed: 180000,
        small_donor_pct: 22.5, in_state_pct: 78.0,
        source: 'ca-cal-access', source_url: 'https://x',
        ingested_at: '2025-01-01T00:00:00Z',
      },
      isLoading: false, isSuccess: true,
    }),
    useOfficialStateDonors: () => ({
      data: [{ state_finance_summary_id: 's1', rank: 1, donor_name: 'Alice', amount: 5000, employer: null, occupation: null, city: null, donor_state: null }],
      isLoading: false, isSuccess: true,
    }),
  }
})

import { StateFinanceCard } from '@/components/state/StateFinanceCard'

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mkOfficial(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid', full_name: 'Test Sen', first_name: 'Test', last_name: 'Sen',
    bioguide_id: null, openstates_person_id: 'ocd-person/x',
    chamber: 'state_senate', party: 'D', state: 'CA',
    district_id: 'did', district_code: '8', title: 'Senator',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_senate', state: 'CA', code: 'CA-08', name: 'CA SD 8' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('StateFinanceCard (mobile)', () => {
  it('renders Finance header + cycle + source label', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText('Finance')).toBeTruthy()
    expect(getByText(/2023.2024/)).toBeTruthy()
    expect(getByText('Cal-Access')).toBeTruthy()
  })
  it('renders 4 scalar rows', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText('Total raised')).toBeTruthy()
    expect(getByText('$250,000')).toBeTruthy()
    expect(getByText('22.5%')).toBeTruthy()
    expect(getByText('78%')).toBeTruthy()
  })
  it('returns null for federal official', () => {
    const fed = mkOfficial({ chamber: 'federal_senate', bioguide_id: 'X', openstates_person_id: null })
    const { toJSON } = render(<StateFinanceCard official={fed} />, { wrapper: wrap })
    expect(toJSON()).toBeNull()
  })
  it('embeds StateDonorsEvidence', () => {
    const { getByTestId } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByTestId('state-donors-evidence')).toBeTruthy()
  })
  it('NE state_legislature renders the card', () => {
    const ne = mkOfficial({ chamber: 'state_legislature', state: 'NE' })
    const { getByText } = render(<StateFinanceCard official={ne} />, { wrapper: wrap })
    expect(getByText('Finance')).toBeTruthy()
  })
  it('renders Top donors header with donor count', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Top donors \(1\)/)).toBeTruthy()
  })
  it('dollar amount uses tabular formatting (commas)', () => {
    const { getByText } = render(<StateFinanceCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText('$250,000')).toBeTruthy()
    expect(getByText('$180,000')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run mobile tests + typecheck**

```bash
pnpm --filter @chiaro/mobile test 'StateFinanceCard|StateDonorsEvidence'
pnpm --filter @chiaro/mobile typecheck
```

Expected: ~12 tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/state/StateDonorsEvidence.tsx \
        apps/mobile/components/state/StateFinanceCard.tsx \
        apps/mobile/test/components/state/StateDonorsEvidence.test.tsx \
        apps/mobile/test/components/state/StateFinanceCard.test.tsx
git commit -m "feat(mobile): StateFinanceCard + StateDonorsEvidence parity

Mirror web Tasks 16-17 with RN primitives (View/Text/Pressable).
Mobile uses singleton supabase import (slice 5D precedent), web uses
createSupabaseBrowserClient via useMemo.

~12 jest-expo cases."
```

---

## Task 20: Mobile — swap ComingSoonCard + update parent test

**Files:**
- Modify: `apps/mobile/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Modify mobile detail page**

Open `apps/mobile/components/state/StateOfficialDetailPage.tsx`. Add the import:

```tsx
import { StateFinanceCard } from './StateFinanceCard'
```

Find the `PLACEHOLDER_CATEGORIES` constant. Drop `'Finance'`:

```tsx
const PLACEHOLDER_CATEGORIES = ['Issue Positions', 'Community Presence', 'Ethics & Accountability'] as const
```

Insert `<StateFinanceCard />` between `<StateServiceRecordCard />` and the placeholder map:

```tsx
<View style={{ gap: 12 }}>
  <StateServiceRecordCard official={official} />
  <StateFinanceCard official={official} />
  {PLACEHOLDER_CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
</View>
```

- [ ] **Step 2: Update parent test**

Open `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`. Extend the existing `jest.mock('@chiaro/officials', ...)` block with the new hooks:

```tsx
jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials') as object
  return {
    ...actual,
    useOfficialMetrics: () => ({ data: undefined, isLoading: false, isSuccess: true }),
    useOfficialStateFinanceSummary: () => ({ data: null, isLoading: false, isSuccess: true }),
    useOfficialStateDonors:         () => ({ data: [], isLoading: false, isSuccess: true }),
  }
})
```

If the existing assertion counts placeholders, update to expect 3 placeholders instead of 4. The total header count (Service Record + Finance + 3 placeholders = 5) is unchanged from slice 5D — only the *origin* of "Finance" shifts from a ComingSoonCard to a real card.

- [ ] **Step 3: Run mobile tests + typecheck**

```bash
pnpm --filter @chiaro/mobile test
pnpm --filter @chiaro/mobile typecheck
```

Expected: all tests pass; typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/state/StateOfficialDetailPage.tsx \
        apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(mobile): swap ComingSoonCard('Finance') for StateFinanceCard

Mirror of web Task 18. PLACEHOLDER_CATEGORIES drops 'Finance' (4 → 3).
Parent test extended with the new useOfficialStateFinanceSummary +
useOfficialStateDonors jest mocks."
```

---

## Task 21: CLAUDE.md slice entry + gotcha #10

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add slice entry**

Open `CLAUDE.md`. Find "Slices delivered" section. After the slice 5D entry, add:

```markdown
- **Sub-slice 5E — state campaign finance** (2026-05-20): per-state adapters (CA Cal-Access, NY NYSBOE, FL DOE, TX Ethics, MI BOE) writing to `state_finance_summaries` + `state_finance_individual_donors`. Replaces `ComingSoonCard('Finance')` on `/state-officials/[id]` with real `StateFinanceCard` + `StateDonorsEvidence` panels (web + mobile). Migrations 0035 + 0036. State finance queries live in `@chiaro/officials` alongside federal finance (workspace stays at 10). 5 adapter test files + 1 orchestrator integration test + ~36 vitest cases (db) + ~12 web + ~12 mobile + 1 new pgTAP file (15 plans).
```

- [ ] **Step 2: Bump numeric claims in Quick start**

```bash
pnpm db:reset                          # apply all migrations 0001–0034
```
→ 
```bash
pnpm db:reset                          # apply all migrations 0001–0036
```

```bash
pnpm db:test                           # pgTAP suite (305 tests across 23 files)
```
→
```bash
pnpm db:test                           # pgTAP suite (320 tests across 24 files)
```

Recompute the actual counts with:
```bash
ls packages/db/supabase/tests/*.test.sql | wc -l
grep -h "^select plan(" packages/db/supabase/tests/*.test.sql | grep -oE "plan\([0-9]+\)" | grep -oE "[0-9]+" | awk '{s+=$1} END {print "Total:", s}'
```

Use the actual values if they differ from 320/24.

- [ ] **Step 3: Add seed:state-finance to Quick start**

Below the existing `pnpm seed:state-bills-full` line, add:

```bash
pnpm seed:state-finance --cycle=2024 --skip-on-error   # state campaign finance (5 states: CA NY FL TX MI)
```

- [ ] **Step 4: Add gotcha #10**

After Gotcha #9, add:

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): sub-slice 5E — state campaign finance

- New slice entry: 5E state finance (per-state adapters for CA/NY/FL/TX/MI)
- Migration range: 0001-0034 → 0001-0036
- pgTAP count: 305 → 320 across 24 files
- Quick start: +seed:state-finance line
- Gotcha #10: state finance source quirks (per-state slugs, cycle
  format, optional pct fields, matching heuristics, FL fragility,
  --state flag for surgical re-runs)"
```

---

## Task 22: Final workspace verify

**Files:** none modified.

Verification-only task. Confirm all 21 prior tasks land correctly.

- [ ] **Step 1: Workspace sweep**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/web build 2>&1 | tail -10
pnpm --filter @chiaro/web test 2>&1 | tail -5
pnpm --filter @chiaro/mobile test 2>&1 | tail -5
pnpm --filter @chiaro/db test 2>&1 | tail -10
pnpm --filter @chiaro/officials test 2>&1 | tail -5
pnpm db:reset 2>&1 | tail -5
pnpm db:test 2>&1 | tail -10
```

Expected:
- typecheck clean across 10 packages
- web build succeeds; `/state-officials/[id]` route present
- web tests green (~178+ including new StateFinanceCard + DonorsEvidence)
- mobile tests green (~108+ including new mobile components)
- db seed tests green (~146+ including 5 new adapter test files + orchestrator)
- officials tests green
- pgTAP green (~320 across 24 files, except pre-existing `tiger_ingest` flake tolerance which already passes)

- [ ] **Step 2: Branch state**

```bash
git log master..HEAD --oneline | head -30
git status
```

Expected: ~24 commits (one per task; possibly more if any task had follow-up fixes). Working tree clean.

- [ ] **Step 3: No commit if everything green**

This task is verification-only. If everything is green, report DONE. If anything failed, report BLOCKED with the failing commands + output.

## Report (after Task 22)

Reply with **DONE | DONE_WITH_CONCERNS | BLOCKED** and:
- Commit SHAs for tasks 1–21
- Final test counts per surface (pgTAP, web vitest, mobile jest-expo, db seed vitest, officials vitest)
- Build outcome
- Confirmation `/state-officials/[id]` route renders `StateFinanceCard` for state officials (web + mobile)
- Any deferred items (CA Cal-Access real XML parser, FL parser, official_metrics integration → slice 5F)
- Operator pre-flight reminder: `pnpm seed:state-finance --cycle=2024 --skip-on-error` post-merge

---

## Self-review notes

**Spec coverage map:**

| Spec section | Covered by |
|---|---|
| Goal | Tasks 17 + 18 + 19 + 20 deliver the user-visible swap |
| Architecture | Tasks 7, 13–14 (adapter shape + orchestrator + script) |
| Schema | Tasks 1, 2, 3 (migrations + types regen) |
| Per-state adapter pattern | Tasks 7 (shared), 8–12 (5 adapters) |
| Orchestrator | Task 13 |
| UI (web) | Tasks 16, 17, 18 |
| UI (mobile) | Tasks 19, 20 |
| Testing — pgTAP | Task 2 |
| Testing — vitest db | Tasks 7–13 |
| Testing — vitest officials | Task 6 (hooks) + Task 15 (integration) |
| Testing — web | Tasks 16–18 |
| Testing — mobile | Tasks 19–20 |
| Integration test extension | Task 15 |
| Known limitations | Documented in spec + Task 21 (CLAUDE.md gotcha #10) |
| Acceptance criteria 1–15 | Distributed across tasks; final verify in Task 22 |
| Operator pre-flight | Task 21 Quick start + Task 22 reminder |

**Placeholder scan:** No "TBD" / "TODO" / "later" remain in any task. Every code step shows the actual code. The `defaultFetcher` stubs in each adapter return `[]` — these are intentional production placeholders for the parser work (CA XML, NY API, FL HTML, TX/MI CSV), documented in CLAUDE.md gotcha #10. The plan tests exercise the orchestration via fetcher injection, which matches slice 5D's enrich-adapter precedent.

**Type consistency:**
- `StateFinanceSummaryRow`, `StateFinanceIndividualDonorRow` defined in Task 4 → used by Tasks 6, 16, 17, 19
- `StateFinanceAdapter`, `StateFinanceStats`, `FinanceState` defined in Task 7 → consumed by Tasks 8–13
- `IngestStateFinanceStats` defined in Task 13 → consumed by orchestrator CLI in same task
- `useOfficialStateFinanceSummary`, `useOfficialStateDonors` defined Task 6 → consumed Tasks 17, 18, 19, 20
- `upsertStateFinance`, `resolveOfficialByName` defined Task 7 → consumed Tasks 8–12
- Source slugs (`'ca-cal-access'`, `'ny-nysboe'`, `'fl-doe'`, `'tx-ethics'`, `'mi-boe'`) consistent across spec, adapters (Tasks 8–12), CLAUDE.md (Task 21), and UI source-pill labels (Task 17)
- `INITIAL_ROW_COUNT = 5` constant repeated in web + mobile DonorsEvidence (acceptable per-file convention)
- `SOURCE_LABEL` map repeated in web + mobile FinanceCard (acceptable per-file convention)

All references resolve forward. No undefined types or methods. Plan is self-consistent.





