# Federal Town Halls + Stock Transactions Parity Implementation Plan (slice 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 2 federal/state schema asymmetries (`town_halls` + `stock_transactions`), extract shared helpers, eliminate slice 7 `as FinanceState` cast, and ship federal mobilize adapter.

**Architecture:** 2 schema migrations adding `source` + `external_id` columns + `(source, external_id)` UNIQUE on federal `town_halls` + `stock_transactions`. 2 new shared modules (`seed/shared/officials.ts` for `resolveOfficialByName` + `Chamber` union; `seed/shared/town-halls-helpers.ts` for `deriveFormat`). New federal mobilize adapter under `seed/federal-community/` with negative-lookbehind regex to reject state titles. Standalone `pnpm seed:federal-town-halls-mobilize` CLI script.

**Tech Stack:** Postgres 15 (Supabase), pgTAP, TypeScript strict mode, `pg` Client, vitest. Reuses slice 7 Mobilize.us API integration patterns.

**Spec:** `docs/superpowers/specs/2026-05-22-federal-town-halls-stock-parity-design.md`

---

## File structure

**Created (~11):**
```
packages/db/supabase/migrations/
  0051_town_halls_parity.sql
  0052_stock_transactions_parity.sql
packages/db/supabase/tests/
  town_halls_parity.test.sql
  stock_transactions_parity.test.sql
packages/db/supabase/seed/shared/
  officials.ts + officials.test.ts
  town-halls-helpers.ts + town-halls-helpers.test.ts
packages/db/supabase/seed/federal-community/town-halls/
  mobilize.ts + mobilize.test.ts
  mobilize-helpers.ts + mobilize-helpers.test.ts
packages/db/supabase/seed/fixtures/federal-community/
  mobilize.json
packages/db/supabase/seed/
  federal-community-mobilize-ingest.ts + .test.ts
```

**Modified (~10):**
```
packages/db/src/types.ts                                              # regen
packages/db/package.json                                              # +seed:federal-town-halls-mobilize
packages/db/supabase/seed/state-finance/shared.ts                     # remove resolveOfficialByName + re-export
packages/db/supabase/seed/state-finance/fetch-ca.ts                   # update import
packages/db/supabase/seed/state-finance/fetch-ny.ts                   # update import
packages/db/supabase/seed/state-finance/fetch-fl.ts                   # update import
packages/db/supabase/seed/state-finance/fetch-tx.ts                   # update import
packages/db/supabase/seed/state-finance/fetch-mi.ts                   # update import
packages/db/supabase/seed/state-community/town-halls/mobilize.ts      # drop `as FinanceState` cast
packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts   # re-export deriveFormat from shared
CLAUDE.md                                                             # +slice 8 entry + Gotcha #17
```

---

## Task 1: Migration 0051 — town_halls parity

**Files:**
- Create: `packages/db/supabase/migrations/0051_town_halls_parity.sql`
- Create: `packages/db/supabase/tests/town_halls_parity.test.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Slice 8: federal town_halls source/external_id parity with state pattern (slice 5H 0042).
-- Existing rows get source='legacy' backfill; external_id stays NULL (NULLs distinct per PG default).

alter table public.town_halls
  add column source       text,
  add column external_id  text;

update public.town_halls
  set source = 'legacy'
  where source is null;

alter table public.town_halls
  alter column source set not null;

alter table public.town_halls
  add constraint town_halls_source_external_id_unique
  unique (source, external_id);

comment on column public.town_halls.source is
  'Adapter slug. mobilize = production parser (slice 8); legacy = pre-slice-8 ingest from town-halls-ingest.ts.';
comment on column public.town_halls.external_id is
  'Per-source stable id for UPSERT dedup. NULL allowed (NULLs distinct per Postgres default). Legacy rows have NULL.';
```

- [ ] **Step 2: Write the pgTAP**

Create `packages/db/supabase/tests/town_halls_parity.test.sql`:

```sql
begin;

select plan(8);

-- 1-2. Columns exist
select has_column('public', 'town_halls', 'source',      'town_halls.source column exists');
select has_column('public', 'town_halls', 'external_id', 'town_halls.external_id column exists');

-- 3. source is NOT NULL
select col_not_null('public', 'town_halls', 'source', 'town_halls.source is NOT NULL');

-- 4. external_id allows NULL
select col_is_null('public', 'town_halls', 'external_id', 'town_halls.external_id allows NULL');

-- 5. Unique constraint exists
select has_index('public', 'town_halls', 'town_halls_source_external_id_unique',
  '(source, external_id) UNIQUE constraint present');

-- 6. (source, external_id) allows multiple NULL external_id (NULLs distinct)
-- Seed district + official + insert rows.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'CA', 'CA-FX-PAR', 'CA FX-PAR',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-par')
  on conflict (tier, code) do nothing;
insert into public.officials (bioguide_id, full_name, first_name, last_name,
    chamber, party, state, district_id, in_office, source_version)
  select 'FXPAR1', 'Test Par1', 'Test', 'Par1', 'federal_house', 'D', 'CA',
    d.id, true, 'FX-par'
  from public.districts d where d.code = 'CA-FX-PAR';
insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
  select id, '2026-01-01', 'in_person', 'CA', 'https://x', 'mobilize', null
  from public.officials where source_version = 'FX-par';
insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
  select id, '2026-01-02', 'in_person', 'CA', 'https://y', 'mobilize', null
  from public.officials where source_version = 'FX-par';
select pass('(source, external_id) UNIQUE allows multiple NULL external_id');

-- 7. (source, external_id) UNIQUE rejects duplicate non-NULL pair
insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
  select id, '2026-02-01', 'in_person', 'CA', 'https://z', 'mobilize', 'thp-1'
  from public.officials where source_version = 'FX-par';
select throws_ok(
  $$ insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
     select id, '2026-02-02', 'in_person', 'CA', 'https://z2', 'mobilize', 'thp-1'
     from public.officials where source_version = 'FX-par' $$,
  '23505', null,
  '(source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- 8. FK official_id RESTRICT (post-0026 + post-0051)
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-par' $$,
  '23503', null,
  'town_halls.official_id FK is RESTRICT'
);

-- Cleanup
delete from public.town_halls where official_id in
  (select id from public.officials where source_version = 'FX-par');
delete from public.officials where source_version = 'FX-par';
delete from public.districts where source_version = 'FX-par';

select * from finish();
rollback;
```

- [ ] **Step 3: Apply + verify**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -15
```

Expected: migrations 0001-0051 apply; `town_halls_parity.test.sql` reports 8/8 (or bump `plan(N)` ±1 if drift); pgTAP total bumps to ~401 across 30 files.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0051_town_halls_parity.sql \
        packages/db/supabase/tests/town_halls_parity.test.sql
git commit -m "feat(db): 0051 town_halls source/external_id parity + pgTAP plan(8)

Slice 8 federal/state schema parity. Federal town_halls now matches
state_town_halls (slice 5H 0042) shape: source NOT NULL + external_id
nullable + (source, external_id) UNIQUE with NULL-distinct semantics.

Existing rows backfilled source='legacy'. Future federal mobilize
adapter (slice 8 Task 8) writes with source='mobilize' + external_id
for stable UPSERT dedup."
```

---

## Task 2: Migration 0052 — stock_transactions parity

