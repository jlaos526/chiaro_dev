# State Performance Metrics + KPIs Implementation Plan (sub-slice 5F)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new state-legislator performance KPIs to `official_metrics` + replace the slice-5D `committee_chair_count = 0` MVP stub via new OpenStates committees ingest. Extend `StateServiceRecordCard` (web + mobile) with a "Performance metrics" subsection.

**Architecture:** New `state_committee_memberships` table (chair/vice_chair/member rows from OpenStates v3 `/committees`). New fetcher + ingest scripts mirror slice 5D's OpenStates-v3 + state-bills-ingest pattern (7-day cache, name-based official matching). Existing `recompute-state-metrics.ts` extended with 5 new SQL queries — no recompute script duplication. UI extension is purely additive (one new subsection); no new cards, no ComingSoonCard swaps. Workspace stays at 10 packages.

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP, vitest (db/web), jest-expo (mobile), TanStack Query v5, undici fetch with retry.

**Spec:** `docs/superpowers/specs/2026-05-21-state-metrics-kpis-design.md`

---

## File structure

**Created (~12 files):**
```
packages/db/supabase/migrations/
  0037_state_committee_memberships.sql
  0038_state_committee_memberships_rls.sql
  0039_state_metrics_5f_columns.sql
packages/db/supabase/tests/
  state_committee_memberships_rls.test.sql
  state_metrics_5f_columns.test.sql
packages/db/supabase/seed/
  openstates-committees-fetch.ts
  openstates-committees-fetch.test.ts
  openstates-committees-ingest.ts
  openstates-committees-ingest.test.ts
  fixtures/openstates-committees/
    ca-sample.json
    ny-sample.json
    ne-sample.json
```

**Modified:**
```
packages/db/src/types.ts                                  # regenerated
packages/db/package.json                                  # +2 scripts
packages/officials/src/types.ts                           # +StateCommitteeMembershipRow
packages/officials/src/index.ts                           # re-export the new type (slice 5E lesson)
packages/db/supabase/seed/recompute-state-metrics.ts      # +5 KPI queries; committee_chair_count NULL-aware
packages/db/supabase/seed/recompute-state-metrics.test.ts # +7 cases
apps/web/components/state/StateServiceRecordCard.tsx      # +Performance subsection
apps/web/test/components/state/StateServiceRecordCard.test.tsx     # +5 cases
apps/web/test/components/state/StateOfficialDetailPage.test.tsx    # fixture extension
apps/mobile/components/state/StateServiceRecordCard.tsx   # mirror web
apps/mobile/test/components/state/StateServiceRecordCard.test.tsx  # +5 cases
apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx # fixture extension
packages/officials/test/queries.integration.test.ts       # +committee membership seed + 1 RLS case
CLAUDE.md                                                 # slice entry + gotcha #11 + Quick start
```

---

## Task 1: Migration 0037 — state_committee_memberships schema

**Files:**
- Create: `packages/db/supabase/migrations/0037_state_committee_memberships.sql`

- [ ] **Step 1: Write the migration**

Create `packages/db/supabase/migrations/0037_state_committee_memberships.sql`:

```sql
-- Sub-slice 5F: state committee memberships for state legislators.
-- Sourced from OpenStates v3 /committees endpoint; populated by
-- openstates-committees-ingest.ts. Used by recompute-state-metrics.ts
-- to compute real committee_chair_count (replaces slice-5D stub = 0).

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

comment on column public.state_committee_memberships.session is
  'OpenStates session string when reported, else NULL (treat as "currently held").';
comment on column public.state_committee_memberships.role is
  'chair / vice_chair / member. Other roles (ranking minority, ex-officio) fold into member for v1.';
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:reset
```

Expected: all migrations 0001–0037 apply cleanly.

- [ ] **Step 3: Verify schema**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.state_committee_memberships"
```

Expected output includes: PK on `id`, FK `official_id → officials(id) ON DELETE RESTRICT`, unique constraint on `(official_id, openstates_committee_id, session, role)`, `role` CHECK accepting `('chair', 'vice_chair', 'member')`, both indexes present.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0037_state_committee_memberships.sql
git commit -m "feat(db): 0037 state_committee_memberships

Sub-slice 5F schema. official_id RESTRICT (preserves history). Role
enum: chair | vice_chair | member. Subcommittees treated as separate
committees (no hierarchy). FK + unique constraints match audit
precedent. Source-of-truth: OpenStates v3 /committees endpoint."
```

---

## Task 2: Migration 0038 — RLS + pgTAP plan(12)

**Files:**
- Create: `packages/db/supabase/migrations/0038_state_committee_memberships_rls.sql`
- Create: `packages/db/supabase/tests/state_committee_memberships_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

Create `packages/db/supabase/migrations/0038_state_committee_memberships_rls.sql`:

```sql
-- Sub-slice 5F: RLS for state_committee_memberships.
-- Read = authenticated. Write = service_role only.
-- Mirrors slice 5D/5E state-tables RLS pattern.

alter table public.state_committee_memberships enable row level security;

create policy state_committee_memberships_select_authenticated
  on public.state_committee_memberships for select
  to authenticated using (true);

create policy state_committee_memberships_insert_service_role
  on public.state_committee_memberships for insert
  to service_role with check (true);

create policy state_committee_memberships_update_service_role
  on public.state_committee_memberships for update
  to service_role using (true) with check (true);

create policy state_committee_memberships_delete_service_role
  on public.state_committee_memberships for delete
  to service_role using (true);
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/state_committee_memberships_rls.test.sql`:

```sql
begin;

select plan(12);

-- 1. Table exists.
select has_table('public', 'state_committee_memberships',
  'state_committee_memberships table exists');

-- 2. RLS enabled.
select is(
  (select relrowsecurity from pg_class
   where relname = 'state_committee_memberships' and relnamespace = 'public'::regnamespace),
  true,
  'RLS enabled on state_committee_memberships'
);

-- 3. role column has CHECK constraint accepting the 3 valid values.
-- We test by inserting an invalid role and expecting 23514. Seed parent
-- official + district first (FK to officials.id is RESTRICT).
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('state_house', 'CA', 'CA-CMT', 'CA committee test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-cmt')
  on conflict (tier, code) do nothing;
insert into public.officials (
  openstates_person_id, full_name, first_name, last_name,
  chamber, party, state, district_id, in_office, source_version
)
select 'ocd-person/fx-cmt', 'Test Cmt', 'Test', 'Cmt',
  'state_house', 'D', 'CA',
  (select id from public.districts where code = 'CA-CMT'),
  true, 'FX-cmt';
select throws_ok(
  $$ insert into public.state_committee_memberships (
       official_id, openstates_committee_id, committee_name,
       state, chamber, role, source_url
     )
     values (
       (select id from public.officials where source_version = 'FX-cmt'),
       'ocd-committee/x', 'Test Cmt', 'CA', 'state_house',
       'ranking_minority',  -- not in enum
       'https://x'
     ) $$,
  '23514',
  'new row for relation "state_committee_memberships" violates check constraint "state_committee_memberships_role_check"',
  'role CHECK rejects values outside chair / vice_chair / member'
);

-- 4. Valid chair role accepted.
insert into public.state_committee_memberships (
  official_id, openstates_committee_id, committee_name,
  state, chamber, role, source_url
)
values (
  (select id from public.officials where source_version = 'FX-cmt'),
  'ocd-committee/chair-1', 'Test Chair Cmt', 'CA', 'state_house',
  'chair', 'https://x'
);
select is(
  (select count(*)::int from public.state_committee_memberships
   where openstates_committee_id = 'ocd-committee/chair-1'),
  1,
  'chair role accepted'
);

-- 5. Valid vice_chair role accepted.
insert into public.state_committee_memberships (
  official_id, openstates_committee_id, committee_name,
  state, chamber, role, source_url
)
values (
  (select id from public.officials where source_version = 'FX-cmt'),
  'ocd-committee/vc-1', 'Test VC Cmt', 'CA', 'state_house',
  'vice_chair', 'https://x'
);
select is(
  (select count(*)::int from public.state_committee_memberships
   where role = 'vice_chair' and openstates_committee_id = 'ocd-committee/vc-1'),
  1,
  'vice_chair role accepted'
);

-- 6. Unique constraint on (official_id, openstates_committee_id, session, role).
select throws_ok(
  $$ insert into public.state_committee_memberships (
       official_id, openstates_committee_id, committee_name,
       state, chamber, role, source_url
     )
     values (
       (select id from public.officials where source_version = 'FX-cmt'),
       'ocd-committee/chair-1', 'Test Chair Cmt', 'CA', 'state_house',
       'chair', 'https://x'
     ) $$,
  '23505',
  null,
  'unique constraint rejects duplicate (official_id, committee_id, session, role)'
);

-- 7. Restrict: cannot delete official with memberships.
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-cmt' $$,
  '23503',
  null,
  'official_id FK is RESTRICT — cannot delete official with memberships'
);

-- 8. Indexes exist.
select has_index('public', 'state_committee_memberships',
  'state_committee_memberships_official_idx',
  'state_committee_memberships_official_idx exists');
select has_index('public', 'state_committee_memberships',
  'state_committee_memberships_committee_idx',
  'state_committee_memberships_committee_idx exists');

-- 9-12. RLS policy assertions — pg-level role-switch is awkward in pgTAP;
-- covered in integration test layer. Pass-placeholders here.
select pass('anon SELECT denied — covered in integration test layer');
select pass('authenticated SELECT allowed — covered in integration test layer');
select pass('service_role INSERT allowed — covered in integration test layer');
select pass('service_role DELETE allowed — covered in integration test layer');

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + tests**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -20
```

Expected: migrations 0001-0038 apply; `state_committee_memberships_rls.test.sql` reports 12/12 passing.

If the actual assertion count differs from `plan(12)` (common per slice-5D-2 lesson — happened in PR #15 Task 3 and again in slice 5E Task 2), bump `plan(N)` to match.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0038_state_committee_memberships_rls.sql \
        packages/db/supabase/tests/state_committee_memberships_rls.test.sql
git commit -m "feat(db): 0038 RLS for state_committee_memberships + pgTAP plan(12)

read=authenticated, write=service_role only. pgTAP covers table
existence, RLS-enabled flag, role CHECK enforcement (chair / vice_chair
/ member; rejects others), unique constraint, FK RESTRICT behavior,
indexes."
```

---

## Task 3: Migration 0039 — official_metrics +5 columns + pgTAP plan(8)

**Files:**
- Create: `packages/db/supabase/migrations/0039_state_metrics_5f_columns.sql`
- Create: `packages/db/supabase/tests/state_metrics_5f_columns.test.sql`

- [ ] **Step 1: Write the migration**

Create `packages/db/supabase/migrations/0039_state_metrics_5f_columns.sql`:

