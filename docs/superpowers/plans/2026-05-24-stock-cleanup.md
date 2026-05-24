# Drop `state_stock_transactions` + Deprecate 6 Stubs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply slice 12's audit findings — drop the over-specified `state_stock_transactions` table (migration 0053), refactor `StateFinancialActivityCard` to disclosures-only, delete the 5 stock stub adapters + related queries/hooks/types/list-component, and deprecate 6 wrong-premise stubs (4 town_halls + MI complaints + TX disclosures) per the slice 11 ACLU/AFP pattern.

**Architecture:** Forward-only migration drops the empty `state_stock_transactions` table. Production code surface (`@chiaro/officials` queries/hooks/types + `@chiaro/officials-ui` list component + state-ethics seed/ingest) is reduced to remove every stock-related entry point. The `StateFinancialActivityCard` collapses to a single-subsection "Financial Disclosures" card. Six confirmed-wrong stubs are reduced to `@deprecated` shells with `covered_states: []` mirroring the slice 11 deprecation pattern.

**Tech Stack:** Postgres 15 + Supabase, TypeScript strict, vitest, pgTAP, React Native Web (via `@chiaro/officials-ui`), TanStack Query.

**Prerequisite reading:** `docs/superpowers/specs/2026-05-24-stock-cleanup-design.md` + `docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`.

---

## File Structure

### Created files
```
packages/db/supabase/migrations/0053_drop_state_stock_transactions.sql      # NEW
```

### Deleted files
```
packages/db/supabase/seed/state-ethics/stock/ca-fppc.ts
packages/db/supabase/seed/state-ethics/stock/ca-fppc.test.ts
packages/db/supabase/seed/state-ethics/stock/ny-jcope.ts
packages/db/supabase/seed/state-ethics/stock/ny-jcope.test.ts
packages/db/supabase/seed/state-ethics/stock/fl-coe.ts
packages/db/supabase/seed/state-ethics/stock/fl-coe.test.ts
packages/db/supabase/seed/state-ethics/stock/tx-tec.ts
packages/db/supabase/seed/state-ethics/stock/tx-tec.test.ts
packages/db/supabase/seed/state-ethics/stock/mi-board.ts
packages/db/supabase/seed/state-ethics/stock/mi-board.test.ts
packages/db/supabase/seed/state-ethics/stock/index.ts
packages/officials-ui/src/state/StateStockTransactionsList.tsx
packages/officials-ui/test/state/StateStockTransactionsList.test.tsx
```
(13 deletions; the entire `state-ethics/stock/` directory is removed.)

### Modified files
```
packages/db/src/types.ts                                                # regenerated post-migration
packages/db/supabase/tests/state_ethics_rls.test.sql                    # remove ~7 stock plans + adjust plan(N)
packages/db/supabase/seed/state-ethics/shared.ts                        # remove NormalizedStockTransaction + upsertStockTransaction + narrow EthicsComponent
packages/db/supabase/seed/state-ethics/shared.test.ts                   # remove stock describe block
packages/db/supabase/seed/state-ethics-ingest.ts                        # remove stock imports + dispatch
packages/officials/src/types.ts                                         # remove StateStockTransactionRow
packages/officials/src/queries.ts                                       # remove fetchOfficialStateStockTransactions
packages/officials/src/hooks.ts                                         # remove useOfficialStateStockTransactions
packages/officials/src/keys.ts                                          # remove stateStockTransactions key
packages/officials/src/index.ts                                         # remove 3 stock re-exports
packages/officials/test/queries.integration.test.ts                     # remove stock describe block
packages/officials/test/hooks.test.tsx                                  # remove stock hook tests
packages/officials-ui/src/state/StateFinancialActivityCard.tsx          # disclosures-only refactor + title rename
packages/officials-ui/test/state/StateFinancialActivityCard.test.tsx    # remove stock mock + verify single-subsection
packages/officials-ui/test/state/StateOfficialDetailPage.test.tsx       # remove useOfficialStateStockTransactions mock
packages/officials-ui/src/index.ts                                      # remove StateStockTransactionsList export
packages/db/supabase/seed/state-community/town-halls/ca-leginfo.ts      # @deprecated stub
packages/db/supabase/seed/state-community/town-halls/ca-leginfo.test.ts # update for empty-behavior
packages/db/supabase/seed/state-community/town-halls/fl-doe.ts          # @deprecated stub
packages/db/supabase/seed/state-community/town-halls/fl-doe.test.ts
packages/db/supabase/seed/state-community/town-halls/mi-legislature.ts  # @deprecated stub
packages/db/supabase/seed/state-community/town-halls/mi-legislature.test.ts
packages/db/supabase/seed/state-community/town-halls/tx-capitol.ts      # @deprecated stub
packages/db/supabase/seed/state-community/town-halls/tx-capitol.test.ts
packages/db/supabase/seed/state-ethics/complaints/mi-board.ts           # @deprecated stub
packages/db/supabase/seed/state-ethics/complaints/mi-board.test.ts
packages/db/supabase/seed/state-ethics/disclosures/tx-tec.ts            # @deprecated stub
packages/db/supabase/seed/state-ethics/disclosures/tx-tec.test.ts
CLAUDE.md                                                                # slice 13 entry (no new Gotcha)
```

---

## Task 1: Migration 0053 + pgTAP update + types regen

**Files:**
- Create: `packages/db/supabase/migrations/0053_drop_state_stock_transactions.sql`
- Modify: `packages/db/supabase/tests/state_ethics_rls.test.sql`
- Modify: `packages/db/src/types.ts` (regenerated)

- [ ] **Step 1: Create migration 0053**

Create `packages/db/supabase/migrations/0053_drop_state_stock_transactions.sql` with exact content:

```sql
-- Drop state_stock_transactions table.
--
-- Slice 12 audit (docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md)
-- confirmed all 5 per-state stub adapters are bucket G — state legislatures
-- in CA/FL/MI/NY/TX don't have a STOCK Act analogue. Stock holdings/sales
-- are line items inside annual financial disclosures (Form 700 / Form 6 /
-- FDS / PFD / PFS), not a discrete data product.
--
-- Gotcha #21 documents the over-specification + this decision to drop the
-- table rather than maintain a forever-empty schema.
--
-- This migration is destructive but safe: state_stock_transactions has
-- zero rows in any environment (no production parser ever shipped). The
-- federal stock_transactions table is unaffected.

drop index if exists public.state_stock_transactions_official_date_idx;
drop index if exists public.state_stock_transactions_state_date_idx;
drop table if exists public.state_stock_transactions;
```