**Files:**
- Create: `packages/db/supabase/migrations/0052_stock_transactions_parity.sql`
- Create: `packages/db/supabase/tests/stock_transactions_parity.test.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Slice 8: federal stock_transactions source/external_id parity with state pattern (slice 5I 0046).
-- No federal adapter wired in slice 8 — just schema parity. Existing rows get source='legacy' backfill.

alter table public.stock_transactions
  add column source       text,
  add column external_id  text;

update public.stock_transactions
  set source = 'legacy'
  where source is null;

alter table public.stock_transactions
  alter column source set not null;

alter table public.stock_transactions
  add constraint stock_transactions_source_external_id_unique
  unique (source, external_id);

comment on column public.stock_transactions.source is
  'Adapter slug. Federal stock-transactions adapter not yet wired in slice 8; legacy = pre-slice-8 ingest from stock-watcher-ingest.ts.';
```

- [ ] **Step 2: Write the pgTAP**

Create `packages/db/supabase/tests/stock_transactions_parity.test.sql`:

```sql
begin;

select plan(8);

-- 1-2. Columns exist
select has_column('public', 'stock_transactions', 'source',      'stock_transactions.source column exists');
select has_column('public', 'stock_transactions', 'external_id', 'stock_transactions.external_id column exists');

-- 3. source NOT NULL
select col_not_null('public', 'stock_transactions', 'source', 'stock_transactions.source is NOT NULL');

-- 4. external_id allows NULL
select col_is_null('public', 'stock_transactions', 'external_id', 'stock_transactions.external_id allows NULL');

-- 5. Unique constraint exists
select has_index('public', 'stock_transactions', 'stock_transactions_source_external_id_unique',
  '(source, external_id) UNIQUE constraint present');

-- 6. Allows multiple NULL external_id
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'CA', 'CA-FX-STK', 'CA FX-STK',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-stk')
  on conflict (tier, code) do nothing;
insert into public.officials (bioguide_id, full_name, first_name, last_name,
    chamber, party, state, district_id, in_office, source_version)
  select 'FXSTK1', 'Test Stk1', 'Test', 'Stk1', 'federal_house', 'D', 'CA',
    d.id, true, 'FX-stk'
  from public.districts d where d.code = 'CA-FX-STK';

insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
  select id, '2026-01-01', '2026-01-15', 'https://x', 'house-stock-watcher', null
  from public.officials where source_version = 'FX-stk';
insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
  select id, '2026-01-02', '2026-01-16', 'https://y', 'house-stock-watcher', null
  from public.officials where source_version = 'FX-stk';
select pass('(source, external_id) UNIQUE allows multiple NULL external_id');

-- 7. Rejects duplicate non-NULL pair
insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
  select id, '2026-02-01', '2026-02-15', 'https://z', 'house-stock-watcher', 'hsw-1'
  from public.officials where source_version = 'FX-stk';
select throws_ok(
  $$ insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
     select id, '2026-02-02', '2026-02-16', 'https://z2', 'house-stock-watcher', 'hsw-1'
     from public.officials where source_version = 'FX-stk' $$,
  '23505', null,
  '(source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- 8. FK official_id RESTRICT
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-stk' $$,
  '23503', null,
  'stock_transactions.official_id FK is RESTRICT'
);

-- Cleanup
delete from public.stock_transactions where official_id in
  (select id from public.officials where source_version = 'FX-stk');
delete from public.officials where source_version = 'FX-stk';
delete from public.districts where source_version = 'FX-stk';

select * from finish();
rollback;
```

- [ ] **Step 3: Apply + verify**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -15
```

Expected: 401 → 409 pgTAP plans across 30 → 31 files.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0052_stock_transactions_parity.sql \
        packages/db/supabase/tests/stock_transactions_parity.test.sql
git commit -m "feat(db): 0052 stock_transactions source/external_id parity + pgTAP plan(8)

Slice 8 federal/state schema parity. Federal stock_transactions now
matches state_stock_transactions (slice 5I 0046) shape. No federal
production adapter wired in slice 8 — just schema. Existing rows
backfilled source='legacy'."
```

---

## Task 3: Regenerate Database type

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Regenerate**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

- [ ] **Step 2: Verify + typecheck**

```bash
grep -c "source.*: string\|external_id" packages/db/src/types.ts | tail -1
pnpm -r typecheck 2>&1 | tail -5
```

Expected: source/external_id refs increase by ~4 (2 tables × 2 columns); all 10 packages typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for town_halls + stock_transactions parity columns"
```

---

## Task 4: `seed/shared/officials.ts` (resolveOfficialByName + Chamber union)

**Files:**
- Create: `packages/db/supabase/seed/shared/officials.ts`
- Create: `packages/db/supabase/seed/shared/officials.test.ts`
- Modify: `packages/db/supabase/seed/state-finance/shared.ts`
- Modify: 5 files — `state-finance/fetch-{ca,ny,fl,tx,mi}.ts`
- Modify: `packages/db/supabase/seed/state-community/town-halls/mobilize.ts`

- [ ] **Step 1: Create shared module**

Create `packages/db/supabase/seed/shared/officials.ts`:

```ts
import type { Client } from 'pg'

export type Chamber =
  | 'state_house'
  | 'state_senate'
  | 'state_legislature'
  | 'federal_house'
  | 'federal_senate'

/**
 * Case-insensitive lookup of officials.id by full_name + state + chamber.
 * Used by state-finance/* + state-community/town-halls/mobilize +
 * federal-community/town-halls/mobilize.
 *
 * Moved from state-finance/shared.ts in slice 8. The original signature
 * constrained `state` to FinanceState (5-state union); slice 8 broadens
 * to plain string to support nationwide adapters (mobilize) without
 * type casts.
 */