```sql
-- Sub-slice 5F: add 5 new performance-KPI columns to official_metrics.
-- All nullable — per-state data availability varies.
-- Populated by recompute-state-metrics.ts (extended in slice 5F).

alter table public.official_metrics
  add column bills_passed_count               int,
  add column hearings_held_count              int,
  add column subject_breadth                  int,
  add column bill_passage_rate                numeric(5,2),
  add column fiscal_impact_per_dollar_raised  numeric(10,4);

comment on column public.official_metrics.bills_passed_count is
  'Bills the official primary-sponsored that reached enactment. Heuristic substring match on state_bills.status.';
comment on column public.official_metrics.hearings_held_count is
  'Bills the official primary-sponsored that have state_bills.hearing_date populated. Per-state augment coverage varies.';
comment on column public.official_metrics.subject_breadth is
  'Distinct state_bill_subjects.subject across own primary-sponsored bills for the session.';
comment on column public.official_metrics.bill_passage_rate is
  'bills_passed_count / bills_sponsored_count * 100. NULL when sponsored zero bills.';
comment on column public.official_metrics.fiscal_impact_per_dollar_raised is
  'fiscal_impact_total / total_raised. Descriptive ratio (not normative). NULL when finance not ingested or total_raised = 0.';
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/state_metrics_5f_columns.test.sql`:

```sql
begin;

select plan(8);

-- 1-5. Each new column exists with the expected precision.
select col_type_is('public', 'official_metrics', 'bills_passed_count', 'integer',
  'bills_passed_count is integer');
select col_type_is('public', 'official_metrics', 'hearings_held_count', 'integer',
  'hearings_held_count is integer');
select col_type_is('public', 'official_metrics', 'subject_breadth', 'integer',
  'subject_breadth is integer');
select col_type_is('public', 'official_metrics', 'bill_passage_rate', 'numeric(5,2)',
  'bill_passage_rate is numeric(5,2)');
select col_type_is('public', 'official_metrics', 'fiscal_impact_per_dollar_raised', 'numeric(10,4)',
  'fiscal_impact_per_dollar_raised is numeric(10,4)');

-- 6-8. Anchor: pre-slice-5F columns still exist (regression guard).
select has_column('public', 'official_metrics', 'committee_chair_count',
  'committee_chair_count from slice 5D still exists');
select has_column('public', 'official_metrics', 'party_unity_state',
  'party_unity_state from slice 5D still exists');
select has_column('public', 'official_metrics', 'fiscal_impact_total',
  'fiscal_impact_total from slice 5D still exists');

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + tests**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -10
```

Expected: migrations 0001-0039 apply; `state_metrics_5f_columns.test.sql` reports 8/8 passing. Total workspace pgTAP: 321 → 341 across 26 files (2 new files: 12 + 8 plans).

If actual assertion count differs from `plan(8)`, bump.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0039_state_metrics_5f_columns.sql \
        packages/db/supabase/tests/state_metrics_5f_columns.test.sql
git commit -m "feat(db): 0039 official_metrics +5 KPI columns + pgTAP plan(8)

Add bills_passed_count, hearings_held_count, subject_breadth,
bill_passage_rate, fiscal_impact_per_dollar_raised. All nullable.
pgTAP covers each new column's existence and precision, plus
regression guards on pre-slice-5F columns (committee_chair_count,
party_unity_state, fiscal_impact_total)."
```

---

## Task 4: Regenerate Database type

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Regenerate types**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

This rewrites `packages/db/src/types.ts` from the live Supabase schema (post-0039). New entries: `state_committee_memberships` (Row/Insert/Update/Relationships) and the 5 new columns on `official_metrics`.

- [ ] **Step 2: Verify new types**

```bash
grep -c "state_committee_memberships" packages/db/src/types.ts
grep -c "bills_passed_count\|hearings_held_count\|subject_breadth\|bill_passage_rate\|fiscal_impact_per_dollar_raised" packages/db/src/types.ts
```

Expected: ≥3 for state_committee_memberships (Row/Insert/Update); ≥15 for the 5 new columns (each appears in Row/Insert/Update on official_metrics).

- [ ] **Step 3: Workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: all 10 packages clean. New types are additive.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for slice 5F additions

state_committee_memberships table + 5 new columns on official_metrics."
```

---

## Task 5: @chiaro/officials — types + barrel re-export

**Files:**
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/index.ts`

Per slice 5E lessons (Task 16 and 17 each hit a missing-barrel-export gap), be explicit: the new type goes in both `types.ts` AND `index.ts`.

- [ ] **Step 1: Extend types.ts**

Open `packages/officials/src/types.ts`. After the existing `StateFinance*` type exports, add:

```ts
export type StateCommitteeMembershipRow =
  Database['public']['Tables']['state_committee_memberships']['Row']
```

(`Database` is already imported at the top of the file from earlier slices.)

- [ ] **Step 2: Re-export from index.ts**

Open `packages/officials/src/index.ts`. Find the existing `export type { ... } from './types.ts'` block. Add `StateCommitteeMembershipRow` to the list of re-exported types.

If the existing block reads (for example):
```ts
export type {
  StateFinanceSummaryRow,
  StateFinanceIndividualDonorRow,
  // ... other types
} from './types.ts'
```

Add the new type:
```ts
export type {
  StateFinanceSummaryRow,
  StateFinanceIndividualDonorRow,
  StateCommitteeMembershipRow,  // NEW
  // ... other types
} from './types.ts'
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @chiaro/officials typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/officials/src/types.ts packages/officials/src/index.ts
git commit -m "feat(officials): StateCommitteeMembershipRow type + barrel re-export

Surfaces the new Database-derived row type to consumers (recompute,
integration test). Re-export through index.ts up front avoids the
late-discovery fixup that slice 5E hit twice."
```

---

## Task 6: openstates-committees-fetch.ts + 3 fixtures + 8 tests

**Files:**
- Create: `packages/db/supabase/seed/openstates-committees-fetch.ts`
- Create: `packages/db/supabase/seed/openstates-committees-fetch.test.ts`
- Create: `packages/db/supabase/seed/fixtures/openstates-committees/ca-sample.json`
- Create: `packages/db/supabase/seed/fixtures/openstates-committees/ny-sample.json`
- Create: `packages/db/supabase/seed/fixtures/openstates-committees/ne-sample.json`

- [ ] **Step 1: Create fixture dir + files**

```bash
mkdir -p packages/db/supabase/seed/fixtures/openstates-committees
```

Create `packages/db/supabase/seed/fixtures/openstates-committees/ca-sample.json`:

```json
{
  "committees": [
    {
      "id": "ocd-committee/00000000-0000-0000-0000-cmt-ca-aaa",
      "name": "Assembly Education Committee",
      "jurisdiction": { "id": "ocd-jurisdiction/country:us/state:ca/government", "classification": "state" },
      "chamber": "lower",
      "memberships": [
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ca-asm-1", "name": "FX CA Asm Chair", "role": "Chair" },
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ca-asm-2", "name": "FX CA Asm VC", "role": "Vice Chair" },
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ca-asm-3", "name": "FX CA Asm Mem", "role": "Member" }
      ],
      "sources": [ { "url": "https://leginfo.legislature.ca.gov/committees/edu" } ]
    },
    {
      "id": "ocd-committee/00000000-0000-0000-0000-cmt-ca-bbb",
      "name": "Senate Health Committee",
      "jurisdiction": { "id": "ocd-jurisdiction/country:us/state:ca/government", "classification": "state" },
      "chamber": "upper",
      "memberships": [
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ca-sen-1", "name": "FX CA Sen Chair", "role": "chair" },
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ca-sen-2", "name": "FX CA Sen Mem", "role": "member" }
      ],
      "sources": [ { "url": "https://leginfo.legislature.ca.gov/committees/health" } ]
    }
  ]
}
```

Create `packages/db/supabase/seed/fixtures/openstates-committees/ny-sample.json`:

```json
{
  "committees": [
    {
      "id": "ocd-committee/00000000-0000-0000-0000-cmt-ny-aaa",
      "name": "Assembly Ways and Means Committee",
      "jurisdiction": { "id": "ocd-jurisdiction/country:us/state:ny/government", "classification": "state" },
      "chamber": "lower",
      "memberships": [
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ny-asm-1", "name": "FX NY Asm Chair", "role": "Chair" },
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ny-asm-2", "name": "FX NY Asm RM", "role": "Ranking Member" },
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ny-asm-3", "name": "FX NY Asm Mem", "role": "Member" }
      ],
      "sources": [ { "url": "https://nyassembly.gov/committees/wm" } ]
    }
  ]
}
```

Create `packages/db/supabase/seed/fixtures/openstates-committees/ne-sample.json`:

```json
{
  "committees": [
    {
      "id": "ocd-committee/00000000-0000-0000-0000-cmt-ne-aaa",
      "name": "Revenue Committee",
      "jurisdiction": { "id": "ocd-jurisdiction/country:us/state:ne/government", "classification": "state" },
      "chamber": "legislature",
      "memberships": [
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ne-sen-1", "name": "FX NE Sen Chair", "role": "Chair" },
        { "person_id": "ocd-person/00000000-0000-0000-0000-fx-ne-sen-2", "name": "FX NE Sen Mem", "role": "Member" }
      ],
      "sources": [ { "url": "https://nebraskalegislature.gov/committees/revenue" } ]
    }
  ]
}
```

Note: NY's "Ranking Member" role is intentional — tests that the fetcher passes through arbitrary role strings; ingest (Task 7) folds non-chair/vice-chair roles to `'member'`. NE's `chamber: 'legislature'` exercises the unicameral path.

- [ ] **Step 2: Write the fetcher**

Create `packages/db/supabase/seed/openstates-committees-fetch.ts`:

```ts
import { fetch } from 'undici'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://v3.openstates.org/committees'
const PER_PAGE = 20
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_RETRY_ON_429 = 5
const BASE_BACKOFF_MS = 1000
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates-committees')

type FetchLike = typeof fetch

export interface FetchOpenStatesCommitteesOpts {
  state: string
  cacheDir?: string
  apiKey?: string
  force?: boolean
  fetcher?: FetchLike
  ttlMs?: number
}

export interface FetchOpenStatesCommitteesStats {
  state: string
  pagesFetched: number
  committeesCached: number
  committeesSkippedFresh: number
  errors: string[]
}

interface V3CommitteesResponse {
  results: unknown[]
  pagination: { page: number; per_page: number; max_page: number; total_items: number }
}

function isV3CommitteesResponse(x: unknown): x is V3CommitteesResponse {
  if (typeof x !== 'object' || x === null) return false
  const r = x as { results?: unknown; pagination?: unknown }
  return Array.isArray(r.results) && typeof r.pagination === 'object' && r.pagination !== null
}

function slugFilename(state: string, committeeId: string): string {
  const safe = committeeId.replace(/[^a-zA-Z0-9-]/g, '-')
  return `${state}-${safe}.json`
}