- [ ] **Step 2: Update `state_ethics_rls.test.sql`**

Read `packages/db/supabase/tests/state_ethics_rls.test.sql`. Remove every assertion that touches `state_stock_transactions`. The file currently has `plan(20)`; the following blocks must be removed:

1. Line 6: `has_table('public', 'state_stock_transactions', ...)`
2. Line 12: `RLS on stock_transactions` assertion
3. Lines 28-35: `transaction_type CHECK rejects bad value` block (the `throws_ok` for `'pillage'`)
4. Lines 65-73: `days_late generated column` block (both the insert + the `select is(...)` assertion)
5. Lines 75-85: insert + `select pass(...)` for NULL external_id (2 inserts + 1 pass)
6. Lines 87-94: `throws_ok` for duplicate non-NULL external_id
7. Lines 114-119: `state_stock_transactions official_id FK is RESTRICT` `throws_ok`
8. Line 126-127: `delete from public.state_stock_transactions ...` cleanup line

Count of `select` assertions involving `state_stock_transactions` to remove: **7** (1 has_table + 1 is(RLS) + 1 throws_ok CHECK + 1 is(days_late) + 1 pass + 1 throws_ok UNIQUE + 1 throws_ok FK).

Update line 3: `select plan(20);` → `select plan(13);`

Replacement content (the full updated file):

```sql
begin;

select plan(13);

-- 1-3. has_table (stock_transactions removed)
select has_table('public', 'state_financial_disclosures',  'state_financial_disclosures exists');
select has_table('public', 'state_ethics_complaints',      'state_ethics_complaints exists');
select has_table('public', 'state_official_events',        'state_official_events exists');

-- 4-6. RLS enabled (stock_transactions removed)
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

-- 7. income_kind CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_financial_disclosures
     (official_id, filing_year, income_kind, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             2025, 'bribery', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'income_kind CHECK rejects bad value'
);

-- 8. status CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_ethics_complaints
     (official_id, complaint_date, status, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'pending_appeal', 'test', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'status CHECK rejects bad value'
);

-- 9. event_type CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_official_events
     (official_id, event_date, event_type, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'abducted_by_aliens', 'test', 'CA', 'https://x', 'openstates') $$,
  '23514', null, 'event_type CHECK rejects bad value'
);

-- 10. financial_disclosures (source, external_id) UNIQUE
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

-- 11. ethics_complaints external_id column type
select col_type_is('public', 'state_ethics_complaints', 'external_id', 'text',
  'state_ethics_complaints external_id is text (UNIQUE constraint per migration)');

-- 12. FK column type on financial_disclosures
select col_type_is('public', 'state_financial_disclosures', 'official_id', 'uuid',
  'state_financial_disclosures.official_id is uuid (FK is RESTRICT per migration)');

-- 13. Cleanup assertion
delete from public.state_financial_disclosures
  where official_id = (select id from public.officials where source_version = 'FX-si');
delete from public.officials where source_version = 'FX-si';
delete from public.districts where source_version = 'FX-si';
select pass('cleanup applied');

select * from finish();
rollback;
```

- [ ] **Step 3: Run `pnpm db:reset` to apply migration**

```bash
pnpm db:start   # ensure local Supabase is running
pnpm db:reset
```

Expected: All 53 migrations apply cleanly; `state_stock_transactions` table no longer exists.

Verify:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "select to_regclass('public.state_stock_transactions');"
```
Expected output: `(null)` (table doesn't exist).

- [ ] **Step 4: Run pgTAP to verify the updated test passes**

```bash
pnpm db:test
```

Expected: ALL pgTAP tests pass at adjusted plan count. The `state_ethics_rls.test.sql` file now runs 13 plans (down from 20). Total project pgTAP count drops from 409 → 402.

If the test fails with a "Looks like you planned N tests but ran M" error, the plan count is wrong — re-count and adjust.

- [ ] **Step 5: Regenerate `packages/db/src/types.ts`**

```bash
supabase gen types typescript --local > packages/db/src/types.ts
```

(Run from repo root; the `supabase` CLI uses the running local Supabase at `127.0.0.1:54322`.)

Verify the diff removes only the `state_stock_transactions` table block:
```bash
git diff packages/db/src/types.ts | grep "state_stock_transactions"
```
Expected: only `-` lines (deletions), no `+` additions.

- [ ] **Step 6: Run db typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: PASS (only the `Database` type changed; no usages broken yet since the rest of the code still references it via downstream packages).

Wait — `pnpm -r typecheck` will FAIL here because `@chiaro/officials` still has `StateStockTransactionRow = Database['public']['Tables']['state_stock_transactions']['Row']` which no longer resolves. That's expected; Task 2 fixes it.

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/db/supabase/migrations/0053_drop_state_stock_transactions.sql \
        packages/db/supabase/tests/state_ethics_rls.test.sql \
        packages/db/src/types.ts
git commit -m "$(cat <<'EOF'
feat(db): migration 0053 drop state_stock_transactions

Per slice 12 audit (docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md)
+ Gotcha #21: state legislatures have no STOCK Act analogue. Stock
holdings/sales are line items inside annual financial disclosures, not
a discrete data product. Table had zero rows in any environment.

- Drop state_stock_transactions table + 2 indexes
- Remove 7 stock-related plans from state_ethics_rls.test.sql
  (plan 20 → 13; project pgTAP 409 → 402)
- Regenerate packages/db/src/types.ts (Database type no longer
  includes state_stock_transactions)

Downstream cleanup (TS code) lands in Tasks 2-5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `@chiaro/officials` cleanup

**Files:**
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/queries.ts`
- Modify: `packages/officials/src/hooks.ts`
- Modify: `packages/officials/src/keys.ts`
- Modify: `packages/officials/src/index.ts`
- Modify: `packages/officials/test/queries.integration.test.ts`
- Modify: `packages/officials/test/hooks.test.tsx`

- [ ] **Step 1: Remove `StateStockTransactionRow` from `types.ts`**

In `packages/officials/src/types.ts`, find the block:
```ts
export type StateStockTransactionRow =
  Database['public']['Tables']['state_stock_transactions']['Row']
```