export async function resolveOfficialByName(
  client: Client,
  opts: { full_name: string; state: string; chamber: Chamber },
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

- [ ] **Step 2: Write tests**

Create `packages/db/supabase/seed/shared/officials.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { resolveOfficialByName, type Chamber } from './officials.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialIdState: string
let officialIdFederal: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house', 'CA', 'CA-FX-OFF-S', 'CA OFF state',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-off-s'),
      ('federal_house', 'CA', 'CA-FX-OFF-F', 'CA OFF federal',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-off-f')
    on conflict (tier, code) do nothing
  `)
  const s = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-off-s', 'Jane Doe', 'Jane', 'Doe', 'state_house', 'D', 'CA',
      d.id, true, 'FX-off-s'
    from public.districts d where d.code = 'CA-FX-OFF-S'
    returning id
  `)
  officialIdState = s.rows[0]!.id
  const f = await client.query<{ id: string }>(`
    insert into public.officials (bioguide_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'FXOFFF1', 'John Smith', 'John', 'Smith', 'federal_house', 'D', 'CA',
      d.id, true, 'FX-off-f'
    from public.districts d where d.code = 'CA-FX-OFF-F'
    returning id
  `)
  officialIdFederal = f.rows[0]!.id
})

afterEach(async () => {
  await client.query("delete from public.officials where source_version in ('FX-off-s','FX-off-f')")
  await client.query("delete from public.districts where source_version in ('FX-off-s','FX-off-f')")
  await client.end()
})

describe('resolveOfficialByName', () => {
  it('resolves state legislator by name + state + chamber', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'Jane Doe', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialIdState)
  })

  it('resolves federal legislator with federal_house chamber', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'John Smith', state: 'CA', chamber: 'federal_house',
    })
    expect(id).toBe(officialIdFederal)
  })

  it('returns null for chamber mismatch (federal name with state chamber)', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'John Smith', state: 'CA', chamber: 'state_house' as Chamber,
    })
    expect(id).toBeNull()
  })

  it('case-insensitive name match', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'JANE DOE', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialIdState)
  })

  it('returns null for unknown name', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'Nobody Here', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests + verify**

```bash
pnpm --filter @chiaro/db test 'shared/officials'
```

Expected: 5 cases pass.

- [ ] **Step 4: Update state-finance/shared.ts**

Find the existing `resolveOfficialByName` definition and replace with re-export:

```ts
// At the top of state-finance/shared.ts, after the existing imports:
export { resolveOfficialByName, type Chamber } from '../shared/officials.ts'

// REMOVE the old `export async function resolveOfficialByName(...) { ... }` definition.
```

Verify the existing `FinanceState` type stays — it's still used internally by `StateFinanceAdapter`.

- [ ] **Step 5: Update 5 state-finance import paths**

In each of `state-finance/fetch-{ca,ny,fl,tx,mi}.ts`, the import block currently has:

```ts
import {
  // ...other imports,
  resolveOfficialByName,
} from './shared.ts'
```

Leave as-is — `state-finance/shared.ts` now re-exports `resolveOfficialByName` from the new location. **No fetch-XX.ts file changes needed.** Existing imports work via re-export. The re-export is intentional for backwards-compat.

- [ ] **Step 6: Drop slice 7 cast in state mobilize**

Open `packages/db/supabase/seed/state-community/town-halls/mobilize.ts`. Change:

```ts
// before:
import {
  resolveOfficialByName,
  type FinanceState,
} from '../../state-finance/shared.ts'
```

To:

```ts
// after:
import { resolveOfficialByName, type Chamber } from '../../shared/officials.ts'
```

Find the `resolveOfficialByName` call and drop the cast:

```ts
// before:
const officialId = await resolveOfficialByName(client, {
  full_name: name,
  state: state as FinanceState,
  chamber,
})

// after:
const officialId = await resolveOfficialByName(client, {
  full_name: name,
  state,
  chamber,
})
```

- [ ] **Step 7: Run all touched tests + typecheck**

```bash
pnpm --filter @chiaro/db test 'state-finance|state-community/town-halls/mobilize|shared/officials'
pnpm --filter @chiaro/db typecheck
```

Expected: all 5 state-finance test files still pass; slice 7 mobilize tests still pass; new shared/officials tests pass; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add packages/db/supabase/seed/shared/officials.ts \
        packages/db/supabase/seed/shared/officials.test.ts \
        packages/db/supabase/seed/state-finance/shared.ts \
        packages/db/supabase/seed/state-community/town-halls/mobilize.ts
git commit -m "refactor(seed): extract resolveOfficialByName to shared/officials.ts

Slice 8 cleanup. The helper now lives at seed/shared/officials.ts with
a broader Chamber union covering state + federal chambers, and state
typed as plain string (not FinanceState 5-state constraint).

state-finance/shared.ts re-exports resolveOfficialByName + Chamber for
backwards-compat with the 5 fetch-XX.ts imports (unchanged).

Slice 7 state-community/town-halls/mobilize.ts drops the
`as FinanceState` cast — uses the general Chamber type directly.
Eliminates the cross-domain cast tech debt documented in slice 7
memory.

5 new vitest cases verifying state + federal resolution + chamber
mismatch + case-insensitive match + null on unknown."
```

---

## Task 5: `seed/shared/town-halls-helpers.ts` (deriveFormat extraction)

**Files:**
- Create: `packages/db/supabase/seed/shared/town-halls-helpers.ts`
- Create: `packages/db/supabase/seed/shared/town-halls-helpers.test.ts`
- Modify: `packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts`

- [ ] **Step 1: Create shared module**

Create `packages/db/supabase/seed/shared/town-halls-helpers.ts`:

```ts
interface EventForFormat {
  is_virtual: boolean
  event_url: string | null
  location: { venue?: string } | null
}

const VIRTUAL_URL_RE = /zoom\.us|meet\.google|teams\.microsoft/i

/**
 * Maps a mobilize-style event payload to format enum. Tier-agnostic; used
 * by state-community/town-halls/mobilize-helpers.ts + federal-community/
 * town-halls/mobilize-helpers.ts.
 *
 * - is_virtual=true → 'virtual'
 * - zoom/meet/teams URL + venue → 'hybrid'
 * - zoom/meet/teams URL, no venue → 'virtual'
 * - else → 'in_person'
 *
 * Moved from state-community/town-halls/mobilize-helpers.ts in slice 8.
 */
export function deriveFormat(event: EventForFormat): 'in_person' | 'virtual' | 'phone' | 'hybrid' {
  if (event.is_virtual === true) return 'virtual'
  const eventUrl = event.event_url ?? ''
  const hasVirtualLink = VIRTUAL_URL_RE.test(eventUrl)
  const hasPhysicalLocation = !!event.location?.venue
  if (hasVirtualLink && hasPhysicalLocation) return 'hybrid'
  if (hasVirtualLink) return 'virtual'
  return 'in_person'
}
```

- [ ] **Step 2: Write tests**

Create `packages/db/supabase/seed/shared/town-halls-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveFormat } from './town-halls-helpers.ts'

describe('deriveFormat', () => {
  it('is_virtual=true → virtual', () => {
    expect(deriveFormat({ is_virtual: true, event_url: null, location: null })).toBe('virtual')
  })

  it('zoom URL + venue → hybrid', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://us02web.zoom.us/j/123',
      location: { venue: 'Capitol Room 100' },
    })).toBe('hybrid')
  })

  it('zoom URL no venue → virtual', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://us02web.zoom.us/j/123',
      location: null,
    })).toBe('virtual')
  })

  it('venue only, no virtual URL → in_person', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://www.mobilize.us/event/123/',
      location: { venue: 'Lafayette Library' },
    })).toBe('in_person')
  })

  it('google meet + venue → hybrid', () => {
    expect(deriveFormat({
      is_virtual: false,
      event_url: 'https://meet.google.com/abc-defg-hij',
      location: { venue: 'Capitol' },
    })).toBe('hybrid')
  })
})
```

- [ ] **Step 3: Update slice 7 state mobilize-helpers**

Open `packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts`. Find the existing `VIRTUAL_URL_RE` constant + `deriveFormat` function. Replace with re-export:

```ts
// At top of file, after existing imports:
export { deriveFormat } from '../../shared/town-halls-helpers.ts'

// REMOVE the existing `const VIRTUAL_URL_RE = ...` line.
// REMOVE the existing `export function deriveFormat(...) { ... }` definition.
// REMOVE the local MobilizeEventForFormat interface (the shared module has its own).
```

Keep the other helpers in this file (`STATE_LEGISLATOR_RE`, `NAME_RE`, `isStateLegislatorEvent`, `extractLegislatorName`, `inferChamberFromTitle`, `StateChamber` type).

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @chiaro/db test 'shared/town-halls-helpers|state-community/town-halls/mobilize-helpers'
pnpm --filter @chiaro/db typecheck
```

Expected: 5 new shared cases + existing slice 7 mobilize-helpers cases still pass; typecheck clean.

```bash
git add packages/db/supabase/seed/shared/town-halls-helpers.ts \
        packages/db/supabase/seed/shared/town-halls-helpers.test.ts \
        packages/db/supabase/seed/state-community/town-halls/mobilize-helpers.ts
git commit -m "refactor(seed): extract deriveFormat to shared/town-halls-helpers.ts

Slice 8 helper extraction. deriveFormat moves to seed/shared/town-halls-
helpers.ts; slice 7 state mobilize-helpers.ts re-exports it for
backwards-compat with slice 7 mobilize.ts + its tests.

Federal mobilize adapter (slice 8 Task 7) imports deriveFormat from
the same shared module — eliminates duplication.

5 new vitest cases verifying all 4 format paths + google meet."
```

---

## Task 6: Federal mobilize-helpers (regex + name + chamber)

**Files:**
- Create: `packages/db/supabase/seed/federal-community/town-halls/mobilize-helpers.ts`
- Create: `packages/db/supabase/seed/federal-community/town-halls/mobilize-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/db/supabase/seed/federal-community/town-halls/mobilize-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  isFederalLegislatorEvent,
  extractFederalLegislatorName,
  inferFederalChamber,
} from './mobilize-helpers.ts'