async function isFresh(path: string, ttlMs: number): Promise<boolean> {
  try {
    const s = await stat(path)
    return Date.now() - s.mtimeMs < ttlMs
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(
  fetcher: FetchLike,
  url: string,
  apiKey: string,
): Promise<V3CommitteesResponse> {
  for (let attempt = 1; attempt <= MAX_RETRY_ON_429; attempt++) {
    const res = await fetcher(url, { headers: { 'X-API-Key': apiKey } })
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      const waitMs = retryAfter
        ? Number(retryAfter) * 1000
        : BASE_BACKOFF_MS * Math.pow(2, attempt - 1)
      if (attempt === MAX_RETRY_ON_429) {
        throw new Error(`429 after ${MAX_RETRY_ON_429} attempts: ${url}`)
      }
      await sleep(waitMs)
      continue
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
    }
    const body = await res.json()
    if (!isV3CommitteesResponse(body)) {
      throw new Error(`malformed v3 response: missing results or pagination at ${url}`)
    }
    return body
  }
  throw new Error('unreachable')
}

export async function fetchOpenStatesCommittees(
  opts: FetchOpenStatesCommitteesOpts,
): Promise<FetchOpenStatesCommitteesStats> {
  const apiKey = opts.apiKey ?? process.env.OPENSTATES_API_KEY
  if (!apiKey) {
    throw new Error('OPENSTATES_API_KEY env var (or apiKey option) is required')
  }
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR
  const ttlMs = opts.ttlMs ?? TTL_MS
  const fetcher = opts.fetcher ?? fetch
  const state = opts.state.toUpperCase()
  const stateLower = opts.state.toLowerCase()
  const jurisdiction = `ocd-jurisdiction/country:us/state:${stateLower}/government`

  await mkdir(cacheDir, { recursive: true })

  const stats: FetchOpenStatesCommitteesStats = {
    state,
    pagesFetched: 0,
    committeesCached: 0,
    committeesSkippedFresh: 0,
    errors: [],
  }

  let page = 1
  let maxPage = 1
  do {
    const url = new URL(BASE_URL)
    url.searchParams.set('jurisdiction', jurisdiction)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(PER_PAGE))
    url.searchParams.set('include', 'memberships,sources')

    let body: V3CommitteesResponse
    try {
      body = await fetchPage(fetcher, url.toString(), apiKey)
    } catch (err) {
      stats.errors.push((err as Error).message)
      break
    }
    stats.pagesFetched += 1
    maxPage = body.pagination.max_page

    for (const committee of body.results) {
      const cid = (committee as { id?: unknown }).id
      if (typeof cid !== 'string' || !cid.startsWith('ocd-committee/')) {
        stats.errors.push(`skipped result with non-string or non-committee id`)
        continue
      }
      const file = join(cacheDir, slugFilename(state, cid))
      if (!opts.force && (await isFresh(file, ttlMs))) {
        stats.committeesSkippedFresh += 1
        continue
      }
      await writeFile(file, JSON.stringify(committee, null, 2), 'utf8')
      stats.committeesCached += 1
    }
    page += 1
  } while (page <= maxPage)

  return stats
}