Delete the 2 lines + the trailing blank line if present.

- [ ] **Step 2: Remove `fetchOfficialStateStockTransactions` from `queries.ts`**

In `packages/officials/src/queries.ts`, find around line 327:
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
  if (error) throw error
  return (data ?? []) as StateStockTransactionRow[]
}
```

Delete the entire function (and any surrounding blank-line padding). Also remove `StateStockTransactionRow` from the `import` block at the top of the file (line 11 area).

- [ ] **Step 3: Remove `stateStockTransactions` key from `keys.ts`**

In `packages/officials/src/keys.ts`, find around line 25-26:
```ts
  stateStockTransactions: (officialId: string) =>
    ['officials', 'stateStockTransactions', officialId] as const,
```

Delete those 2 lines. (Note: `stockTransactions` for federal — line 35 — STAYS untouched.)

- [ ] **Step 4: Remove `useOfficialStateStockTransactions` from `hooks.ts`**

In `packages/officials/src/hooks.ts`:

1. Find around line 14: import line including `fetchOfficialStateStockTransactions`. Remove that one symbol from the comma-separated import list.
2. Find around line 26: import line including `StateStockTransactionRow`. Remove that one symbol.
3. Find around line 207-215:
```ts
export function useOfficialStateStockTransactions(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateStockTransactionRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateStockTransactions(officialId),
    queryFn: () => fetchOfficialStateStockTransactions(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}
```

Delete the entire function.

Federal `useOfficialStockTransactions` (line 103) STAYS untouched.

- [ ] **Step 5: Remove re-exports from `index.ts`**

In `packages/officials/src/index.ts`, find these lines (around 16, 43, 55):

Line 16 area (type export):
```ts
  StateStockTransactionRow,
```
Remove this symbol from the export-types block.

Line 43 area (query function export):
```ts
  fetchOfficialStateStockTransactions, fetchOfficialStateFinancialDisclosures,
```
Remove `fetchOfficialStateStockTransactions,` (keep the disclosures one).

Line 55 area (hook export):
```ts
  useOfficialStateStockTransactions, useOfficialStateFinancialDisclosures,
```
Remove `useOfficialStateStockTransactions,` (keep the disclosures one).

- [ ] **Step 6: Update `queries.integration.test.ts`**

In `packages/officials/test/queries.integration.test.ts`, find the `describe('fetchOfficialStateStockTransactions', ...)` block (search the file for that exact function name) and delete the entire `describe(...)` block including its contents.

If the test file has fixture setup that inserts into `state_stock_transactions`, remove those inserts too (the file may have `beforeAll` / `afterAll` hooks touching the table).

Run `grep -n "state_stock_transactions\|StateStockTransactionRow\|fetchOfficialStateStockTransactions" packages/officials/test/queries.integration.test.ts` after editing — should return 0 hits.

- [ ] **Step 7: Update `hooks.test.tsx`**

In `packages/officials/test/hooks.test.tsx`, find the `describe('useOfficialStateStockTransactions', ...)` block (or any tests referencing that hook) and delete them. Run the same grep to verify 0 hits.

- [ ] **Step 8: Verify typecheck + tests**

```bash
pnpm --filter @chiaro/officials typecheck
```
Expected: PASS.

```bash
pnpm --filter @chiaro/officials test
```
Expected: PASS. Integration tests that need `SUPABASE_SERVICE_ROLE_KEY` may skip if env var is unset — that's pre-existing CI-only behavior, not a Task 2 regression.

- [ ] **Step 9: Commit Task 2**

```bash
git add packages/officials/src packages/officials/test
git commit -m "$(cat <<'EOF'
refactor(officials): remove state stock transaction queries/hooks/types

Slice 12 audit confirmed state_stock_transactions table is over-specified
(no STOCK Act analogue at state level). Migration 0053 dropped the table;
this commit removes the downstream TS surface.

- Delete StateStockTransactionRow type
- Delete fetchOfficialStateStockTransactions query
- Delete useOfficialStateStockTransactions hook
- Delete officialsKeys.stateStockTransactions key
- Remove 3 re-export lines from index.ts
- Delete integration + hook tests for the removed surface

Federal stock_transactions queries/hooks/types are UNAFFECTED
(StockTransactionRow, fetchOfficialStockTransactions,
useOfficialStockTransactions, officialsKeys.stockTransactions all
preserved per Gotcha #21 federal/state schema asymmetry rationale).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `@chiaro/officials-ui` card refactor + list deletion

**Files:**
- Modify: `packages/officials-ui/src/state/StateFinancialActivityCard.tsx`
- Modify: `packages/officials-ui/test/state/StateFinancialActivityCard.test.tsx`
- Modify: `packages/officials-ui/test/state/StateOfficialDetailPage.test.tsx`
- Modify: `packages/officials-ui/src/index.ts`
- Delete: `packages/officials-ui/src/state/StateStockTransactionsList.tsx`
- Delete: `packages/officials-ui/test/state/StateStockTransactionsList.test.tsx`

- [ ] **Step 1: Refactor `StateFinancialActivityCard.tsx`**

Replace `packages/officials-ui/src/state/StateFinancialActivityCard.tsx` entire contents with:

```tsx
'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useOfficialStateFinancialDisclosures } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { StateFinancialDisclosuresList } from './StateFinancialDisclosuresList.tsx'

export interface StateFinancialActivityCardProps {
  officialId: string
}

export function StateFinancialActivityCard({
  officialId,
}: StateFinancialActivityCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const disclosures = useOfficialStateFinancialDisclosures(client, officialId)

  const [openDisc, setOpenDisc] = useState(false)

  if (disclosures.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Financial Disclosures</Text>
        <Text style={styles.muted}>Loading financial disclosures…</Text>
      </View>
    )
  }

  const discCount = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null

  if (discCount === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Financial Disclosures</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No financial-disclosure records on file for this legislator.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Financial Disclosures</Text>
      <Text style={styles.summary}>
        {discCount != null
          ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (latest ${latestYear})` : ''}`
          : '—'}
      </Text>

      <CardSubsection
        label={`Financial disclosures (${discCount ?? '—'})`}
        open={openDisc}
        onToggle={() => setOpenDisc(v => !v)}
      >
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
      </CardSubsection>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.neutral.background,
    borderColor: COLORS.neutral.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: COLORS.brand.text },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
})
```

Changes vs pre-Task-3:
- Removed `useOfficialStateStockTransactions` import + call
- Removed `StateStockTransactionsList` import
- Removed `openStock` state
- Removed `stock` data + count + summary line
- Title: "Financial Activity" → "Financial Disclosures"
- All-empty branch text rewritten
- Summary line simplified to disclosures-only
- 2 subsections → 1 subsection

- [ ] **Step 2: Update `StateFinancialActivityCard.test.tsx`**

Read the current test file. Find every reference to `useOfficialStateStockTransactions`, `StateStockTransactionsList`, "stock", "Stock", "Financial Activity" (as page title), and update:

- Remove the `vi.mock('@chiaro/officials', ...)` block's `useOfficialStateStockTransactions` mock entry. Keep `useOfficialStateFinancialDisclosures`.
- Remove any test case asserting stock count appears or stock subsection renders.
- Update any title-matching assertions: `getByText('Financial Activity')` → `getByText('Financial Disclosures')`.
- Update the all-empty test: should now assert "No financial-disclosure records on file for this legislator." instead of the previous "No stock or financial-disclosure records..."

The full updated test file content depends on what's currently there. Read the file first, surgical-edit each instance.

- [ ] **Step 3: Update `StateOfficialDetailPage.test.tsx`**

Read `packages/officials-ui/test/state/StateOfficialDetailPage.test.tsx`. The file likely has a `vi.mock('@chiaro/officials', ...)` block with many hook mocks including `useOfficialStateStockTransactions`. Remove only that one mock entry; leave all other hooks intact.

Also check for any assertion that "Financial Activity" title renders — update to "Financial Disclosures" if present.

- [ ] **Step 4: Delete `StateStockTransactionsList.tsx` + its test**

```bash
rm packages/officials-ui/src/state/StateStockTransactionsList.tsx
rm packages/officials-ui/test/state/StateStockTransactionsList.test.tsx
```

- [ ] **Step 5: Update `officials-ui/src/index.ts`**

In `packages/officials-ui/src/index.ts`, find around line 141-143:
```ts
export {
  StateStockTransactionsList,
  type StateStockTransactionsListProps,
} from './state/StateStockTransactionsList.tsx'
```

Delete those 4 lines (the entire export block).

`FederalStockTransactionsList` exports (around line 66-68) STAY untouched.

- [ ] **Step 6: Verify typecheck + tests**

```bash
pnpm --filter @chiaro/officials-ui typecheck
```
Expected: PASS.

```bash
pnpm --filter @chiaro/officials-ui test
```
Expected: PASS. Test count drops by the number of StateStockTransactionsList tests (likely 4-5) plus any stock-specific cases removed from StateFinancialActivityCard.test.tsx and StateOfficialDetailPage.test.tsx.

- [ ] **Step 7: Commit Task 3**

```bash
git add packages/officials-ui/src packages/officials-ui/test
git commit -m "$(cat <<'EOF'
refactor(officials-ui): StateFinancialActivityCard → disclosures-only

Per slice 12 audit + migration 0053: state_stock_transactions table
removed. UI surface follows:

- Refactor StateFinancialActivityCard:
  - Title "Financial Activity" → "Financial Disclosures"
  - Drop useOfficialStateStockTransactions hook + StateStockTransactionsList
    import + openStock state + stock subsection + stock summary line
  - All-empty branch now disclosures-only
  - Card keeps CardSubsection wrapper for UI consistency with other
    state cards (single subsection acceptable per slice 11 precedent)
- Delete StateStockTransactionsList component + test (~5 cases removed)
- Update StateFinancialActivityCard.test.tsx + StateOfficialDetailPage.test.tsx
  to drop stock mocks + stock-specific assertions
- Remove StateStockTransactionsList exports from officials-ui/src/index.ts

Federal stock_transactions UI surface (FederalStockTransactionsList,
FederalEthicsAccountabilityCard) UNAFFECTED — federal STOCK Act PTR
feed still exists.

File name StateFinancialActivityCard.tsx kept intentionally; rename
to StateFinancialDisclosuresCard would cascade into ~5 consumer
imports. Deferred to future polish slice.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: state-ethics seed/ingest cleanup

**Files:**
- Modify: `packages/db/supabase/seed/state-ethics/shared.ts`
- Modify: `packages/db/supabase/seed/state-ethics/shared.test.ts`
- Modify: `packages/db/supabase/seed/state-ethics-ingest.ts`
- Delete: `packages/db/supabase/seed/state-ethics/stock/` (entire directory: 5 adapters + index.ts + 5 test files = 11 files)

- [ ] **Step 1: Update `shared.ts`**

In `packages/db/supabase/seed/state-ethics/shared.ts`:

1. Update line 3 type:
```diff
- export type EthicsComponent = 'stock' | 'disclosures' | 'complaints' | 'events'
+ export type EthicsComponent = 'disclosures' | 'complaints' | 'events'
```

2. Delete lines 5-18 (the entire `NormalizedStockTransaction` interface).

3. Update lines 67-70 (the union type in `StateEthicsAdapter.fetchEvents` return):
```diff
   fetchEvents(opts: {
     client: Client
     state?: string
     fetcher?: () => Promise<unknown[]>
   }): Promise<Array<
-    NormalizedStockTransaction | NormalizedFinancialDisclosure |
+    NormalizedFinancialDisclosure |
     NormalizedEthicsComplaint | NormalizedOfficialEvent
   >>
```

4. Delete lines 94-123 (the entire `upsertStockTransaction` function).

- [ ] **Step 2: Update `shared.test.ts`**

In `packages/db/supabase/seed/state-ethics/shared.test.ts`:

1. Line 4: remove `upsertStockTransaction,` from the import.

2. Line 36: remove the entire `state_stock_transactions` cleanup line in `afterEach`:
```diff
-  await client.query('delete from public.state_stock_transactions    where official_id = $1', [officialId])
   await client.query('delete from public.state_financial_disclosures where official_id = $1', [officialId])
```

3. Lines 45-82: delete the entire `describe('upsertStockTransaction', ...)` block.

- [ ] **Step 3: Delete `state-ethics/stock/` directory**

```bash
rm -rf packages/db/supabase/seed/state-ethics/stock/
```

(PowerShell: `Remove-Item -Recurse -Force packages/db/supabase/seed/state-ethics/stock/`)

That deletes:
- `ca-fppc.ts` + `ca-fppc.test.ts`
- `ny-jcope.ts` + `ny-jcope.test.ts`
- `fl-coe.ts` + `fl-coe.test.ts`
- `tx-tec.ts` + `tx-tec.test.ts`
- `mi-board.ts` + `mi-board.test.ts`
- `index.ts`

= 11 files.

- [ ] **Step 4: Update `state-ethics-ingest.ts`**

In `packages/db/supabase/seed/state-ethics-ingest.ts`:

1. Lines 2-8 import block — remove `upsertStockTransaction,` and `NormalizedStockTransaction,`:
```diff
 import {
   type EthicsComponent, type StateEthicsAdapter, type StateEthicsStats,
-  upsertStockTransaction, upsertFinancialDisclosure,
+  upsertFinancialDisclosure,
   upsertEthicsComplaint, upsertOfficialEvent,
-  type NormalizedStockTransaction, type NormalizedFinancialDisclosure,
+  type NormalizedFinancialDisclosure,
   type NormalizedEthicsComplaint, type NormalizedOfficialEvent,
 } from './state-ethics/shared.ts'
```

2. Lines 13-14 — delete the stock adapters import:
```diff
- import { caFppcStock, nyJcopeStock, flCoeStock, txTecStock, miBoardStock }
-   from './state-ethics/stock/index.ts'
```

3. Lines 23-33 — update `ADAPTERS_DEFAULT`:
```diff
 const ADAPTERS_DEFAULT: StateEthicsAdapter[] = [
-  // stock
-  caFppcStock, nyJcopeStock, flCoeStock, txTecStock, miBoardStock,
   // disclosures
   caFppcDisclosures, nyJcopeDisclosures, flCoeDisclosures, txTecDisclosures, miBoardDisclosures,
   // complaints
   caFppcComplaints, nyJcopeComplaints, flCoeComplaints, txTecComplaints, miBoardComplaints,
   // events — OpenStates FIRST (resignation/death), then Ballotpedia (recalls), then per-state finance violations
   openstatesEndReason, ballotpediaRecalls,
   caFppcEvents, nyJcopeEvents, flCoeEvents, txTecEvents, miBoardEvents,
 ]
```

4. Lines 80-81 — remove the stock dispatch case in the orchestrator:
```diff
         for (const event of events) {
           let ok = false
-          if (adapter.component === 'stock') {
-            ok = await upsertStockTransaction(client, event as NormalizedStockTransaction)
-          } else if (adapter.component === 'disclosures') {
+          if (adapter.component === 'disclosures') {
             ok = await upsertFinancialDisclosure(client, event as NormalizedFinancialDisclosure)
           } else if (adapter.component === 'complaints') {
             ok = await upsertEthicsComplaint(client, event as NormalizedEthicsComplaint)
           } else if (adapter.component === 'events') {
             ok = await upsertOfficialEvent(client, event as NormalizedOfficialEvent)
           }
```

- [ ] **Step 5: Verify typecheck + tests**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

```bash
pnpm --filter @chiaro/db test state-ethics
```
Expected: PASS. Test count drops by ~3-5 (stock describe block from shared.test.ts) + ~15-20 (5 stock adapter tests × 3-4 cases each).

- [ ] **Step 6: Commit Task 4**

```bash
git add packages/db/supabase/seed/state-ethics-ingest.ts \
        packages/db/supabase/seed/state-ethics/shared.ts \
        packages/db/supabase/seed/state-ethics/shared.test.ts
git rm -r packages/db/supabase/seed/state-ethics/stock/
git commit -m "$(cat <<'EOF'
refactor(state-ethics): delete stock adapters + orchestrator dispatch

Per slice 12 audit + migration 0053. Removes the seed/ingest surface
for state_stock_transactions:

- Delete entire state-ethics/stock/ directory (5 adapters +
  index.ts + 5 test files = 11 files)
- Narrow EthicsComponent type: drop 'stock' member
- Remove NormalizedStockTransaction interface
- Remove upsertStockTransaction helper
- Update StateEthicsAdapter union return type
- Remove stock case from state-ethics-ingest.ts dispatch
- Remove stock cleanup from shared.test.ts afterEach hook
- Delete describe('upsertStockTransaction') block from shared.test.ts

State ethics adapter count: 25 → 20 (5 disclosures + 5 complaints +
5 events per-state + OpenStates + Ballotpedia + 5 events per-state).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Deprecate 6 wrong-premise stubs

**Files (12 total — 6 source + 6 test):**
- Modify: `packages/db/supabase/seed/state-community/town-halls/{ca-leginfo,fl-doe,mi-legislature,tx-capitol}.ts` (4 files)
- Modify: corresponding 4 `*.test.ts` files
- Modify: `packages/db/supabase/seed/state-ethics/complaints/mi-board.ts`
- Modify: `packages/db/supabase/seed/state-ethics/complaints/mi-board.test.ts`
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/tx-tec.ts`
- Modify: `packages/db/supabase/seed/state-ethics/disclosures/tx-tec.test.ts`

### Canonical example — `ca-leginfo.ts` town_halls

- [ ] **Step 1: Rewrite `ca-leginfo.ts`**

Replace `packages/db/supabase/seed/state-community/town-halls/ca-leginfo.ts` entire contents with:

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * CA does not maintain an aggregated state-government town-hall feed.
 * leginfo.ca.gov publishes institutional sessions/hearings only; town
 * halls live on individual senator/AM microsites (sdNN.senate.ca.gov,
 * aXX.asmdc.org) with no central index.
 *
 * Mobilize.us (slice 7 nationwide adapter at
 * state-community/town-halls/mobilize.ts) IS the production source for
 * CA state-legislator town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const caLeginfoTownHalls: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'halls',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
```

- [ ] **Step 2: Update `ca-leginfo.test.ts`**

Replace `packages/db/supabase/seed/state-community/town-halls/ca-leginfo.test.ts` entire contents with:

```ts
import { describe, expect, it } from 'vitest'
import { caLeginfoTownHalls } from './ca-leginfo.ts'

describe('caLeginfoTownHalls adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(caLeginfoTownHalls.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await caLeginfoTownHalls.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(caLeginfoTownHalls.slug).toBe('ca-leginfo')
  })

  it('component is halls', () => {
    expect(caLeginfoTownHalls.component).toBe('halls')
  })
})
```

- [ ] **Step 3: Run test to verify PASS**

```bash
pnpm --filter @chiaro/db test state-community/town-halls/ca-leginfo
```
Expected: 4 tests PASS.

### Remaining 5 stubs — same pattern with per-stub JSDoc

- [ ] **Step 4: Rewrite `fl-doe.ts` (town_halls)**

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * FL does not publish an aggregated member town-hall feed. flsenate.gov
 * calendar shows institutional sessions only; the House lacks even a
 * calendar UI.
 *
 * Mobilize.us (slice 7 nationwide adapter) covers FL state-legislator
 * town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const flDoeTownHalls: StateCommunityAdapter = {
  slug: 'fl-doe',
  component: 'halls',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
```

Update `fl-doe.test.ts` to match the canonical pattern (replace `caLeginfoTownHalls` with `flDoeTownHalls`, `'ca-leginfo'` with `'fl-doe'`, otherwise identical).

- [ ] **Step 5: Rewrite `mi-legislature.ts` (town_halls)**

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * MI does not publish an aggregated member town-hall feed.
 * Senator-by-senator coffee-hour pages exist on senate.michigan.gov +
 * house.mi.gov but with no central index.
 *
 * Mobilize.us (slice 7 nationwide adapter) covers MI state-legislator
 * town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const miLegislatureTownHalls: StateCommunityAdapter = {
  slug: 'mi-legislature',
  component: 'halls',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
```

Update `mi-legislature.test.ts` (per canonical pattern; substitute `miLegislatureTownHalls` + `'mi-legislature'`).

- [ ] **Step 6: Rewrite `tx-capitol.ts` (town_halls)**

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * Member calendars are not a feature of the Texas Capitol site;
 * capitol.texas.gov also has fragile uptime (slice 8/9/11 precedent —
 * 503/ECONNREFUSED during slice 12 audit window).
 *
 * Mobilize.us (slice 7 nationwide adapter) covers TX state-legislator
 * town halls.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const txCapitolTownHalls: StateCommunityAdapter = {
  slug: 'tx-capitol',
  component: 'halls',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedTownHall[]> {
    return []
  },
}
```

Update `tx-capitol.test.ts` (per canonical pattern; substitute `txCapitolTownHalls` + `'tx-capitol'`).

- [ ] **Step 7: Rewrite `complaints/mi-board.ts`**

```ts
import type { StateEthicsAdapter, NormalizedEthicsComplaint } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * Michigan does not publish a standing online portal for ethics
 * complaints against state legislators. MI Bureau of Elections
 * receives PFD-compliance complaints but does not expose them via a
 * public enforcement-actions feed.
 *
 * Recall/expulsion events for MI legislators continue to be sourced
 * via slice 9's Ballotpedia recalls adapter (nationwide). No source
 * exists for campaign-finance-violation events in MI.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const miBoardComplaints: StateEthicsAdapter = {
  slug: 'mi-board',
  component: 'complaints',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedEthicsComplaint[]> {
    return []
  },
}
```

Update `complaints/mi-board.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { miBoardComplaints } from './mi-board.ts'

describe('miBoardComplaints adapter — DEPRECATED (slice 13)', () => {
  it('covered_states is empty after deprecation', () => {
    expect(miBoardComplaints.covered_states).toEqual([])
  })

  it('fetchEvents returns [] regardless of opts', async () => {
    const result = await miBoardComplaints.fetchEvents({} as never)
    expect(result).toEqual([])
  })

  it('slug preserved for orchestrator dispatch continuity', () => {
    expect(miBoardComplaints.slug).toBe('mi-board')
  })

  it('component is complaints', () => {
    expect(miBoardComplaints.component).toBe('complaints')
  })
})
```

- [ ] **Step 8: Rewrite `disclosures/tx-tec.ts`**

```ts
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'

/**
 * @deprecated 2026-05-24 (slice 13, per slice 12 discovery audit)
 *
 * Texas Ethics Commission explicitly does not publish Personal
 * Financial Statements (PFS) online. The TEC Quick View page
 * states filings exist but the agency withholds the file feed.
 * No production parser is possible for TX financial disclosures
 * without CPRA-style request fulfillment.
 *
 * See docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md
 * + Gotcha #21 in CLAUDE.md.
 */
export const txTecDisclosures: StateEthicsAdapter = {
  slug: 'tx-tec',
  component: 'disclosures',
  covered_states: [],
  async fetchEvents(): Promise<NormalizedFinancialDisclosure[]> {
    return []
  },
}
```

Update `disclosures/tx-tec.test.ts` per canonical pattern (substitute `txTecDisclosures`, `'tx-tec'`, `'disclosures'`).

- [ ] **Step 9: Verify typecheck + tests**

```bash
pnpm --filter @chiaro/db typecheck
```
Expected: PASS.

```bash
pnpm --filter @chiaro/db test state-community/town-halls state-ethics/complaints state-ethics/disclosures
```
Expected: ALL 6 deprecated stub tests PASS (4 cases each = 24 cases). NY-side stubs (ny-senate town_halls, ny-jcope complaints, ny-jcope disclosures) UNAFFECTED.

- [ ] **Step 10: Commit Task 5**

```bash
git add packages/db/supabase/seed/state-community/town-halls/{ca-leginfo,fl-doe,mi-legislature,tx-capitol}.{ts,test.ts} \
        packages/db/supabase/seed/state-ethics/complaints/mi-board.{ts,test.ts} \
        packages/db/supabase/seed/state-ethics/disclosures/tx-tec.{ts,test.ts}
git commit -m "$(cat <<'EOF'
refactor(state-stubs): deprecate 6 wrong-premise stubs per slice 12 audit

Slice 11 ACLU/AFP pattern: @deprecated JSDoc + covered_states=[] +
fetchEvents returns []. Preserves orchestrator dispatch invariants;
makes adapter iteration a no-op for these (state, component) pairs.

Town halls (4 stubs — Mobilize.us slice 7 nationwide covers all 4):
- ca-leginfo (institutional sessions only on leginfo.ca.gov)
- fl-doe (flsenate.gov calendar shows institutional only; House no UI)
- mi-legislature (per-senator pages exist but no aggregated feed)
- tx-capitol (no member calendar feature + capitol.texas.gov flaky)

Ethics complaints (1 stub):
- mi-board (Michigan does not publish ethics enforcement feed)

Financial disclosures (1 stub):
- tx-tec (TEC explicitly withholds PFS filings online)

NY-side stubs (ny-senate town_halls, ny-jcope complaints + disclosures,
nyassembly + nysenate district_offices) UNTOUCHED — they ship as
production parsers in slice 14.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Slice 13 closure docs

**Files:**
- Modify: `CLAUDE.md`
- Create (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice13_stock_cleanup.md`
- Modify (outside repo): `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`

- [ ] **Step 1: Append slice 13 entry to CLAUDE.md**

Find the "## Slices delivered" section. The current last entry is slice 12 (stub adapter audit). Append immediately after:

```markdown
- **Slice 13 — Drop state_stock_transactions + deprecate 6 wrong-premise stubs** (2026-05-24): Schema cleanup applying slice 12 audit findings. Migration 0053 drops `state_stock_transactions` table (slice 5I over-specified per Gotcha #21 — state legislatures have no STOCK Act analogue). Deletes 5 stock stub adapters + `StateStockTransactionsList` shared component + `useOfficialStateStockTransactions` hook + related query/types. `StateFinancialActivityCard` becomes "Financial Disclosures" single-subsection card. Deprecates 6 confirmed wrong-premise stubs per slice 11 ACLU/AFP pattern (4 town_halls: CA/FL/MI/TX — Mobilize.us covers nationwide; 1 MI ethics_complaints — no published feed; 1 TX financial_disclosures — TEC withholds online). NY stubs preserved for slice 14 production-parser work. ~30 files; no new parsers; pgTAP 409 → 402 (7 stock RLS tests removed).
```

NO new Gotcha — Gotcha #21 (added in slice 12) already documents the schema rationale.

- [ ] **Step 2: Write memory file**

Create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice13_stock_cleanup.md`:

```markdown
---
name: project-chiaro-slice13-stock-cleanup
description: Slice 13 — drop state_stock_transactions + deprecate 6 wrong-premise stubs
metadata:
  type: project
---

Slice 13 shipped 2026-05-24 — ready for squash-merge to master.

**Scope:** Apply slice 12 audit findings — drop the over-specified `state_stock_transactions` table (migration 0053), refactor `StateFinancialActivityCard` to disclosures-only, delete the 5 stock stub adapters + related queries/hooks/types/list-component, and deprecate 6 wrong-premise stubs (4 town_halls + MI complaints + TX disclosures) per the slice 11 ACLU/AFP pattern. No new parsers (deferred to slice 14).

**What shipped:**
- Migration 0053 drops `state_stock_transactions` table + 2 indexes
- 7 pgTAP plans removed from `state_ethics_rls.test.sql` (project pgTAP 409 → 402)
- `packages/db/src/types.ts` regenerated (Database type no longer includes the table)
- `@chiaro/officials`: deleted StateStockTransactionRow type + fetchOfficialStateStockTransactions query + useOfficialStateStockTransactions hook + officialsKeys.stateStockTransactions key + 3 re-exports + integration/hook test cases
- `@chiaro/officials-ui`: deleted StateStockTransactionsList component + test; refactored StateFinancialActivityCard to disclosures-only (title rename "Financial Activity" → "Financial Disclosures", removed stock subsection + summary line)
- `state-ethics` seed/ingest: deleted entire `stock/` directory (11 files), narrowed EthicsComponent type, removed NormalizedStockTransaction interface + upsertStockTransaction helper, removed stock dispatch from state-ethics-ingest.ts
- 6 wrong-premise stubs deprecated with `@deprecated` JSDoc + `covered_states: []`: ca-leginfo/fl-doe/mi-legislature/tx-capitol town_halls + mi-board complaints + tx-tec disclosures

**Durable lessons:**

1. **Drop-vs-keep schema decision: drop wins when category doesn't exist.** Slice 12 audit confirmed `state_stock_transactions` was modeled on the federal STOCK Act PTR feed, but no state in CA/FL/MI/NY/TX has an equivalent (stock is buried inside annual financial disclosures). Keeping the empty table would have required maintaining a fiction operators have to re-verify on every audit cycle. Drop is honest.

2. **Federal/state schema asymmetry from Gotcha #15 is intentional + justified, but the unintentional asymmetry from over-specification needs correction.** Federal `stock_transactions` exists because federal STOCK Act exists. State side correctly drops `state_stock_transactions` while keeping `state_ethics_complaints` (asymmetry justified — state has ethics complaints; federal doesn't).

3. **Forward-only migration pattern (drop without restoring 0046).** Migration 0046 created the table; 0053 drops it. Both stay in the migration history (no squash). `pnpm db:reset` applies 0046 then 0053 in sequence — table is created, then immediately dropped. Acceptable per existing migration conventions; the table never had production data.

4. **Card refactor: single-subsection card pattern is acceptable.** `StateFinancialActivityCard` now has 1 collapsible subsection (`Financial disclosures`). Other state cards (e.g., `StateFinanceCard`) also have 1 main list. The `CardSubsection` wrapper is retained for UI consistency.

5. **File name preserved despite title rename.** `StateFinancialActivityCard.tsx` stays as the file name; only the displayed title changes ("Financial Activity" → "Financial Disclosures"). A file rename would cascade into 5+ consumer imports + 2 test renames for cosmetic improvement. Deferred to future polish slice.

6. **6-stub deprecation in 1 commit is a manageable batch.** Slice 11 deprecated 11 stubs (ACLU × 6 + AFP × 5) in one commit. Slice 13 does 6 in one commit. Both well under the threshold where reviewer fatigue becomes a risk.

7. **Stock RLS tests in `state_ethics_rls.test.sql` were per-table assertions, not per-policy.** The 7 removed plans (has_table, RLS-enabled, transaction_type CHECK, days_late generated column, NULL-distinct UNIQUE, duplicate-non-NULL UNIQUE, FK RESTRICT) were all table-level structural assertions. Each migration deserves its own pgTAP file long-term, but consolidating per-slice (5I groups all 4 ethics tables) is the existing convention.

**Active follow-ups (operator → slice 14):**
- 6 NY-weighted production parsers from slice 12 audit:
  - NY town_halls (nysenate.gov/events filterable feed)
  - CA + NY + MI district_offices
  - NY COELIG enforcement table (complaints + events combined)
  - TX TEC sworn-complaint orders (complaints + events combined)
- PDF-parsing slice for NY FDS + MI PFD (deferred)
- LCV-OR + PP × 5 browser-UA probe spike (slice 11 carryover)
- A11y batch (E + F + G from slice 10 follow-ups)
- Mobile DoD on-device smoke

**Master state at slice 13 closure:** HEAD = `<squash SHA>`. 11 workspace packages unchanged. Migrations 0001-0053; pgTAP 402 plans across 31 files (down from 409 — 7 stock plans removed). 7 production parsers total (unchanged from slice 11). State stub count after slice 13: 19 active (down from 30: −5 stock deleted, −6 deprecated). Of 19 active: 6 NY-side ready for slice 14 production parser work; 13 deferred (PDF / SPA / anti-bot / no source).

**Cross-links:** [[project-chiaro-slice5i-ethics-accountability]] [[project-chiaro-slice11-lcv-scorecards]] [[project-chiaro-slice12-stub-audit]]
```

- [ ] **Step 3: Update MEMORY.md index**

In `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`, find the slice 12 line and add a new line immediately after:

```markdown
- [Chiaro slice 13 stock cleanup](project_chiaro_slice13_stock_cleanup.md) — drop state_stock_transactions table (migration 0053) + delete stock TS surface (queries/hooks/types/list-component) + StateFinancialActivityCard → disclosures-only + 6 wrong-premise stub deprecations
```

- [ ] **Step 4: Verify full workspace tests + build**

```bash
pnpm -r typecheck
pnpm db:test
pnpm --filter @chiaro/db test
pnpm --filter @chiaro/officials test
pnpm --filter @chiaro/officials-ui test
pnpm --filter @chiaro/web build
```

Expected: all green.

`pnpm test` (full workspace) may fail on the 4 pre-existing integration tests requiring `SUPABASE_SERVICE_ROLE_KEY` env var — that's pre-slice-13 behavior, not a regression.

- [ ] **Step 5: Commit Task 6**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: slice 13 closure — CLAUDE.md entry

Slice 13 ships migration 0053 (drop state_stock_transactions) + the
downstream TS surface cleanup + 6 wrong-premise stub deprecations
per the slice 12 audit findings.

No new Gotcha — Gotcha #21 (added in slice 12) already documents the
schema rationale + per-state town_halls wrong-premise.

pgTAP 409 → 402 (7 stock RLS tests removed). State stub count:
30 → 19 (5 stock deleted, 6 deprecated).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Memory files at `~/.claude/projects/...` are outside the repo — write but do NOT git add.)

---

## Workspace verify gate

After all 6 tasks complete:

```bash
pnpm -r typecheck                       # 11 packages green
pnpm db:test                            # 402 pgTAP plans green
pnpm --filter @chiaro/db test           # state-ethics + state-community + others green
pnpm --filter @chiaro/officials test    # stock tests removed; rest green
pnpm --filter @chiaro/officials-ui test # StateStockTransactionsList tests removed; rest green
pnpm --filter @chiaro/web build         # 12 routes
git log master..HEAD --oneline          # 7 commits (spec + plan + 6 implementation)
```

Expected:
- 11 packages typecheck green
- pgTAP plan count: 402 (down from 409)
- Web build: 12 routes
- Branch: ~7 commits (1 spec + 1 plan already there + 6 implementation)

---

## Self-review notes

### Spec coverage

- ✅ Migration 0053 drop table → Task 1
- ✅ pgTAP test update → Task 1
- ✅ `packages/db/src/types.ts` regen → Task 1
- ✅ `@chiaro/officials` queries/hooks/types/keys/index cleanup → Task 2
- ✅ `@chiaro/officials` test cleanup → Task 2
- ✅ `@chiaro/officials-ui` StateFinancialActivityCard refactor → Task 3
- ✅ `@chiaro/officials-ui` StateStockTransactionsList deletion → Task 3
- ✅ `@chiaro/officials-ui` test updates → Task 3
- ✅ state-ethics shared.ts + ingest cleanup → Task 4
- ✅ state-ethics/stock/ directory deletion → Task 4
- ✅ 6 wrong-premise stub deprecations → Task 5
- ✅ CLAUDE.md slice entry + memory → Task 6
- ✅ Acceptance criteria covered by Task 6 Step 4 workspace verify gate

### Placeholder scan

No "TBD", "TODO", or "Similar to Task N" without code. Each task contains the full file content where applicable. Step-per-step code blocks show exact text to write.

The 4 town-halls stubs share an identical test pattern; Task 5 shows the canonical example (ca-leginfo) in full, then provides the per-stub JSDoc text + name substitutions for the remaining 3. The test pattern is identical except for the constant name + slug — the engineer substitutes 2 strings per file.

### Type consistency

- `EthicsComponent` narrowed from `'stock' | 'disclosures' | 'complaints' | 'events'` → `'disclosures' | 'complaints' | 'events'` consistently across Tasks 1 (pgTAP doesn't reference the TS type) + 4 (shared.ts type declaration + state-ethics-ingest.ts dispatch).
- `StateEthicsAdapter.fetchEvents` return type narrowed consistently in Task 4.
- 6 deprecated adapters all use identical shape: `{ slug, component, covered_states: [], async fetchEvents(): Promise<X[]> { return [] } }` where `X` matches the component (NormalizedTownHall / NormalizedEthicsComplaint / NormalizedFinancialDisclosure).
- 6 test files use identical structure (4 cases): `covered_states empty / fetchEvents [] / slug preserved / component matches`.

### Known incomplete details

- Task 1 Step 2 lists 7 pgTAP assertions to remove and shows the full replacement file. Exact line numbers could shift if the file changes between plan write + implementation; the implementer matches by content (search strings like "state_stock_transactions") rather than line numbers.
- Task 5 has 6 stub rewrites. The 4 town-halls are nearly identical (per-state JSDoc reasoning differs); the implementer copies the canonical example structure and adapts the JSDoc text + constant names per stub.
- Memory file template includes `<squash SHA>` placeholder — implementer fills it post-merge during the `finishing-a-development-branch` flow (matches slice 10/11/12 precedent).