describe('isFederalLegislatorEvent', () => {
  it('matches "Senator <Name>" (federal)', () => {
    expect(isFederalLegislatorEvent('Town Hall with Senator Elizabeth Warren', '')).toBe(true)
  })
  it('matches "Representative <Name>"', () => {
    expect(isFederalLegislatorEvent('Town Hall with Representative Jim Jordan', '')).toBe(true)
  })
  it('matches "Congressman <Name>"', () => {
    expect(isFederalLegislatorEvent('Congressman Adam Smith Town Hall', '')).toBe(true)
  })
  it('matches "Congresswoman <Name>"', () => {
    expect(isFederalLegislatorEvent('Congresswoman Maria Lopez', '')).toBe(true)
  })
  it('matches "Rep. <Name>"', () => {
    expect(isFederalLegislatorEvent('Rep. John Doe Town Hall', '')).toBe(true)
  })
  it('REJECTS "State Senator <Name>"', () => {
    expect(isFederalLegislatorEvent('Town Hall with State Senator Mike Foote', '')).toBe(false)
  })
  it('REJECTS "State Rep. <Name>"', () => {
    expect(isFederalLegislatorEvent('State Rep. Emily Sirota — Community Town Hall', '')).toBe(false)
  })
  it('REJECTS "State Representative <Name>"', () => {
    expect(isFederalLegislatorEvent('State Representative Jane Roe', '')).toBe(false)
  })
  it('falls back to description when title has no match', () => {
    expect(isFederalLegislatorEvent('Open Forum', 'Featuring Senator John Doe')).toBe(true)
  })
})

describe('extractFederalLegislatorName', () => {
  it('extracts from "Senator <Name>"', () => {
    expect(extractFederalLegislatorName('Town Hall with Senator Elizabeth Warren')).toBe('Elizabeth Warren')
  })
  it('extracts from "Representative <Name>"', () => {
    expect(extractFederalLegislatorName('Town Hall with Representative Jim Jordan')).toBe('Jim Jordan')
  })
  it('extracts hyphenated last name', () => {
    expect(extractFederalLegislatorName('Senator Maria Lopez-Garcia Town Hall')).toBe('Maria Lopez-Garcia')
  })
  it('extracts from "Rep. <Name>"', () => {
    expect(extractFederalLegislatorName('Rep. John Doe Town Hall')).toBe('John Doe')
  })
  it('returns null for "State Senator <Name>" (rejected before extraction)', () => {
    expect(extractFederalLegislatorName('Town Hall with State Senator Mike Foote')).toBeNull()
  })
})