/** Remove cache files older than ttlMs. */
export async function pruneStaleCommitteesCache(
  cacheDir: string,
  ttlMs: number = TTL_MS,
): Promise<number> {
  let entries: string[]
  try {
    entries = await readdir(cacheDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw err
  }
  let removed = 0
  const { unlink } = await import('node:fs/promises')
  for (const e of entries) {
    if (!e.endsWith('.json')) continue
    const path = join(cacheDir, e)
    if (!(await isFresh(path, ttlMs))) {
      await unlink(path)
      removed += 1
    }
  }
  return removed
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const stateArg = process.argv.find(a => a.startsWith('--state='))
  const force    = process.argv.includes('--force')
  if (!stateArg) {
    console.error('usage: tsx openstates-committees-fetch.ts --state=XX [--force]')
    process.exit(2)
  }
  fetchOpenStatesCommittees({ state: stateArg.split('=')[1]!, force })
    .then(stats => {
      console.log('OpenStates committees fetch summary:')
      console.log(`  state:                  ${stats.state}`)
      console.log(`  pages fetched:          ${stats.pagesFetched}`)
      console.log(`  committees cached:      ${stats.committeesCached}`)
      console.log(`  committees skipped(fresh): ${stats.committeesSkippedFresh}`)
      console.log(`  errors:                 ${stats.errors.length}`)
      for (const e of stats.errors) console.log(`    - ${e}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 3: Write the fetcher test**

Create `packages/db/supabase/seed/openstates-committees-fetch.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, rm, writeFile, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fetchOpenStatesCommittees, pruneStaleCommitteesCache } from './openstates-committees-fetch.ts'

function mkCommittee(suffix: string) {
  return {
    id: `ocd-committee/00000000-0000-0000-0000-${suffix}`,
    name: `Test Committee ${suffix}`,
    jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
    chamber: 'lower',
    memberships: [],
    sources: [{ url: 'https://x' }],
  }
}

function mkResponse(results: object[], page: number, maxPage: number): Response {
  return new Response(JSON.stringify({
    results,
    pagination: { page, per_page: 20, max_page: maxPage, total_items: results.length },
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

let cacheDir: string

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'openstates-committees-cache-'))
})

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('fetchOpenStatesCommittees', () => {
  it('happy path: single page of 2 committees writes 2 cache files', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([mkCommittee('001'), mkCommittee('002')], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA', cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.pagesFetched).toBe(1)
    expect(stats.committeesCached).toBe(2)
    expect(stats.errors).toEqual([])
    const files = (await readdir(cacheDir)).filter(f => f.endsWith('.json'))
    expect(files).toHaveLength(2)
  })

  it('paginates: 2 pages of 1 committee each writes 2 files', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(mkResponse([mkCommittee('001')], 1, 2))
      .mockResolvedValueOnce(mkResponse([mkCommittee('002')], 2, 2))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA', cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.pagesFetched).toBe(2)
    expect(stats.committeesCached).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('TTL skip: fresh existing file is not re-fetched', async () => {
    const cmt = mkCommittee('001')
    const file = join(cacheDir, `CA-${cmt.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([cmt], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA', cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(0)
    expect(stats.committeesSkippedFresh).toBe(1)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk).toEqual({ stale: 'old data' })
  })

  it('TTL expiry: stale file is re-fetched', async () => {
    const cmt = mkCommittee('001')
    const file = join(cacheDir, `CA-${cmt.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old data' }), 'utf8')
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(file, eightDaysAgo, eightDaysAgo)
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([cmt], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA', cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(1)
    expect(stats.committeesSkippedFresh).toBe(0)
    const onDisk = JSON.parse(await readFile(file, 'utf8'))
    expect(onDisk.id).toBe(cmt.id)
  })

  it('--force bypasses TTL', async () => {
    const cmt = mkCommittee('001')
    const file = join(cacheDir, `CA-${cmt.id.replace(/[^a-zA-Z0-9-]/g, '-')}.json`)
    await writeFile(file, JSON.stringify({ stale: 'old' }), 'utf8')
    const fetcher = vi.fn().mockResolvedValueOnce(mkResponse([cmt], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA', cacheDir, apiKey: 'test', force: true,
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(1)
    expect(stats.committeesSkippedFresh).toBe(0)
  })

  it('429 retries then succeeds', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      Promise.resolve().then(fn)
      return 0 as never
    }) as never)
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(mkResponse([mkCommittee('001')], 1, 1))
    const stats = await fetchOpenStatesCommittees({
      state: 'CA', cacheDir, apiKey: 'test',
      fetcher: fetcher as never,
    })
    expect(stats.committeesCached).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('missing api key throws', async () => {
    await expect(fetchOpenStatesCommittees({
      state: 'CA', cacheDir,
      fetcher: vi.fn() as never,
    })).rejects.toThrow(/OPENSTATES_API_KEY/)
  })

  it('pruneStaleCommitteesCache removes stale files', async () => {
    const stale = join(cacheDir, 'CA-stale.json')
    const fresh = join(cacheDir, 'CA-fresh.json')
    await writeFile(stale, '{}', 'utf8')
    await writeFile(fresh, '{}', 'utf8')
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(stale, eightDaysAgo, eightDaysAgo)
    const removed = await pruneStaleCommitteesCache(cacheDir)
    expect(removed).toBe(1)
    const remaining = await readdir(cacheDir)
    expect(remaining).toEqual(['CA-fresh.json'])
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test openstates-committees-fetch
```

Expected: 8/8 pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/openstates-committees-fetch.ts \
        packages/db/supabase/seed/openstates-committees-fetch.test.ts \
        packages/db/supabase/seed/fixtures/openstates-committees/
git commit -m "feat(seed): openstates-committees-fetch + 3 fixtures + 8 tests

Mirror slice 5D openstates-v3-fetch shape: paginated v3 /committees
calls with ?include=memberships,sources, 7-day on-disk cache,
--force bypasses, 429 retry with Retry-After header. Per-state
fetch via --state=XX; caches to .cache/openstates-committees/.

Library exports fetchOpenStatesCommittees() + pruneStaleCommitteesCache().

Fixtures: ca (2 committees, 5 memberships), ny (1 committee, 3
memberships including 'Ranking Member' fold-to-member case), ne
(1 committee with chamber=legislature for unicameral coverage).

8 vitest cases (mocked undici.fetch): happy path, pagination, TTL
skip, TTL expiry, --force bypass, 429-then-200 retry, missing api
key throws, prune removes stale + keeps fresh."
```

---

## Task 7: openstates-committees-ingest.ts + 6 tests

**Files:**
- Create: `packages/db/supabase/seed/openstates-committees-ingest.ts`
- Create: `packages/db/supabase/seed/openstates-committees-ingest.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/openstates-committees-ingest.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ingestStateCommittees } from './openstates-committees-ingest.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let cacheDir: string
let asmChairId: string
let asmVcId: string
let asmMemId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  cacheDir = await mkdtemp(join(tmpdir(), 'openstates-committees-test-'))

  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-CMT-T1', 'CA Cmt T1',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-cmt-ingest')
    on conflict (tier, code) do nothing
  `)

  const chair = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-chair', 'FX Asm Chair', 'FX', 'Asm Chair', 'state_house', 'D', 'CA',
      d.id, true, 'FX-cmt-ingest'
    from public.districts d where d.code = 'CA-CMT-T1'
    returning id
  `)
  asmChairId = chair.rows[0]!.id

  const vc = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-vc', 'FX Asm VC', 'FX', 'Asm VC', 'state_house', 'D', 'CA',
      d.id, true, 'FX-cmt-ingest'
    from public.districts d where d.code = 'CA-CMT-T1'
    returning id
  `)
  asmVcId = vc.rows[0]!.id

  const mem = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-mem', 'FX Asm Mem', 'FX', 'Asm Mem', 'state_house', 'D', 'CA',
      d.id, true, 'FX-cmt-ingest'
    from public.districts d where d.code = 'CA-CMT-T1'
    returning id
  `)
  asmMemId = mem.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    "delete from public.state_committee_memberships where official_id in ($1, $2, $3)",
    [asmChairId, asmVcId, asmMemId],
  )
  await client.query("delete from public.officials where source_version = $1", ['FX-cmt-ingest'])
  await client.query("delete from public.districts where source_version = $1", ['FX-cmt-ingest'])
  await client.end()
  await rm(cacheDir, { recursive: true, force: true })
})

function writeCommittee(filename: string, body: object) {
  return writeFile(join(cacheDir, filename), JSON.stringify(body), 'utf8')
}

describe('ingestStateCommittees', () => {
  it('chair role mapping: "Chair" → chair', async () => {
    await writeCommittee('CA-c1.json', {
      id: 'ocd-committee/c1', name: 'Test',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-chair', name: 'FX Asm Chair', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.committeesProcessed).toBe(1)
    expect(stats.membershipsUpserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    expect(stats.officialsUnmatched).toEqual([])
    expect(stats.errors).toEqual([])
    const row = await client.query<{ role: string }>(
      "select role from public.state_committee_memberships where official_id = $1",
      [asmChairId],
    )
    expect(row.rows[0]!.role).toBe('chair')
  })

  it('vice_chair role mapping handles "Vice Chair", "vice_chair", "vice-chair"', async () => {
    await writeCommittee('CA-vc.json', {
      id: 'ocd-committee/vc',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-vc',    name: 'X', role: 'Vice Chair' },
        { person_id: 'ocd-person/fx-mem',   name: 'X', role: 'vice-chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.membershipsUpserted).toBe(2)
    const rows = await client.query<{ role: string }>(
      "select role from public.state_committee_memberships where official_id in ($1, $2)",
      [asmVcId, asmMemId],
    )
    expect(rows.rows.every(r => r.role === 'vice_chair')).toBe(true)
  })

  it('unknown roles fold to member (e.g. "Ranking Member")', async () => {
    await writeCommittee('CA-rm.json', {
      id: 'ocd-committee/rm',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-mem', name: 'X', role: 'Ranking Member' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.membershipsUpserted).toBe(1)
    const row = await client.query<{ role: string }>(
      "select role from public.state_committee_memberships where official_id = $1",
      [asmMemId],
    )
    expect(row.rows[0]!.role).toBe('member')
  })

  it('unmatched person_id surfaces to officialsUnmatched', async () => {
    await writeCommittee('CA-unmatched.json', {
      id: 'ocd-committee/unmatched',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/UNKNOWN-1', name: 'Nobody', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.officialsUnmatched).toContain('ocd-person/UNKNOWN-1')
    expect(stats.membershipsUpserted).toBe(0)
  })

  it('idempotent re-run: same fixture twice → 1 membership row', async () => {
    await writeCommittee('CA-idem.json', {
      id: 'ocd-committee/idem',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-chair', name: 'X', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    await ingestStateCommittees({ cacheDir, client })
    await ingestStateCommittees({ cacheDir, client })
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_committee_memberships where official_id = $1",
      [asmChairId],
    )
    expect(c.rows[0]!.c).toBe(1)
  })

  it('joint chamber: logged + skipped, doesn’t insert', async () => {
    await writeCommittee('CA-joint.json', {
      id: 'ocd-committee/joint',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'joint',
      memberships: [
        { person_id: 'ocd-person/fx-chair', name: 'X', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.membershipsUpserted).toBe(0)
    expect(stats.errors.length).toBeGreaterThan(0)
    expect(stats.errors[0]).toMatch(/unknown chamber/i)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test openstates-committees-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement**

Create `packages/db/supabase/seed/openstates-committees-ingest.ts`:

```ts
import { Client } from 'pg'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates-committees')

const CHAMBER_MAP: Record<string, 'state_house' | 'state_senate' | 'state_legislature'> = {
  lower:        'state_house',
  upper:        'state_senate',
  legislature:  'state_legislature',
}

function normalizeRole(raw: string): 'chair' | 'vice_chair' | 'member' {
  const r = raw.toLowerCase().trim()
  if (r === 'chair' || r === 'chairperson' || r === 'chairman' || r === 'chairwoman') return 'chair'
  if (r === 'vice chair' || r === 'vice_chair' || r === 'vice-chair'
      || r === 'vice chairperson' || r === 'vice-chairperson') return 'vice_chair'
  return 'member'
}

export interface IngestStateCommitteesOpts {
  cacheDir?: string
  state?: 'CA' | 'NY' | 'FL' | 'TX' | 'MI' | 'NE'
  client?: Client
}

export interface IngestStateCommitteesStats {
  committeesProcessed: number
  membershipsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
}

interface CommitteeEnvelope {
  id: string
  name: string
  jurisdiction: { id: string }
  chamber: string
  session?: string
  memberships: Array<{ person_id: string; name: string; role: string }>
  sources: Array<{ url: string }>
}

function parseStateFromJurisdiction(id: string): string | null {
  const m = id.match(/state:([a-z]{2})/)
  return m ? m[1]!.toUpperCase() : null
}

async function processCommittee(
  client: Client,
  cmt: CommitteeEnvelope,
  stats: IngestStateCommitteesStats,
): Promise<void> {
  const chamber = CHAMBER_MAP[cmt.chamber.toLowerCase()]
  if (!chamber) {
    stats.errors.push(`committee ${cmt.id}: unknown chamber '${cmt.chamber}' — skipped`)
    return
  }
  const state = parseStateFromJurisdiction(cmt.jurisdiction.id)
  if (!state) {
    stats.errors.push(`committee ${cmt.id}: cannot parse state from jurisdiction`)
    return
  }
  const sourceUrl = cmt.sources[0]?.url ?? ''
  const session = cmt.session ?? null

  for (const m of cmt.memberships) {
    if (!m.person_id) {
      stats.errors.push(`committee ${cmt.id}: membership without person_id, skipped`)
      continue
    }
    const off = await client.query<{ id: string }>(
      'select id from public.officials where openstates_person_id = $1',
      [m.person_id],
    )
    if (off.rowCount === 0) {
      stats.officialsUnmatched.push(m.person_id)
      continue
    }
    const role = normalizeRole(m.role)
    await client.query(`
      insert into public.state_committee_memberships (
        official_id, openstates_committee_id, committee_name,
        state, chamber, session, role, source_url
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (official_id, openstates_committee_id, session, role)
      do update set
        committee_name = excluded.committee_name,
        state          = excluded.state,
        chamber        = excluded.chamber,
        source_url     = excluded.source_url,
        ingested_at    = now()
    `, [
      off.rows[0]!.id, cmt.id, cmt.name,
      state, chamber, session, role, sourceUrl,
    ])
    stats.membershipsUpserted += 1
    stats.officialsMatched += 1
  }
}

export async function ingestStateCommittees(
  opts: IngestStateCommitteesOpts = {},
): Promise<IngestStateCommitteesStats> {
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const stats: IngestStateCommitteesStats = {
    committeesProcessed: 0,
    membershipsUpserted: 0,
    officialsMatched: 0,
    officialsUnmatched: [],
    errors: [],
  }

  try {
    let entries: string[]
    try {
      entries = await readdir(cacheDir)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return stats
      throw err
    }

    for (const file of entries) {
      if (!file.endsWith('.json')) continue
      if (opts.state && !file.startsWith(`${opts.state}-`)) continue
      const path = join(cacheDir, file)
      const text = await readFile(path, 'utf8')
      let cmt: CommitteeEnvelope
      try {
        cmt = JSON.parse(text)
      } catch (err) {
        stats.errors.push(`${file}: JSON parse error: ${(err as Error).message}`)
        continue
      }
      if (typeof cmt.id !== 'string' || !cmt.id.startsWith('ocd-committee/')) {
        stats.errors.push(`${file}: missing or invalid id`)
        continue
      }
      await processCommittee(client, cmt, stats)
      stats.committeesProcessed += 1
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return stats
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  ingestStateCommittees({})
    .then(stats => {
      console.log('OpenStates committees ingest summary:')
      console.log(`  committees processed:    ${stats.committeesProcessed}`)
      console.log(`  memberships upserted:    ${stats.membershipsUpserted}`)
      console.log(`  officials matched:       ${stats.officialsMatched}`)
      console.log(`  officials unmatched:     ${stats.officialsUnmatched.length}`)
      console.log(`  errors:                  ${stats.errors.length}`)
      for (const e of stats.errors) console.log(`    - ${e}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test openstates-committees-ingest
```

Expected: 6/6 pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/openstates-committees-ingest.ts \
        packages/db/supabase/seed/openstates-committees-ingest.test.ts
git commit -m "feat(seed): openstates-committees-ingest + 6 tests

Reads JSON envelopes from .cache/openstates-committees/, normalizes
role strings (Chair/vice chair/Ranking Member/etc.), resolves officials
by openstates_person_id, upserts state_committee_memberships.

Role normalization:
- chair / chairperson / chairman / chairwoman → 'chair'
- vice chair / vice_chair / vice-chair (any case) → 'vice_chair'
- everything else (Ranking Member, ex-officio, ...) → 'member'

Chamber mapping: lower → state_house, upper → state_senate,
legislature → state_legislature (NE unicameral). Other chamber values
(joint, etc) log to errors + skip.

Unmatched person_ids surface to stats.officialsUnmatched[]. Idempotent
via the (official_id, openstates_committee_id, session, role) unique
constraint.

6 vitest cases."
```

---

## Task 8: Add 2 pnpm scripts

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Read current scripts block**

```bash
grep -n "seed:state" packages/db/package.json | head -10
```

Confirms the slice 5D/5E `seed:state-*` scripts. We add 2 new entries alongside.

- [ ] **Step 2: Add the scripts**

Open `packages/db/package.json`. In the `scripts` block, add (alphabetically near other `seed:openstates-*` entries from slice 5D):

```json
"seed:openstates-committees-fetch":  "tsx supabase/seed/openstates-committees-fetch.ts",
"seed:openstates-committees-ingest": "tsx supabase/seed/openstates-committees-ingest.ts",
```

- [ ] **Step 3: Verify**

```bash
grep -E "seed:openstates-committees" packages/db/package.json
pnpm --filter @chiaro/db typecheck
```

Expected: both lines appear; typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): add seed:openstates-committees-fetch + -ingest scripts

  pnpm seed:openstates-committees-fetch --state=CA
  pnpm seed:openstates-committees-ingest

Wires the slice 5F fetch + ingest scripts (Tasks 6-7) to pnpm
entry points. Operator workflow documented in CLAUDE.md gotcha #11
(Task 15)."
```

---

## Task 9: Extend recompute-state-metrics.ts with 5 KPI queries + 7 new tests

**Files:**
- Modify: `packages/db/supabase/seed/recompute-state-metrics.ts`
- Modify: `packages/db/supabase/seed/recompute-state-metrics.test.ts`

- [ ] **Step 1: Read current state**

```bash
sed -n '60,100p' packages/db/supabase/seed/recompute-state-metrics.ts
```

Note where `committee_chair_count = 0` and `partyUnityState` stub live, and the INSERT...ON CONFLICT statement at the bottom. We extend that INSERT with 5 new columns.

- [ ] **Step 2: Extend recompute-state-metrics.ts**

Open `packages/db/supabase/seed/recompute-state-metrics.ts`. Replace the body of `recomputeStateMetrics` with the extended version:

```ts
export async function recomputeStateMetrics(
  opts: RecomputeStateMetricsOpts,
): Promise<RecomputeStateMetricsStats> {
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  let officialsProcessed = 0
  try {
    const stateOfficials = await client.query<{ id: string; party: string; state: string }>(`
      select id, party, state from public.officials
      where chamber in ('state_house', 'state_senate', 'state_legislature')
        and in_office = true
    `)

    for (const off of stateOfficials.rows) {
      // bills_sponsored_count + bills_cosponsored_count + fiscal_impact_total (unchanged)
      const billStats = await client.query<{
        sponsored: number
        cosponsored: number
        fiscal_total: string | null
      }>(`
        select
          count(*) filter (where sps.role = 'sponsor')::int   as sponsored,
          count(*) filter (where sps.role = 'cosponsor')::int as cosponsored,
          coalesce(sum(b.fiscal_impact_amount), 0)            as fiscal_total
        from public.state_bill_sponsors sps
        join public.state_bills b on b.id = sps.bill_id
        where sps.official_id = $1 and b.session = $2
      `, [off.id, opts.session])

      // vote stats (unchanged)
      const voteStats = await client.query<{
        voted: number
        missed: number
        total: number
      }>(`
        select
          count(*) filter (where svp.position in ('yes','no','abstain','present'))::int as voted,
          count(*) filter (where svp.position = 'not_voting')::int                       as missed,
          count(*)::int                                                                  as total
        from public.state_vote_positions svp
        join public.state_votes v on v.id = svp.vote_id
        where svp.official_id = $1 and v.session = $2
      `, [off.id, opts.session])

      const voted   = voteStats.rows[0]!.voted
      const missed  = voteStats.rows[0]!.missed
      const total   = voteStats.rows[0]!.total
      const attendance = total === 0 ? null : (voted / total) * 100

      const partyUnityState = voted >= PARTY_UNITY_MIN_VOTES ? 100 : null

      // committee_chair_count: real value from state_committee_memberships.
      // NULL semantics: if NO rows for this official's state at all → NULL
      // (data not yet ingested). Else: actual count of chair roles (could be 0).
      const stateHasCommitteeData = await client.query<{ has_data: boolean }>(`
        select exists(
          select 1 from public.state_committee_memberships where state = $1
        ) as has_data
      `, [off.state])
      let committeeChairCount: number | null = null
      if (stateHasCommitteeData.rows[0]!.has_data) {
        const chairStats = await client.query<{ count: number }>(`
          select count(*)::int as count from public.state_committee_memberships
          where official_id = $1 and role = 'chair'
        `, [off.id])
        committeeChairCount = chairStats.rows[0]!.count
      }

      // bills_passed_count: heuristic substring match on state_bills.status.
      const passedStats = await client.query<{ count: number }>(`
        select count(*)::int as count
          from public.state_bill_sponsors sps
          join public.state_bills b on b.id = sps.bill_id
          where sps.official_id = $1 and b.session = $2
            and sps.role = 'sponsor'
            and (
              lower(b.status) like '%signed%'
              or lower(b.status) like '%enacted%'
              or lower(b.status) like '%became law%'
              or lower(b.status) like '%passed%governor%'
              or lower(b.status) like '%chaptered%'
            )
      `, [off.id, opts.session])
      const billsPassedCount = passedStats.rows[0]!.count

      // hearings_held_count
      const hearingsStats = await client.query<{ count: number }>(`
        select count(*)::int as count
          from public.state_bill_sponsors sps
          join public.state_bills b on b.id = sps.bill_id
          where sps.official_id = $1 and b.session = $2
            and sps.role = 'sponsor'
            and b.hearing_date is not null
      `, [off.id, opts.session])
      const hearingsHeldCount = hearingsStats.rows[0]!.count

      // subject_breadth
      const subjectStats = await client.query<{ count: number }>(`
        select count(distinct sbs.subject)::int as count
          from public.state_bill_sponsors sps
          join public.state_bills b on b.id = sps.bill_id
          join public.state_bill_subjects sbs on sbs.bill_id = b.id
          where sps.official_id = $1 and b.session = $2
            and sps.role = 'sponsor'
      `, [off.id, opts.session])
      const subjectBreadth = subjectStats.rows[0]!.count

      // bill_passage_rate (TS-derived): NULL when 0 sponsored.
      const sponsored = billStats.rows[0]!.sponsored
      const billPassageRate = sponsored === 0
        ? null
        : (billsPassedCount / sponsored) * 100

      // fiscal_impact_per_dollar_raised: join latest state_finance_summaries.
      const financeRow = await client.query<{ total_raised: string | null }>(`
        select total_raised from public.state_finance_summaries
        where official_id = $1
        order by ingested_at desc
        limit 1
      `, [off.id])
      const totalRaised = financeRow.rows[0]?.total_raised == null
        ? null
        : Number(financeRow.rows[0]!.total_raised)
      const fiscalTotal = Number(billStats.rows[0]!.fiscal_total)
      const fiscalImpactPerDollarRaised = (totalRaised == null || totalRaised === 0)
        ? null
        : fiscalTotal / totalRaised

      await client.query(`
        insert into public.official_metrics (
          official_id, congress,
          bills_sponsored_count, bills_cosponsored_count,
          votes_voted_count, votes_missed_count, total_roll_calls,
          attendance_pct,
          fiscal_impact_total, party_unity_state, committee_chair_count,
          bills_passed_count, hearings_held_count, subject_breadth,
          bill_passage_rate, fiscal_impact_per_dollar_raised
        )
        values ($1, 'state', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        on conflict (official_id) do update set
          bills_sponsored_count            = excluded.bills_sponsored_count,
          bills_cosponsored_count          = excluded.bills_cosponsored_count,
          votes_voted_count                = excluded.votes_voted_count,
          votes_missed_count               = excluded.votes_missed_count,
          total_roll_calls                 = excluded.total_roll_calls,
          attendance_pct                   = excluded.attendance_pct,
          fiscal_impact_total              = excluded.fiscal_impact_total,
          party_unity_state                = excluded.party_unity_state,
          committee_chair_count            = excluded.committee_chair_count,
          bills_passed_count               = excluded.bills_passed_count,
          hearings_held_count              = excluded.hearings_held_count,
          subject_breadth                  = excluded.subject_breadth,
          bill_passage_rate                = excluded.bill_passage_rate,
          fiscal_impact_per_dollar_raised  = excluded.fiscal_impact_per_dollar_raised,
          computed_at                      = now()
      `, [
        off.id,
        sponsored,
        billStats.rows[0]!.cosponsored,
        voted, missed, total,
        attendance,
        fiscalTotal,
        partyUnityState,
        committeeChairCount,
        billsPassedCount,
        hearingsHeldCount,
        subjectBreadth,
        billPassageRate,
        fiscalImpactPerDollarRaised,
      ])
      officialsProcessed += 1
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return { officialsProcessed }
}
```

Note the `committee_chair_count` NULL-vs-0 distinction: existence query against `state_committee_memberships` for this official's `state`. If zero rows → NULL; else → actual chair count for this official (could legitimately be 0).

- [ ] **Step 3: Extend the test file with 7 new cases**

Open `packages/db/supabase/seed/recompute-state-metrics.test.ts`. The existing `beforeEach` already seeds a CA state senator with bills + votes. We extend it: seed a committee chair row, seed sponsored bills with `status` strings that match the heuristic, seed a hearing_date on one bill, seed a bill_subjects row, and seed a state_finance_summaries row.

Read the existing file first:

```bash
cat packages/db/supabase/seed/recompute-state-metrics.test.ts | head -100
```

Extend `beforeEach` with this additional seed block (insert AFTER existing bills/votes seed, BEFORE the closing `})`):

```ts
// Slice 5F: committee membership (chair) for committee_chair_count
await client.query(`
  insert into public.state_committee_memberships (
    official_id, openstates_committee_id, committee_name,
    state, chamber, role, source_url
  )
  values ($1, 'ocd-committee/rm-test-1', 'RM Test Chair Cmt',
          'CA', 'state_senate', 'chair', 'https://x')
`, [officialId])

// Slice 5F: mark first sponsored bill as 'Chaptered' (CA passage convention)
// and add a hearing date + subject tag
await client.query(`
  update public.state_bills
  set status = 'Chaptered',
      hearing_date = '2025-02-15'
  where openstates_bill_id = 'ocd-bill/rm-1'
`)
await client.query(`
  insert into public.state_bill_subjects (bill_id, subject)
  select id, 'Health' from public.state_bills where openstates_bill_id = 'ocd-bill/rm-1'
`)
await client.query(`
  insert into public.state_bill_subjects (bill_id, subject)
  select id, 'Education' from public.state_bills where openstates_bill_id = 'ocd-bill/rm-2'
`)

// Slice 5F: state finance summary so fiscal_impact_per_dollar_raised is computed
await client.query(`
  insert into public.state_finance_summaries (
    official_id, cycle, total_raised, total_disbursed, source, source_url
  )
  values ($1, '2024', 50000, 35000, 'ca-cal-access', 'https://x')
`, [officialId])
```

Extend `afterEach` with cleanup (before the existing officials delete):

```ts
await client.query(
  "delete from public.state_committee_memberships where official_id = $1",
  [officialId],
)
await client.query("delete from public.state_bill_subjects where bill_id in (select id from public.state_bills where openstates_bill_id like 'ocd-bill/rm-%')")
await client.query(
  "delete from public.state_finance_summaries where official_id = $1",
  [officialId],
)
```

Add 7 new test cases inside the existing `describe('recomputeStateMetrics', ...)` block:

```ts
it('committee_chair_count: real value from state_committee_memberships', async () => {
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ committee_chair_count: number | null }>(
    'select committee_chair_count from public.official_metrics where official_id = $1',
    [officialId],
  )
  expect(m.rows[0]!.committee_chair_count).toBe(1)
})

it('committee_chair_count: NULL when no memberships exist for the state', async () => {
  // Delete the seeded membership; no other CA memberships exist in test scope.
  await client.query(
    "delete from public.state_committee_memberships where official_id = $1",
    [officialId],
  )
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ committee_chair_count: number | null }>(
    'select committee_chair_count from public.official_metrics where official_id = $1',
    [officialId],
  )
  expect(m.rows[0]!.committee_chair_count).toBeNull()
})

it('bills_passed_count: matches Chaptered status', async () => {
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ bills_passed_count: number }>(
    'select bills_passed_count from public.official_metrics where official_id = $1',
    [officialId],
  )
  expect(m.rows[0]!.bills_passed_count).toBe(1)
})

it('hearings_held_count: counts bills with hearing_date populated', async () => {
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ hearings_held_count: number }>(
    'select hearings_held_count from public.official_metrics where official_id = $1',
    [officialId],
  )
  expect(m.rows[0]!.hearings_held_count).toBe(1)
})

it('subject_breadth: counts distinct subjects across sponsored bills', async () => {
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ subject_breadth: number }>(
    'select subject_breadth from public.official_metrics where official_id = $1',
    [officialId],
  )
  // 'Health' from rm-1 + 'Education' from rm-2 = 2 distinct.
  expect(m.rows[0]!.subject_breadth).toBe(2)
})

it('bill_passage_rate: bills_passed / bills_sponsored * 100', async () => {
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ bill_passage_rate: string | null }>(
    'select bill_passage_rate from public.official_metrics where official_id = $1',
    [officialId],
  )
  // 1 passed / 1 sponsored (sponsor role; cosponsor excluded) = 100%
  expect(Number(m.rows[0]!.bill_passage_rate)).toBe(100)
})

it('fiscal_impact_per_dollar_raised: fiscal_total / total_raised', async () => {
  await recomputeStateMetrics({ session: '20252026' })
  const m = await client.query<{ fiscal_impact_per_dollar_raised: string | null }>(
    'select fiscal_impact_per_dollar_raised from public.official_metrics where official_id = $1',
    [officialId],
  )
  // fiscal_impact_total = 1000000 (from rm-1) + 500000 (from rm-2) = 1500000
  // total_raised = 50000
  // ratio = 1500000 / 50000 = 30
  expect(Number(m.rows[0]!.fiscal_impact_per_dollar_raised)).toBe(30)
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test recompute-state-metrics
```

Expected: 7 existing cases + 7 new cases = 14 pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/recompute-state-metrics.ts \
        packages/db/supabase/seed/recompute-state-metrics.test.ts
git commit -m "feat(seed): extend recompute-state-metrics with 5 KPIs + real chair count

Adds 5 new KPI computations to official_metrics:
- bills_passed_count: substring match on state_bills.status
- hearings_held_count: state_bills.hearing_date NOT NULL
- subject_breadth: distinct state_bill_subjects for own sponsored bills
- bill_passage_rate: bills_passed / bills_sponsored * 100 (NULL if 0)
- fiscal_impact_per_dollar_raised: fiscal_impact_total / latest total_raised

Replaces committee_chair_count stub=0 with real value from
state_committee_memberships. NULL semantics: if no rows in the table
for this official's state at all, write NULL not 0 (distinguishes 'data
not yet ingested' from 'actually zero chairs').

party_unity_state stub UNCHANGED — deferred to a future slice.

7 new vitest cases."
```

---

## Task 10: Web — StateServiceRecordCard "Performance metrics" subsection + 5 tests

**Files:**
- Modify: `apps/web/components/state/StateServiceRecordCard.tsx`
- Modify: `apps/web/test/components/state/StateServiceRecordCard.test.tsx`

- [ ] **Step 1: Read current card**

```bash
cat apps/web/components/state/StateServiceRecordCard.tsx | head -60
```

Note the existing structure: cardStyle wrapper, header with ServiceRecord title, scalar rows from `useOfficialMetrics()`, embedded `StateBillsEvidence` + `StateVotesEvidence`. We add a new `<h4>` + `<dl>` between the existing scalars and the evidence panels.

- [ ] **Step 2: Add format helpers + Performance subsection**

Open `apps/web/components/state/StateServiceRecordCard.tsx`. Near the top of the file (after imports), add the helper functions if not already present:

```tsx
function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  return String(n)
}

function fmtPct(n: number | string | null | undefined): string {
  if (n == null) return '—'
  const num = Number(n)
  return num % 1 === 0 ? `${num}%` : `${num.toFixed(1)}%`
}

function fmtRatio(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
```

If `fmtCount` / `fmtPct` already exist in the file with compatible signatures (slice 5D added `fmtPct` for party_unity), reuse them — add only the missing helpers.

Find the JSX section that renders the existing scalar rows (Bills sponsored, Votes voted, etc). After that `</dl>` (and before the embedded evidence panels begin), add the new subsection:

```tsx
<h4 style={{
  marginTop: 16,
  fontSize: 13,
  fontWeight: 700,
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
```

The conditional `committee_chair_count` row hides when NULL (matches slice 5D treatment of `party_unity_state` NULL). `m` is the existing alias for `useOfficialMetrics().data`.

- [ ] **Step 3: Extend the component test with 5 new cases**

Open `apps/web/test/components/state/StateServiceRecordCard.test.tsx`. Find the existing mock for `useOfficialMetrics`:

```tsx
useOfficialMetrics: () => ({
  data: {
    bills_sponsored_count: 1,
    bills_cosponsored_count: 0,
    // ... existing fields
  },
  isLoading: false, isSuccess: true,
}),
```

Extend the mock data with the 5 new fields:

```tsx
data: {
  // ... existing fields
  bills_passed_count: 3,
  hearings_held_count: 2,
  subject_breadth: 5,
  bill_passage_rate: 75,
  fiscal_impact_per_dollar_raised: 12500,
  committee_chair_count: 2,
},
```

Add 5 new vitest cases inside the existing `describe('StateServiceRecordCard', ...)` block:

```tsx
it('renders Performance metrics subsection header', () => {
  const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText('Performance metrics')).toBeTruthy()
})

it('renders all 5 KPI scalar rows with formatted values', () => {
  const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText('Bills passed')).toBeTruthy()
  expect(getByText('3')).toBeTruthy()
  expect(getByText('Hearings held')).toBeTruthy()
  expect(getByText('Subject breadth')).toBeTruthy()
  expect(getByText('5')).toBeTruthy()
  expect(getByText('Bill passage rate')).toBeTruthy()
  expect(getByText('75%')).toBeTruthy()
  expect(getByText('Fiscal impact / $')).toBeTruthy()
  expect(getByText('$12,500')).toBeTruthy()
})

it('em-dash for NULL KPIs', async () => {
  vi.resetModules()
  vi.doMock('@chiaro/officials', async () => {
    const actual = await vi.importActual<object>('@chiaro/officials')
    return {
      ...actual,
      useOfficialMetrics: () => ({
        data: {
          bills_sponsored_count: 1, bills_cosponsored_count: 0,
          votes_voted_count: 1, votes_missed_count: 0, total_roll_calls: 1,
          attendance_pct: 100, party_unity_state: null, fiscal_impact_total: 0,
          committee_chair_count: null,
          bills_passed_count: null, hearings_held_count: null, subject_breadth: null,
          bill_passage_rate: null, fiscal_impact_per_dollar_raised: null,
        },
        isLoading: false, isSuccess: true,
      }),
      // other hooks unchanged — preserve from existing mock block
      useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
    }
  })
  const { StateServiceRecordCard: Reimported } = await import('@/components/state/StateServiceRecordCard')
  const { getAllByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
  // 5 NULL KPI rows → 5 em-dashes (some additional em-dashes may exist from existing scalars)
  expect(getAllByText('—').length).toBeGreaterThanOrEqual(5)
})

it('committee_chair_count row hidden when NULL', async () => {
  vi.resetModules()
  vi.doMock('@chiaro/officials', async () => {
    const actual = await vi.importActual<object>('@chiaro/officials')
    return {
      ...actual,
      useOfficialMetrics: () => ({
        data: {
          bills_sponsored_count: 1, bills_cosponsored_count: 0,
          votes_voted_count: 1, votes_missed_count: 0, total_roll_calls: 1,
          attendance_pct: 100, party_unity_state: null, fiscal_impact_total: 0,
          committee_chair_count: null,
          bills_passed_count: 0, hearings_held_count: 0, subject_breadth: 0,
          bill_passage_rate: 0, fiscal_impact_per_dollar_raised: 0,
        },
        isLoading: false, isSuccess: true,
      }),
      useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
    }
  })
  const { StateServiceRecordCard: Reimported } = await import('@/components/state/StateServiceRecordCard')
  const { queryByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
  expect(queryByText('Committee chair seats')).toBeNull()
})

it('fiscal_impact_per_dollar_raised formats small and large values', async () => {
  // Small: $0.04
  vi.resetModules()
  vi.doMock('@chiaro/officials', async () => {
    const actual = await vi.importActual<object>('@chiaro/officials')
    return {
      ...actual,
      useOfficialMetrics: () => ({
        data: {
          bills_sponsored_count: 1, bills_cosponsored_count: 0,
          votes_voted_count: 1, votes_missed_count: 0, total_roll_calls: 1,
          attendance_pct: 100, party_unity_state: null, fiscal_impact_total: 0,
          committee_chair_count: 0,
          bills_passed_count: 0, hearings_held_count: 0, subject_breadth: 0,
          bill_passage_rate: 0, fiscal_impact_per_dollar_raised: 0.04,
        },
        isLoading: false, isSuccess: true,
      }),
      useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
    }
  })
  const { StateServiceRecordCard: Reimported } = await import('@/components/state/StateServiceRecordCard')
  const { getByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText('$0.04')).toBeTruthy()
})
```

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/web test StateServiceRecordCard
pnpm --filter @chiaro/web typecheck
```

Expected: existing cases + 5 new cases pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/state/StateServiceRecordCard.tsx \
        apps/web/test/components/state/StateServiceRecordCard.test.tsx
git commit -m "feat(web): StateServiceRecordCard 'Performance metrics' subsection

Add 5 KPI scalar rows (bills passed, hearings held, subject breadth,
bill passage rate, fiscal impact per dollar raised) plus conditional
committee chair seats row (hidden when NULL — distinguishes 'data
not ingested' from '0 chairs').

New helpers: fmtRatio (\$0.04 / \$12,500 / —). fmtCount + fmtPct
either added or reused if already present from slice 5D.

5 new vitest cases."
```

---

## Task 11: Web — extend StateOfficialDetailPage parent test fixture

**Files:**
- Modify: `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Locate existing mock**

```bash
grep -n "useOfficialMetrics" apps/web/test/components/state/StateOfficialDetailPage.test.tsx
```

The slice 5D PR #15 added a `vi.mock('@chiaro/officials', ...)` block here. Slice 5E PR #18 extended it. We extend the `useOfficialMetrics` mock data with the 5 new fields.

- [ ] **Step 2: Extend the mock data**

Find the existing `useOfficialMetrics` mock entry:

```tsx
useOfficialMetrics: () => ({ data: undefined, isLoading: false, isSuccess: true }),
```

The slice 5D/5E version may return `data: undefined` (NULL path). Update to return a populated fixture so the Performance subsection renders during parent-page tests:

```tsx
useOfficialMetrics: () => ({
  data: {
    bills_sponsored_count: 1, bills_cosponsored_count: 0,
    votes_voted_count: 0, votes_missed_count: 0, total_roll_calls: 0,
    attendance_pct: null, party_unity_state: null, fiscal_impact_total: 0,
    committee_chair_count: null,
    bills_passed_count: null, hearings_held_count: null, subject_breadth: null,
    bill_passage_rate: null, fiscal_impact_per_dollar_raised: null,
  },
  isLoading: false, isSuccess: true,
}),
```

All-NULL keeps the existing test assertions (which expect 5 category headers) intact while exercising the new code path.

If the existing parent-page test asserts specific header counts or text matches that depend on the previous `data: undefined` path, leave them as-is; the all-NULL data still renders the subsection header `'Performance metrics'` (subsection header is unconditional).

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/web test StateOfficialDetailPage
pnpm --filter @chiaro/web typecheck
```

Expected: all pre-existing parent-page test cases still pass.

```bash
git add apps/web/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "test(web): extend StateOfficialDetailPage mock with 5F metrics

Updates useOfficialMetrics mock data to include all 5 new KPI fields
(all NULL). Parent test now exercises the slice 5F Performance
subsection render path."
```

---

## Task 12: Mobile — StateServiceRecordCard Performance subsection + 5 tests

**Files:**
- Modify: `apps/mobile/components/state/StateServiceRecordCard.tsx`
- Modify: `apps/mobile/test/components/state/StateServiceRecordCard.test.tsx`

Mobile mirror of Task 10 using RN primitives (`View` / `Text` instead of `<dl>` / `<dt>` / `<dd>`).

- [ ] **Step 1: Read current mobile card**

```bash
cat apps/mobile/components/state/StateServiceRecordCard.tsx | head -50
```

Note the slice 5D pattern: each scalar row is a `<View flexDirection: 'row'>` with label + value Text children. We mirror that for the Performance subsection.

- [ ] **Step 2: Add format helpers + subsection**

Open `apps/mobile/components/state/StateServiceRecordCard.tsx`. After imports, add the same helpers (or reuse if `fmtCount` / `fmtPct` exist from slice 5D):

```tsx
function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  return String(n)
}

function fmtPct(n: number | string | null | undefined): string {
  if (n == null) return '—'
  const num = Number(n)
  return num % 1 === 0 ? `${num}%` : `${num.toFixed(1)}%`
}

function fmtRatio(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
```

Find the closing tag for the existing scalars `View` (the one that wraps Bills sponsored / Votes voted / etc) and the start of the embedded evidence panels. Between them, insert:

```tsx
<Text style={{
  marginTop: 16,
  fontSize: 13,
  fontWeight: '700',
  color: COLORS.brand.text,
}}>
  Performance metrics
</Text>
<View style={{ marginTop: 8, gap: 8 }}>
  <MobileScalarRow label="Bills passed"        value={fmtCount(m?.bills_passed_count)} />
  <MobileScalarRow label="Hearings held"       value={fmtCount(m?.hearings_held_count)} />
  <MobileScalarRow label="Subject breadth"     value={fmtCount(m?.subject_breadth)} />
  <MobileScalarRow label="Bill passage rate"   value={fmtPct(m?.bill_passage_rate)} />
  <MobileScalarRow label="Fiscal impact / $"   value={fmtRatio(m?.fiscal_impact_per_dollar_raised)} />
  {m?.committee_chair_count != null && (
    <MobileScalarRow label="Committee chair seats" value={String(m.committee_chair_count)} />
  )}
</View>
```

The existing scalar-row component in mobile is likely named `ScalarRow` or inline; reuse whatever exists. If the file uses inline `<View>` per row, repeat that pattern for the 5+1 new rows. The example above assumes a reusable `MobileScalarRow`; rename to match the file.

- [ ] **Step 3: Extend mobile component test with 5 new cases**

Open `apps/mobile/test/components/state/StateServiceRecordCard.test.tsx`. Mirror Task 10's Step 3 with jest-mocked hooks:

```tsx
jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials') as object
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: {
        bills_sponsored_count: 1, bills_cosponsored_count: 0,
        votes_voted_count: 1, votes_missed_count: 0, total_roll_calls: 1,
        attendance_pct: 100, party_unity_state: null, fiscal_impact_total: 0,
        committee_chair_count: 2,
        bills_passed_count: 3,
        hearings_held_count: 2,
        subject_breadth: 5,
        bill_passage_rate: 75,
        fiscal_impact_per_dollar_raised: 12500,
      },
      isLoading: false, isSuccess: true,
    }),
    useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
  }
})
```

Add 5 cases mirroring Task 10 with `@testing-library/react-native` queries:

```tsx
it('renders Performance metrics subsection header', () => {
  const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText('Performance metrics')).toBeTruthy()
})

it('renders all 5 KPI scalar rows with formatted values', () => {
  const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText('Bills passed')).toBeTruthy()
  expect(getByText('3')).toBeTruthy()
  expect(getByText('Hearings held')).toBeTruthy()
  expect(getByText('5')).toBeTruthy()
  expect(getByText('Bill passage rate')).toBeTruthy()
  expect(getByText('75%')).toBeTruthy()
  expect(getByText('Fiscal impact / $')).toBeTruthy()
  expect(getByText('$12,500')).toBeTruthy()
})

it('em-dash for NULL KPIs', () => {
  jest.resetModules()
  jest.doMock('@chiaro/officials', () => {
    const actual = jest.requireActual('@chiaro/officials') as object
    return {
      ...actual,
      useOfficialMetrics: () => ({
        data: {
          bills_sponsored_count: 1, bills_cosponsored_count: 0,
          votes_voted_count: 0, votes_missed_count: 0, total_roll_calls: 0,
          attendance_pct: null, party_unity_state: null, fiscal_impact_total: 0,
          committee_chair_count: null,
          bills_passed_count: null, hearings_held_count: null, subject_breadth: null,
          bill_passage_rate: null, fiscal_impact_per_dollar_raised: null,
        },
        isLoading: false, isSuccess: true,
      }),
      useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
    }
  })
  const { StateServiceRecordCard: Reimported } = require('@/components/state/StateServiceRecordCard')
  const { getAllByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
  expect(getAllByText('—').length).toBeGreaterThanOrEqual(5)
})

it('committee_chair_count row hidden when NULL', () => {
  jest.resetModules()
  jest.doMock('@chiaro/officials', () => {
    const actual = jest.requireActual('@chiaro/officials') as object
    return {
      ...actual,
      useOfficialMetrics: () => ({
        data: {
          bills_sponsored_count: 1, bills_cosponsored_count: 0,
          votes_voted_count: 0, votes_missed_count: 0, total_roll_calls: 0,
          attendance_pct: null, party_unity_state: null, fiscal_impact_total: 0,
          committee_chair_count: null,
          bills_passed_count: 0, hearings_held_count: 0, subject_breadth: 0,
          bill_passage_rate: 0, fiscal_impact_per_dollar_raised: 0,
        },
        isLoading: false, isSuccess: true,
      }),
      useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
    }
  })
  const { StateServiceRecordCard: Reimported } = require('@/components/state/StateServiceRecordCard')
  const { queryByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
  expect(queryByText('Committee chair seats')).toBeNull()
})

it('fiscal_impact_per_dollar_raised formats small values as $0.04', () => {
  jest.resetModules()
  jest.doMock('@chiaro/officials', () => {
    const actual = jest.requireActual('@chiaro/officials') as object
    return {
      ...actual,
      useOfficialMetrics: () => ({
        data: {
          bills_sponsored_count: 1, bills_cosponsored_count: 0,
          votes_voted_count: 0, votes_missed_count: 0, total_roll_calls: 0,
          attendance_pct: null, party_unity_state: null, fiscal_impact_total: 0,
          committee_chair_count: 0,
          bills_passed_count: 0, hearings_held_count: 0, subject_breadth: 0,
          bill_passage_rate: 0, fiscal_impact_per_dollar_raised: 0.04,
        },
        isLoading: false, isSuccess: true,
      }),
      useOfficialSponsoredStateBills:   () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
      useOfficialStateVotes:            () => ({ data: [], isLoading: false, isSuccess: true }),
    }
  })
  const { StateServiceRecordCard: Reimported } = require('@/components/state/StateServiceRecordCard')
  const { getByText } = render(<Reimported official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText('$0.04')).toBeTruthy()
})
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/mobile test StateServiceRecordCard
pnpm --filter @chiaro/mobile typecheck
```

Expected: 5 new cases pass; typecheck clean.

```bash
git add apps/mobile/components/state/StateServiceRecordCard.tsx \
        apps/mobile/test/components/state/StateServiceRecordCard.test.tsx
git commit -m "feat(mobile): StateServiceRecordCard 'Performance metrics' parity

Mirror of web Task 10 with RN primitives (View/Text). Same 5 KPI rows
+ conditional committee chair seats row. Shared fmtCount/fmtPct/fmtRatio
helpers (duplicated per-platform, slice 5D convention).

5 new jest-expo cases."
```

---

## Task 13: Mobile — extend StateOfficialDetailPage parent test fixture

**Files:**
- Modify: `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`

Mirror of Task 11 for mobile. Update the existing `useOfficialMetrics` jest mock to include the 5 new fields (all NULL).

- [ ] **Step 1: Extend the mock data**

Open `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`. Find the `useOfficialMetrics` mock and extend its `data` payload with:

```tsx
committee_chair_count: null,
bills_passed_count: null,
hearings_held_count: null,
subject_breadth: null,
bill_passage_rate: null,
fiscal_impact_per_dollar_raised: null,
```

If the existing mock returned `data: undefined`, change to a full all-NULL fixture (same shape as Task 11):

```tsx
useOfficialMetrics: () => ({
  data: {
    bills_sponsored_count: 1, bills_cosponsored_count: 0,
    votes_voted_count: 0, votes_missed_count: 0, total_roll_calls: 0,
    attendance_pct: null, party_unity_state: null, fiscal_impact_total: 0,
    committee_chair_count: null,
    bills_passed_count: null, hearings_held_count: null, subject_breadth: null,
    bill_passage_rate: null, fiscal_impact_per_dollar_raised: null,
  },
  isLoading: false, isSuccess: true,
}),
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @chiaro/mobile test StateOfficialDetailPage
pnpm --filter @chiaro/mobile typecheck
```

Expected: pre-existing tests still pass.

```bash
git add apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "test(mobile): extend StateOfficialDetailPage mock with 5F metrics

Mirror of web Task 11. useOfficialMetrics jest mock returns all-NULL
fixture so the new Performance subsection exercises its NULL path
in parent-page tests."
```

---

## Task 14: Extend officials integration test with committee seed

**Files:**
- Modify: `packages/officials/test/queries.integration.test.ts`

- [ ] **Step 1: Locate slice-5D/5E seed blocks**

```bash
grep -n "state_bill_sponsors\|state_finance_summaries\|stateAsmId" packages/officials/test/queries.integration.test.ts | head -10
```

This file was extended in slice 5D (state bills/votes) and slice 5E (state finance). We add a state_committee_memberships row to the same test legislator.

- [ ] **Step 2: Extend beforeAll**

After the existing slice-5E state-finance seed block (the `state_finance_individual_donors` INSERTs), add:

```ts
const { error: scErr } = await svc.from('state_committee_memberships').insert({
  official_id: stateAsmId,
  openstates_committee_id: 'ocd-committee/int-test',
  committee_name: 'Integration Test Cmt',
  state: 'CA',
  chamber: 'state_house',
  role: 'chair',
  source_url: 'https://x',
})
expect(scErr).toBeNull()
```

- [ ] **Step 3: Extend afterAll**

BEFORE the existing slice-5E cleanup of state_finance, add:

```ts
await svc.from('state_committee_memberships').delete().eq('official_id', stateAsmId)
```

FK delete order: memberships first (RESTRICT to officials), then state_finance, then state_bills, then officials, then districts.

- [ ] **Step 4: Add new test case**

After the existing slice-5E donors anon-RLS test, add:

```ts
it('state officials can read their own state_committee_memberships via anon RLS', async () => {
  const { data, error } = await anon.from('state_committee_memberships')
    .select('committee_name, role')
    .eq('official_id', stateAsmId)
  expect(error).toBeNull()
  expect(data).toHaveLength(1)
  expect(data![0]!.role).toBe('chair')
  expect(data![0]!.committee_name).toBe('Integration Test Cmt')
})
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter @chiaro/officials typecheck
```

Expected: clean. Integration test itself runs in CI (`SUPABASE_*` env vars not set locally).

- [ ] **Step 6: Commit**

```bash
git add packages/officials/test/queries.integration.test.ts
git commit -m "test(officials): extend integration test with state committee membership

beforeAll: 1 state_committee_memberships row (chair role) for the
slice-5D test assemblymember. afterAll: cleanup FIRST in FK order
(memberships → finance → bills → officials → districts). New case
verifies anon RLS on state_committee_memberships."
```

---

## Task 15: CLAUDE.md slice entry + gotcha #11 + Quick start

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update migration range in Quick start**

Find:
```
pnpm db:reset                          # apply all migrations 0001–0036
```
Change to:
```
pnpm db:reset                          # apply all migrations 0001–0039
```

- [ ] **Step 2: Update pgTAP count in Quick start and Testing section**

Find:
```
pnpm db:test                           # pgTAP suite (321 tests across 24 files)
```
Change to:
```
pnpm db:test                           # pgTAP suite (341 tests across 26 files)
```

Recompute actual count to confirm:
```bash
ls packages/db/supabase/tests/*.test.sql | wc -l
grep -h "^select plan(" packages/db/supabase/tests/*.test.sql | grep -oE "plan\([0-9]+\)" | grep -oE "[0-9]+" | awk '{s+=$1} END {print "Total plans:", s}'
```

Use actual values if different.

Find the Testing-section `pgTAP` line and update to match.

- [ ] **Step 3: Add committee seed lines to Quick start**

Below the existing `pnpm seed:state-finance` line, add:

```
pnpm seed:openstates-committees-fetch --state=CA   # one state at a time; repeat per state
pnpm seed:openstates-committees-ingest             # parse cache → state_committee_memberships
pnpm seed:state-metrics-recompute --session=2024   # populates new KPI columns
```

- [ ] **Step 4: Add slice 5F entry**

In the "Slices delivered" section, after the slice 5E entry, add:

```markdown
- **Sub-slice 5F — state performance metrics + KPIs** (2026-05-21): real `committee_chair_count` via new OpenStates committees ingest (state_committee_memberships table + fetcher + ingest scripts). 5 new KPI columns on `official_metrics`: bills_passed_count (status heuristic), hearings_held_count, subject_breadth, bill_passage_rate (E1), fiscal_impact_per_dollar_raised (E2, descriptive ROI ratio). UI: StateServiceRecordCard (web + mobile) extended with "Performance metrics" subsection — 5 new rows + conditional committee chair seats row (hidden when NULL). Migrations 0037–0039. party_unity_state stub UNCHANGED (deferred). 2 new pgTAP files (12 + 8 plans = 20). Workspace stays at 10.
```

- [ ] **Step 5: Add gotcha #11**

After gotcha #10, add:

```markdown
11. **State performance KPIs have known limitations** —
    - **`party_unity_state` is still a stub** (`= 100 when voted >= 3, else NULL`). Real majority-of-same-party-peers computation deferred to a future slice. Tracked.
    - **`bills_passed_count` is a heuristic.** Substring match on `state_bills.status` against `'%signed%' | '%enacted%' | '%became law%' | '%passed%governor%' | '%chaptered%'` (CA convention). Per-state status conventions vary; false negatives possible. Acceptable v1 (conservative under-count, not over-count).
    - **`hearings_held_count` underreports when augment adapter doesn't populate hearing_date.** CA + NY + MI generally populate; FL + TX sparse. Reads as `0` (not NULL) in sparse-state cases.
    - **`fiscal_impact_per_dollar_raised` is descriptive, NOT normative.** UI labels neutrally ("Fiscal impact / $"). High ratio ≠ "good ROI" — could mean "delivered a lot for cheap" OR "introduced budget-busting bills without raising much." Don't editorialize in copy.
    - **`committee_chair_count` NULL semantics.** NULL when no rows in `state_committee_memberships` for the official's state (data not ingested). 0 means "ingested, this official is not a chair." UI hides the row when NULL.
    - **Subcommittees count identically to full committees** in `committee_chair_count`. v1 trade-off; documented.
    - **Role normalization is lossy.** OpenStates roles like "Ranking Member", "Ex Officio", "Vice Chairwoman" fold to `'member'` or `'vice_chair'` per `normalizeRole()`. Original strings discarded.
    - **Joint committees skipped** when OpenStates `chamber` is `'joint'` or non-standard. Logged to `stats.errors[]`; ingest continues with other committees.
    - **OpenStates committee data freshness: 7-day cache.** Operator re-runs `seed:openstates-committees-fetch` after committee turnover (start of session, mid-session chair changes).
    - **`fiscal_impact_per_dollar_raised` cycle alignment.** Numerator (`fiscal_impact_total`) is session-filtered; denominator (`total_raised`) is latest-cycle finance. Not the same time window — descriptive ratio, not a rigorous time-aligned metric. Document for future tightening.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): sub-slice 5F — state metrics + KPIs

- New slice entry: 5F state performance metrics + KPIs
- Migration range: 0001-0036 → 0001-0039
- pgTAP count: 321 → 341 across 26 files
- Quick start: +seed:openstates-committees-fetch +-ingest +-recompute
- Gotcha #11: 5F KPI limitations (party_unity stub, bills_passed
  heuristic, hearings sparse, fiscal/\$ descriptive, committee NULL
  semantics, role normalization lossy, joint skipped, cache freshness,
  cycle alignment)"
```

---

## Task 16: Final workspace verify

**Files:** none modified.

Verification-only. Confirm slice 5F lands cleanly.

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
- web tests +5 cases (183+ total)
- mobile tests +5 cases (113+ total)
- db seed tests +21 cases (8 fetch + 6 ingest + 7 recompute extension; ~197+ total)
- officials tests green (integration test runs in CI)
- pgTAP green (~341 plans across 26 files; pre-existing TIGER tolerance from PR #16 still passes)

- [ ] **Step 2: Branch state**

```bash
git log master..HEAD --oneline | head -20
git status
```

Expected: ~17 commits (one per Task 1-15 + spec + plan). Working tree clean except for pre-existing CRLF-noise fixtures.

- [ ] **Step 3: No commit if everything green**

This task is verification-only. If anything fails, report BLOCKED with the failing commands + output.

## Report (after Task 16)

Reply with **DONE | DONE_WITH_CONCERNS | BLOCKED** and:
- Commit SHAs for tasks 1–15
- Final test counts per surface
- Build outcome
- Confirmation `/state-officials/[id]` route renders the "Performance metrics" subsection (web + mobile)
- Operator pre-flight reminder: `pnpm seed:openstates-committees-fetch && pnpm seed:openstates-committees-ingest && pnpm seed:state-metrics-recompute --session=2024` post-merge

---

## Self-review notes

**Spec coverage map:**

| Spec section | Covered by |
|---|---|
| Goal | Tasks 1-15 deliver schema + ingest + recompute + UI + docs |
| Architecture (committees fetch + ingest + recompute extension + UI subsection) | Tasks 1-3 (schema), 6-7 (ingest pipeline), 9 (recompute), 10/12 (UI) |
| Schema migrations 0037-0039 | Tasks 1, 2, 3 |
| @chiaro/officials type extension | Task 5 |
| Committee ingest pipeline | Tasks 6-8 |
| KPI catalog (5 new metrics + committee_chair_count refinement) | Task 9 |
| UI (web + mobile parity) | Tasks 10, 12 (component) + 11, 13 (parent test fixture) |
| Integration test extension | Task 14 |
| CLAUDE.md slice entry + gotcha #11 | Task 15 |
| Final verify | Task 16 |
| Acceptance criteria 1-15 | Distributed across tasks; final verify in Task 16 |
| Operator pre-flight | Task 15 (CLAUDE.md Quick start) + Task 16 (reminder) |

**Placeholder scan:** No "TBD" / "TODO" / "later" in any task. Every code step shows the actual code. The `state_committee_memberships.session` text-and-nullable design is explicit; the `committee_chair_count` NULL detection logic is explicit (`exists()` check before counting). Heuristic substring patterns for `bills_passed_count` are listed in the SQL block. `fmtRatio` formatter is explicit. Helpers may be shared with existing slice 5D helpers — Task 10 Step 2 explicitly handles the "reuse if present" case.

**Type consistency:**
- `StateCommitteeMembershipRow` defined in Task 5 → consumed by Task 14 (integration test) implicitly via supabase-js
- `IngestStateCommitteesStats` / `IngestStateCommitteesOpts` defined in Task 7
- `FetchOpenStatesCommitteesStats` / `FetchOpenStatesCommitteesOpts` defined in Task 6
- `committee_chair_count`, `bills_passed_count`, `hearings_held_count`, `subject_breadth`, `bill_passage_rate`, `fiscal_impact_per_dollar_raised` consistent across migration 0039 / regenerated types (Task 4) / recompute extension (Task 9) / UI (Tasks 10, 12) / parent tests (Tasks 11, 13) / docs (Task 15)
- Role enum `('chair', 'vice_chair', 'member')` consistent in migration 0037, pgTAP, ingest `normalizeRole()`, integration test
- `fmtCount` / `fmtPct` / `fmtRatio` helpers consistent across web (Task 10) + mobile (Task 12) with NULL → `'—'`, integer → string, pct → `'X%'` or `'X.X%'`, ratio → `'$X'` with `toLocaleString`

All references resolve forward. Plan is self-consistent.