describe('inferFederalChamber', () => {
  it('"Senator" (no State prefix) → federal_senate', () => {
    expect(inferFederalChamber('Town Hall with Senator Warren')).toBe('federal_senate')
  })
  it('"Representative" → federal_house', () => {
    expect(inferFederalChamber('Representative Jordan')).toBe('federal_house')
  })
  it('"Congressman" → federal_house', () => {
    expect(inferFederalChamber('Congressman Smith')).toBe('federal_house')
  })
  it('"Congresswoman" → federal_house', () => {
    expect(inferFederalChamber('Congresswoman Lopez')).toBe('federal_house')
  })
  it('"Rep." → federal_house', () => {
    expect(inferFederalChamber('Rep. Doe')).toBe('federal_house')
  })
  it('"State Senator" → null (state-tier event)', () => {
    expect(inferFederalChamber('State Senator Foote')).toBeNull()
  })
  it('"State Rep." → null', () => {
    expect(inferFederalChamber('State Rep. Sirota')).toBeNull()
  })
  it('vague title → null', () => {
    expect(inferFederalChamber('Community Town Hall in Brooklyn')).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test 'federal-community/town-halls/mobilize-helpers'
```

Expected: module not found.

- [ ] **Step 3: Implement helpers**

Create `packages/db/supabase/seed/federal-community/town-halls/mobilize-helpers.ts`:

```ts
// Federal-tier title classifier. CRITICAL: must NOT match "State Senator" /
// "State Rep." / "State Representative" — uses negative lookbehind to skip
// events with "State" prefix. Lookbehind is supported in Node 22+ / V8 9+.

export const FEDERAL_LEGISLATOR_RE =
  /\b(?<!State\s)(?<!State\s+)(Senator|Representative|Congressman|Congresswoman|Rep\.?)\b/i

export const FEDERAL_NAME_RE =
  /(?<!State\s)(?<!State\s+)(?:Senator|Representative|Congressman|Congresswoman|Rep\.?)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,1})/

export function isFederalLegislatorEvent(title: string, description: string): boolean {
  return FEDERAL_LEGISLATOR_RE.test(title) || FEDERAL_LEGISLATOR_RE.test(description)
}

export function extractFederalLegislatorName(title: string): string | null {
  const m = title.match(FEDERAL_NAME_RE)
  return m ? m[1]! : null
}

export type FederalChamber = 'federal_house' | 'federal_senate'

export function inferFederalChamber(title: string): FederalChamber | null {
  // Senate first (Senator matches first in regex order).
  if (/\b(?<!State\s)Senator\b/i.test(title)) return 'federal_senate'
  if (/\b(?<!State\s)(Representative|Congressman|Congresswoman|Rep\.?)\b/i.test(title)) {
    return 'federal_house'
  }
  return null
}
```

- [ ] **Step 4: Verify lookbehind support + run**

```bash
pnpm --filter @chiaro/db test 'federal-community/town-halls/mobilize-helpers'
```

Expected: 21 cases pass. If lookbehind throws (very unlikely on Node 22+), fall back to the 2-step classifier pattern documented in spec Section 5 (match base pattern via positive regex, then filter via `!/State\s+(Senator|...)/.test(...)`).

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/federal-community/town-halls/mobilize-helpers.ts \
        packages/db/supabase/seed/federal-community/town-halls/mobilize-helpers.test.ts
git commit -m "feat(seed): federal mobilize-helpers — classifier + name + chamber

Federal-tier title regex with negative-lookbehind to reject 'State'
prefix (matches Senator, Representative, Congressman/woman, Rep.
but NOT State Senator / State Rep).

inferFederalChamber:
- Senator (no State prefix) → federal_senate
- Representative/Congressman/Rep. (no State prefix) → federal_house

21 vitest cases. Order matters in regex: Senate must precede House
since both contain capitalized 'State' prefix test condition."
```

---

## Task 7: Federal mobilize fixture

**Files:**
- Create: `packages/db/supabase/seed/fixtures/federal-community/mobilize.json`

- [ ] **Step 1: Create fixture**

```json
{
  "data": [
    {
      "id": 200001,
      "title": "Town Hall with Senator Elizabeth Warren",
      "description": "Senator Warren community town hall.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://www.mobilize.us/example/event/200001/",
      "location": {
        "venue": "Boston Convention Center",
        "address_lines": ["415 Summer St"],
        "locality": "Boston",
        "region": "MA",
        "postal_code": "02210",
        "country": "US"
      },
      "timeslots": [{ "id": 300001, "start_date": 1739491200, "end_date": 1739498400 }]
    },
    {
      "id": 200002,
      "title": "Representative Jim Jordan Town Hall",
      "description": "Constituent town hall in Lima, OH.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://us02web.zoom.us/j/567890",
      "location": {
        "venue": "Lima Civic Center",
        "locality": "Lima",
        "region": "OH",
        "country": "US"
      },
      "timeslots": [{ "id": 300002, "start_date": 1739577600, "end_date": 1739584800 }]
    },
    {
      "id": 200003,
      "title": "Town Hall with State Senator Mike Foote",
      "description": "CO state senator town hall.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://www.mobilize.us/example/event/200003/",
      "location": {
        "venue": "Lafayette Library",
        "locality": "Lafayette",
        "region": "CO",
        "country": "US"
      },
      "timeslots": [{ "id": 300003, "start_date": 1739664000, "end_date": 1739671200 }]
    },
    {
      "id": 200004,
      "title": "Congresswoman Maria Lopez Virtual Town Hall",
      "description": "Virtual town hall.",
      "event_type": "TOWN_HALL",
      "is_virtual": true,
      "event_url": "https://us02web.zoom.us/j/678901",
      "location": null,
      "timeslots": [{ "id": 300004, "start_date": 1739750400, "end_date": 1739757600 }]
    },
    {
      "id": 200005,
      "title": "Community Town Hall in Brooklyn",
      "description": "Town hall meeting.",
      "event_type": "TOWN_HALL",
      "is_virtual": false,
      "event_url": "https://www.mobilize.us/example/event/200005/",
      "location": {
        "venue": "Brooklyn Public Library",
        "locality": "Brooklyn",
        "region": "NY",
        "country": "US"
      },
      "timeslots": [{ "id": 300005, "start_date": 1739836800, "end_date": 1739844000 }]
    }
  ],
  "count": 5,
  "next": null,
  "previous": null
}
```

5 events covering: federal senate match (MA hybrid via zoom + venue), federal house match (OH), state senator REJECT (CO — federal classifier must skip), federal congresswoman virtual (no region), vague title REJECT (NY).

- [ ] **Step 2: Commit**

```bash
git add packages/db/supabase/seed/fixtures/federal-community/mobilize.json
git commit -m "feat(seed): federal mobilize.json fixture

5-event fixture mirroring Mobilize.us API shape. Exercises classifier
paths: federal senator (hybrid via zoom + venue), federal house,
state-senator REJECT (must skip to confirm negative-lookbehind),
federal congresswoman (virtual), vague title REJECT."
```

---

## Task 8: Federal mobilize adapter

**Files:**
- Create: `packages/db/supabase/seed/federal-community/town-halls/mobilize.ts`
- Create: `packages/db/supabase/seed/federal-community/town-halls/mobilize.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/db/supabase/seed/federal-community/town-halls/mobilize.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFederalMobilizeEvents, type FederalTownHallRow } from './mobilize.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'federal-community', 'mobilize.json')

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(officialId: string | null): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: officialId ? [{ id: officialId }] : [],
      rowCount: officialId ? 1 : 0,
    }),
  }
}

describe('federal mobilize adapter', () => {
  it('happy path: fixture returns federal events; rejects state + vague', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    // 5 fixture events: 3 federal (MA senator, OH rep, virtual congresswoman) + 1 state senator REJECT + 1 vague REJECT = 3 emitted
    expect(events).toHaveLength(3)
  })

  it('classifies MA hybrid (zoom + venue → hybrid)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const ma = events.find(e => e.state === 'MA')
    expect(ma).toBeDefined()
    expect(ma!.format).toBe('hybrid')
  })

  it('OH rep event has chamber inferred as federal_house', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const oh = events.find(e => e.state === 'OH')
    expect(oh).toBeDefined()
    // chamber field exists on FederalTownHallRow
    expect((oh as FederalTownHallRow).chamber).toBe('federal_house')
  })

  it('REJECTS state senator event (CO)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const co = events.find(e => e.state === 'CO')
    expect(co).toBeUndefined()
  })

  it('REJECTS vague title (NY)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    const ny = events.find(e => e.state === 'NY')
    expect(ny).toBeUndefined()
  })

  it('drops events with unresolved legislator names', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient(null) as never  // every name → unresolved
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    expect(events).toHaveLength(0)
  })

  it('sets source=mobilize + external_id=mobilize-{id}', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const client = mkClient('oid-fed') as never
    const events = await parseFederalMobilizeEvents(fixture.data, client)
    expect(events[0]!.source).toBe('mobilize')
    expect(events[0]!.external_id).toMatch(/^mobilize-/)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test 'federal-community/town-halls/mobilize.test'
```

Expected: module not found.

- [ ] **Step 3: Implement adapter**

Create `packages/db/supabase/seed/federal-community/town-halls/mobilize.ts`:

```ts
import type { Client } from 'pg'
import {
  isFederalLegislatorEvent,
  extractFederalLegislatorName,
  inferFederalChamber,
  type FederalChamber,
} from './mobilize-helpers.ts'
import { deriveFormat } from '../../shared/town-halls-helpers.ts'
import { resolveOfficialByName } from '../../shared/officials.ts'

const MOBILIZE_API_BASE = 'https://api.mobilize.us/v1/events'
const PER_PAGE = 100

interface MobilizeEvent {
  id: number
  title: string
  description?: string
  event_type: string
  is_virtual: boolean
  event_url: string | null
  location: {
    venue?: string
    address_lines?: string[]
    locality?: string
    region?: string
    postal_code?: string
    country?: string
  } | null
  timeslots: Array<{ id: number; start_date: number; end_date: number }>
}

interface MobilizeListResponse {
  data: MobilizeEvent[]
  count: number
  next: string | null
  previous: string | null
}

export interface FederalTownHallRow {
  official_id: string
  legislator_name: string
  chamber: FederalChamber
  event_date: string
  city?: string
  state: string
  format?: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  source_url: string
  source: 'mobilize'
  external_id: string
}

/**
 * Parse Mobilize events into FederalTownHallRow[]. Pure function; one
 * client.query per event for name → official_id resolution. Exported for tests.
 *
 * Returns only events that classify as FEDERAL and successfully resolve to
 * an official via resolveOfficialByName. State-tier events (titles with
 * "State Senator" / "State Rep" / "State Representative") are filtered out
 * via FEDERAL_LEGISLATOR_RE's negative-lookbehind in the helpers module.
 */
export async function parseFederalMobilizeEvents(
  events: MobilizeEvent[],
  client: Client,
): Promise<FederalTownHallRow[]> {
  const out: FederalTownHallRow[] = []
  for (const event of events) {
    const description = event.description ?? ''
    if (!isFederalLegislatorEvent(event.title, description)) continue

    const name = extractFederalLegislatorName(event.title)
      ?? extractFederalLegislatorName(description)
    if (!name) continue

    const state = event.location?.region
    if (!state || !/^[A-Z]{2}$/.test(state)) continue

    const chamber = inferFederalChamber(event.title) ?? inferFederalChamber(description)
    if (!chamber) continue

    const officialId = await resolveOfficialByName(client, {
      full_name: name, state, chamber,
    })
    if (!officialId) continue

    const startTs = event.timeslots[0]?.start_date
    if (!startTs) continue
    const eventDate = new Date(startTs * 1000).toISOString().slice(0, 10)

    out.push({
      official_id: officialId,
      legislator_name: name,
      chamber,
      event_date: eventDate,
      city: event.location?.locality,
      state,
      format: deriveFormat({
        is_virtual: event.is_virtual,
        event_url: event.event_url,
        location: event.location,
      }),
      source_url: event.event_url ?? `https://www.mobilize.us/events/${event.id}/`,
      source: 'mobilize',
      external_id: `mobilize-${event.id}`,
    })
  }
  return out
}

/**
 * Fetch + paginate Mobilize API; parse to FederalTownHallRow[].
 * Fails-empty on network errors (matches slice 7 stub fallback pattern).
 */
export async function fetchAndNormalizeFederal(client: Client): Promise<FederalTownHallRow[]> {
  const out: FederalTownHallRow[] = []
  let url: string | null = `${MOBILIZE_API_BASE}?event_types=town_hall&per_page=${PER_PAGE}`
  let pageCount = 0
  const MAX_PAGES = 50

  while (url && pageCount < MAX_PAGES) {
    pageCount += 1
    let body: MobilizeListResponse
    try {
      const resp = await fetch(url)
      if (!resp.ok) break
      body = await resp.json() as MobilizeListResponse
    } catch {
      break
    }
    const parsed = await parseFederalMobilizeEvents(body.data ?? [], client)
    out.push(...parsed)
    url = body.next ?? null
  }
  return out
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'federal-community/town-halls/mobilize.test'
pnpm --filter @chiaro/db typecheck
```

Expected: 7 cases pass; typecheck clean.

```bash
git add packages/db/supabase/seed/federal-community/town-halls/mobilize.ts \
        packages/db/supabase/seed/federal-community/town-halls/mobilize.test.ts
git commit -m "feat(seed): federal mobilize adapter — production parser

Mirror of slice 7 state mobilize adapter, but writes to federal
town_halls (not state_town_halls). Federal-tier classifier rejects
'State Senator' / 'State Rep' via negative-lookbehind. Reuses
deriveFormat from seed/shared/town-halls-helpers.ts + resolveOfficial
ByName from seed/shared/officials.ts.

FederalTownHallRow includes pre-resolved official_id (no double
resolution in the CLI INSERT). source='mobilize' + external_id=
mobilize-\${event.id} for stable UPSERT dedup via the new (source,
external_id) UNIQUE constraint on town_halls (migration 0051).

7 vitest cases (fixture-injected; parseFederalMobilizeEvents exported
for unit testing). Production fetcher fails-empty on network errors.
Hard-cap pagination at 50 pages."
```

---

## Task 9: Federal seed script + tests

**Files:**
- Create: `packages/db/supabase/seed/federal-community-mobilize-ingest.ts`
- Create: `packages/db/supabase/seed/federal-community-mobilize-ingest.test.ts`
- Modify: `packages/db/package.json` (+1 script)

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/federal-community-mobilize-ingest.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestFederalTownHallsMobilize } from './federal-community-mobilize-ingest.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('federal_house', 'OH', 'OH-FX-FM', 'OH FX-FM',
      st_geogfromtext('MULTIPOLYGON(((-84 40,-83 40,-83 41,-84 41,-84 40)))'),
      'FX-fm')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (bioguide_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'FXFM1', 'Jim Jordan', 'Jim', 'Jordan', 'federal_house', 'R', 'OH',
      d.id, true, 'FX-fm'
    from public.districts d where d.code = 'OH-FX-FM'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.town_halls where official_id = $1', [officialId])
  await client.query("delete from public.officials where source_version = 'FX-fm'")
  await client.query("delete from public.districts where source_version = 'FX-fm'")
  await client.end()
})

describe('ingestFederalTownHallsMobilize', () => {
  it('happy path: UPSERTs events to town_halls via (source, external_id) UNIQUE', async () => {
    const events = [{
      official_id: officialId,
      legislator_name: 'Jim Jordan',
      chamber: 'federal_house' as const,
      event_date: '2026-02-15',
      city: 'Lima',
      state: 'OH',
      format: 'in_person' as const,
      source_url: 'https://www.mobilize.us/example/200002/',
      source: 'mobilize' as const,
      external_id: 'mobilize-200002',
    }]
    const stats = await ingestFederalTownHallsMobilize({ client, fetcher: async () => events })
    expect(stats.rowsUpserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    const r = await client.query('select * from public.town_halls where external_id = $1', ['mobilize-200002'])
    expect(r.rowCount).toBe(1)
  })

  it('idempotent re-run UPSERTs same row via (source, external_id) UNIQUE', async () => {
    const events = [{
      official_id: officialId,
      legislator_name: 'Jim Jordan',
      chamber: 'federal_house' as const,
      event_date: '2026-02-15',
      city: 'Lima',
      state: 'OH',
      format: 'in_person' as const,
      source_url: 'https://x',
      source: 'mobilize' as const,
      external_id: 'mobilize-200002',
    }]
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => events })
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => events })
    const r = await client.query<{ c: number }>(
      "select count(*)::int as c from public.town_halls where external_id = 'mobilize-200002'"
    )
    expect(r.rows[0]!.c).toBe(1)
  })

  it('updates row when re-run with different source_url (UPSERT update)', async () => {
    const event1 = {
      official_id: officialId, legislator_name: 'Jim Jordan', chamber: 'federal_house' as const,
      event_date: '2026-02-15', city: 'Lima', state: 'OH', format: 'in_person' as const,
      source_url: 'https://original-url', source: 'mobilize' as const, external_id: 'mobilize-200002',
    }
    const event2 = { ...event1, source_url: 'https://updated-url' }
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => [event1] })
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => [event2] })
    const r = await client.query<{ source_url: string }>(
      "select source_url from public.town_halls where external_id = 'mobilize-200002'"
    )
    expect(r.rows[0]!.source_url).toBe('https://updated-url')
  })

  it('skipOnError: continues after one row throws', async () => {
    const events = [
      // First event: invalid official_id (FK failure → throws)
      {
        official_id: '00000000-0000-0000-0000-000000000000',
        legislator_name: 'Bad Bad', chamber: 'federal_house' as const,
        event_date: '2026-02-15', city: 'Nowhere', state: 'OH', format: 'in_person' as const,
        source_url: 'https://x', source: 'mobilize' as const, external_id: 'mobilize-fail',
      },
      // Second event: valid (should still ingest)
      {
        official_id: officialId, legislator_name: 'Jim Jordan', chamber: 'federal_house' as const,
        event_date: '2026-02-15', city: 'Lima', state: 'OH', format: 'in_person' as const,
        source_url: 'https://x', source: 'mobilize' as const, external_id: 'mobilize-200002',
      },
    ]
    const stats = await ingestFederalTownHallsMobilize({ client, skipOnError: true, fetcher: async () => events })
    expect(stats.rowsUpserted).toBe(1)
    expect(stats.errors.length).toBeGreaterThan(0)
  })

  it('default (no skipOnError): throws on FK violation', async () => {
    const events = [{
      official_id: '00000000-0000-0000-0000-000000000000',
      legislator_name: 'Bad Bad', chamber: 'federal_house' as const,
      event_date: '2026-02-15', city: 'Nowhere', state: 'OH', format: 'in_person' as const,
      source_url: 'https://x', source: 'mobilize' as const, external_id: 'mobilize-fail',
    }]
    await expect(ingestFederalTownHallsMobilize({ client, fetcher: async () => events }))
      .rejects.toThrow()
  })

  it('empty input → zero ingested, no errors', async () => {
    const stats = await ingestFederalTownHallsMobilize({ client, fetcher: async () => [] })
    expect(stats.rowsUpserted).toBe(0)
    expect(stats.errors).toEqual([])
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test federal-community-mobilize-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement orchestrator**

Create `packages/db/supabase/seed/federal-community-mobilize-ingest.ts`:

```ts
import { Client } from 'pg'
import {
  fetchAndNormalizeFederal,
  type FederalTownHallRow,
} from './federal-community/town-halls/mobilize.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface FederalMobilizeStats {
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
}

export interface IngestFederalTownHallsMobilizeOpts {
  client?: Client
  fetcher?: () => Promise<FederalTownHallRow[]>
  skipOnError?: boolean
}

export async function ingestFederalTownHallsMobilize(
  opts: IngestFederalTownHallsMobilizeOpts = {},
): Promise<FederalMobilizeStats> {
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const stats: FederalMobilizeStats = {
    rowsUpserted: 0, officialsMatched: 0, officialsUnmatched: [], errors: [],
  }

  try {
    const events = opts.fetcher
      ? await opts.fetcher()
      : await fetchAndNormalizeFederal(client)

    for (const e of events) {
      try {
        await client.query(`
          insert into public.town_halls (
            official_id, event_date, city, state, format,
            attendance_estimate, source_url, source, external_id
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (source, external_id) where external_id is not null
          do update set
            event_date          = excluded.event_date,
            city                = excluded.city,
            state               = excluded.state,
            format              = excluded.format,
            attendance_estimate = excluded.attendance_estimate,
            source_url          = excluded.source_url
        `, [
          e.official_id, e.event_date, e.city ?? null, e.state, e.format ?? null,
          null, e.source_url, e.source, e.external_id,
        ])
        stats.rowsUpserted += 1
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push((err as Error).message)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return stats
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const skipOnError = process.argv.includes('--skip-on-error')
  ingestFederalTownHallsMobilize({ skipOnError })
    .then(stats => {
      console.log(`Federal town halls (mobilize) ingest:`)
      console.log(`  rows upserted:        ${stats.rowsUpserted}`)
      console.log(`  officials matched:    ${stats.officialsMatched}`)
      console.log(`  officials unmatched:  ${stats.officialsUnmatched.length}`)
      console.log(`  errors:               ${stats.errors.length}`)
      if (stats.errors.length > 0) {
        for (const err of stats.errors.slice(0, 5)) console.log(`    - ${err}`)
      }
      process.exit(stats.errors.length === 0 ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 4: Add pnpm script**

Open `packages/db/package.json`. After the existing `seed:federal-*` or similar lines (or after `seed:state-ethics` if no federal seed exists yet), append:

```json
"seed:federal-town-halls-mobilize": "tsx supabase/seed/federal-community-mobilize-ingest.ts",
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/db test federal-community-mobilize-ingest
pnpm --filter @chiaro/db typecheck
```

Expected: 6 cases pass; typecheck clean.

```bash
git add packages/db/supabase/seed/federal-community-mobilize-ingest.ts \
        packages/db/supabase/seed/federal-community-mobilize-ingest.test.ts \
        packages/db/package.json
git commit -m "feat(db): federal-community-mobilize-ingest CLI orchestrator + pnpm script

Standalone federal town-halls ingest using the slice 8 mobilize adapter.
INSERT … ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
DO UPDATE — idempotent re-runs UPSERT updated metadata (event_date,
city, format, source_url).

DOES NOT touch the legacy town-halls-ingest.ts (federal bioguide_id-
based pipeline). Separate concern; future slice could unify.

CLI: pnpm seed:federal-town-halls-mobilize [--skip-on-error]

6 vitest cases against real local Supabase: happy path, idempotent,
UPSERT-update on re-run, skipOnError, default-throw, empty input."
```

---

## Task 10: CLAUDE.md slice 8 entry + Gotcha #17

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Slice 8 entry**

In `## Slices delivered`, after slice 7 entry, append:

```markdown
- **Slice 8 — federal town_halls + stock_transactions parity + mobilize adapter** (2026-05-22): closes 2 federal/state schema asymmetries documented in slice 7 closure. Migrations 0051 (town_halls) + 0052 (stock_transactions) add `source` + `external_id` columns + `(source, external_id)` UNIQUE; existing rows backfilled `source='legacy'`. Federal stock_transactions adapter NOT in scope (just schema). Federal `mobilize` adapter at `seed/federal-community/town-halls/mobilize.ts` writes to federal `town_halls` (mirroring slice 7 state mobilize). Shared helpers extracted: `seed/shared/officials.ts` (resolveOfficialByName + broader Chamber union) eliminates slice 7's `as FinanceState` cast; `seed/shared/town-halls-helpers.ts` (deriveFormat) deduplicates federal + state implementations. New `pnpm seed:federal-town-halls-mobilize` CLI. ~16 new pgTAP plans (393 → 409 across 31 files).
```

- [ ] **Step 2: Gotcha #17**

In `## Gotchas`, after current #16, append:

```markdown
17. **Federal/state mobilize adapter classifier asymmetry — negative-lookbehind on "State" prefix.** Federal `FEDERAL_LEGISLATOR_RE` at `seed/federal-community/town-halls/mobilize-helpers.ts` uses `\b(?<!State\s)(?<!State\s+)(Senator|Representative|Congressman|Congresswoman|Rep\.?)\b` to reject state-tier event titles. State `STATE_LEGISLATOR_RE` at `seed/state-community/town-halls/mobilize-helpers.ts` requires `\bState\s+` prefix to match. Chamber inference order matters: senate match must precede house in regex evaluation (both contain "State" prefix candidates). NE unicameral stays in state tier — no federal classification collision. Lookbehind requires Node 22+ / V8 9+ (deployed since 2021); fall back to 2-step classifier (positive regex + filter `!/State\s+(Senator|...)/`) if implementer environment lacks lookbehind support.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 8 entry + Gotcha #17 (federal mobilize classifier)

Slice 8 ships federal town_halls + stock_transactions schema parity +
federal mobilize adapter + shared helper extraction.

Gotcha #17 documents the federal/state mobilize classifier asymmetry:
federal regex uses negative-lookbehind to reject 'State' prefix;
state regex requires 'State' prefix to match. Chamber inference
order + NE unicameral edge case + lookbehind fallback documented."
```

---

## Task 11: Workspace verify + memory + branch handoff

**Files:**
- None (verification + memory writes only)

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm --filter @chiaro/db test
pnpm --filter @chiaro/web build 2>&1 | tail -5
pnpm db:reset
pnpm db:test 2>&1 | tail -15
```

Expected:
- All 10 packages typecheck clean
- `@chiaro/db` tests pass (5 shared/officials + 5 shared/town-halls-helpers + 21 federal mobilize-helpers + 7 federal mobilize + 6 federal-ingest = +44 new cases on top of existing)
- Web build clean
- All migrations 0001-0052 apply
- pgTAP 409 across 31 files (TIGER 4-failures expected per gotcha #6)

- [ ] **Step 2: Branch state**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: ~13 commits on `slice-8-federal-parity` ahead of master.

- [ ] **Step 3: Write slice 8 durable-lessons memory**

Create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice8_federal_parity.md`:

```markdown
---
name: project-chiaro-slice8-federal-parity
description: Slice 8 — federal town_halls + stock_transactions schema parity + mobilize adapter
metadata:
  node_type: memory
  type: project
---

Slice 8 shipped 2026-05-22 — squash SHA TBD (fill in after merge). ~13 commits on `slice-8-federal-parity` branch (1 spec + 1 plan + 11 implementation/docs).

**Closes 2 federal/state schema asymmetries documented in slice 7 closure:**

1. **Federal `town_halls`** now matches state shape (slice 5H 0042) — `source` NOT NULL + `external_id` nullable + `(source, external_id)` UNIQUE.
2. **Federal `stock_transactions`** now matches state shape (slice 5I 0046) — same column parity. No federal adapter wired in slice 8; just schema.

**What shipped:**

- Migrations 0051 + 0052 add columns + UNIQUE; existing rows backfill `source='legacy'`
- `seed/shared/officials.ts` (NEW) — moved `resolveOfficialByName` + broadened `Chamber` union covering state + federal chambers + state typed as plain `string`
- `seed/shared/town-halls-helpers.ts` (NEW) — moved `deriveFormat` from slice 7 state mobilize-helpers
- 5 `state-finance/fetch-XX.ts` imports unchanged (state-finance/shared.ts re-exports for backwards-compat)
- Slice 7 `state-community/town-halls/mobilize.ts` drops `as FinanceState` cast — uses general `Chamber` directly
- `seed/federal-community/town-halls/mobilize.ts` + helpers + fixture — federal-tier mobilize adapter
- `seed/federal-community-mobilize-ingest.ts` + CLI script `pnpm seed:federal-town-halls-mobilize`
- 2 new pgTAP files (16 plans); 393 → 409 across 31 files

**Durable Chiaro-specific lessons:**

1. **Slice 7 closure memory had a wrong follow-up.** Claimed federal `town_halls.official_id` FK CASCADE→RESTRICT was outstanding; migration 0026 (slice 5B audit closure) already flipped it along with 4 other federal FKs. Slice 8 confirmed via inspection. Future closure memories should verify follow-up claims against migration log before documenting.

2. **`(source, external_id) UNIQUE` with NULL-distinct semantics.** Standard Postgres NULLs-distinct UNIQUE allows multiple legacy rows (NULL external_id) to coexist while preventing duplicate non-NULL pairs. Backfill `source='legacy'` for pre-slice-8 rows; future production adapter rows get stable per-event external_id. UPSERT via `ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL` reaches the partial-unique branch only for adapter rows.

3. **Federal/state mobilize classifier — negative-lookbehind asymmetry.** Federal `FEDERAL_LEGISLATOR_RE` uses `(?<!State\s)` to reject titles like "State Senator Mike Foote". State `STATE_LEGISLATOR_RE` requires `State` prefix to match. Both regex patterns must be tested against the OTHER tier's fixture events to prove they don't cross-classify. Implementer wrote 21 vitest cases covering both directions for the federal regex.

4. **Chamber inference order matters in regex evaluation.** `inferFederalChamber()` checks Senator first, Representative second. Reversing the order would matter if any title contained "Senator-Representative Joint" (currently no such fixture); document as known edge case in Gotcha #17.

5. **`Chamber` union covers 5 values.** `'state_house' | 'state_senate' | 'state_legislature' | 'federal_house' | 'federal_senate'`. NE unicameral is `state_legislature` per slice 5C. The shared `resolveOfficialByName` accepts any of these; SQL filter does the discrimination.

6. **Shared module backwards-compat via re-export.** `state-finance/shared.ts` re-exports `resolveOfficialByName` + `Chamber` from new location to avoid touching the 5 `fetch-XX.ts` import lines. Same pattern: slice 7 state mobilize-helpers re-exports `deriveFormat` from new shared module. Reduces refactor blast radius.

7. **Federal seed script is standalone, not integrated with legacy `town-halls-ingest.ts`.** Slice 8 doesn't refactor the legacy bioguide_id-based ingest pipeline. Both pipelines coexist; operator runs `seed:federal-town-halls-mobilize` for the new path. Future slice could unify them into a multi-adapter orchestrator matching state-community-ingest.

8. **FederalTownHallRow includes `official_id` (pre-resolved in parse step).** Avoids double resolution in CLI INSERT — parseFederalMobilizeEvents calls resolveOfficialByName once; CLI uses the resolved id directly. Cleaner than slice 7 state mobilize which re-resolves via subquery in INSERT.

9. **Lookbehind support in Node 22+ / V8 9+.** Both deployed since 2021. Verified at implementation; no 2-step fallback needed. If future regex updates use new lookbehind variants (e.g., `(?<=…)` positive lookbehind), reverify support in vitest + esbuild build pipeline.

**Active follow-ups (operator):**

- Federal `stock_transactions` production adapter (slice 8 just schema; live source TBD — house-stock-watcher.com or senatestockwatcher.com)
- Unify legacy `town-halls-ingest.ts` with `federal-community-mobilize-ingest.ts` into a multi-adapter orchestrator (matches state-community pattern)
- Federal `district_offices` schema parity — state has `kind` + `hours_text` columns federal lacks (per slice 6 Task 4 discovery)
- Remaining ~35 stub adapters across 5G/5H/5I

**Master state at slice 8 closure:** HEAD = `<squash-SHA-after-merge>`. 10 workspace packages unchanged. Migrations 0001-0052. 409 pgTAP plans across 31 files. Web + mobile UI unified (slice 6). 2 production parsers live (slice 7 state mobilize + slice 8 federal mobilize). Federal/state schema asymmetries closed for town_halls + stock_transactions.

**Cross-links:** [[project-chiaro-slice5h-community-presence]] [[project-chiaro-slice7-parser-wiring]]
```

- [ ] **Step 4: Update MEMORY.md index**

Append to `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\MEMORY.md`:

```markdown
- [Chiaro slice 8 federal parity](project_chiaro_slice8_federal_parity.md) — federal town_halls + stock_transactions schema parity + federal mobilize adapter shipped 2026-05-22 (squash TBD). Migrations 0051+0052 add source/external_id cols + UNIQUE. Shared modules seed/shared/officials.ts + town-halls-helpers.ts dedupe federal+state implementations + eliminate slice 7 `as FinanceState` cast. Federal mobilize at seed/federal-community/ uses negative-lookbehind to reject state titles. New `pnpm seed:federal-town-halls-mobilize`. pgTAP 409 across 31 files.
```

- [ ] **Step 5: Hand off via finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch`. Recommended: option 1 (squash merge to master locally), matching prior 11 sub-slices.

---

## Verification Checklist (post-Task 11)

- [ ] Migrations 0051 + 0052 apply cleanly; town_halls + stock_transactions both have source NOT NULL + external_id nullable + (source, external_id) UNIQUE
- [ ] Legacy rows backfilled with `source='legacy'`
- [ ] `seed/shared/officials.ts` exists; `Chamber` union covers state + federal chambers
- [ ] `seed/shared/town-halls-helpers.ts` exists; deriveFormat extracted
- [ ] state-finance/shared.ts re-exports resolveOfficialByName + Chamber for backwards-compat
- [ ] Slice 7 mobilize.ts drops `as FinanceState` cast
- [ ] Federal mobilize adapter classifies federal titles via negative-lookbehind; rejects "State Senator/Rep" titles
- [ ] inferFederalChamber: Senator → federal_senate; Rep./Congressman/Congresswoman → federal_house
- [ ] FederalTownHallRow includes pre-resolved official_id
- [ ] CLI `pnpm seed:federal-town-halls-mobilize` works + idempotent re-run via UNIQUE
- [ ] Workspace typecheck clean across all 10 packages
- [ ] pgTAP 409 across 31 files
- [ ] Next 15 build clean
- [ ] No new env vars required

## Known v1 limitations carried over from spec

1. Federal `stock_transactions` adapter not in scope (schema only)
2. Legacy federal `town-halls-ingest.ts` unchanged (parallel pipeline)
3. Negative-lookbehind requires Node 22+ / V8 9+
4. Chamber inference fails for joint federal titles (edge case)
5. NE unicameral stays in state tier (no federal collision)
6. No CI validation of real federal Mobilize fetches
7. Backfill `source='legacy'` uniformly applied
8. `(source, external_id)` UNIQUE doesn't dedupe legacy NULL-external_id rows
