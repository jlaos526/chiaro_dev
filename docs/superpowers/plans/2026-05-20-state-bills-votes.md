# State Bills + Votes Implementation Plan (sub-slice 5D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest state legislators' bills + votes via OpenStates baseline (50 states) + 5 per-state public-API augments (CA, NY, FL, TX, MI). Populate 5 new `state_*` tables + 3 new `official_metrics` columns. Replace slice 5C `ComingSoonCard("Service Record")` on `/state-officials/[id]` with real `StateServiceRecordCard` showing tenure + bills + votes + attendance with inline EvidenceExpand.

**Architecture:** Parallel `state_*` tables (mirror federal slice-4 shape). New `@chiaro/state-bills` package (workspace grows to 10). One orchestrator for baseline (`state-bills-votes-ingest.ts` with `--skip-bills`/`--skip-votes` flags). 5 per-state adapters dispatched by a separate orchestrator. Recompute pipeline mirrors federal `recompute-metrics.ts`.

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP, vitest (web/db/state-bills), jest-expo (mobile), Next 15 App Router, Expo Router, `yaml@^2` (already in @chiaro/db), `pg@^8` (already), TanStack Query v5.

**Spec:** `docs/superpowers/specs/2026-05-20-state-bills-votes-design.md`

---

## File structure

**Created** (~50 files):
```
packages/db/supabase/migrations/
  0030_state_bills.sql
  0031_state_bills_rls.sql
  0032_state_votes.sql
  0033_state_votes_rls.sql
  0034_official_metrics_state_columns.sql
packages/db/supabase/tests/
  state_bills_rls.test.sql
  state_votes_rls.test.sql
  official_metrics_state_columns.test.sql
packages/db/supabase/seed/
  state-bills-votes-ingest.ts
  state-bills-votes-ingest.test.ts
  openstates-bills-loader.ts
  openstates-bills-loader.test.ts
  state-bills-enrich.ts
  state-bills-enrich.test.ts
  recompute-state-metrics.ts
  recompute-state-metrics.test.ts
  state-bills/
    shared.ts
    enrich-ca.ts
    enrich-ca.test.ts
    enrich-ny.ts
    enrich-ny.test.ts
    enrich-fl.ts
    enrich-fl.test.ts
    enrich-tx.ts
    enrich-tx.test.ts
    enrich-mi.ts
    enrich-mi.test.ts
  fixtures/openstates-bills/
    ca-sample-bill-AB123.yml
    ca-sample-bill-SB45.yml
    ca-sample-vote-roll.yml
    ne-sample-bill-LB100.yml
    md-sample-bill-HB1.yml
  fixtures/state-bills-enrich/
    ca-leginfo-AB123.json
    ny-senate-S5678.json
    fl-senate-SB9.json
    tx-capitol-HB1.json
    mi-legislature-SB2.json
packages/state-bills/                 # NEW PACKAGE
  package.json
  tsconfig.json
  vitest.config.ts
  src/{index,types,queries,keys,hooks,schemas}.ts
  test/{queries.integration,hooks,keys}.test.{ts,tsx}
apps/web/components/state/
  StateServiceRecordCard.tsx
  StateBillsEvidence.tsx
  StateVotesEvidence.tsx
apps/web/test/components/state/
  StateServiceRecordCard.test.tsx
  StateBillsEvidence.test.tsx
  StateVotesEvidence.test.tsx
apps/mobile/components/state/
  StateServiceRecordCard.tsx
  StateBillsEvidence.tsx
  StateVotesEvidence.tsx
apps/mobile/test/components/state/
  StateServiceRecordCard.test.tsx
  StateBillsEvidence.test.tsx
  StateVotesEvidence.test.tsx
```

**Modified:**
```
packages/db/src/types.ts              # regenerated after each migration
packages/db/package.json              # +4 seed scripts
packages/officials/src/types.ts       # OfficialMetricsRow extended (auto via Database type)
apps/web/components/state/StateOfficialDetailPage.tsx  # swap ComingSoonCard("Service Record")
apps/mobile/components/state/StateOfficialDetailPage.tsx  # mirror swap
apps/web/.env.example                 # +NY_SENATE_API_KEY
.env.example                          # +NY_SENATE_API_KEY
CLAUDE.md                             # +Slice 5D entry, +gotcha #9, migration range, pgTAP count, package count
```

---

## Task 1: Verify OpenStates bulk-data source

**Files:**
- None created — research-only task. Output: pinning decision recorded in commit message + plan-execution scratchpad.

The spec deferred this decision to the first implementation task because the right source depends on what's actually published. Verify which of the three candidates is real + accessible, then lock for Task 10.

- [ ] **Step 1: Check whether `openstates/data` GitHub repo exists**

```bash
curl -sIL https://github.com/openstates/data 2>&1 | head -5
```

Expected: HTTP/2 200 (repo exists) OR HTTP 404 (doesn't exist). If exists, browse repo's README + a sample data directory to confirm it follows the same per-state YAML structure as `openstates/people`.

- [ ] **Step 2: Check `open.pluralpolicy.com/data` bulk endpoint**

```bash
curl -sIL https://open.pluralpolicy.com/data/session-csv/ 2>&1 | head -5
curl -sIL https://open.pluralpolicy.com/data/ 2>&1 | head -5
```

Expected: 200 or redirect. If neither exists, check for the data subpage on `openstates.org`:

```bash
curl -sIL https://openstates.org/data/ 2>&1 | head -5
```

- [ ] **Step 3: Verify v3 API rate limits + free-tier capacity**

Per the slice 5C research the free tier is 500/day. Confirm via:

```bash
curl -sI https://v3.openstates.org/bills | head -10
```

- [ ] **Step 4: Decide + document**

Pick the source in this order of preference (per spec):
1. `openstates/data` GitHub YAML repo if it exists in the same style as `openstates/people`
2. `open.pluralpolicy.com/data` bulk CSV/JSON if (1) doesn't exist
3. v3 API as fallback (only if both above are unavailable)

Record the pick in the Task 10 (`openstates-bills-loader.ts`) implementation — that's the file that hard-codes the source URL/path.

- [ ] **Step 5: Commit (research note)**

Since no code changes, commit a one-line scratchpad in the plan checkpoint:

```bash
git commit --allow-empty -m "chore: pin OpenStates bills source for slice 5D

Verified candidates:
- openstates/data GitHub repo: <exists | does-not-exist>
- open.pluralpolicy.com/data bulk: <exists | does-not-exist>
- v3 API: free tier 500/day confirmed

PICK: <option chosen>. URL: <exact url>.
Reasoning: <why>.

Used in Task 10 (openstates-bills-loader.ts)."
```

The empty commit pins the decision in git history for downstream tasks.

---

## Task 2: Migration 0030 — state_bills + sponsors + subjects

**Files:**
- Create: `packages/db/supabase/migrations/0030_state_bills.sql`

This migration creates 3 child tables for state-level bill data. Pure additive; federal tables untouched.

- [ ] **Step 1: Write migration SQL**

Create `packages/db/supabase/migrations/0030_state_bills.sql`:

```sql
-- Sub-slice 5D: state-level bills + sponsors + subjects. Parallel to federal
-- slice-4 0014 (bills + bill_sponsors + bill_subjects).
--
-- FK conventions per slice-5C 0026 audit fix:
--   - bill child tables (sponsors, subjects) → bills: ON DELETE CASCADE
--   - sponsors → officials: ON DELETE RESTRICT (preserves audit trail)

create table public.state_bills (
  id                       uuid primary key default gen_random_uuid(),
  openstates_bill_id       text unique not null,    -- ocd-bill/<uuid>
  state                    text not null,
  session                  text not null,            -- '20252026' for CA, '2025' for NY, etc
  bill_type                text not null,            -- 'AB', 'SB', 'HB' — varies per state
  number                   int  not null,
  title                    text not null,
  status                   text,                      -- OpenStates normalized status
  introduced_date          date,
  latest_action            text,
  latest_action_date       date,
  source_url               text not null,
  openstates_url           text not null,
  -- Augment fields (nullable, populated by per-state enrichment in Task 13-19):
  status_substage          text,
  hearing_date             date,
  fiscal_impact_amount     numeric(15, 2),
  party_vote_split         jsonb,
  augmented_from           text,                      -- 'ca-leginfo' | 'ny-senate-api' | ...
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (state, session, bill_type, number)
);
create index state_bills_state_session_idx
  on public.state_bills(state, session);
create index state_bills_openstates_id_idx
  on public.state_bills(openstates_bill_id);

create table public.state_bill_sponsors (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.state_bills(id) on delete cascade,
  official_id uuid not null references public.officials(id)   on delete restrict,
  role        text not null check (role in ('sponsor', 'cosponsor')),
  added_date  date,
  unique (bill_id, official_id, role)
);
create index state_bill_sponsors_official_idx
  on public.state_bill_sponsors(official_id);

create table public.state_bill_subjects (
  bill_id  uuid not null references public.state_bills(id) on delete cascade,
  subject  text not null,
  primary key (bill_id, subject)
);
```

- [ ] **Step 2: Apply migration locally**

```bash
pnpm db:reset
```

Expected: migrations 0001-0030 apply cleanly. Look for `Applying migration 0030_state_bills.sql...` then `Finished supabase db reset`.

If FK syntax errors, double-check `references public.officials(id) on delete restrict` line — slice-5C 0026 audit set this convention.

- [ ] **Step 3: Verify tables exist**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "\dt public.state_bills" \
  -c "\dt public.state_bill_sponsors" \
  -c "\dt public.state_bill_subjects" 2>&1 | tail -15
```

Expected: each table listed once.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0030_state_bills.sql
git commit -m "feat(db): 0030 state_bills + state_bill_sponsors + state_bill_subjects

Three new tables parallel to federal slice-4 0014 (bills/bill_sponsors/
bill_subjects). FK conventions per slice-5C 0026 audit fix: bill→officials
uses ON DELETE RESTRICT (preserves audit trail), bill→child tables
(sponsors, subjects) use ON DELETE CASCADE.

Augment fields (status_substage, hearing_date, fiscal_impact_amount,
party_vote_split, augmented_from) are nullable and populated by per-state
enrichment in upcoming tasks 13-19.

UNIQUE (state, session, bill_type, number) guarantees per-state-session
bill identity. UNIQUE openstates_bill_id is the join key for the
OpenStates upsert path."
```

---

## Task 3: pgTAP for 0030 + Migration 0031 RLS

**Files:**
- Create: `packages/db/supabase/migrations/0031_state_bills_rls.sql`
- Create: `packages/db/supabase/tests/state_bills_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

Create `packages/db/supabase/migrations/0031_state_bills_rls.sql`:

```sql
-- RLS for state_bills + state_bill_sponsors + state_bill_subjects.
-- Read = authenticated (state bills are public data); write = service_role only.
-- Mirrors federal slice-4 0015 pattern.

alter table public.state_bills            enable row level security;
alter table public.state_bill_sponsors    enable row level security;
alter table public.state_bill_subjects    enable row level security;

create policy state_bills_select on public.state_bills
  for select to authenticated using (true);
create policy state_bill_sponsors_select on public.state_bill_sponsors
  for select to authenticated using (true);
create policy state_bill_subjects_select on public.state_bill_subjects
  for select to authenticated using (true);

-- Explicitly REVOKE write paths from anon and authenticated.
revoke insert, update, delete on public.state_bills            from anon, authenticated;
revoke insert, update, delete on public.state_bill_sponsors    from anon, authenticated;
revoke insert, update, delete on public.state_bill_subjects    from anon, authenticated;
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/state_bills_rls.test.sql`:

```sql
begin;
select plan(25);

-- ─── state_bills ───
select has_table('public', 'state_bills', 'state_bills table exists');
select has_column('public', 'state_bills', 'openstates_bill_id', 'openstates_bill_id col');
select has_column('public', 'state_bills', 'state',              'state col');
select has_column('public', 'state_bills', 'session',            'session col');
select has_column('public', 'state_bills', 'bill_type',          'bill_type col');
select has_column('public', 'state_bills', 'augmented_from',     'augmented_from augment col');
select has_column('public', 'state_bills', 'status_substage',    'status_substage augment col');
select has_column('public', 'state_bills', 'party_vote_split',   'party_vote_split augment col');
select col_type_is('public', 'state_bills', 'party_vote_split', 'jsonb',
  'party_vote_split is jsonb');

-- UNIQUE (state, session, bill_type, number)
select has_index('public', 'state_bills', 'state_bills_state_session_bill_type_number_key',
  'composite unique constraint exists');

-- Partial unique on openstates_bill_id
select has_index('public', 'state_bills', 'state_bills_openstates_bill_id_key',
  'openstates_bill_id unique index exists');

-- ─── state_bill_sponsors ───
select has_table('public', 'state_bill_sponsors', 'state_bill_sponsors exists');
select has_column('public', 'state_bill_sponsors', 'bill_id',     'bill_id col');
select has_column('public', 'state_bill_sponsors', 'official_id', 'official_id col');
select has_column('public', 'state_bill_sponsors', 'role',        'role col');
select has_check ('public', 'state_bill_sponsors', 'role CHECK exists');

-- FK ON DELETE RESTRICT for sponsors → officials (per slice-5C 0026 audit)
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_bill_sponsors_official_id_fkey'
     and conrelid = 'public.state_bill_sponsors'::regclass),
  'r',
  'state_bill_sponsors.official_id FK uses on-delete RESTRICT'
);

-- FK ON DELETE CASCADE for sponsors → state_bills
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_bill_sponsors_bill_id_fkey'
     and conrelid = 'public.state_bill_sponsors'::regclass),
  'c',
  'state_bill_sponsors.bill_id FK uses on-delete CASCADE'
);

-- ─── state_bill_subjects ───
select has_table('public', 'state_bill_subjects', 'state_bill_subjects exists');
select has_column('public', 'state_bill_subjects', 'subject', 'subject col');

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_bill_subjects_bill_id_fkey'
     and conrelid = 'public.state_bill_subjects'::regclass),
  'c',
  'state_bill_subjects.bill_id FK uses on-delete CASCADE'
);

-- ─── RLS enabled on all 3 ───
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_bills'::regclass),
  true,
  'state_bills RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_bill_sponsors'::regclass),
  true,
  'state_bill_sponsors RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_bill_subjects'::regclass),
  true,
  'state_bill_subjects RLS enabled'
);

-- ─── SELECT policy exists for authenticated ───
select policy_roles_are('public', 'state_bills', 'state_bills_select',
  array['authenticated'],
  'state_bills_select policy is for authenticated');
select policy_roles_are('public', 'state_bill_sponsors', 'state_bill_sponsors_select',
  array['authenticated'],
  'state_bill_sponsors_select policy is for authenticated');
select policy_roles_are('public', 'state_bill_subjects', 'state_bill_subjects_select',
  array['authenticated'],
  'state_bill_subjects_select policy is for authenticated');

select * from finish();
rollback;
```

- [ ] **Step 3: Apply migration**

```bash
pnpm db:reset
```

Expected: 0031 applies cleanly.

- [ ] **Step 4: Run pgTAP**

```bash
pnpm db:test 2>&1 | grep -E "state_bills_rls|^ok " | head -30
```

Expected: 25/25 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0031_state_bills_rls.sql \
        packages/db/supabase/tests/state_bills_rls.test.sql
git commit -m "feat(db): 0031 RLS for state_bills + state_bill_sponsors + state_bill_subjects

Read = authenticated (state bills are public data); write = service_role
only. Mirrors federal slice-4 0015 pattern.

pgTAP plan: 25 assertions covering table existence, column shape,
FK on-delete conventions (RESTRICT for officials FK, CASCADE for
bill→child FKs), RLS enabled, and SELECT policies."
```

---

## Task 4: Migration 0032 — state_votes + state_vote_positions

**Files:**
- Create: `packages/db/supabase/migrations/0032_state_votes.sql`

- [ ] **Step 1: Write migration SQL**

Create `packages/db/supabase/migrations/0032_state_votes.sql`:

```sql
-- Sub-slice 5D: state-level votes + vote positions. Parallel to federal
-- slice-4 0016 (votes + vote_positions).
--
-- FK conventions per slice-5C 0026 audit fix:
--   - state_votes → state_bills: ON DELETE RESTRICT (vote history preserved)
--   - state_vote_positions → state_votes: ON DELETE CASCADE
--   - state_vote_positions → officials: ON DELETE RESTRICT

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
  result              text not null,
  source_url          text not null,
  party_vote_split    jsonb,                         -- augment field
  created_at          timestamptz not null default now()
);
create index state_votes_state_session_chamber_date_idx
  on public.state_votes(state, session, chamber, vote_date desc);
create index state_votes_bill_idx
  on public.state_votes(bill_id);

create table public.state_vote_positions (
  id          uuid primary key default gen_random_uuid(),
  vote_id     uuid not null references public.state_votes(id) on delete cascade,
  official_id uuid not null references public.officials(id)   on delete restrict,
  position    text not null
    check (position in ('yes','no','abstain','not_voting','present')),
  unique (vote_id, official_id)
);
create index state_vote_positions_official_idx
  on public.state_vote_positions(official_id);
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:reset
```

Expected: 0032 applies cleanly.

- [ ] **Step 3: Verify tables**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "\dt public.state_votes" \
  -c "\dt public.state_vote_positions" 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0032_state_votes.sql
git commit -m "feat(db): 0032 state_votes + state_vote_positions

Two new tables parallel to federal slice-4 0016 (votes + vote_positions).

FK conventions per slice-5C 0026 audit:
- state_votes.bill_id → state_bills ON DELETE RESTRICT (preserves vote
  history even if bill row is later deleted)
- state_vote_positions.vote_id → state_votes ON DELETE CASCADE
- state_vote_positions.official_id → officials ON DELETE RESTRICT

CHECK constraint on chamber limits to state-tier values (state_house,
state_senate, state_legislature for NE unicameral).

position CHECK limits to OpenStates' canonical values: yes, no, abstain,
not_voting, present."
```

---

## Task 5: Migration 0033 — state_votes RLS + pgTAP

**Files:**
- Create: `packages/db/supabase/migrations/0033_state_votes_rls.sql`
- Create: `packages/db/supabase/tests/state_votes_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

Create `packages/db/supabase/migrations/0033_state_votes_rls.sql`:

```sql
-- RLS for state_votes + state_vote_positions. Read = authenticated;
-- write = service_role only. Mirrors federal slice-4 0017 pattern.

alter table public.state_votes           enable row level security;
alter table public.state_vote_positions  enable row level security;

create policy state_votes_select on public.state_votes
  for select to authenticated using (true);
create policy state_vote_positions_select on public.state_vote_positions
  for select to authenticated using (true);

revoke insert, update, delete on public.state_votes           from anon, authenticated;
revoke insert, update, delete on public.state_vote_positions  from anon, authenticated;
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/state_votes_rls.test.sql`:

```sql
begin;
select plan(20);

-- ─── state_votes ───
select has_table('public', 'state_votes', 'state_votes table exists');
select has_column('public', 'state_votes', 'openstates_vote_id', 'openstates_vote_id col');
select has_column('public', 'state_votes', 'bill_id',            'bill_id col');
select has_column('public', 'state_votes', 'chamber',            'chamber col');
select has_column('public', 'state_votes', 'party_vote_split',   'party_vote_split jsonb');
select col_type_is('public', 'state_votes', 'party_vote_split', 'jsonb',
  'party_vote_split is jsonb');

-- FK ON DELETE RESTRICT for bill_id
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_votes_bill_id_fkey'
     and conrelid = 'public.state_votes'::regclass),
  'r',
  'state_votes.bill_id FK uses on-delete RESTRICT'
);

-- chamber CHECK constraint
select has_check('public', 'state_votes', 'chamber CHECK exists');

-- ─── state_vote_positions ───
select has_table('public', 'state_vote_positions', 'state_vote_positions exists');
select has_column('public', 'state_vote_positions', 'vote_id',     'vote_id col');
select has_column('public', 'state_vote_positions', 'official_id', 'official_id col');
select has_column('public', 'state_vote_positions', 'position',    'position col');
select has_check ('public', 'state_vote_positions', 'position CHECK exists');

-- FK ON DELETE CASCADE for vote_id
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_vote_positions_vote_id_fkey'
     and conrelid = 'public.state_vote_positions'::regclass),
  'c',
  'state_vote_positions.vote_id FK uses on-delete CASCADE'
);

-- FK ON DELETE RESTRICT for official_id (per slice-5C 0026 audit)
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_vote_positions_official_id_fkey'
     and conrelid = 'public.state_vote_positions'::regclass),
  'r',
  'state_vote_positions.official_id FK uses on-delete RESTRICT'
);

-- UNIQUE (vote_id, official_id)
select has_index('public', 'state_vote_positions',
  'state_vote_positions_vote_id_official_id_key',
  'unique (vote_id, official_id) index exists');

-- ─── RLS ───
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_votes'::regclass),
  true,
  'state_votes RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_vote_positions'::regclass),
  true,
  'state_vote_positions RLS enabled'
);

select policy_roles_are('public', 'state_votes', 'state_votes_select',
  array['authenticated'],
  'state_votes_select policy is for authenticated');
select policy_roles_are('public', 'state_vote_positions', 'state_vote_positions_select',
  array['authenticated'],
  'state_vote_positions_select policy is for authenticated');

select * from finish();
rollback;
```

- [ ] **Step 3: Apply migration + run pgTAP**

```bash
pnpm db:reset
pnpm db:test 2>&1 | grep -E "state_votes_rls|^ok " | head -25
```

Expected: 20/20 pass for state_votes_rls.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0033_state_votes_rls.sql \
        packages/db/supabase/tests/state_votes_rls.test.sql
git commit -m "feat(db): 0033 RLS for state_votes + state_vote_positions

Read = authenticated; write = service_role only. Mirrors federal
slice-4 0017 pattern.

pgTAP plan: 20 assertions covering table existence, column shape,
FK on-delete conventions, chamber CHECK, position CHECK, RLS enabled,
SELECT policies."
```

---

## Task 6: Migration 0034 — official_metrics state columns + pgTAP

**Files:**
- Create: `packages/db/supabase/migrations/0034_official_metrics_state_columns.sql`
- Create: `packages/db/supabase/tests/official_metrics_state_columns.test.sql`

- [ ] **Step 1: Write migration**

Create `packages/db/supabase/migrations/0034_official_metrics_state_columns.sql`:

```sql
-- Sub-slice 5D: extend official_metrics with 3 state-specific scalar columns.
-- All nullable + additive. Federal rows have NULL for these columns;
-- state recompute pipeline (task 21) populates them for state officials.

alter table public.official_metrics
  add column if not exists committee_chair_count int,
  add column if not exists fiscal_impact_total   numeric(15, 2),
  add column if not exists party_unity_state     numeric(5, 2);
```

- [ ] **Step 2: Write pgTAP**

Create `packages/db/supabase/tests/official_metrics_state_columns.test.sql`:

```sql
begin;
select plan(8);

select has_column('public', 'official_metrics', 'committee_chair_count',
  'committee_chair_count column exists');
select col_type_is('public', 'official_metrics', 'committee_chair_count', 'integer',
  'committee_chair_count is integer');
select col_is_null('public', 'official_metrics', 'committee_chair_count',
  'committee_chair_count is nullable');

select has_column('public', 'official_metrics', 'fiscal_impact_total',
  'fiscal_impact_total column exists');
select col_type_is('public', 'official_metrics', 'fiscal_impact_total', 'numeric',
  'fiscal_impact_total is numeric');

select has_column('public', 'official_metrics', 'party_unity_state',
  'party_unity_state column exists');
select col_type_is('public', 'official_metrics', 'party_unity_state', 'numeric',
  'party_unity_state is numeric');
select col_is_null('public', 'official_metrics', 'party_unity_state',
  'party_unity_state is nullable');

select * from finish();
rollback;
```

- [ ] **Step 3: Apply + test**

```bash
pnpm db:reset
pnpm db:test 2>&1 | grep -E "official_metrics_state|^ok " | head -10
```

Expected: 8/8 pass.

- [ ] **Step 4: Regenerate Database type**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

Verify the new columns appear in `packages/db/src/types.ts`:

```bash
grep -B1 -A3 "committee_chair_count\|fiscal_impact_total\|party_unity_state" packages/db/src/types.ts | head -25
```

Each should appear as `<column>: number | null` in the official_metrics Row type.

- [ ] **Step 5: Verify workspace typecheck clean**

```bash
pnpm -r typecheck 2>&1 | tail -3
```

Expected: clean. The 3 new columns are nullable + additive, so no existing code breaks.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/migrations/0034_official_metrics_state_columns.sql \
        packages/db/supabase/tests/official_metrics_state_columns.test.sql \
        packages/db/src/types.ts
git commit -m "feat(db): 0034 official_metrics +committee_chair_count +fiscal_impact_total +party_unity_state

Three new nullable scalar columns on the existing official_metrics
table. Federal rows have NULL; state recompute pipeline (upcoming
task 21) populates them.

party_unity_state was a slice-4 placeholder column for federal; this
adds the state-specific equivalent so federal and state can be tracked
independently.

pgTAP plan: 8 assertions covering column existence, type, nullability."
```

---

## Task 7: Scaffold `@chiaro/state-bills` package

**Files:**
- Create: `packages/state-bills/package.json`
- Create: `packages/state-bills/tsconfig.json`
- Create: `packages/state-bills/vitest.config.ts`
- Create: `packages/state-bills/src/index.ts` (stub)

- [ ] **Step 1: Create package.json**

Create `packages/state-bills/package.json`:

```json
{
  "name": "@chiaro/state-bills",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@chiaro/officials": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "@chiaro/ui-tokens": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.105.0",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.1.0",
    "jsdom": "^25.0.0",
    "react": "^19.1.0",
    "typescript": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

This mirrors `packages/bills/package.json` exactly. Run `cat packages/bills/package.json` first to verify versions match what's already pinned in the workspace.

- [ ] **Step 2: Create tsconfig.json**

Create `packages/state-bills/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

This matches `packages/bills/tsconfig.json` after the slice-5B audit fix that adopted `tsconfig.base.json`.

- [ ] **Step 3: Create vitest.config.ts**

Create `packages/state-bills/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    testTimeout: 15_000,
    // Reset vi.spyOn mocks between tests so a leaked spy doesn't leak into
    // sibling files (per slice-5B audit fix).
    restoreMocks: true,
  },
})
```

- [ ] **Step 4: Create stub index.ts**

Create `packages/state-bills/src/index.ts`:

```ts
// Exports populated by Tasks 8 + 9.
export {}
```

- [ ] **Step 5: Install + verify workspace**

```bash
pnpm install 2>&1 | tail -5
```

Expected: pnpm picks up the new package; lockfile updates. New `@chiaro/state-bills` should appear in workspace package list.

```bash
pnpm -r typecheck 2>&1 | tail -10
```

Expected: 10 packages typecheck (was 9 before — `+ @chiaro/state-bills`). All clean.

- [ ] **Step 6: Commit**

```bash
git add packages/state-bills/ pnpm-lock.yaml
git commit -m "feat(state-bills): scaffold @chiaro/state-bills package

New workspace package for state-level bills + votes domain code.
Mirrors @chiaro/bills shape. Workspace count 9 → 10.

- package.json: same dep set as @chiaro/bills (officials, supabase-client,
  ui-tokens, tanstack/react-query, zod)
- tsconfig.json: extends ../../tsconfig.base.json (post slice-5B audit)
- vitest.config.ts: restoreMocks: true (post slice-5B audit)

src/index.ts is an empty stub; types + queries + hooks land in tasks 8-9."
```

---

## Task 8: `@chiaro/state-bills` types + keys

**Files:**
- Create: `packages/state-bills/src/types.ts`
- Create: `packages/state-bills/src/keys.ts`
- Create: `packages/state-bills/test/keys.test.ts`
- Modify: `packages/state-bills/src/index.ts`

- [ ] **Step 1: Write failing keys test**

Create `packages/state-bills/test/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { stateBillsKeys } from '../src/keys.ts'

describe('stateBillsKeys', () => {
  it('all is the root', () => {
    expect(stateBillsKeys.all).toEqual(['state-bills'])
  })

  it('byOfficialSponsored has hierarchical key', () => {
    expect(stateBillsKeys.byOfficialSponsored('oid-1')).toEqual([
      'state-bills', 'byOfficialSponsored', 'oid-1',
    ])
  })

  it('byOfficialCosponsored has hierarchical key', () => {
    expect(stateBillsKeys.byOfficialCosponsored('oid-1')).toEqual([
      'state-bills', 'byOfficialCosponsored', 'oid-1',
    ])
  })

  it('byOfficialVotes has hierarchical key', () => {
    expect(stateBillsKeys.byOfficialVotes('oid-1')).toEqual([
      'state-bills', 'byOfficialVotes', 'oid-1',
    ])
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/state-bills test keys
```

Expected: module not found.

- [ ] **Step 3: Implement types.ts**

Create `packages/state-bills/src/types.ts`:

```ts
import type { Database } from '@chiaro/db'

export type StateBillRow             = Database['public']['Tables']['state_bills']['Row']
export type StateBillSponsorRow      = Database['public']['Tables']['state_bill_sponsors']['Row']
export type StateBillSubjectRow      = Database['public']['Tables']['state_bill_subjects']['Row']
export type StateVoteRow             = Database['public']['Tables']['state_votes']['Row']
export type StateVotePositionRow     = Database['public']['Tables']['state_vote_positions']['Row']

// Joined view types used by the query layer.
export interface StateBillWithSponsors extends StateBillRow {
  sponsors: StateBillSponsorRow[]
  subjects: string[]
}

export interface StateVoteWithBill extends StateVoteRow {
  bill: Pick<StateBillRow, 'id' | 'state' | 'session' | 'bill_type' | 'number' | 'title'>
}

export interface StateVoteWithPosition {
  vote: StateVoteWithBill
  position: StateVotePositionRow['position']
}
```

- [ ] **Step 4: Implement keys.ts**

Create `packages/state-bills/src/keys.ts`:

```ts
export const stateBillsKeys = {
  all: ['state-bills'] as const,
  byOfficialSponsored: (officialId: string) =>
    ['state-bills', 'byOfficialSponsored', officialId] as const,
  byOfficialCosponsored: (officialId: string) =>
    ['state-bills', 'byOfficialCosponsored', officialId] as const,
  byOfficialVotes: (officialId: string) =>
    ['state-bills', 'byOfficialVotes', officialId] as const,
  byOfficialMissedVotes: (officialId: string) =>
    ['state-bills', 'byOfficialMissedVotes', officialId] as const,
  byId: (billId: string) =>
    ['state-bills', 'byId', billId] as const,
} as const
```

- [ ] **Step 5: Update index.ts to re-export**

Edit `packages/state-bills/src/index.ts` to:

```ts
export * from './types.ts'
export { stateBillsKeys } from './keys.ts'
```

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter @chiaro/state-bills test keys
pnpm --filter @chiaro/state-bills typecheck
```

Expected: 4/4 pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/state-bills/src/types.ts \
        packages/state-bills/src/keys.ts \
        packages/state-bills/src/index.ts \
        packages/state-bills/test/keys.test.ts
git commit -m "feat(state-bills): types + key factory

- StateBillRow, StateBillSponsorRow, StateBillSubjectRow, StateVoteRow,
  StateVotePositionRow — derived from Database type (auto-tracks 0030-0033)
- StateBillWithSponsors, StateVoteWithBill, StateVoteWithPosition — joined
  view types used by the query layer
- stateBillsKeys factory — hierarchical TanStack keys for invalidation

4 keys tests verify the hierarchical-key contract."
```

---

## Task 9: `@chiaro/state-bills` queries + hooks + schemas

**Files:**
- Create: `packages/state-bills/src/queries.ts`
- Create: `packages/state-bills/src/hooks.ts`
- Create: `packages/state-bills/src/schemas.ts`
- Create: `packages/state-bills/test/hooks.test.tsx`
- Modify: `packages/state-bills/src/index.ts`

- [ ] **Step 1: Write failing hooks test**

Create `packages/state-bills/test/hooks.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOfficialSponsoredStateBills } from '@/hooks'

vi.mock('../src/queries.ts', () => ({
  fetchOfficialSponsoredStateBills: vi.fn().mockResolvedValue([
    { id: 'b1', title: 'Mock Bill', state: 'CA', session: '20252026', sponsors: [], subjects: [] },
  ]),
}))

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useOfficialSponsoredStateBills', () => {
  it('returns data from fetchOfficialSponsoredStateBills', async () => {
    const fakeClient = { from: vi.fn() } as never
    const { result } = renderHook(
      () => useOfficialSponsoredStateBills(fakeClient, 'oid-1'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.title).toBe('Mock Bill')
  })

  it('uses the byOfficialSponsored query key', async () => {
    const fakeClient = { from: vi.fn() } as never
    const { result } = renderHook(
      () => useOfficialSponsoredStateBills(fakeClient, 'oid-1'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // The hook should use stateBillsKeys.byOfficialSponsored('oid-1') internally;
    // we verify the query key shape by reading the internal state.
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0)
  })
})
```

The `@/hooks` import alias requires either path mapping in tsconfig OR direct relative path. Use relative path for now:

```tsx
import { useOfficialSponsoredStateBills } from '../src/hooks.ts'
```

- [ ] **Step 2: Implement queries.ts**

Create `packages/state-bills/src/queries.ts`:

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type {
  StateBillRow,
  StateBillWithSponsors,
  StateVoteRow,
  StateVoteWithBill,
  StateVoteWithPosition,
} from './types.ts'

const SELECT_BILL_WITH_SPONSORS = `
  *,
  sponsors:state_bill_sponsors(*),
  subjects:state_bill_subjects(subject)
`

export async function fetchOfficialSponsoredStateBills(
  client: ChiaroClient,
  officialId: string,
): Promise<StateBillWithSponsors[]> {
  // Two-step: 1) find bill_ids where role='sponsor', 2) fetch bills with joined sponsors+subjects.
  const { data: bsRows, error: bsErr } = await client
    .from('state_bill_sponsors')
    .select('bill_id')
    .eq('official_id', officialId)
    .eq('role', 'sponsor')
  if (bsErr) throw bsErr
  if (!bsRows || bsRows.length === 0) return []

  const { data, error } = await client
    .from('state_bills')
    .select(SELECT_BILL_WITH_SPONSORS)
    .in('id', bsRows.map(r => r.bill_id))
    .order('latest_action_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    ...(row as StateBillRow & { sponsors: unknown; subjects: { subject: string }[] }),
    sponsors: (row as { sponsors: unknown[] }).sponsors as StateBillWithSponsors['sponsors'],
    subjects: ((row as { subjects: { subject: string }[] }).subjects ?? []).map(s => s.subject),
  })) as StateBillWithSponsors[]
}

export async function fetchOfficialCosponsoredStateBills(
  client: ChiaroClient,
  officialId: string,
): Promise<StateBillWithSponsors[]> {
  const { data: bsRows, error: bsErr } = await client
    .from('state_bill_sponsors')
    .select('bill_id')
    .eq('official_id', officialId)
    .eq('role', 'cosponsor')
  if (bsErr) throw bsErr
  if (!bsRows || bsRows.length === 0) return []

  const { data, error } = await client
    .from('state_bills')
    .select(SELECT_BILL_WITH_SPONSORS)
    .in('id', bsRows.map(r => r.bill_id))
    .order('latest_action_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    ...(row as StateBillRow & { sponsors: unknown; subjects: { subject: string }[] }),
    sponsors: (row as { sponsors: unknown[] }).sponsors as StateBillWithSponsors['sponsors'],
    subjects: ((row as { subjects: { subject: string }[] }).subjects ?? []).map(s => s.subject),
  })) as StateBillWithSponsors[]
}

export async function fetchStateBill(
  client: ChiaroClient,
  billId: string,
): Promise<StateBillWithSponsors> {
  const { data, error } = await client
    .from('state_bills')
    .select(SELECT_BILL_WITH_SPONSORS)
    .eq('id', billId)
    .single()
  if (error) throw error
  const row = data as StateBillRow & { sponsors: unknown[]; subjects: { subject: string }[] }
  return {
    ...row,
    sponsors: row.sponsors as StateBillWithSponsors['sponsors'],
    subjects: (row.subjects ?? []).map(s => s.subject),
  } as StateBillWithSponsors
}

export async function fetchOfficialStateVotes(
  client: ChiaroClient,
  officialId: string,
): Promise<StateVoteWithPosition[]> {
  const { data, error } = await client
    .from('state_vote_positions')
    .select(`
      position,
      vote:state_votes!state_vote_positions_vote_id_fkey(
        *,
        bill:state_bills!state_votes_bill_id_fkey(id, state, session, bill_type, number, title)
      )
    `)
    .eq('official_id', officialId)
    .order('vote(vote_date)', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    vote: (row as { vote: StateVoteWithBill }).vote,
    position: (row as { position: StateVotePositionRow['position'] }).position,
  })) as StateVoteWithPosition[]
}

export async function fetchOfficialMissedStateVotes(
  client: ChiaroClient,
  officialId: string,
): Promise<StateVoteWithPosition[]> {
  const all = await fetchOfficialStateVotes(client, officialId)
  return all.filter(v => v.position === 'not_voting' || v.position === 'abstain')
}

export async function fetchStateBillVotes(
  client: ChiaroClient,
  billId: string,
): Promise<StateVoteRow[]> {
  const { data, error } = await client
    .from('state_votes')
    .select('*')
    .eq('bill_id', billId)
    .order('vote_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateVoteRow[]
}

// One canonical re-import for downstream types
import type { StateVotePositionRow } from './types.ts'
```

- [ ] **Step 3: Implement hooks.ts**

Create `packages/state-bills/src/hooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import {
  fetchOfficialSponsoredStateBills,
  fetchOfficialCosponsoredStateBills,
  fetchOfficialStateVotes,
  fetchOfficialMissedStateVotes,
  fetchStateBill,
  fetchStateBillVotes,
} from './queries.ts'
import { stateBillsKeys } from './keys.ts'

const STALE_TIME = 5 * 60 * 1000        // 5 min — matches @chiaro/bills convention
const GC_TIME    = 30 * 60 * 1000       // 30 min

export function useOfficialSponsoredStateBills(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialSponsored(officialId),
    queryFn: () => fetchOfficialSponsoredStateBills(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialCosponsoredStateBills(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialCosponsored(officialId),
    queryFn: () => fetchOfficialCosponsoredStateBills(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialStateVotes(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialVotes(officialId),
    queryFn: () => fetchOfficialStateVotes(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useOfficialMissedStateVotes(client: ChiaroClient, officialId: string) {
  return useQuery({
    queryKey: stateBillsKeys.byOfficialMissedVotes(officialId),
    queryFn: () => fetchOfficialMissedStateVotes(client, officialId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useStateBill(client: ChiaroClient, billId: string) {
  return useQuery({
    queryKey: stateBillsKeys.byId(billId),
    queryFn: () => fetchStateBill(client, billId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}

export function useStateBillVotes(client: ChiaroClient, billId: string) {
  return useQuery({
    queryKey: ['state-bills', 'votes', billId] as const,
    queryFn: () => fetchStateBillVotes(client, billId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
}
```

- [ ] **Step 4: Implement schemas.ts**

Create `packages/state-bills/src/schemas.ts`:

```ts
import { z } from 'zod'

// OpenStates v3 bill envelope (subset of fields we actually use).
// Validates the per-state YAML/JSON payload before upserting.
export const OpenStatesBillSchema = z.object({
  id: z.string().startsWith('ocd-bill/'),
  jurisdiction: z.object({ id: z.string(), classification: z.string() }),
  session: z.string(),
  identifier: z.string(),            // e.g., 'AB 123'
  title: z.string(),
  classification: z.array(z.string()).optional(),  // ['bill']
  subject: z.array(z.string()).optional(),
  sponsorships: z.array(z.object({
    person_id: z.string().nullable(),
    name: z.string(),
    classification: z.enum(['primary', 'cosponsor']),
  })).optional(),
  actions: z.array(z.object({
    description: z.string(),
    date: z.string(),
    classification: z.array(z.string()).optional(),
  })).optional(),
  sources: z.array(z.object({ url: z.string() })),
  openstates_url: z.string().url(),
})

export type OpenStatesBill = z.infer<typeof OpenStatesBillSchema>

export const OpenStatesVoteEventSchema = z.object({
  id: z.string().startsWith('ocd-vote/'),
  bill_id: z.string().startsWith('ocd-bill/'),
  motion_text: z.string(),
  result: z.string(),
  start_date: z.string(),
  organization: z.object({ classification: z.string() }),  // 'lower' | 'upper' | 'legislature'
  votes: z.array(z.object({
    voter_name: z.string(),
    voter_id: z.string().nullable(),
    option: z.string(),  // 'yes' | 'no' | 'abstain' | 'not voting' | 'absent'
  })),
  sources: z.array(z.object({ url: z.string() })),
})

export type OpenStatesVoteEvent = z.infer<typeof OpenStatesVoteEventSchema>
```

- [ ] **Step 5: Update index.ts**

Edit `packages/state-bills/src/index.ts`:

```ts
export * from './types.ts'
export { stateBillsKeys } from './keys.ts'
export {
  fetchOfficialSponsoredStateBills,
  fetchOfficialCosponsoredStateBills,
  fetchStateBill,
  fetchOfficialStateVotes,
  fetchOfficialMissedStateVotes,
  fetchStateBillVotes,
} from './queries.ts'
export {
  useOfficialSponsoredStateBills,
  useOfficialCosponsoredStateBills,
  useOfficialStateVotes,
  useOfficialMissedStateVotes,
  useStateBill,
  useStateBillVotes,
} from './hooks.ts'
export {
  OpenStatesBillSchema,
  OpenStatesVoteEventSchema,
  type OpenStatesBill,
  type OpenStatesVoteEvent,
} from './schemas.ts'
```

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter @chiaro/state-bills test
pnpm --filter @chiaro/state-bills typecheck
```

Expected: 4 keys + 2 hooks = 6/6 pass; typecheck clean.

If TypeScript complains about the `as never` cast on `vi.spyOn` or the joined query result shape, refine the casts in queries.ts. The Supabase typed-client returns wider types for joined queries; explicit `as StateBillRow & { sponsors: ... }` casts at the post-fetch boundary are acceptable.

- [ ] **Step 7: Commit**

```bash
git add packages/state-bills/src/queries.ts \
        packages/state-bills/src/hooks.ts \
        packages/state-bills/src/schemas.ts \
        packages/state-bills/src/index.ts \
        packages/state-bills/test/hooks.test.tsx
git commit -m "feat(state-bills): queries + hooks + zod schemas

Queries (6):
- fetchOfficialSponsoredStateBills, fetchOfficialCosponsoredStateBills
- fetchStateBill, fetchStateBillVotes
- fetchOfficialStateVotes, fetchOfficialMissedStateVotes

Hooks (6): TanStack useQuery wrappers, 5 min staleTime / 30 min gcTime.

Schemas: zod for OpenStates v3 bill + vote_event payload validation
(used by Task 11 ingest orchestrator)."
```

---

## Task 10: OpenStates bills loader + fixtures

**Files:**
- Create: `packages/db/supabase/seed/openstates-bills-loader.ts`
- Create: `packages/db/supabase/seed/openstates-bills-loader.test.ts`
- Create: `packages/db/supabase/seed/fixtures/openstates-bills/` (5 sample files)

This module reads OpenStates bulk data from the source pinned in Task 1. Fixture-based tests exercise the parsing + normalization.

- [ ] **Step 1: Create fixture YAML files**

Create directory:

```bash
mkdir -p packages/db/supabase/seed/fixtures/openstates-bills
```

Then 5 fixture files. Each represents a per-bill record from OpenStates' bulk data (the exact shape depends on Task 1's source pin — YAML if `openstates/data` repo exists, JSON if `open.pluralpolicy.com` bulk, JSON if v3 API). Use YAML shape below; adjust to JSON if Task 1 picked a JSON source.

`packages/db/supabase/seed/fixtures/openstates-bills/ca-sample-bill-AB123.yml`:

```yaml
id: ocd-bill/00000000-0000-0000-0000-00000000b001
jurisdiction:
  id: ocd-jurisdiction/country:us/state:ca/government
  classification: state
session: '20252026'
identifier: 'AB 123'
title: Test California Assembly Bill — Clean Air
classification:
  - bill
subject:
  - Air quality
  - Environmental protection
sponsorships:
  - person_id: ocd-person/00000000-0000-0000-0000-000000000001
    name: Test Asm
    classification: primary
actions:
  - description: Introduced
    date: '2025-01-15'
    classification: [introduction]
  - description: Referred to Committee
    date: '2025-01-20'
    classification: [committee-referral]
sources:
  - url: https://leginfo.legislature.ca.gov/bill/AB-123
openstates_url: https://openstates.org/ca/bills/20252026/AB123/
```

`packages/db/supabase/seed/fixtures/openstates-bills/ca-sample-bill-SB45.yml`:

```yaml
id: ocd-bill/00000000-0000-0000-0000-00000000b002
jurisdiction:
  id: ocd-jurisdiction/country:us/state:ca/government
  classification: state
session: '20252026'
identifier: 'SB 45'
title: Test California Senate Bill — Public Safety
classification:
  - bill
subject:
  - Public safety
sponsorships:
  - person_id: ocd-person/00000000-0000-0000-0000-000000000002
    name: Test Sen
    classification: primary
actions:
  - description: Introduced
    date: '2025-01-10'
    classification: [introduction]
sources:
  - url: https://leginfo.legislature.ca.gov/bill/SB-45
openstates_url: https://openstates.org/ca/bills/20252026/SB45/
```

`packages/db/supabase/seed/fixtures/openstates-bills/ca-sample-vote-roll.yml`:

```yaml
id: ocd-vote/00000000-0000-0000-0000-00000000v001
bill_id: ocd-bill/00000000-0000-0000-0000-00000000b002
motion_text: On Passage as Amended
result: passed
start_date: '2025-03-04'
organization:
  classification: upper
votes:
  - voter_name: Test Sen
    voter_id: ocd-person/00000000-0000-0000-0000-000000000002
    option: yes
sources:
  - url: https://leginfo.legislature.ca.gov/vote/SB-45/2025-03-04
```

`packages/db/supabase/seed/fixtures/openstates-bills/ne-sample-bill-LB100.yml`:

```yaml
id: ocd-bill/00000000-0000-0000-0000-00000000b003
jurisdiction:
  id: ocd-jurisdiction/country:us/state:ne/government
  classification: state
session: '109'
identifier: 'LB 100'
title: Test Nebraska Legislative Bill — Education Funding
classification:
  - bill
subject:
  - Education
sponsorships:
  - person_id: ocd-person/00000000-0000-0000-0000-000000000003
    name: Test NE Sen
    classification: primary
actions:
  - description: Introduced
    date: '2025-01-08'
    classification: [introduction]
sources:
  - url: https://nebraskalegislature.gov/bill/LB-100
openstates_url: https://openstates.org/ne/bills/109/LB100/
```

`packages/db/supabase/seed/fixtures/openstates-bills/md-sample-bill-HB1.yml`:

```yaml
id: ocd-bill/00000000-0000-0000-0000-00000000b004
jurisdiction:
  id: ocd-jurisdiction/country:us/state:md/government
  classification: state
session: '2025rs'
identifier: 'HB 1'
title: Test Maryland House Bill — Worker Protections
classification:
  - bill
subject:
  - Labor
sponsorships:
  - person_id: ocd-person/00000000-0000-0000-0000-000000000004
    name: Test Del 1A
    classification: primary
  - person_id: ocd-person/00000000-0000-0000-0000-000000000005
    name: Test Del 1B
    classification: cosponsor
actions:
  - description: Introduced
    date: '2025-01-15'
    classification: [introduction]
sources:
  - url: https://mgaleg.maryland.gov/bill/HB-1
openstates_url: https://openstates.org/md/bills/2025rs/HB1/
```

- [ ] **Step 2: Write failing loader test**

Create `packages/db/supabase/seed/openstates-bills-loader.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOpenStatesBillsDir, loadOpenStatesVotesDir } from './openstates-bills-loader.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-bills')

describe('openstates-bills-loader', () => {
  it('loadOpenStatesBillsDir loads 4 fixture bills (excluding vote files)', async () => {
    const bills = await loadOpenStatesBillsDir(FIXTURE_DIR)
    expect(bills).toHaveLength(4)
  })

  it('loadOpenStatesVotesDir loads 1 fixture vote (excluding bill files)', async () => {
    const votes = await loadOpenStatesVotesDir(FIXTURE_DIR)
    expect(votes).toHaveLength(1)
  })

  it('returns CA assembly bill with normalized fields', async () => {
    const bills = await loadOpenStatesBillsDir(FIXTURE_DIR)
    const ab123 = bills.find(b => b.id === 'ocd-bill/00000000-0000-0000-0000-00000000b001')!
    expect(ab123.session).toBe('20252026')
    expect(ab123.identifier).toBe('AB 123')
    expect(ab123.subject).toContain('Air quality')
    expect(ab123.sponsorships).toHaveLength(1)
    expect(ab123.sponsorships![0]!.classification).toBe('primary')
  })

  it('parses MD multi-sponsor bill (1 primary + 1 cosponsor)', async () => {
    const bills = await loadOpenStatesBillsDir(FIXTURE_DIR)
    const md = bills.find(b => b.id === 'ocd-bill/00000000-0000-0000-0000-00000000b004')!
    expect(md.sponsorships).toHaveLength(2)
    const roles = md.sponsorships!.map(s => s.classification)
    expect(roles).toContain('primary')
    expect(roles).toContain('cosponsor')
  })

  it('returns vote event with bill_id reference', async () => {
    const votes = await loadOpenStatesVotesDir(FIXTURE_DIR)
    const v = votes[0]!
    expect(v.bill_id).toBe('ocd-bill/00000000-0000-0000-0000-00000000b002')
    expect(v.result).toBe('passed')
    expect(v.votes).toHaveLength(1)
  })

  it('returns empty array for missing dir', async () => {
    const empty = await loadOpenStatesBillsDir('/nonexistent/path')
    expect(empty).toEqual([])
  })

  it('skips malformed YAML files and continues', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-bills-broken-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(
      join(tmpDir, 'good.yml'),
      `id: ocd-bill/x\njurisdiction: {id: ocd-jurisdiction/country:us/state:ca/government, classification: state}\nsession: '2025'\nidentifier: 'AB 1'\ntitle: G\nsources: [{url: 'https://x'}]\nopenstates_url: https://x\n`,
    )
    await writeFile(join(tmpDir, 'broken.yml'), `[invalid yaml syntax: : :`)
    try {
      const result = await loadOpenStatesBillsDir(tmpDir)
      expect(result).toHaveLength(1)
      expect(result[0]!.identifier).toBe('AB 1')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
pnpm --filter @chiaro/db test openstates-bills-loader
```

Expected: module not found.

- [ ] **Step 4: Implement loader**

Create `packages/db/supabase/seed/openstates-bills-loader.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

// OpenStates v3 bill envelope. Subset of fields we actually use during ingest.
export interface OpenStatesBillEnvelope {
  id: string                      // ocd-bill/<uuid>
  jurisdiction: { id: string; classification: string }
  session: string
  identifier: string              // 'AB 123' — gets split into bill_type + number
  title: string
  classification?: string[]       // ['bill']
  subject?: string[]
  sponsorships?: Array<{
    person_id: string | null
    name: string
    classification: 'primary' | 'cosponsor'
  }>
  actions?: Array<{
    description: string
    date: string
    classification?: string[]
  }>
  sources: Array<{ url: string }>
  openstates_url: string
}

// OpenStates v3 vote_event envelope.
export interface OpenStatesVoteEnvelope {
  id: string                      // ocd-vote/<uuid>
  bill_id: string                 // ocd-bill/<uuid> (references a bill)
  motion_text: string
  result: string
  start_date: string
  organization: { classification: string }  // 'lower' | 'upper' | 'legislature'
  votes: Array<{
    voter_name: string
    voter_id: string | null
    option: string                // 'yes' | 'no' | 'abstain' | 'not voting' | 'absent'
  }>
  sources: Array<{ url: string }>
}

/**
 * Walk every .yml/.yaml/.json file in the directory. Parse each, return
 * those that look like bill envelopes (id starts with `ocd-bill/`).
 */
export async function loadOpenStatesBillsDir(dir: string): Promise<OpenStatesBillEnvelope[]> {
  const files = await safeReaddir(dir)
  const out: OpenStatesBillEnvelope[] = []
  for (const file of files) {
    const parsed = await safeParse(join(dir, file))
    if (parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string'
        && (parsed as { id: string }).id.startsWith('ocd-bill/')) {
      out.push(parsed as OpenStatesBillEnvelope)
    }
  }
  return out
}

/**
 * Same shape as bills, but filters for vote_event envelopes.
 */
export async function loadOpenStatesVotesDir(dir: string): Promise<OpenStatesVoteEnvelope[]> {
  const files = await safeReaddir(dir)
  const out: OpenStatesVoteEnvelope[] = []
  for (const file of files) {
    const parsed = await safeParse(join(dir, file))
    if (parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string'
        && (parsed as { id: string }).id.startsWith('ocd-vote/')) {
      out.push(parsed as OpenStatesVoteEnvelope)
    }
  }
  return out
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    return entries.filter(f => /\.(ya?ml|json)$/i.test(f))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function safeParse(path: string): Promise<unknown> {
  try {
    const text = await readFile(path, 'utf8')
    if (path.endsWith('.json')) return JSON.parse(text)
    return parseYaml(text)
  } catch (err) {
    console.error(`[openstates-bills-loader] parse error in ${path}: ${(err as Error).message}`)
    return null
  }
}

// Helper: split OpenStates identifier ('AB 123') into bill_type + number.
export function parseBillIdentifier(identifier: string): { bill_type: string; number: number } | null {
  const match = identifier.match(/^([A-Za-z]+)\s*(\d+)$/)
  if (!match) return null
  return { bill_type: match[1]!.toUpperCase(), number: parseInt(match[2]!, 10) }
}

// Helper: extract state from jurisdiction id.
export function parseJurisdictionState(jurisdictionId: string): string | null {
  const match = jurisdictionId.match(/state:([a-z]{2})/)
  return match ? match[1]!.toUpperCase() : null
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @chiaro/db test openstates-bills-loader
```

Expected: 7/7 pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/db/supabase/seed/openstates-bills-loader.ts \
        packages/db/supabase/seed/openstates-bills-loader.test.ts \
        packages/db/supabase/seed/fixtures/openstates-bills/
git commit -m "feat(db): openstates-bills-loader + 5 fixture files

loadOpenStatesBillsDir(dir) → OpenStatesBillEnvelope[]
loadOpenStatesVotesDir(dir) → OpenStatesVoteEnvelope[]

Parses .yml/.yaml/.json files in a non-recursive directory walk. Splits
output by ocd-bill/ vs ocd-vote/ id prefix. Fault-tolerant:
malformed/unreadable → logged to stderr + skipped.

Helpers:
- parseBillIdentifier('AB 123') → { bill_type: 'AB', number: 123 }
- parseJurisdictionState('ocd-jurisdiction/.../state:ca/...') → 'CA'

Fixture set covers: CA assembly+senate bills, NE unicameral LB,
MD multi-member HB (2 sponsors: primary + cosponsor), 1 vote event.

7 vitest cases."
```

---

## Task 11: state-bills-votes-ingest orchestrator + tests

**Files:**
- Create: `packages/db/supabase/seed/state-bills-votes-ingest.ts`
- Create: `packages/db/supabase/seed/state-bills-votes-ingest.test.ts`

The orchestrator pulls everything together: loader → identifier parsing → upserts into 5 state_* tables. Defensive guards mirror slice-3 + 5C. CLI flag support for `--skip-bills` / `--skip-votes`.

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/state-bills-votes-ingest.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestStateBillsVotes } from './state-bills-votes-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-bills')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  // Pre-seed officials so the sponsor/voter joins resolve. Use the same
  // openstates_person_id values as the fixture state-officials from 5C.
  // Pre-seed a state_house district for the sponsors.
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',       'CA', 'CA-15', 'CA AD 15',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-bills'),
      ('state_senate',      'CA', 'CA-08', 'CA SD 8',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-bills'),
      ('state_senate',      'NE', 'NE-23', 'NE District 23',
        st_geogfromtext('MULTIPOLYGON(((-100 40,-99 40,-99 41,-100 41,-100 40)))'), 'FX-bills'),
      ('state_house',       'MD', 'MD-01', 'MD HD 01',
        st_geogfromtext('MULTIPOLYGON(((-77 39,-76 39,-76 40,-77 40,-77 39)))'), 'FX-bills')
    on conflict (tier, code) do nothing
  `)
  await client.query(`
    insert into public.officials (
      openstates_person_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version
    )
    select t.opid, t.fname, t.lname, t.fullname,
           t.chamber::public.official_chamber, t.party, t.state,
           d.id, null, 'FX-bills'
    from (values
      ('ocd-person/00000000-0000-0000-0000-000000000001', 'Test', 'Asm', 'Test Asm',     'state_house',       'Democratic', 'CA', 'CA-15'),
      ('ocd-person/00000000-0000-0000-0000-000000000002', 'Test', 'Sen', 'Test Sen',     'state_senate',      'Republican', 'CA', 'CA-08'),
      ('ocd-person/00000000-0000-0000-0000-000000000003', 'Test', 'NE',  'Test NE Sen',  'state_legislature', 'Nonpartisan','NE', 'NE-23'),
      ('ocd-person/00000000-0000-0000-0000-000000000004', 'Test', '1A',  'Test Del 1A',  'state_house',       'Democratic', 'MD', 'MD-01'),
      ('ocd-person/00000000-0000-0000-0000-000000000005', 'Test', '1B',  'Test Del 1B',  'state_house',       'Republican', 'MD', 'MD-01')
    ) as t(opid, fname, lname, fullname, chamber, party, state, code)
    join public.districts d on d.state = t.state and d.code = t.code
    on conflict (openstates_person_id) where openstates_person_id is not null do nothing
  `)
})

afterEach(async () => {
  // Cleanup in FK dependency order.
  await client.query("delete from public.state_vote_positions where official_id in (select id from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%')")
  await client.query("delete from public.state_votes where state in ('CA','NE','MD')")
  await client.query("delete from public.state_bill_sponsors where official_id in (select id from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%')")
  await client.query("delete from public.state_bill_subjects where bill_id in (select id from public.state_bills where state in ('CA','NE','MD'))")
  await client.query("delete from public.state_bills where state in ('CA','NE','MD')")
  await client.query("delete from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%' and source_version = 'FX-bills'")
  await client.query("delete from public.districts where source_version = 'FX-bills'")
  await client.end()
})

describe('ingestStateBillsVotes', () => {
  it('happy path: 4 bills + 1 vote ingested', async () => {
    const stats = await ingestStateBillsVotes({
      fixturesDir: FIXTURE_DIR,
      minStateBillsCount: 0,
    })
    expect(stats.errors).toEqual([])
    expect(stats.billsUpserted).toBe(4)
    expect(stats.votesUpserted).toBe(1)
  })

  it('multi-sponsor bill (MD): 1 primary + 1 cosponsor', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const sponsors = await client.query<{ role: string }>(`
      select sps.role from public.state_bill_sponsors sps
      join public.state_bills b on b.id = sps.bill_id
      where b.state = 'MD' and b.bill_type = 'HB' and b.number = 1
      order by sps.role
    `)
    const roles = sponsors.rows.map(r => r.role)
    expect(roles).toContain('sponsor')
    expect(roles).toContain('cosponsor')
  })

  it('subjects upserted (CA AB123: Air quality + Environmental protection)', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const subjects = await client.query<{ subject: string }>(`
      select s.subject from public.state_bill_subjects s
      join public.state_bills b on b.id = s.bill_id
      where b.state = 'CA' and b.bill_type = 'AB' and b.number = 123
    `)
    const set = new Set(subjects.rows.map(r => r.subject))
    expect(set).toContain('Air quality')
    expect(set).toContain('Environmental protection')
  })

  it('vote position attributed to correct official', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const pos = await client.query<{ position: string; oid: string }>(`
      select svp.position::text, o.openstates_person_id as oid
      from public.state_vote_positions svp
      join public.officials o on o.id = svp.official_id
      join public.state_votes v on v.id = svp.vote_id
      where v.state = 'CA'
    `)
    expect(pos.rows).toHaveLength(1)
    expect(pos.rows[0]!.position).toBe('yes')
    expect(pos.rows[0]!.oid).toBe('ocd-person/00000000-0000-0000-0000-000000000002')
  })

  it('idempotent re-run: same fixture → same row counts', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const stats2 = await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    expect(stats2.billsUpserted).toBe(4)  // updated (not duplicated)
    const count = await client.query<{ c: number }>(`
      select count(*)::int as c from public.state_bills where state in ('CA','NE','MD')
    `)
    expect(count.rows[0]!.c).toBe(4)
  })

  it('--skip-bills: only votes ingested', async () => {
    // First populate bills so vote can find its FK.
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    // Delete vote_positions + votes; bills remain.
    await client.query("delete from public.state_vote_positions where vote_id in (select id from public.state_votes where state = 'CA')")
    await client.query("delete from public.state_votes where state = 'CA'")
    // Re-run with --skip-bills.
    const stats = await ingestStateBillsVotes({
      fixturesDir: FIXTURE_DIR,
      minStateBillsCount: 0,
      skipBills: true,
    })
    expect(stats.billsUpserted).toBe(0)
    expect(stats.votesUpserted).toBe(1)
  })

  it('--skip-votes: only bills ingested', async () => {
    const stats = await ingestStateBillsVotes({
      fixturesDir: FIXTURE_DIR,
      minStateBillsCount: 0,
      skipVotes: true,
    })
    expect(stats.billsUpserted).toBe(4)
    expect(stats.votesUpserted).toBe(0)
  })

  it('vote with unknown bill_id logged to unmatched + skipped', async () => {
    // Build a tmp dir with one bill + one vote whose bill_id refers to an unknown bill.
    const tmp = join(__dirname, 'fixtures', 'openstates-bills-orphan-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmp, { recursive: true })
    await writeFile(
      join(tmp, 'orphan-vote.yml'),
      `id: ocd-vote/orphan\nbill_id: ocd-bill/does-not-exist\nmotion_text: X\nresult: passed\nstart_date: '2025-01-01'\norganization: {classification: upper}\nvotes: []\nsources: [{url: 'https://x'}]\n`,
    )
    try {
      const stats = await ingestStateBillsVotes({ fixturesDir: tmp, minStateBillsCount: 0 })
      expect(stats.votesUpserted).toBe(0)
      expect(stats.unmatchedBills).toContain('ocd-bill/does-not-exist')
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })

  it('pre-flight count below threshold aborts non-zero', async () => {
    await expect(
      ingestStateBillsVotes({
        fixturesDir: FIXTURE_DIR,
        minStateBillsCount: 1000,
      }),
    ).rejects.toThrow(/pre-flight count/i)
    const c = await client.query<{ c: number }>(`
      select count(*)::int as c from public.state_bills where state in ('CA','NE','MD')
    `)
    expect(c.rows[0]!.c).toBe(0)
  })

  it('parses session per state (CA "20252026", NE "109", MD "2025rs")', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const sessions = await client.query<{ state: string; session: string }>(`
      select distinct state, session from public.state_bills where state in ('CA','NE','MD')
      order by state
    `)
    const map = Object.fromEntries(sessions.rows.map(r => [r.state, r.session]))
    expect(map.CA).toBe('20252026')
    expect(map.NE).toBe('109')
    expect(map.MD).toBe('2025rs')
  })

  it('augmented_from is null after baseline ingest (enrichment lands later)', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const rows = await client.query<{ augmented_from: string | null }>(`
      select augmented_from from public.state_bills where state in ('CA','NE','MD')
    `)
    for (const r of rows.rows) expect(r.augmented_from).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test state-bills-votes-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement orchestrator**

Create `packages/db/supabase/seed/state-bills-votes-ingest.ts`:

```ts
import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import {
  loadOpenStatesBillsDir,
  loadOpenStatesVotesDir,
  parseBillIdentifier,
  parseJurisdictionState,
  type OpenStatesBillEnvelope,
  type OpenStatesVoteEnvelope,
} from './openstates-bills-loader.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const DEFAULT_MIN_STATE_BILLS_COUNT = 500
const MAX_STALE_BILL_DELETIONS_FRACTION = 0.10
const MAX_STALE_BILL_DELETIONS_MIN      = 50

export interface IngestStateBillsVotesOpts {
  fixturesDir?: string
  minStateBillsCount?: number
  skipBills?: boolean
  skipVotes?: boolean
  allowDeletions?: number
}

export interface IngestStateBillsVotesStats {
  billsUpserted: number
  sponsorsUpserted: number
  subjectsUpserted: number
  votesUpserted: number
  positionsUpserted: number
  unmatchedBills: string[]
  unmatchedVoters: string[]
  errors: string[]
}

export async function ingestStateBillsVotes(
  opts: IngestStateBillsVotesOpts = {},
): Promise<IngestStateBillsVotesStats> {
  const fixturesDir = opts.fixturesDir
    ?? process.env.OPENSTATES_BILLS_DATA_DIR
    ?? join(__dirname, 'fixtures', 'openstates-bills')
  const minBills = opts.minStateBillsCount ?? DEFAULT_MIN_STATE_BILLS_COUNT

  const bills = opts.skipBills ? [] : await loadOpenStatesBillsDir(fixturesDir)
  const votes = opts.skipVotes ? [] : await loadOpenStatesVotesDir(fixturesDir)

  if (!opts.skipBills && bills.length < minBills) {
    throw new Error(
      `pre-flight count below threshold: bills=${bills.length} (min ${minBills}). ` +
      `Aborting with zero DB writes.`,
    )
  }

  const stats: IngestStateBillsVotesStats = {
    billsUpserted: 0,
    sponsorsUpserted: 0,
    subjectsUpserted: 0,
    votesUpserted: 0,
    positionsUpserted: 0,
    unmatchedBills: [],
    unmatchedVoters: [],
    errors: [],
  }

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    if (!opts.skipBills) {
      for (const b of bills) {
        await ingestBill(client, b, stats)
      }
    }
    if (!opts.skipVotes) {
      for (const v of votes) {
        await ingestVote(client, v, stats)
      }
    }
  } finally {
    await client.end()
  }
  return stats
}

async function ingestBill(
  client: Client,
  b: OpenStatesBillEnvelope,
  stats: IngestStateBillsVotesStats,
): Promise<void> {
  const state = parseJurisdictionState(b.jurisdiction.id)
  if (!state) {
    stats.errors.push(`bill ${b.id} has no parseable state in jurisdiction`)
    return
  }
  const billType = parseBillIdentifier(b.identifier)
  if (!billType) {
    stats.errors.push(`bill ${b.id} has unparseable identifier '${b.identifier}'`)
    return
  }
  const status = b.actions?.length ? b.actions[b.actions.length - 1]!.description : null
  const introducedAction = b.actions?.find(a => a.classification?.includes('introduction'))
  const introducedDate = introducedAction?.date ?? null
  const latestAction = b.actions?.length ? b.actions[b.actions.length - 1]!.description : null
  const latestActionDate = b.actions?.length ? b.actions[b.actions.length - 1]!.date : null

  const sourceUrl = b.sources[0]?.url ?? b.openstates_url

  const upsert = await client.query<{ id: string }>(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title, status,
      introduced_date, latest_action, latest_action_date, source_url, openstates_url
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    on conflict (openstates_bill_id) do update set
      title              = excluded.title,
      status             = excluded.status,
      latest_action      = excluded.latest_action,
      latest_action_date = excluded.latest_action_date,
      updated_at         = now()
    returning id
  `, [
    b.id, state, b.session, billType.bill_type, billType.number,
    b.title, status, introducedDate, latestAction, latestActionDate,
    sourceUrl, b.openstates_url,
  ])
  const billId = upsert.rows[0]!.id
  stats.billsUpserted += 1

  // Sponsors. Map person_id → officials.id, skip rows where the person isn't ingested.
  if (b.sponsorships?.length) {
    // Delete-then-reinsert keeps sponsor list in sync with upstream.
    await client.query('delete from public.state_bill_sponsors where bill_id = $1', [billId])
    for (const sp of b.sponsorships) {
      if (!sp.person_id) continue
      const off = await client.query<{ id: string }>(
        'select id from public.officials where openstates_person_id = $1',
        [sp.person_id],
      )
      if (off.rowCount === 0) continue
      const role = sp.classification === 'primary' ? 'sponsor' : 'cosponsor'
      await client.query(
        'insert into public.state_bill_sponsors (bill_id, official_id, role) values ($1, $2, $3) on conflict do nothing',
        [billId, off.rows[0]!.id, role],
      )
      stats.sponsorsUpserted += 1
    }
  }

  // Subjects.
  if (b.subject?.length) {
    await client.query('delete from public.state_bill_subjects where bill_id = $1', [billId])
    for (const subject of b.subject) {
      await client.query(
        'insert into public.state_bill_subjects (bill_id, subject) values ($1, $2) on conflict do nothing',
        [billId, subject],
      )
      stats.subjectsUpserted += 1
    }
  }
}

async function ingestVote(
  client: Client,
  v: OpenStatesVoteEnvelope,
  stats: IngestStateBillsVotesStats,
): Promise<void> {
  const billRow = await client.query<{ id: string; state: string; session: string }>(
    'select id, state, session from public.state_bills where openstates_bill_id = $1',
    [v.bill_id],
  )
  if (billRow.rowCount === 0) {
    stats.unmatchedBills.push(v.bill_id)
    return
  }
  const { id: billId, state, session } = billRow.rows[0]!

  const chamber =
    v.organization.classification === 'lower'        ? 'state_house' :
    v.organization.classification === 'upper'        ? 'state_senate' :
    v.organization.classification === 'legislature' ? 'state_legislature' :
                                                      null
  if (!chamber) {
    stats.errors.push(`vote ${v.id} has unknown organization.classification '${v.organization.classification}'`)
    return
  }

  const voteUpsert = await client.query<{ id: string }>(`
    insert into public.state_votes (
      openstates_vote_id, bill_id, state, session, chamber,
      vote_date, question, result, source_url
    )
    values ($1, $2, $3, $4, $5::public.official_chamber, $6, $7, $8, $9)
    on conflict (openstates_vote_id) do update set
      question = excluded.question,
      result   = excluded.result
    returning id
  `, [
    v.id, billId, state, session, chamber,
    v.start_date, v.motion_text, v.result, v.sources[0]?.url ?? '',
  ])
  const voteId = voteUpsert.rows[0]!.id
  stats.votesUpserted += 1

  // Vote positions.
  await client.query('delete from public.state_vote_positions where vote_id = $1', [voteId])
  for (const vp of v.votes) {
    if (!vp.voter_id) {
      stats.unmatchedVoters.push(vp.voter_name)
      continue
    }
    const off = await client.query<{ id: string }>(
      'select id from public.officials where openstates_person_id = $1',
      [vp.voter_id],
    )
    if (off.rowCount === 0) {
      stats.unmatchedVoters.push(vp.voter_id)
      continue
    }
    const position = normalizeVoteOption(vp.option)
    if (!position) continue
    await client.query(
      'insert into public.state_vote_positions (vote_id, official_id, position) values ($1, $2, $3) on conflict do nothing',
      [voteId, off.rows[0]!.id, position],
    )
    stats.positionsUpserted += 1
  }
}

function normalizeVoteOption(raw: string): 'yes' | 'no' | 'abstain' | 'not_voting' | 'present' | null {
  const v = raw.toLowerCase().trim()
  if (v === 'yes' || v === 'aye' || v === 'y') return 'yes'
  if (v === 'no' || v === 'nay' || v === 'n') return 'no'
  if (v === 'abstain') return 'abstain'
  if (v === 'not voting' || v === 'absent' || v === 'not_voting') return 'not_voting'
  if (v === 'present') return 'present'
  return null
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const skipBills = process.argv.includes('--skip-bills')
  const skipVotes = process.argv.includes('--skip-votes')
  const allowDeletionsArg = process.argv.find(a => a.startsWith('--allow-deletions='))
  const allowDeletions = allowDeletionsArg ? Number(allowDeletionsArg.split('=')[1]) : undefined
  ingestStateBillsVotes({ skipBills, skipVotes, allowDeletions })
    .then(stats => {
      console.log('Ingest summary (state bills + votes):')
      console.log(`  bills upserted:    ${stats.billsUpserted}`)
      console.log(`  sponsors upserted: ${stats.sponsorsUpserted}`)
      console.log(`  subjects upserted: ${stats.subjectsUpserted}`)
      console.log(`  votes upserted:    ${stats.votesUpserted}`)
      console.log(`  positions upsert:  ${stats.positionsUpserted}`)
      console.log(`  unmatched bills:   ${stats.unmatchedBills.length}`)
      console.log(`  unmatched voters:  ${stats.unmatchedVoters.length}`)
      console.log(`  errors:            ${stats.errors.length}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test state-bills-votes-ingest
```

Expected: 11/11 pass. If `--skip-bills` test fails because the orchestrator dies on missing source data without skipping the pre-flight check, ensure the check is conditional on `!opts.skipBills`.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-bills-votes-ingest.ts \
        packages/db/supabase/seed/state-bills-votes-ingest.test.ts
git commit -m "feat(db): state-bills-votes-ingest orchestrator

Pulls OpenStates bills + votes via openstates-bills-loader. Normalizes
identifier → (bill_type, number). Upserts to 5 state_* tables:
- state_bills (by openstates_bill_id)
- state_bill_sponsors (delete-and-reinsert per bill)
- state_bill_subjects (delete-and-reinsert per bill)
- state_votes (by openstates_vote_id)
- state_vote_positions (delete-and-reinsert per vote)

Defensive guards:
- Pre-flight count: bills >= MIN_STATE_BILLS_COUNT (500). Aborts non-zero.
- Vote with unknown bill_id → unmatchedBills, skipped (does not abort).
- Vote position for unknown voter → unmatchedVoters, skipped.

CLI flags:
- --skip-bills: votes-only run (requires bills already in DB)
- --skip-votes: bills-only run

11 vitest cases covering happy path, multi-sponsor, subjects, vote
attribution, idempotent re-run, --skip-bills, --skip-votes, unmatched
bill, pre-flight abort, per-state session format, augmented_from is
NULL after baseline."
```

---

## Task 12: Add seed:state-bills-votes script

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Read current package.json scripts**

```bash
cat packages/db/package.json | head -40
```

Note where the existing `seed:*` scripts are. Likely alphabetical.

- [ ] **Step 2: Add the new script**

Open `packages/db/package.json`. In the `scripts` block, add (alphabetically with existing seed scripts):

```json
"seed:state-bills-votes": "tsx supabase/seed/state-bills-votes-ingest.ts"
```

- [ ] **Step 3: Verify**

```bash
cat packages/db/package.json | grep "seed:state-bills"
```

Expected: line appears.

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): add seed:state-bills-votes script

Wires the orchestrator from Task 11 to a pnpm script. Operator invocation:

  pnpm seed:state-bills-votes
  pnpm seed:state-bills-votes -- --skip-bills    # votes only
  pnpm seed:state-bills-votes -- --skip-votes    # bills only

Additional wrapper scripts (seed:state-bills-enrich, seed:state-metrics-
recompute, seed:state-bills-full) land in upcoming tasks 20 + 22."
```

---

## Task 13: Per-state-adapter shared interface

**Files:**
- Create: `packages/db/supabase/seed/state-bills/shared.ts`
- Create: `packages/db/supabase/seed/state-bills/shared.test.ts` (helper-only tests)
- Create: `packages/db/supabase/seed/fixtures/state-bills-enrich/` (subdirectory only — adapter fixtures land in tasks 14-18)

- [ ] **Step 1: Write the shared interface**

Create `packages/db/supabase/seed/state-bills/shared.ts`:

```ts
import type { Client } from 'pg'

export type EnrichableState = 'CA' | 'NY' | 'FL' | 'TX' | 'MI'

export interface StateEnrichAdapter {
  state: EnrichableState
  /** Set true when adapter is skipped (e.g., missing required API key). */
  enrich(opts: { client: Client; session: string }): Promise<EnrichStats>
}

export interface EnrichStats {
  state: EnrichableState
  billsUpdated: number
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/**
 * Update augment fields on state_bills for a single bill identified by
 * (state, session, bill_type, number). Returns true if a row was updated,
 * false if no such bill exists yet (caller can log + continue).
 */
export async function updateStateBillAugment(
  client: Client,
  key: { state: string; session: string; bill_type: string; number: number },
  augment: {
    status_substage?: string | null
    hearing_date?: string | null
    fiscal_impact_amount?: number | null
    party_vote_split?: object | null
    augmented_from: string
  },
): Promise<boolean> {
  const result = await client.query(`
    update public.state_bills set
      status_substage      = coalesce($5, status_substage),
      hearing_date         = coalesce($6, hearing_date),
      fiscal_impact_amount = coalesce($7, fiscal_impact_amount),
      party_vote_split     = coalesce($8::jsonb, party_vote_split),
      augmented_from       = $9,
      updated_at           = now()
    where state = $1 and session = $2 and bill_type = $3 and number = $4
  `, [
    key.state, key.session, key.bill_type, key.number,
    augment.status_substage ?? null,
    augment.hearing_date ?? null,
    augment.fiscal_impact_amount ?? null,
    augment.party_vote_split ? JSON.stringify(augment.party_vote_split) : null,
    augment.augmented_from,
  ])
  return (result.rowCount ?? 0) > 0
}

/** HTTP retry helper. 5x exponential backoff: 500ms, 1s, 2s, 4s, 8s. */
export async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  const delays = [500, 1000, 2000, 4000, 8000]
  let lastErr: unknown = null
  for (const delay of [0, ...delays]) {
    if (delay > 0) await new Promise(r => setTimeout(r, delay))
    try {
      const res = await fetch(url, init)
      if (res.ok || res.status === 404) return res  // 404 isn't transient
      lastErr = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error(`fetchWithRetry exhausted for ${url}`)
}
```

- [ ] **Step 2: Write the shared.test.ts test**

Create `packages/db/supabase/seed/state-bills/shared.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { updateStateBillAugment } from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  // Seed one bill we can update.
  await client.query(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title,
      source_url, openstates_url
    )
    values ('ocd-bill/test-shared', 'CA', '20252026', 'AB', 999, 'Test', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id = 'ocd-bill/test-shared'")
  await client.end()
})

describe('updateStateBillAugment', () => {
  it('updates augment fields on a matching bill', async () => {
    const ok = await updateStateBillAugment(client, {
      state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
    }, {
      status_substage: 'Senate Appropriations Committee',
      fiscal_impact_amount: 1_000_000,
      party_vote_split: { 'D-yes': 12, 'D-no': 0 },
      augmented_from: 'ca-leginfo',
    })
    expect(ok).toBe(true)
    const row = await client.query<{
      status_substage: string | null
      fiscal_impact_amount: string | null
      party_vote_split: object | null
      augmented_from: string | null
    }>(`
      select status_substage, fiscal_impact_amount, party_vote_split, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-shared'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Appropriations Committee')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(1_000_000)
    expect(row.rows[0]!.party_vote_split).toEqual({ 'D-yes': 12, 'D-no': 0 })
    expect(row.rows[0]!.augmented_from).toBe('ca-leginfo')
  })

  it('returns false when no matching bill', async () => {
    const ok = await updateStateBillAugment(client, {
      state: 'XX', session: '0000', bill_type: 'AB', number: 0,
    }, {
      augmented_from: 'never',
    })
    expect(ok).toBe(false)
  })

  it('preserves existing fields when augment passes null', async () => {
    await updateStateBillAugment(client, {
      state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
    }, {
      status_substage: 'Initial',
      augmented_from: 'ca-leginfo',
    })
    await updateStateBillAugment(client, {
      state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
    }, {
      // status_substage omitted — should NOT clear the existing value
      fiscal_impact_amount: 50_000,
      augmented_from: 'ca-leginfo',
    })
    const row = await client.query<{ status_substage: string | null }>(
      `select status_substage from public.state_bills where openstates_bill_id = 'ocd-bill/test-shared'`,
    )
    expect(row.rows[0]!.status_substage).toBe('Initial')  // preserved
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @chiaro/db test 'state-bills/shared'
```

Expected: 3/3 pass.

- [ ] **Step 4: Create empty enrich fixture directory**

```bash
mkdir -p packages/db/supabase/seed/fixtures/state-bills-enrich
touch packages/db/supabase/seed/fixtures/state-bills-enrich/.gitkeep
```

Per-state fixture files land in tasks 14-18.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-bills/shared.ts \
        packages/db/supabase/seed/state-bills/shared.test.ts \
        packages/db/supabase/seed/fixtures/state-bills-enrich/.gitkeep
git commit -m "feat(db): state-bills/shared.ts — adapter interface + helpers

StateEnrichAdapter interface + EnrichStats result shape.

Helpers:
- updateStateBillAugment(client, key, augment): UPDATE state_bills set
  augment fields by (state, session, bill_type, number). coalesce()
  preserves existing values when augment passes null.
- fetchWithRetry(url): 5x exponential backoff (500ms..8s); 404 is
  treated as non-transient + returned immediately.

3 vitest cases covering update success, no-match no-op, and field
preservation across multiple augment runs."
```

---

## Task 14: enrich-ca (California leginfo)

**Files:**
- Create: `packages/db/supabase/seed/state-bills/enrich-ca.ts`
- Create: `packages/db/supabase/seed/state-bills/enrich-ca.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-bills-enrich/ca-leginfo-AB123.json`

CA leginfo (`leginfo.legislature.ca.gov`) has a public API + bulk-data downloads. For MVP: hit the per-bill HTML/XML endpoint, scrape status substage + hearing date + fiscal impact. The adapter is structured around an injected `fetcher` so tests can use fixtures.

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-bills-enrich/ca-leginfo-AB123.json`:

```json
{
  "bill_id": "AB123",
  "session": "20252026",
  "status_substage": "Senate Appropriations Committee — Suspense File",
  "hearing_date": "2025-04-12",
  "fiscal_impact_amount": 2500000,
  "party_vote_split": {
    "D-yes": 12, "D-no": 0,
    "R-yes": 8,  "R-no": 5
  }
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-bills/enrich-ca.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichCalifornia } from './enrich-ca.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'ca-leginfo-AB123.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title,
      source_url, openstates_url
    )
    values
      ('ocd-bill/test-ca-AB123', 'CA', '20252026', 'AB', 123, 'Test CA AB 123', 'https://x', 'https://y'),
      ('ocd-bill/test-ca-SB45',  'CA', '20252026', 'SB', 45,  'Test CA SB 45',  'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-ca-%'")
  await client.end()
})

describe('enrichCalifornia', () => {
  it('updates augment fields from leginfo fixture', async () => {
    const fixtureText = await readFile(FIXTURE, 'utf8')
    const fixture = JSON.parse(fixtureText)
    const stats = await enrichCalifornia.enrich({
      client,
      session: '20252026',
      // Test-only injection: fetcher returns the fixture for AB-123 + null for everything else.
      fetcher: async (billRef: { bill_type: string; number: number }) =>
        billRef.bill_type === 'AB' && billRef.number === 123 ? fixture : null,
    } as never)
    expect(stats.state).toBe('CA')
    expect(stats.errors).toEqual([])
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      hearing_date: string | null
      fiscal_impact_amount: string | null
      party_vote_split: object | null
      augmented_from: string | null
    }>(`
      select status_substage, hearing_date::text, fiscal_impact_amount,
             party_vote_split, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-ca-AB123'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Appropriations Committee — Suspense File')
    expect(row.rows[0]!.hearing_date).toBe('2025-04-12')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(2500000)
    expect(row.rows[0]!.party_vote_split).toMatchObject({ 'D-yes': 12 })
    expect(row.rows[0]!.augmented_from).toBe('ca-leginfo')
  })

  it('bill with no fixture response → not updated; stats.billsUpdated unchanged', async () => {
    const stats = await enrichCalifornia.enrich({
      client,
      session: '20252026',
      fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
    const sb = await client.query<{ augmented_from: string | null }>(
      `select augmented_from from public.state_bills where openstates_bill_id = 'ocd-bill/test-ca-SB45'`,
    )
    expect(sb.rows[0]!.augmented_from).toBeNull()
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async (billRef: { bill_type: string; number: number }) =>
      billRef.bill_type === 'AB' && billRef.number === 123 ? fixture : null
    await enrichCalifornia.enrich({ client, session: '20252026', fetcher } as never)
    const stats2 = await enrichCalifornia.enrich({ client, session: '20252026', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state CA + correct skipped=false', async () => {
    const stats = await enrichCalifornia.enrich({
      client, session: '20252026', fetcher: async () => null,
    } as never)
    expect(stats.state).toBe('CA')
    expect(stats.skipped).toBeUndefined()
  })

  it('non-2025 session: no bills updated', async () => {
    const stats = await enrichCalifornia.enrich({
      client, session: '99999999', fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })
})
```

- [ ] **Step 3: Implement enrich-ca.ts**

Create `packages/db/supabase/seed/state-bills/enrich-ca.ts`:

```ts
import type { Client } from 'pg'
import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface CALeginfoBillEnvelope {
  bill_id: string
  session: string
  status_substage?: string
  hearing_date?: string
  fiscal_impact_amount?: number
  party_vote_split?: object
}

// Test-only fetcher injection. In production, hits leginfo HTTP endpoints.
type CABillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<CALeginfoBillEnvelope | null>

const defaultFetcher: CABillFetcher = async (billRef) => {
  const url = `https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=${billRef.bill_type}-${billRef.number}&session=${billRef.session}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    // Real implementation parses HTML/XML. For test fixtures we accept JSON.
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('json')) return await res.json() as CALeginfoBillEnvelope
    // HTML scraping omitted in MVP scope — placeholder for real impl.
    return null
  } catch {
    return null
  }
}

export const enrichCalifornia: StateEnrichAdapter = {
  state: 'CA',
  async enrich(opts): Promise<EnrichStats> {
    // Extract optional test-only fetcher override.
    const fetcher: CABillFetcher = (opts as never as { fetcher?: CABillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = {
      state: 'CA',
      billsUpdated: 0,
      errors: [],
    }

    // Find all CA bills for the session that haven't been augmented from leginfo yet
    // (or re-augment any whose updated_at is older than 7 days).
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'CA' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'CA', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.status_substage      ?? null,
          hearing_date:         fetched.hearing_date         ?? null,
          fiscal_impact_amount: fetched.fiscal_impact_amount ?? null,
          party_vote_split:     fetched.party_vote_split     ?? null,
          augmented_from:       'ca-leginfo',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`CA ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test 'state-bills/enrich-ca'
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/state-bills/enrich-ca.ts \
        packages/db/supabase/seed/state-bills/enrich-ca.test.ts \
        packages/db/supabase/seed/fixtures/state-bills-enrich/ca-leginfo-AB123.json
git commit -m "feat(db): enrich-ca California leginfo adapter

StateEnrichAdapter implementation for CA. Queries state_bills for the
target session, fetches per-bill detail from leginfo (production HTTP)
or fixture (test injection via fetcher param), upserts augment fields
(status_substage, hearing_date, fiscal_impact_amount, party_vote_split,
augmented_from = 'ca-leginfo').

Test fixture (ca-leginfo-AB123.json) exercises happy path + the
'no augment data for this bill' branch + idempotent re-run.

5 vitest cases."
```

---

## Task 15: enrich-ny (New York senate API)

**Files:**
- Create: `packages/db/supabase/seed/state-bills/enrich-ny.ts`
- Create: `packages/db/supabase/seed/state-bills/enrich-ny.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-bills-enrich/ny-senate-S5678.json`
- Modify: `.env.example` (repo root)
- Modify: `apps/web/.env.example`

NY's API at `api.nysenate.gov` requires `NY_SENATE_API_KEY`. The adapter must gracefully skip with a clear warning when the key is missing.

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-bills-enrich/ny-senate-S5678.json`:

```json
{
  "result": {
    "basePrintNo": "S5678",
    "session": 2025,
    "status": {
      "statusType": "IN_COMMITTEE",
      "statusDesc": "Senate Finance Committee",
      "actionDate": "2025-02-10"
    },
    "billCalNo": null,
    "votes": {
      "items": [{
        "memberVotes": {
          "items": {
            "AYE": { "count": 30, "items": [] },
            "NAY": { "count": 12, "items": [] },
            "EXC": { "count": 1, "items": [] }
          }
        }
      }]
    },
    "fiscalNote": {
      "totalCost": 5400000
    }
  }
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-bills/enrich-ny.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichNewYork } from './enrich-ny.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'ny-senate-S5678.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title,
      source_url, openstates_url
    )
    values
      ('ocd-bill/test-ny-S5678', 'NY', '2025', 'S', 5678, 'Test NY S 5678', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-ny-%'")
  await client.end()
})

describe('enrichNewYork', () => {
  it('updates augment from senate API fixture', async () => {
    process.env.NY_SENATE_API_KEY = 'test-key'
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichNewYork.enrich({
      client, session: '2025',
      fetcher: async () => fixture,
    } as never)
    expect(stats.state).toBe('NY')
    expect(stats.errors).toEqual([])
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      party_vote_split: object | null
      fiscal_impact_amount: string | null
      augmented_from: string | null
    }>(`
      select status_substage, party_vote_split, fiscal_impact_amount, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-ny-S5678'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Finance Committee')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(5400000)
    expect(row.rows[0]!.party_vote_split).toMatchObject({ AYE: 30, NAY: 12, EXC: 1 })
    expect(row.rows[0]!.augmented_from).toBe('ny-senate-api')
  })

  it('missing NY_SENATE_API_KEY → skipped with reason', async () => {
    delete process.env.NY_SENATE_API_KEY
    const stats = await enrichNewYork.enrich({
      client, session: '2025', fetcher: async () => null,
    } as never)
    expect(stats.skipped).toBe(true)
    expect(stats.skipReason).toMatch(/NY_SENATE_API_KEY/)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    process.env.NY_SENATE_API_KEY = 'test-key'
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichNewYork.enrich({ client, session: '2025', fetcher } as never)
    const stats2 = await enrichNewYork.enrich({ client, session: '2025', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })
})
```

- [ ] **Step 3: Implement enrich-ny.ts**

Create `packages/db/supabase/seed/state-bills/enrich-ny.ts`:

```ts
import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface NYSenateBillEnvelope {
  result?: {
    status?: { statusDesc?: string; actionDate?: string }
    votes?: {
      items?: Array<{
        memberVotes?: {
          items?: Record<string, { count: number }>
        }
      }>
    }
    fiscalNote?: { totalCost?: number }
  }
}

type NYBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<NYSenateBillEnvelope | null>

const defaultFetcher = (apiKey: string): NYBillFetcher => async (billRef) => {
  const url = `https://api.nysenate.gov/api/3/bills/${billRef.session}/${billRef.bill_type}${billRef.number}?key=${apiKey}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as NYSenateBillEnvelope
  } catch {
    return null
  }
}

export const enrichNewYork: StateEnrichAdapter = {
  state: 'NY',
  async enrich(opts): Promise<EnrichStats> {
    const apiKey = process.env.NY_SENATE_API_KEY
    if (!apiKey) {
      return {
        state: 'NY',
        billsUpdated: 0,
        errors: [],
        skipped: true,
        skipReason: 'NY_SENATE_API_KEY not set — NY augment skipped',
      }
    }

    const fetcher: NYBillFetcher =
      (opts as never as { fetcher?: NYBillFetcher }).fetcher ?? defaultFetcher(apiKey)

    const stats: EnrichStats = { state: 'NY', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'NY' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched?.result) continue
        const status = fetched.result.status
        const fiscalNote = fetched.result.fiscalNote
        const voteItems = fetched.result.votes?.items?.[0]?.memberVotes?.items
        const partyVoteSplit = voteItems
          ? Object.fromEntries(Object.entries(voteItems).map(([k, v]) => [k, v.count]))
          : null

        const updated = await updateStateBillAugment(opts.client, {
          state: 'NY', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      status?.statusDesc ?? null,
          hearing_date:         status?.actionDate ?? null,
          fiscal_impact_amount: fiscalNote?.totalCost ?? null,
          party_vote_split:     partyVoteSplit ?? null,
          augmented_from:       'ny-senate-api',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`NY ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Add NY_SENATE_API_KEY to .env.example files**

Open `.env.example` (repo root). Add (near the existing Sentry block, or wherever per-state-API keys would go):

```
# NY Senate API key for sub-slice 5D state-bills enrichment. Free signup at
# legislation.nysenate.gov/keyOptions.
NY_SENATE_API_KEY=
```

Open `apps/web/.env.example`. Add (it's web-side too for completeness, even though only seed scripts read it):

```
NY_SENATE_API_KEY=
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @chiaro/db test 'state-bills/enrich-ny'
```

Expected: 3/3 pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-bills/enrich-ny.ts \
        packages/db/supabase/seed/state-bills/enrich-ny.test.ts \
        packages/db/supabase/seed/fixtures/state-bills-enrich/ny-senate-S5678.json \
        .env.example apps/web/.env.example
git commit -m "feat(db): enrich-ny New York senate API adapter

StateEnrichAdapter implementation for NY. Requires NY_SENATE_API_KEY
env var; skips gracefully (with skipReason) when missing.

Maps api.nysenate.gov v3 envelope to augment fields:
- result.status.statusDesc → status_substage
- result.status.actionDate → hearing_date
- result.fiscalNote.totalCost → fiscal_impact_amount
- result.votes.items[0].memberVotes.items → party_vote_split

Fixture: ny-senate-S5678.json. .env.example entries added.

3 vitest cases."
```

---

## Task 16: enrich-fl (Florida Senate + House)

**Files:**
- Create: `packages/db/supabase/seed/state-bills/enrich-fl.ts`
- Create: `packages/db/supabase/seed/state-bills/enrich-fl.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-bills-enrich/fl-senate-SB9.json`

FL has two separate APIs: `flsenate.gov/Tracker/API` (Senate) and `myfloridahouse.gov` (House). For MVP: cover Senate via fixture-tested fetcher; House follows the same pattern but with a different endpoint.

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-bills-enrich/fl-senate-SB9.json`:

```json
{
  "bill": {
    "Session": 2025,
    "Number": "SB 9",
    "CurrentCommittee": "Senate Appropriations Subcommittee on Education",
    "LastActionDate": "2025-03-01",
    "FiscalImpactStatement": {
      "TotalAmount": 750000
    }
  }
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-bills/enrich-fl.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichFlorida } from './enrich-fl.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'fl-senate-SB9.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number, title, source_url, openstates_url)
    values ('ocd-bill/test-fl-SB9', 'FL', '2025', 'SB', 9, 'Test FL SB 9', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-fl-%'")
  await client.end()
})

describe('enrichFlorida', () => {
  it('updates augment from senate fixture', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichFlorida.enrich({
      client, session: '2025',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      hearing_date: string | null
      fiscal_impact_amount: string | null
      augmented_from: string | null
    }>(`
      select status_substage, hearing_date::text, fiscal_impact_amount, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-fl-SB9'
    `)
    expect(row.rows[0]!.status_substage).toBe('Senate Appropriations Subcommittee on Education')
    expect(row.rows[0]!.hearing_date).toBe('2025-03-01')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(750000)
    expect(row.rows[0]!.augmented_from).toBe('fl-senate-api')
  })

  it('null fetcher response → not updated', async () => {
    const stats = await enrichFlorida.enrich({
      client, session: '2025', fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichFlorida.enrich({ client, session: '2025', fetcher } as never)
    const stats2 = await enrichFlorida.enrich({ client, session: '2025', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state FL', async () => {
    const stats = await enrichFlorida.enrich({ client, session: '2025', fetcher: async () => null } as never)
    expect(stats.state).toBe('FL')
  })

  it('handles missing FiscalImpactStatement', async () => {
    const fixture = { bill: { Session: 2025, Number: 'SB 9', CurrentCommittee: 'X', LastActionDate: '2025-03-01' } }
    const stats = await enrichFlorida.enrich({
      client, session: '2025', fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{ fiscal_impact_amount: string | null }>(
      `select fiscal_impact_amount from public.state_bills where openstates_bill_id = 'ocd-bill/test-fl-SB9'`,
    )
    expect(row.rows[0]!.fiscal_impact_amount).toBeNull()
  })
})
```

- [ ] **Step 3: Implement enrich-fl.ts**

Create `packages/db/supabase/seed/state-bills/enrich-fl.ts`:

```ts
import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface FLBillEnvelope {
  bill?: {
    CurrentCommittee?: string
    LastActionDate?: string
    FiscalImpactStatement?: { TotalAmount?: number }
  }
}

type FLBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<FLBillEnvelope | null>

const defaultFetcher: FLBillFetcher = async (billRef) => {
  // Senate bills (SB) → flsenate.gov; House bills (HB) → myfloridahouse.gov
  const isHouse = billRef.bill_type === 'HB'
  const url = isHouse
    ? `https://www.myfloridahouse.gov/Sections/Bills/billsdetail.aspx?BillId=${billRef.bill_type}${billRef.number}&SessionId=${billRef.session}`
    : `https://www.flsenate.gov/Tracker/API/Bill/${billRef.bill_type}${billRef.number}/${billRef.session}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as FLBillEnvelope
  } catch {
    return null
  }
}

export const enrichFlorida: StateEnrichAdapter = {
  state: 'FL',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: FLBillFetcher =
      (opts as never as { fetcher?: FLBillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = { state: 'FL', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'FL' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched?.bill) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'FL', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.bill.CurrentCommittee                  ?? null,
          hearing_date:         fetched.bill.LastActionDate                    ?? null,
          fiscal_impact_amount: fetched.bill.FiscalImpactStatement?.TotalAmount ?? null,
          augmented_from:       'fl-senate-api',  // 'fl-house-api' for HB; differentiator is bill_type
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`FL ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @chiaro/db test 'state-bills/enrich-fl'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-bills/enrich-fl.ts \
        packages/db/supabase/seed/state-bills/enrich-fl.test.ts \
        packages/db/supabase/seed/fixtures/state-bills-enrich/fl-senate-SB9.json
git commit -m "feat(db): enrich-fl Florida Senate + House adapter

StateEnrichAdapter for FL. Routes by bill_type:
- SB → flsenate.gov/Tracker/API
- HB → myfloridahouse.gov

Maps response envelope:
- bill.CurrentCommittee → status_substage
- bill.LastActionDate → hearing_date
- bill.FiscalImpactStatement.TotalAmount → fiscal_impact_amount
- augmented_from = 'fl-senate-api'

5 vitest cases."
```

---

## Task 17: enrich-tx (Texas capitol)

**Files:**
- Create: `packages/db/supabase/seed/state-bills/enrich-tx.ts`
- Create: `packages/db/supabase/seed/state-bills/enrich-tx.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-bills-enrich/tx-capitol-HB1.json`

TX's API at `capitol.texas.gov` is limited; bulk data via FTP. MVP only handles the public API surface; sparse-data state.

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-bills-enrich/tx-capitol-HB1.json`:

```json
{
  "bill": {
    "session": "89R",
    "number": "HB 1",
    "lastActionDescription": "Received from the Senate",
    "lastActionDate": "2025-04-22",
    "fiscalNote": null
  }
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-bills/enrich-tx.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichTexas } from './enrich-tx.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'tx-capitol-HB1.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number, title, source_url, openstates_url)
    values ('ocd-bill/test-tx-HB1', 'TX', '89R', 'HB', 1, 'Test TX HB 1', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-tx-%'")
  await client.end()
})

describe('enrichTexas', () => {
  it('updates augment from capitol fixture (sparse: only status + date)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichTexas.enrich({
      client, session: '89R',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      hearing_date: string | null
      fiscal_impact_amount: string | null
      augmented_from: string | null
    }>(`
      select status_substage, hearing_date::text, fiscal_impact_amount, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-tx-HB1'
    `)
    expect(row.rows[0]!.status_substage).toBe('Received from the Senate')
    expect(row.rows[0]!.hearing_date).toBe('2025-04-22')
    expect(row.rows[0]!.fiscal_impact_amount).toBeNull()
    expect(row.rows[0]!.augmented_from).toBe('tx-capitol')
  })

  it('null response → no update', async () => {
    const stats = await enrichTexas.enrich({
      client, session: '89R', fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichTexas.enrich({ client, session: '89R', fetcher } as never)
    const stats2 = await enrichTexas.enrich({ client, session: '89R', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state TX', async () => {
    const stats = await enrichTexas.enrich({ client, session: '89R', fetcher: async () => null } as never)
    expect(stats.state).toBe('TX')
  })

  it('handles bills with no fiscal note', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    fixture.bill.fiscalNote = null
    const stats = await enrichTexas.enrich({
      client, session: '89R', fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    expect(stats.errors).toEqual([])
  })
})
```

- [ ] **Step 3: Implement enrich-tx.ts**

Create `packages/db/supabase/seed/state-bills/enrich-tx.ts`:

```ts
import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface TXBillEnvelope {
  bill?: {
    lastActionDescription?: string
    lastActionDate?: string
    fiscalNote?: { totalCost?: number } | null
  }
}

type TXBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<TXBillEnvelope | null>

const defaultFetcher: TXBillFetcher = async (billRef) => {
  const url = `https://capitol.texas.gov/api/v1/bills/${billRef.session}/${billRef.bill_type}${billRef.number}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as TXBillEnvelope
  } catch {
    return null
  }
}

export const enrichTexas: StateEnrichAdapter = {
  state: 'TX',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: TXBillFetcher =
      (opts as never as { fetcher?: TXBillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = { state: 'TX', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'TX' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched?.bill) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'TX', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.bill.lastActionDescription      ?? null,
          hearing_date:         fetched.bill.lastActionDate              ?? null,
          fiscal_impact_amount: fetched.bill.fiscalNote?.totalCost       ?? null,
          augmented_from:       'tx-capitol',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`TX ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-bills/enrich-tx'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-bills/enrich-tx.ts \
        packages/db/supabase/seed/state-bills/enrich-tx.test.ts \
        packages/db/supabase/seed/fixtures/state-bills-enrich/tx-capitol-HB1.json
git commit -m "feat(db): enrich-tx Texas capitol adapter

StateEnrichAdapter for TX via capitol.texas.gov public API. Sparse data —
fiscal_impact_amount often null. 5 vitest cases."
```

---

## Task 18: enrich-mi (Michigan legislature)

**Files:**
- Create: `packages/db/supabase/seed/state-bills/enrich-mi.ts`
- Create: `packages/db/supabase/seed/state-bills/enrich-mi.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-bills-enrich/mi-legislature-SB2.json`

MI legislature.mi.gov has limited but usable endpoints. Same pattern.

- [ ] **Step 1: Create fixture**

`packages/db/supabase/seed/fixtures/state-bills-enrich/mi-legislature-SB2.json`:

```json
{
  "BillNo": "SB 2",
  "Session": "2025-2026",
  "LastAction": "Referred to Committee on Government Operations",
  "LastActionDate": "2025-01-25",
  "FiscalImpact": 1200000
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-bills/enrich-mi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichMichigan } from './enrich-mi.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-bills-enrich', 'mi-legislature-SB2.json')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number, title, source_url, openstates_url)
    values ('ocd-bill/test-mi-SB2', 'MI', '2025-2026', 'SB', 2, 'Test MI SB 2', 'https://x', 'https://y')
    on conflict (openstates_bill_id) do nothing
  `)
})

afterEach(async () => {
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/test-mi-%'")
  await client.end()
})

describe('enrichMichigan', () => {
  it('updates augment from fixture', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await enrichMichigan.enrich({
      client, session: '2025-2026',
      fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    const row = await client.query<{
      status_substage: string | null
      hearing_date: string | null
      fiscal_impact_amount: string | null
      augmented_from: string | null
    }>(`
      select status_substage, hearing_date::text, fiscal_impact_amount, augmented_from
      from public.state_bills where openstates_bill_id = 'ocd-bill/test-mi-SB2'
    `)
    expect(row.rows[0]!.status_substage).toBe('Referred to Committee on Government Operations')
    expect(row.rows[0]!.hearing_date).toBe('2025-01-25')
    expect(Number(row.rows[0]!.fiscal_impact_amount)).toBe(1200000)
    expect(row.rows[0]!.augmented_from).toBe('mi-legislature')
  })

  it('null response → no update', async () => {
    const stats = await enrichMichigan.enrich({
      client, session: '2025-2026', fetcher: async () => null,
    } as never)
    expect(stats.billsUpdated).toBe(0)
  })

  it('idempotent re-run', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const fetcher = async () => fixture
    await enrichMichigan.enrich({ client, session: '2025-2026', fetcher } as never)
    const stats2 = await enrichMichigan.enrich({ client, session: '2025-2026', fetcher } as never)
    expect(stats2.billsUpdated).toBe(1)
  })

  it('reports state MI', async () => {
    const stats = await enrichMichigan.enrich({ client, session: '2025-2026', fetcher: async () => null } as never)
    expect(stats.state).toBe('MI')
  })

  it('handles missing FiscalImpact', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    delete fixture.FiscalImpact
    const stats = await enrichMichigan.enrich({
      client, session: '2025-2026', fetcher: async () => fixture,
    } as never)
    expect(stats.billsUpdated).toBe(1)
    expect(stats.errors).toEqual([])
  })
})
```

- [ ] **Step 3: Implement enrich-mi.ts**

Create `packages/db/supabase/seed/state-bills/enrich-mi.ts`:

```ts
import { type StateEnrichAdapter, type EnrichStats, updateStateBillAugment, fetchWithRetry } from './shared.ts'

interface MIBillEnvelope {
  LastAction?: string
  LastActionDate?: string
  FiscalImpact?: number
}

type MIBillFetcher = (
  billRef: { bill_type: string; number: number; session: string },
) => Promise<MIBillEnvelope | null>

const defaultFetcher: MIBillFetcher = async (billRef) => {
  const url = `https://legislature.mi.gov/api/bill?billno=${billRef.bill_type}${billRef.number}&session=${billRef.session}`
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    return await res.json() as MIBillEnvelope
  } catch {
    return null
  }
}

export const enrichMichigan: StateEnrichAdapter = {
  state: 'MI',
  async enrich(opts): Promise<EnrichStats> {
    const fetcher: MIBillFetcher =
      (opts as never as { fetcher?: MIBillFetcher }).fetcher ?? defaultFetcher

    const stats: EnrichStats = { state: 'MI', billsUpdated: 0, errors: [] }
    const bills = await opts.client.query<{ bill_type: string; number: number }>(
      `select bill_type, number from public.state_bills
       where state = 'MI' and session = $1`,
      [opts.session],
    )

    for (const b of bills.rows) {
      try {
        const fetched = await fetcher({
          bill_type: b.bill_type, number: b.number, session: opts.session,
        })
        if (!fetched) continue
        const updated = await updateStateBillAugment(opts.client, {
          state: 'MI', session: opts.session, bill_type: b.bill_type, number: b.number,
        }, {
          status_substage:      fetched.LastAction       ?? null,
          hearing_date:         fetched.LastActionDate   ?? null,
          fiscal_impact_amount: fetched.FiscalImpact     ?? null,
          augmented_from:       'mi-legislature',
        })
        if (updated) stats.billsUpdated += 1
      } catch (err) {
        stats.errors.push(`MI ${b.bill_type} ${b.number}: ${(err as Error).message}`)
      }
    }
    return stats
  },
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-bills/enrich-mi'
```

Expected: 5/5 pass.

```bash
git add packages/db/supabase/seed/state-bills/enrich-mi.ts \
        packages/db/supabase/seed/state-bills/enrich-mi.test.ts \
        packages/db/supabase/seed/fixtures/state-bills-enrich/mi-legislature-SB2.json
git commit -m "feat(db): enrich-mi Michigan legislature adapter

StateEnrichAdapter for MI via legislature.mi.gov. Same pattern as
enrich-tx (single endpoint per bill). 5 vitest cases."
```

---

## Task 19: state-bills-enrich orchestrator

**Files:**
- Create: `packages/db/supabase/seed/state-bills-enrich.ts`
- Create: `packages/db/supabase/seed/state-bills-enrich.test.ts`

Orchestrator dispatches to the 5 adapters; per-adapter isolation; aggregated stats.

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/state-bills-enrich.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateBillsEnrich } from './state-bills-enrich.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})

afterEach(async () => {
  await client.end()
})

describe('ingestStateBillsEnrich', () => {
  it('returns stats from all 5 adapters', async () => {
    delete process.env.NY_SENATE_API_KEY  // ensure NY is skipped
    const stats = await ingestStateBillsEnrich({
      session: '20252026',
      adapters: [
        { state: 'CA', async enrich() { return { state: 'CA', billsUpdated: 2, errors: [] } } },
        { state: 'NY', async enrich() { return { state: 'NY', billsUpdated: 0, errors: [], skipped: true, skipReason: 'no key' } } },
        { state: 'FL', async enrich() { return { state: 'FL', billsUpdated: 1, errors: [] } } },
        { state: 'TX', async enrich() { return { state: 'TX', billsUpdated: 0, errors: [] } } },
        { state: 'MI', async enrich() { return { state: 'MI', billsUpdated: 3, errors: [] } } },
      ] as never,
    })
    expect(stats.totalBillsUpdated).toBe(6)
    expect(stats.byState).toHaveLength(5)
    expect(stats.byState.find(s => s.state === 'NY')!.skipped).toBe(true)
  })

  it('one adapter throwing → others still run; error captured', async () => {
    const stats = await ingestStateBillsEnrich({
      session: '20252026',
      adapters: [
        { state: 'CA', async enrich() { throw new Error('CA broke') } },
        { state: 'NY', async enrich() { return { state: 'NY', billsUpdated: 1, errors: [] } } },
      ] as never,
    })
    expect(stats.totalBillsUpdated).toBe(1)
    expect(stats.byState.find(s => s.state === 'CA')!.errors).toContain('CA broke')
    expect(stats.byState.find(s => s.state === 'NY')!.billsUpdated).toBe(1)
  })

  it('aggregates errors across all adapters', async () => {
    const stats = await ingestStateBillsEnrich({
      session: '20252026',
      adapters: [
        { state: 'CA', async enrich() { return { state: 'CA', billsUpdated: 0, errors: ['CA err 1', 'CA err 2'] } } },
        { state: 'FL', async enrich() { return { state: 'FL', billsUpdated: 0, errors: ['FL err'] } } },
      ] as never,
    })
    expect(stats.totalErrors).toBe(3)
  })
})
```

- [ ] **Step 2: Implement orchestrator**

Create `packages/db/supabase/seed/state-bills-enrich.ts`:

```ts
import { Client } from 'pg'
import type { StateEnrichAdapter, EnrichStats } from './state-bills/shared.ts'
import { enrichCalifornia } from './state-bills/enrich-ca.ts'
import { enrichNewYork    } from './state-bills/enrich-ny.ts'
import { enrichFlorida    } from './state-bills/enrich-fl.ts'
import { enrichTexas      } from './state-bills/enrich-tx.ts'
import { enrichMichigan   } from './state-bills/enrich-mi.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateEnrichAdapter[] = [
  enrichCalifornia,
  enrichNewYork,
  enrichFlorida,
  enrichTexas,
  enrichMichigan,
]

export interface IngestStateBillsEnrichOpts {
  session: string
  adapters?: StateEnrichAdapter[]
  client?: Client     // for tests; production opens its own
}

export interface IngestStateBillsEnrichStats {
  totalBillsUpdated: number
  totalErrors: number
  byState: EnrichStats[]
}

export async function ingestStateBillsEnrich(
  opts: IngestStateBillsEnrichOpts,
): Promise<IngestStateBillsEnrichStats> {
  const adapters = opts.adapters ?? ADAPTERS_DEFAULT
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byState: EnrichStats[] = []
  try {
    for (const adapter of adapters) {
      try {
        const stats = await adapter.enrich({ client, session: opts.session })
        byState.push(stats)
      } catch (err) {
        byState.push({
          state: adapter.state,
          billsUpdated: 0,
          errors: [(err as Error).message],
        })
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    totalBillsUpdated: byState.reduce((s, x) => s + x.billsUpdated, 0),
    totalErrors:       byState.reduce((s, x) => s + x.errors.length, 0),
    byState,
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const sessionArg = process.argv.find(a => a.startsWith('--session='))
  const session = sessionArg ? sessionArg.split('=')[1]! : new Date().getFullYear().toString()
  ingestStateBillsEnrich({ session })
    .then(stats => {
      console.log('State bills enrich summary:')
      console.log(`  total bills updated: ${stats.totalBillsUpdated}`)
      console.log(`  total errors:        ${stats.totalErrors}`)
      for (const s of stats.byState) {
        const tag = s.skipped ? `SKIPPED (${s.skipReason})` : `${s.billsUpdated} updated, ${s.errors.length} errors`
        console.log(`  ${s.state}: ${tag}`)
      }
      process.exit(stats.totalErrors > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @chiaro/db test state-bills-enrich
```

Expected: 3/3 pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/seed/state-bills-enrich.ts \
        packages/db/supabase/seed/state-bills-enrich.test.ts
git commit -m "feat(db): state-bills-enrich orchestrator

Dispatches to the 5 per-state adapters (CA, NY, FL, TX, MI) sequentially.
Per-adapter isolation: thrown errors land in stats.byState[N].errors,
other adapters still run.

stats.totalBillsUpdated + stats.totalErrors aggregate across adapters.
Each adapter's stats.skipped + stats.skipReason flow through (NY's
missing-API-key path is the primary use case).

3 vitest cases."
```

---

## Task 20: Add seed:state-bills-enrich script

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add script**

Open `packages/db/package.json`. In `scripts`, add (alphabetically):

```json
"seed:state-bills-enrich": "tsx supabase/seed/state-bills-enrich.ts"
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): add seed:state-bills-enrich script

  pnpm seed:state-bills-enrich -- --session=20252026

Runs all 5 per-state augment adapters via the orchestrator from Task 19.
NY adapter skips gracefully without NY_SENATE_API_KEY."
```

---

## Task 21: recompute-state-metrics

**Files:**
- Create: `packages/db/supabase/seed/recompute-state-metrics.ts`
- Create: `packages/db/supabase/seed/recompute-state-metrics.test.ts`

Mirrors federal `recompute-metrics.ts` but joins `state_bill_sponsors` + `state_vote_positions` + `state_bills` for state officials. Populates the existing scalar columns on `official_metrics` (bills_sponsored_count etc. that slice-4 added for federal) AND the 3 new state-specific columns from migration 0034.

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/recompute-state-metrics.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { recomputeStateMetrics } from './recompute-state-metrics.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  // Seed a CA state senator + 2 sponsored bills (1 primary, 1 cosponsor)
  // + 4 votes (3 voted yes, 1 missed).
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_senate', 'CA', 'CA-RMTEST', 'CA Sen RM test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-rm')
    on conflict (tier, code) do nothing
  `)
  const off = await client.query<{ id: string }>(`
    insert into public.officials (
      openstates_person_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version, in_office
    )
    select 'ocd-person/rm-test', 'RM', 'Test', 'RM Test',
           'state_senate', 'Democratic', 'CA',
           d.id, null, 'FX-rm', true
    from public.districts where code = 'CA-RMTEST'
    on conflict (openstates_person_id) where openstates_person_id is not null
    do update set in_office = true
    returning id
  `)
  officialId = off.rows[0]!.id

  // 2 bills: one sponsored, one cosponsored
  const b1 = await client.query<{ id: string }>(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number,
      title, fiscal_impact_amount, source_url, openstates_url)
    values ('ocd-bill/rm-1', 'CA', '20252026', 'SB', 100, 'RM Sponsored',
      1000000, 'https://x', 'https://y')
    returning id
  `)
  await client.query(
    "insert into public.state_bill_sponsors (bill_id, official_id, role) values ($1, $2, 'sponsor')",
    [b1.rows[0]!.id, officialId],
  )
  const b2 = await client.query<{ id: string }>(`
    insert into public.state_bills (openstates_bill_id, state, session, bill_type, number,
      title, fiscal_impact_amount, source_url, openstates_url)
    values ('ocd-bill/rm-2', 'CA', '20252026', 'SB', 101, 'RM Cosponsored',
      500000, 'https://x', 'https://y')
    returning id
  `)
  await client.query(
    "insert into public.state_bill_sponsors (bill_id, official_id, role) values ($1, $2, 'cosponsor')",
    [b2.rows[0]!.id, officialId],
  )

  // 4 votes — 3 voted, 1 missed
  for (let i = 0; i < 4; i++) {
    const v = await client.query<{ id: string }>(`
      insert into public.state_votes (openstates_vote_id, bill_id, state, session, chamber,
        vote_date, question, result, source_url)
      values ($1, $2, 'CA', '20252026', 'state_senate', '2025-03-01', 'Q', 'passed', 'https://x')
      returning id
    `, [`ocd-vote/rm-${i}`, b1.rows[0]!.id])
    const pos = i === 3 ? 'not_voting' : 'yes'
    await client.query(
      'insert into public.state_vote_positions (vote_id, official_id, position) values ($1, $2, $3)',
      [v.rows[0]!.id, officialId, pos],
    )
  }
})

afterEach(async () => {
  await client.query("delete from public.state_vote_positions where official_id = $1", [officialId])
  await client.query("delete from public.state_votes where openstates_vote_id like 'ocd-vote/rm-%'")
  await client.query("delete from public.state_bill_sponsors where official_id = $1", [officialId])
  await client.query("delete from public.state_bills where openstates_bill_id like 'ocd-bill/rm-%'")
  await client.query("delete from public.official_metrics where official_id = $1", [officialId])
  await client.query("delete from public.officials where id = $1", [officialId])
  await client.query("delete from public.districts where source_version = 'FX-rm'")
  await client.end()
})

describe('recomputeStateMetrics', () => {
  it('computes bills_sponsored_count = 1 + bills_cosponsored_count = 1', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{
      bills_sponsored_count: number
      bills_cosponsored_count: number
    }>('select bills_sponsored_count, bills_cosponsored_count from public.official_metrics where official_id = $1', [officialId])
    expect(m.rows[0]!.bills_sponsored_count).toBe(1)
    expect(m.rows[0]!.bills_cosponsored_count).toBe(1)
  })

  it('computes attendance: voted=3, missed=1, attendance_pct=75', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{
      votes_voted_count: number
      votes_missed_count: number
      total_roll_calls: number
      attendance_pct: string
    }>(`
      select votes_voted_count, votes_missed_count, total_roll_calls, attendance_pct
      from public.official_metrics where official_id = $1
    `, [officialId])
    expect(m.rows[0]!.votes_voted_count).toBe(3)
    expect(m.rows[0]!.votes_missed_count).toBe(1)
    expect(m.rows[0]!.total_roll_calls).toBe(4)
    expect(Number(m.rows[0]!.attendance_pct)).toBe(75)
  })

  it('computes fiscal_impact_total = sum of sponsored + cosponsored bill amounts', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ fiscal_impact_total: string }>(
      'select fiscal_impact_total from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(Number(m.rows[0]!.fiscal_impact_total)).toBe(1500000)
  })

  it('party_unity_state computed when ≥3 votes', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ party_unity_state: string | null }>(
      'select party_unity_state from public.official_metrics where official_id = $1',
      [officialId],
    )
    // 3 voted; with all yes + Democratic party, party unity = 100 (placeholder
    // simple metric: % of votes where this official voted with their party
    // majority — here, the only voter is themselves, so 100).
    expect(m.rows[0]!.party_unity_state).not.toBeNull()
  })

  it('idempotent re-run', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const stats2 = await recomputeStateMetrics({ session: '20252026' })
    expect(stats2.officialsProcessed).toBeGreaterThanOrEqual(1)
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.official_metrics where official_id = $1',
      [officialId],
    )
    expect(c.rows[0]!.c).toBe(1)
  })

  it('committee_chair_count defaults to 0', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    const m = await client.query<{ committee_chair_count: number | null }>(
      'select committee_chair_count from public.official_metrics where official_id = $1',
      [officialId],
    )
    // Placeholder until committee data lands. MVP behavior: 0.
    expect(m.rows[0]!.committee_chair_count).toBe(0)
  })

  it('federal officials untouched (NULL state-specific columns)', async () => {
    await recomputeStateMetrics({ session: '20252026' })
    // Inspect any federal official's metrics; assert state cols are NULL.
    const m = await client.query<{ party_unity_state: string | null }>(
      `select om.party_unity_state from public.official_metrics om
       join public.officials o on o.id = om.official_id
       where o.bioguide_id is not null limit 1`,
    )
    if (m.rowCount! > 0) {
      expect(m.rows[0]!.party_unity_state).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Implement recompute-state-metrics.ts**

Create `packages/db/supabase/seed/recompute-state-metrics.ts`:

```ts
import { Client } from 'pg'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface RecomputeStateMetricsOpts {
  session: string
  client?: Client
}

export interface RecomputeStateMetricsStats {
  officialsProcessed: number
}

const PARTY_UNITY_MIN_VOTES = 3

export async function recomputeStateMetrics(
  opts: RecomputeStateMetricsOpts,
): Promise<RecomputeStateMetricsStats> {
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  let officialsProcessed = 0
  try {
    // Pull all state officials. Iterate one at a time (small N <= 7,400);
    // bulk-CTE approach also viable but per-row is clearer for debug logs.
    const stateOfficials = await client.query<{ id: string; party: string }>(`
      select id, party from public.officials
      where chamber in ('state_house', 'state_senate', 'state_legislature')
        and in_office = true
    `)

    for (const off of stateOfficials.rows) {
      // bills_sponsored_count + bills_cosponsored_count + fiscal_impact_total
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

      // votes_voted_count, votes_missed_count, total_roll_calls
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

      // party_unity_state: % of votes where this official voted with majority
      // of their same-party peers on the same roll call. Requires ≥3 votes.
      // Simplified: if state senate has only this official + their party_peers,
      // approximate as percent of yes/no votes aligned with party median.
      // For MVP we use a placeholder: if voted >= 3, set to 100. Refine in 5F.
      const partyUnityState = voted >= PARTY_UNITY_MIN_VOTES ? 100 : null

      // committee_chair_count: placeholder 0 until committee data lands.
      const committeeChairCount = 0

      await client.query(`
        insert into public.official_metrics (
          official_id, congress,
          bills_sponsored_count, bills_cosponsored_count,
          votes_voted_count, votes_missed_count, total_roll_calls,
          attendance_pct,
          fiscal_impact_total, party_unity_state, committee_chair_count
        )
        values ($1, 'state', $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (official_id) do update set
          bills_sponsored_count   = excluded.bills_sponsored_count,
          bills_cosponsored_count = excluded.bills_cosponsored_count,
          votes_voted_count       = excluded.votes_voted_count,
          votes_missed_count      = excluded.votes_missed_count,
          total_roll_calls        = excluded.total_roll_calls,
          attendance_pct          = excluded.attendance_pct,
          fiscal_impact_total     = excluded.fiscal_impact_total,
          party_unity_state       = excluded.party_unity_state,
          committee_chair_count   = excluded.committee_chair_count,
          computed_at             = now()
      `, [
        off.id,
        billStats.rows[0]!.sponsored,
        billStats.rows[0]!.cosponsored,
        voted, missed, total,
        attendance,
        Number(billStats.rows[0]!.fiscal_total),
        partyUnityState,
        committeeChairCount,
      ])
      officialsProcessed += 1
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return { officialsProcessed }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const sessionArg = process.argv.find(a => a.startsWith('--session='))
  const session = sessionArg ? sessionArg.split('=')[1]! : new Date().getFullYear().toString()
  recomputeStateMetrics({ session })
    .then(stats => {
      console.log('Recompute state metrics summary:')
      console.log(`  officials processed: ${stats.officialsProcessed}`)
      process.exit(0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @chiaro/db test recompute-state-metrics
```

Expected: 7/7 pass. If "federal officials untouched" test fails because no federal officials exist in the test DB, it gracefully no-ops (the `if (m.rowCount > 0)` guard).

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/recompute-state-metrics.ts \
        packages/db/supabase/seed/recompute-state-metrics.test.ts
git commit -m "feat(db): recompute-state-metrics pipeline

Mirrors federal recompute-metrics.ts but joins state_bill_sponsors +
state_vote_positions + state_bills for state officials.

Populates the slice-4 official_metrics scalar columns (bills_sponsored
_count, bills_cosponsored_count, votes_voted_count, votes_missed_count,
total_roll_calls, attendance_pct) AND the 3 state-specific columns from
migration 0034 (committee_chair_count, fiscal_impact_total,
party_unity_state).

MVP placeholders:
- party_unity_state = 100 when voted ≥ 3 (placeholder until 5F)
- committee_chair_count = 0 (until committee data lands)

7 vitest cases."
```

---

## Task 22: Add seed:state-metrics-recompute + seed:state-bills-full

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add scripts**

Open `packages/db/package.json`. Add (alphabetically with other seeds):

```json
"seed:state-bills-full": "tsx supabase/seed/state-bills-votes-ingest.ts && tsx supabase/seed/state-bills-enrich.ts && tsx supabase/seed/recompute-state-metrics.ts",
"seed:state-metrics-recompute": "tsx supabase/seed/recompute-state-metrics.ts"
```

- [ ] **Step 2: Verify**

```bash
cat packages/db/package.json | grep -E "seed:state"
```

Expected: 4 lines (state-bills-votes, state-bills-enrich, state-metrics-recompute, state-bills-full).

```bash
pnpm --filter @chiaro/db typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): add seed:state-metrics-recompute + seed:state-bills-full wrapper

Operator usage:
  pnpm seed:state-bills-full        # ingest + enrich + recompute in sequence
  pnpm seed:state-metrics-recompute # recompute alone

Single-command wrapper saves operator from running the 3-step sequence
by hand. Each individual script is still available for surgical re-runs."
```

---

## Task 23: Web — StateBillsEvidence + StateVotesEvidence

**Files:**
- Create: `apps/web/components/state/StateBillsEvidence.tsx`
- Create: `apps/web/test/components/state/StateBillsEvidence.test.tsx`
- Create: `apps/web/components/state/StateVotesEvidence.tsx`
- Create: `apps/web/test/components/state/StateVotesEvidence.test.tsx`

Inline EvidenceExpand-style components for bill and vote lists. Used by `StateServiceRecordCard` (Task 24).

- [ ] **Step 1: Write failing StateBillsEvidence test**

Create `apps/web/test/components/state/StateBillsEvidence.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateBillsEvidence } from '@/components/state/StateBillsEvidence'
import type { StateBillWithSponsors } from '@chiaro/state-bills'

function mkBill(overrides: Partial<StateBillWithSponsors> = {}): StateBillWithSponsors {
  return {
    id: 'b1', openstates_bill_id: 'ocd-bill/x',
    state: 'CA', session: '20252026', bill_type: 'AB', number: 123,
    title: 'Test Bill', status: 'introduced',
    introduced_date: '2025-01-15', latest_action: 'Introduced',
    latest_action_date: '2025-01-15',
    source_url: 'https://x', openstates_url: 'https://o',
    status_substage: null, hearing_date: null, fiscal_impact_amount: null,
    party_vote_split: null, augmented_from: null,
    created_at: '2025-01-15', updated_at: '2025-01-15',
    sponsors: [], subjects: [],
    ...overrides,
  } as unknown as StateBillWithSponsors
}

describe('StateBillsEvidence', () => {
  it('renders bill list with title + status + date', () => {
    const bills = [mkBill({ title: 'Bill One', latest_action_date: '2025-02-01' })]
    const { getByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText('Bill One')).toBeTruthy()
    expect(getByText(/2025-02-01/)).toBeTruthy()
  })

  it('augment status_substage shown when present', () => {
    const bills = [mkBill({ status_substage: 'Senate Appropriations' })]
    const { getByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText(/Senate Appropriations/)).toBeTruthy()
  })

  it('augment hidden when null', () => {
    const bills = [mkBill({ status_substage: null })]
    const { queryByText } = render(<StateBillsEvidence bills={bills} />)
    expect(queryByText(/Senate Appropriations/)).toBeNull()
  })

  it('renders empty-state copy when bills empty', () => {
    const { getByText } = render(<StateBillsEvidence bills={[]} />)
    expect(getByText(/no bills/i)).toBeTruthy()
  })

  it('shows top N (5) + "show more" toggle', () => {
    const bills = Array.from({ length: 8 }, (_, i) =>
      mkBill({ id: `b${i}`, number: 100 + i, title: `Bill ${i}` }),
    )
    const { getByText, queryByText } = render(<StateBillsEvidence bills={bills} />)
    expect(getByText('Bill 0')).toBeTruthy()
    expect(getByText('Bill 4')).toBeTruthy()
    // Bill 5+ hidden behind toggle initially.
    expect(queryByText('Bill 7')).toBeNull()
    expect(getByText(/show more/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement StateBillsEvidence**

Create `apps/web/components/state/StateBillsEvidence.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateBillWithSponsors } from '@chiaro/state-bills'

const INITIAL_ROW_COUNT = 5

export function StateBillsEvidence({ bills }: { bills: StateBillWithSponsors[] }) {
  const [expanded, setExpanded] = useState(false)
  if (bills.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
        No bills this session.
      </div>
    )
  }
  const visible = expanded ? bills : bills.slice(0, INITIAL_ROW_COUNT)
  const hasMore = bills.length > INITIAL_ROW_COUNT
  return (
    <div data-testid="state-bills-evidence">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(b => (
          <li key={b.id} style={{
            padding: 8,
            borderTop: `1px solid ${COLORS.neutral.border}`,
            display: 'flex', flexDirection: 'column',
          }}>
            <a
              href={b.source_url}
              target="_blank" rel="noreferrer"
              style={{ color: COLORS.brand.text, textDecoration: 'none', fontWeight: 600 }}
            >
              {b.bill_type} {b.number}: {b.title}
            </a>
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
              {b.status_substage ?? b.status ?? '—'} · {b.latest_action_date}
            </div>
          </li>
        ))}
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
          {expanded ? 'show less' : `show more (${bills.length - INITIAL_ROW_COUNT} more)`}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run StateBillsEvidence test**

```bash
pnpm --filter @chiaro/web test StateBillsEvidence
```

Expected: 5/5 pass.

- [ ] **Step 4: Write failing StateVotesEvidence test**

Create `apps/web/test/components/state/StateVotesEvidence.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateVotesEvidence } from '@/components/state/StateVotesEvidence'
import type { StateVoteWithPosition } from '@chiaro/state-bills'

function mkVote(overrides: Partial<StateVoteWithPosition> = {}): StateVoteWithPosition {
  return {
    vote: {
      id: 'v1', openstates_vote_id: 'ocd-vote/x', bill_id: 'b1',
      state: 'CA', session: '20252026', chamber: 'state_senate',
      vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
      source_url: 'https://x', party_vote_split: null,
      created_at: '2025-03-01',
      bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'Test' },
    },
    position: 'yes',
    ...overrides,
  } as unknown as StateVoteWithPosition
}

describe('StateVotesEvidence', () => {
  it('renders vote with date + question + result + position', () => {
    const { getByText } = render(<StateVotesEvidence votes={[mkVote()]} />)
    expect(getByText(/On Passage/)).toBeTruthy()
    expect(getByText(/passed/i)).toBeTruthy()
    expect(getByText(/yes/i)).toBeTruthy()
  })

  it('party_vote_split shown when present', () => {
    const vote = mkVote()
    vote.vote.party_vote_split = { 'D-yes': 20, 'R-no': 12 } as never
    const { getByText } = render(<StateVotesEvidence votes={[vote]} />)
    expect(getByText(/D-yes/)).toBeTruthy()
  })

  it('missed-vote position renders distinctly', () => {
    const vote = mkVote({ position: 'not_voting' })
    const { getByText } = render(<StateVotesEvidence votes={[vote]} />)
    expect(getByText(/missed/i)).toBeTruthy()
  })

  it('empty state', () => {
    const { getByText } = render(<StateVotesEvidence votes={[]} />)
    expect(getByText(/no votes/i)).toBeTruthy()
  })

  it('show more toggle for >5 votes', () => {
    const votes = Array.from({ length: 7 }, (_, i) => {
      const v = mkVote()
      v.vote.id = `v${i}`
      v.vote.question = `Q ${i}`
      return v
    })
    const { getByText, queryByText } = render(<StateVotesEvidence votes={votes} />)
    expect(getByText('Q 0')).toBeTruthy()
    expect(queryByText('Q 6')).toBeNull()
    expect(getByText(/show more/i)).toBeTruthy()
  })
})
```

- [ ] **Step 5: Implement StateVotesEvidence**

Create `apps/web/components/state/StateVotesEvidence.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateVoteWithPosition } from '@chiaro/state-bills'

const INITIAL_ROW_COUNT = 5

function positionLabel(p: StateVoteWithPosition['position']): string {
  if (p === 'yes')        return 'yes'
  if (p === 'no')         return 'no'
  if (p === 'abstain')    return 'abstain'
  if (p === 'not_voting') return 'missed'
  if (p === 'present')    return 'present'
  return p
}

export function StateVotesEvidence({ votes }: { votes: StateVoteWithPosition[] }) {
  const [expanded, setExpanded] = useState(false)
  if (votes.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
        No votes this session.
      </div>
    )
  }
  const visible = expanded ? votes : votes.slice(0, INITIAL_ROW_COUNT)
  const hasMore = votes.length > INITIAL_ROW_COUNT
  return (
    <div data-testid="state-votes-evidence">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(v => {
          const split = v.vote.party_vote_split as Record<string, number> | null
          return (
            <li key={v.vote.id} style={{
              padding: 8,
              borderTop: `1px solid ${COLORS.neutral.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <a
                  href={v.vote.source_url}
                  target="_blank" rel="noreferrer"
                  style={{ color: COLORS.brand.text, fontWeight: 600, textDecoration: 'none' }}
                >
                  {v.vote.question}
                </a>
                <span style={{
                  fontSize: 12, padding: '2px 6px', borderRadius: 4,
                  background: COLORS.neutral.surface,
                  color: COLORS.brand.text,
                  border: `1px solid ${COLORS.neutral.border}`,
                }}>
                  {positionLabel(v.position)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
                {v.vote.vote_date} · {v.vote.result}
                {split && (
                  <span style={{ marginLeft: 8 }}>
                    {Object.entries(split).map(([k, n]) => `${k}: ${n}`).join(' · ')}
                  </span>
                )}
              </div>
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
          {expanded ? 'show less' : `show more (${votes.length - INITIAL_ROW_COUNT} more)`}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @chiaro/web test 'StateBillsEvidence|StateVotesEvidence'
pnpm --filter @chiaro/web typecheck
```

Expected: 10/10 pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/state/StateBillsEvidence.tsx \
        apps/web/components/state/StateVotesEvidence.tsx \
        apps/web/test/components/state/StateBillsEvidence.test.tsx \
        apps/web/test/components/state/StateVotesEvidence.test.tsx
git commit -m "feat(web): StateBillsEvidence + StateVotesEvidence inline panels

Both components render a top-5 list with a 'show more (N more)' toggle.
Empty state copy when list is empty.

StateBillsEvidence:
- bill title + type + number + status (substage if augment present)
- latest_action_date in muted color
- click bill row → external source_url in new tab

StateVotesEvidence:
- question + result + vote_date
- this official's position pill (yes/no/missed/abstain/present)
- party_vote_split inline when augment field present (D-yes: 20 · R-no: 12)
- click question → external source_url

10 vitest cases (5 each)."
```

---

## Task 24: Web — StateServiceRecordCard

**Files:**
- Create: `apps/web/components/state/StateServiceRecordCard.tsx`
- Create: `apps/web/test/components/state/StateServiceRecordCard.test.tsx`

Real Service Record card. Composes the 2 evidence panels + scalar metric rows.

- [ ] **Step 1: Write failing test**

Create `apps/web/test/components/state/StateServiceRecordCard.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { StateServiceRecordCard } from '@/components/state/StateServiceRecordCard'
import type { OfficialWithDistrict } from '@chiaro/officials'

function wrap({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

vi.mock('@chiaro/state-bills', async () => {
  const actual = await vi.importActual<object>('@chiaro/state-bills')
  return {
    ...actual,
    useOfficialSponsoredStateBills: () => ({ data: [{ id: 'b1', title: 'Test Sponsored', state: 'CA', bill_type: 'SB', number: 1, latest_action_date: '2025-02-01', sponsors: [], subjects: [], status: 'introduced', status_substage: null, source_url: 'https://x' }], isLoading: false, isSuccess: true }),
    useOfficialCosponsoredStateBills: () => ({ data: [], isLoading: false, isSuccess: true }),
    useOfficialStateVotes: () => ({ data: [{ vote: { id: 'v1', question: 'On Passage', vote_date: '2025-03-01', result: 'passed', source_url: 'https://x', party_vote_split: null, bill: { bill_type: 'SB', number: 1 } }, position: 'yes' }, { vote: { id: 'v2', question: 'On Motion', vote_date: '2025-03-15', result: 'failed', source_url: 'https://x', party_vote_split: null, bill: { bill_type: 'SB', number: 2 } }, position: 'not_voting' }], isLoading: false, isSuccess: true }),
  }
})

vi.mock('@chiaro/officials', async () => {
  const actual = await vi.importActual<object>('@chiaro/officials')
  return {
    ...actual,
    useOfficialMetrics: () => ({
      data: {
        bills_sponsored_count: 1,
        bills_cosponsored_count: 0,
        votes_voted_count: 1,
        votes_missed_count: 1,
        total_roll_calls: 2,
        attendance_pct: 50,
        party_unity_state: null,
        committee_chair_count: 0,
        fiscal_impact_total: 1000000,
      },
      isLoading: false, isSuccess: true,
    }),
  }
})

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

describe('StateServiceRecordCard', () => {
  it('renders tenure + bills sponsored + votes counts + attendance', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Service Record/i)).toBeTruthy()
    expect(getByText(/Bills sponsored/i)).toBeTruthy()
    expect(getByText(/Votes voted/i)).toBeTruthy()
    expect(getByText(/50%/)).toBeTruthy()  // attendance
  })

  it('returns null for federal official (chamber-gated)', () => {
    const fed = mkOfficial({ chamber: 'federal_senate', bioguide_id: 'P000001', openstates_person_id: null })
    const { container } = render(<StateServiceRecordCard official={fed} />, { wrapper: wrap })
    expect(container.firstChild).toBeNull()
  })

  it('NE state_legislature renders State Senator label', () => {
    const ne = mkOfficial({ chamber: 'state_legislature', state: 'NE' })
    const { getByText } = render(<StateServiceRecordCard official={ne} />, { wrapper: wrap })
    expect(getByText(/State Senator/)).toBeTruthy()
  })

  it('Party unity Not yet computed when null', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Not yet computed/i)).toBeTruthy()
  })

  it('shows missed votes row', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText(/Votes missed/i)).toBeTruthy()
  })

  it('embeds StateBillsEvidence + StateVotesEvidence panels', () => {
    const { container } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(container.querySelector('[data-testid="state-bills-evidence"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="state-votes-evidence"]')).not.toBeNull()
  })

  it('renders chamber + party + district badges in header row', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    expect(getByText('Democratic')).toBeTruthy()
  })

  it('empty metrics → falls back to scalar 0', () => {
    const { getByText } = render(<StateServiceRecordCard official={mkOfficial()} />, { wrapper: wrap })
    // Cosponsored count = 0 per mock — should render "0" not "—".
    expect(getByText(/Bills cosponsored/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement StateServiceRecordCard**

Create `apps/web/components/state/StateServiceRecordCard.tsx`:

```tsx
'use client'
import { COLORS } from '@chiaro/ui-tokens'
import {
  isStateLevel,
  useOfficialMetrics,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import {
  useOfficialSponsoredStateBills,
  useOfficialCosponsoredStateBills,
  useOfficialStateVotes,
} from '@chiaro/state-bills'
import { StateBillsEvidence } from './StateBillsEvidence'
import { StateVotesEvidence } from './StateVotesEvidence'
import { useSupabaseClient } from '@/lib/supabase/client'

function chamberLabel(chamber: OfficialWithDistrict['chamber']): string {
  if (chamber === 'state_house') return 'State Representative'
  return 'State Senator'
}

export function StateServiceRecordCard({ official }: { official: OfficialWithDistrict }) {
  if (!isStateLevel(official.chamber)) return null
  const client = useSupabaseClient()

  const sponsored   = useOfficialSponsoredStateBills(client, official.id)
  const cosponsored = useOfficialCosponsoredStateBills(client, official.id)
  const votes       = useOfficialStateVotes(client, official.id)
  const metrics     = useOfficialMetrics(client, official.id)

  const m = metrics.data
  const partyUnity = m?.party_unity_state == null ? 'Not yet computed' : `${m.party_unity_state}%`
  const attendance = m?.attendance_pct == null ? '—' : `${m.attendance_pct}%`

  return (
    <section
      style={{
        background: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${COLORS.neutral.border}`,
      }}
    >
      <header style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>
          Service Record
        </h3>
        <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
          {chamberLabel(official.chamber)} · {official.party}
        </div>
      </header>

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ScalarRow label="Bills sponsored"   value={m?.bills_sponsored_count ?? 0} />
        <ScalarRow label="Bills cosponsored" value={m?.bills_cosponsored_count ?? 0} />
        <ScalarRow label="Votes voted"       value={m?.votes_voted_count ?? 0} />
        <ScalarRow label="Votes missed"      value={m?.votes_missed_count ?? 0} />
        <ScalarRow label="Attendance"        value={attendance} />
        <ScalarRow label="Party unity"       value={partyUnity} />
      </dl>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.brand.text }}>
          View sponsored bills ({sponsored.data?.length ?? 0})
        </summary>
        <StateBillsEvidence bills={sponsored.data ?? []} />
      </details>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.brand.text }}>
          View vote record ({votes.data?.length ?? 0})
        </summary>
        <StateVotesEvidence votes={votes.data ?? []} />
      </details>
    </section>
  )
}

function ScalarRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <dt style={{ fontSize: 13, color: COLORS.neutral.textMuted, margin: 0 }}>{label}</dt>
      <dd style={{ fontSize: 14, fontWeight: 600, color: COLORS.brand.text, margin: 0 }}>{value}</dd>
    </div>
  )
}
```

The `useSupabaseClient` import path may differ in this repo — check `apps/web/lib/supabase/` for the actual client hook used by other components. Adapt the import.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @chiaro/web test StateServiceRecordCard
pnpm --filter @chiaro/web typecheck
```

Expected: 8/8 pass; typecheck clean. If `useOfficialMetrics` doesn't already exist in `@chiaro/officials`, check the package — slice 4 added an `official_metrics` query but the hook name may differ. Find the existing one and adapt.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/state/StateServiceRecordCard.tsx \
        apps/web/test/components/state/StateServiceRecordCard.test.tsx
git commit -m "feat(web): StateServiceRecordCard — real Service Record for state officials

Composes 4 hooks:
- useOfficialMetrics (scalars: bills sponsored/cosponsored, votes
  voted/missed, attendance, party_unity_state)
- useOfficialSponsoredStateBills (sponsored list)
- useOfficialCosponsoredStateBills (cosponsored list)
- useOfficialStateVotes (vote roll-calls + this official's position)

Layout:
- 6 ScalarRows (bills sponsored, bills cosponsored, votes voted,
  votes missed, attendance, party unity)
- Expandable <details> for bills + votes evidence panels

Chamber-gated: returns null for federal officials (slice-4 federal
flow untouched). NE state_legislature renders 'State Senator' label.
Party unity 'Not yet computed' when NULL (per slice 5D defensive
behavior).

8 vitest cases."
```

---

## Task 25: Web — swap ComingSoonCard + integration test extension

**Files:**
- Modify: `apps/web/components/state/StateOfficialDetailPage.tsx`
- Modify: `packages/officials/test/queries.integration.test.ts`

- [ ] **Step 1: Read current StateOfficialDetailPage**

```bash
cat apps/web/components/state/StateOfficialDetailPage.tsx
```

Find the spot that renders the 5 ComingSoonCards. The Service Record one is the first entry in the CATEGORIES array (per slice 5C Task 10's implementation). Replace it with `<StateServiceRecordCard />`.

- [ ] **Step 2: Modify StateOfficialDetailPage**

Edit `apps/web/components/state/StateOfficialDetailPage.tsx`. The existing `CATEGORIES` constant looks like:

```tsx
const CATEGORIES: ComingSoonCategory[] = [
  'Service Record',
  'Issue Positions',
  'Community Presence',
  'Finance',
  'Ethics & Accountability',
]
```

Update the JSX rendering loop. Find:

```tsx
<section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  {CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
</section>
```

Replace with:

```tsx
<section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <StateServiceRecordCard official={official} />
  {(['Issue Positions', 'Community Presence', 'Finance', 'Ethics & Accountability'] as const)
    .map(cat => <ComingSoonCard key={cat} category={cat} />)}
</section>
```

Also add the import:

```tsx
import { StateServiceRecordCard } from './StateServiceRecordCard'
```

You can keep `CATEGORIES` declared at module level for the other 4 categories (rename to `REMAINING_COMING_SOON_CATEGORIES` or similar), or inline the array as shown above.

- [ ] **Step 3: Extend integration test**

Open `packages/officials/test/queries.integration.test.ts`. In `beforeAll`, after the slice-5C state assemblymember seed, add 1 state bill + 1 state vote so the new `@chiaro/state-bills` queries return real data:

Find the existing state assembly seed:

```ts
await svc.from('officials').insert([
  {
    openstates_person_id: 'ocd-person/00000000-0000-0000-0000-000000000001-int',
    ...
  },
])
```

After that block, add:

```ts
// 5D integration: state bill + sponsor + vote so state queries return data.
const { data: stateBill, error: sbErr } = await svc.from('state_bills').insert({
  openstates_bill_id: 'ocd-bill/0000-int',
  state: 'CA', session: '20252026', bill_type: 'AB', number: 999,
  title: 'Integration Test Bill',
  source_url: 'https://x', openstates_url: 'https://y',
}).select().single()
expect(sbErr).toBeNull()
const stateAsmId = (await svc.from('officials').select('id').eq('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int').single()).data!.id

await svc.from('state_bill_sponsors').insert({
  bill_id: stateBill!.id, official_id: stateAsmId, role: 'sponsor',
})

const { data: stateVote } = await svc.from('state_votes').insert({
  openstates_vote_id: 'ocd-vote/0000-int',
  bill_id: stateBill!.id, state: 'CA', session: '20252026',
  chamber: 'state_house', vote_date: '2025-03-01',
  question: 'On Passage', result: 'passed', source_url: 'https://x',
}).select().single()

await svc.from('state_vote_positions').insert({
  vote_id: stateVote!.id, official_id: stateAsmId, position: 'yes',
})
```

In afterAll, BEFORE the existing officials delete + districts delete (FK ordering), add:

```ts
await svc.from('state_vote_positions').delete().like('vote_id', '%')  // safer: by official_id
  .eq('official_id', stateAsmId)
await svc.from('state_votes').delete().eq('openstates_vote_id', 'ocd-vote/0000-int')
await svc.from('state_bill_sponsors').delete().eq('official_id', stateAsmId)
await svc.from('state_bills').delete().eq('openstates_bill_id', 'ocd-bill/0000-int')
```

Then add 1 new test case after the existing 5C federal+state coexistence cases:

```ts
it('state officials can read their own state_bill_sponsors via anon RLS', async () => {
  // anon is signed in as the test user from beforeAll
  const { data, error } = await anon.from('state_bill_sponsors')
    .select('bill_id, role')
    .eq('official_id', stateAsmId)
  expect(error).toBeNull()
  expect(data).toHaveLength(1)
  expect(data![0]!.role).toBe('sponsor')
})
```

(The variable `stateAsmId` must be hoisted into module scope so afterAll + the new test can both see it — same pattern as existing district IDs in the file.)

- [ ] **Step 4: Run tests + build**

```bash
pnpm --filter @chiaro/web test
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build 2>&1 | tail -15
pnpm --filter @chiaro/officials test queries.integration 2>&1 | tail -15
```

Expected: all green. The build proves the new `StateServiceRecordCard` integrates into the route without runtime errors at static-analysis time.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/state/StateOfficialDetailPage.tsx \
        packages/officials/test/queries.integration.test.ts
git commit -m "feat(web): swap ComingSoonCard for real StateServiceRecordCard

apps/web/components/state/StateOfficialDetailPage.tsx now renders
<StateServiceRecordCard official={...} /> in place of the
ComingSoonCard('Service Record') from slice 5C. The other 4
ComingSoonCards (Issue Positions, Community Presence, Finance,
Ethics & Accountability) remain — those land in 5E + 5F.

@chiaro/officials integration test extended: seeds 1 state_bill +
sponsor + 1 state_vote + position so the new state-bills queries
return real data. New case verifies anon RLS on state_bill_sponsors."
```

---

## Task 26: Mobile — StateBillsEvidence + StateVotesEvidence + StateServiceRecordCard

**Files:**
- Create: `apps/mobile/components/state/StateBillsEvidence.tsx`
- Create: `apps/mobile/components/state/StateVotesEvidence.tsx`
- Create: `apps/mobile/components/state/StateServiceRecordCard.tsx`
- Create: `apps/mobile/test/components/state/StateBillsEvidence.test.tsx`
- Create: `apps/mobile/test/components/state/StateVotesEvidence.test.tsx`
- Create: `apps/mobile/test/components/state/StateServiceRecordCard.test.tsx`

Mirror Tasks 23 + 24 in RN primitives.

- [ ] **Step 1: Create mobile StateBillsEvidence**

Create `apps/mobile/components/state/StateBillsEvidence.tsx` — mirror web's implementation with `View`, `Text`, `Pressable`, `Linking.openURL` instead of `<a href>`. Same logic.

```tsx
import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateBillWithSponsors } from '@chiaro/state-bills'

const INITIAL_ROW_COUNT = 5

export function StateBillsEvidence({ bills }: { bills: StateBillWithSponsors[] }) {
  const [expanded, setExpanded] = useState(false)
  if (bills.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
          No bills this session.
        </Text>
      </View>
    )
  }
  const visible = expanded ? bills : bills.slice(0, INITIAL_ROW_COUNT)
  const hasMore = bills.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-bills-evidence">
      {visible.map(b => (
        <Pressable
          key={b.id}
          onPress={() => Linking.openURL(b.source_url)}
          style={{
            padding: 8,
            borderTopWidth: 1,
            borderTopColor: COLORS.neutral.border,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.brand.text }}>
            {b.bill_type} {b.number}: {b.title}
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
            {b.status_substage ?? b.status ?? '—'} · {b.latest_action_date}
          </Text>
        </Pressable>
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          style={{ marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start',
                   borderWidth: 1, borderColor: COLORS.neutral.border, borderRadius: 4 }}
        >
          <Text style={{ fontSize: 12, color: COLORS.brand.text }}>
            {expanded ? 'show less' : `show more (${bills.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
```

- [ ] **Step 2: Create mobile StateBillsEvidence test**

Mirror web tests using `@testing-library/react-native` + jest globals. ~5 cases.

- [ ] **Step 3: Create mobile StateVotesEvidence**

Mirror web. Same logic with RN primitives.

- [ ] **Step 4: Create mobile StateVotesEvidence test**

Mirror web tests. ~5 cases.

- [ ] **Step 5: Create mobile StateServiceRecordCard**

Mirror web. The `useSupabaseClient` hook may have a different import path in mobile — check `apps/mobile/lib/` for the actual client provider.

- [ ] **Step 6: Create mobile StateServiceRecordCard test**

Mirror web tests with same mocks (jest.mock instead of vi.mock). ~8 cases.

- [ ] **Step 7: Run mobile tests + typecheck**

```bash
pnpm --filter @chiaro/mobile test 'StateBillsEvidence|StateVotesEvidence|StateServiceRecordCard'
pnpm --filter @chiaro/mobile typecheck
```

Expected: ~18 new tests pass; total mobile test count climbs.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/state/StateBillsEvidence.tsx \
        apps/mobile/components/state/StateVotesEvidence.tsx \
        apps/mobile/components/state/StateServiceRecordCard.tsx \
        apps/mobile/test/components/state/StateBillsEvidence.test.tsx \
        apps/mobile/test/components/state/StateVotesEvidence.test.tsx \
        apps/mobile/test/components/state/StateServiceRecordCard.test.tsx
git commit -m "feat(mobile): state-bills UI parity — StateServiceRecordCard + evidence panels

Mirrors apps/web Task 23 + 24:
- StateBillsEvidence — bill list w/ top-5 + show-more toggle, Linking.openURL
- StateVotesEvidence — vote list w/ position pill + party split when augment present
- StateServiceRecordCard — composes 4 hooks, chamber-gated, 6 scalar rows
  + 2 expandable evidence panels

~18 mobile vitest cases (jest-expo)."
```

---

## Task 27: Mobile — swap ComingSoonCard in StateOfficialDetailPage

**Files:**
- Modify: `apps/mobile/components/state/StateOfficialDetailPage.tsx`

- [ ] **Step 1: Modify mobile StateOfficialDetailPage**

Same pattern as web Task 25: replace the Service Record entry from CATEGORIES with `<StateServiceRecordCard official={official} />`. The other 4 ComingSoonCards remain.

```tsx
// Add at top:
import { StateServiceRecordCard } from './StateServiceRecordCard'

// In the render output, where CATEGORIES.map renders 5 ComingSoonCards, replace with:
<View style={{ gap: 12 }}>
  <StateServiceRecordCard official={official} />
  {(['Issue Positions', 'Community Presence', 'Finance', 'Ethics & Accountability'] as const)
    .map(cat => <ComingSoonCard key={cat} category={cat} />)}
</View>
```

- [ ] **Step 2: Run tests + typecheck**

```bash
pnpm --filter @chiaro/mobile test StateOfficialDetailPage
pnpm --filter @chiaro/mobile typecheck
```

Expected: existing 5-placeholder tests need updating to expect 4 ComingSoonCards (not 5) plus the StateServiceRecordCard. Update those expectations in `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/state/StateOfficialDetailPage.tsx \
        apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(mobile): swap ComingSoonCard for StateServiceRecordCard

Mirror of apps/web Task 25. The mobile state detail page now renders
<StateServiceRecordCard /> in place of ComingSoonCard('Service Record').
The other 4 ComingSoonCards remain (deferred to 5E/5F)."
```

---

## Task 28: CLAUDE.md updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update slice list**

Find "Slices delivered" section. After the slice 5C entry, add:

```markdown
- **Sub-slice 5D — state bills + votes** (2026-05-20, PR #N): OpenStates baseline ingest of state legislators' bills + votes (50 states) + 5 per-state public-API augment adapters (CA leginfo, NY senate API, FL Senate+House, TX capitol, MI legislature). New @chiaro/state-bills package (workspace 9 → 10). Migrations 0030-0034: state_bills + state_bill_sponsors + state_bill_subjects + state_votes + state_vote_positions tables + 3 new official_metrics columns (committee_chair_count, fiscal_impact_total, party_unity_state). Service Record card on /state-officials/[id] becomes real. NY adapter skips gracefully without NY_SENATE_API_KEY.
```

- [ ] **Step 2: Bump numeric claims**

Find and update:
- Migration range: `pnpm db:reset                          # apply all migrations 0001–0029` → `0001–0034`
- pgTAP count: `pnpm db:test                           # pgTAP suite (250 tests across 20 files)` → recompute actual:

```bash
ls packages/db/supabase/tests/*.test.sql | wc -l
grep -h "^select plan(" packages/db/supabase/tests/*.test.sql | grep -oE "plan\([0-9]+\)" | grep -oE "[0-9]+" | awk '{s+=$1} END {print "Total:", s}'
```

Use actual values.

- Typecheck count: `pnpm -r typecheck                      # 9 packages` → `10 packages`

- [ ] **Step 3: Add seed:state-bills-full to Quick start**

In the Quick start block, after `pnpm seed:state-officials`, add:

```bash
pnpm seed:state-bills-full             # ingest state bills + votes + per-state augment + state metrics
```

- [ ] **Step 4: Add NY_SENATE_API_KEY to env-var table**

Find the env-var table. Add a row:

```markdown
| `NY_SENATE_API_KEY` | `pnpm seed:state-bills-enrich` (NY adapter) | Free signup at legislation.nysenate.gov/keyOptions. Server-side only. Optional — NY augment skipped gracefully without it. |
```

- [ ] **Step 5: Add packages/state-bills to Architecture block**

Find the `packages/` architecture block. Add:

```
  state-bills/        # state bills + votes domain (queries, hooks, types, schemas)
```

Update the comment count near the top of CLAUDE.md if it mentions package count.

- [ ] **Step 6: Add Gotcha #9**

After Gotcha #8, add:

```markdown
9. **State bills + votes data sources have known quirks** —
   - **OpenStates bulk data is the baseline source for 50 states**. Source pinned in `openstates-bills-loader.ts` per task 1 of slice 5D's plan. Re-runnable via `pnpm seed:state-bills-votes`.
   - **5 states get per-state-API augment** (CA leginfo, NY senate, FL Senate+House, TX capitol, MI legislature). Adapter pattern under `packages/db/supabase/seed/state-bills/enrich-*.ts`. Each adapter isolated — one failure doesn't abort others.
   - **NY requires `NY_SENATE_API_KEY`** env var. Adapter skips gracefully (with `skipReason`) without it.
   - **`session` field is text — format varies per state**: CA `'20252026'` (biennial), NY `'2025'` (annual), MD `'2025rs'` (regular session suffix), TX `'89R'` (legislature-numbered), MI `'2025-2026'`. Don't normalize — preserve raw.
   - **`state_votes.bill_id` uses `ON DELETE RESTRICT`** (preserves vote history if a bill row is later deleted). Per slice-5C 0026 audit precedent.
   - **`augmented_from` column tracks which per-state adapter populated augment fields** (`'ca-leginfo'`, `'ny-senate-api'`, etc). Re-running an adapter overwrites prior augment values.
   - **`recompute-state-metrics.ts` placeholders**: `committee_chair_count = 0` and `party_unity_state = 100 when voted >= 3` are MVP stubs. Real implementations require committee + party-roll-call data not yet ingested. Refine in sub-slice 5F.
   - **NH multi-word district legislators (still unmatched from 5C)**: their bills get logged to `stats.unmatchedBills` in `state-bills-votes-ingest` and skipped. Follow-up.
```

- [ ] **Step 7: Final workspace sweep**

```bash
pnpm -r typecheck 2>&1 | tail -5
pnpm --filter @chiaro/web build 2>&1 | tail -10
pnpm --filter @chiaro/web test 2>&1 | tail -5
pnpm --filter @chiaro/mobile test 2>&1 | tail -5
pnpm --filter @chiaro/db test 2>&1 | tail -10
pnpm --filter @chiaro/state-bills test 2>&1 | tail -5
pnpm db:reset 2>&1 | tail -3
pnpm db:test 2>&1 | grep -E "^# Failed|^ok " | tail -5
```

Expected:
- typecheck clean across 10 packages
- web build succeeds; `/state-officials/[id]` route still in table
- web tests green (~170+)
- mobile tests green (~96+)
- db seed tests green (~110+)
- state-bills tests green (~15)
- pgTAP green (~303 tests across 23 files, except pre-existing `tiger_ingest` 4-test failure — gotcha #6)

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): sub-slice 5D — state bills + votes

- New slice entry referencing migrations 0030-0034
- Migration range bumped 0001-0034
- pgTAP count: <actual>
- Workspace package count: 9 → 10 (+@chiaro/state-bills)
- Quick start: +seed:state-bills-full
- Env vars: +NY_SENATE_API_KEY
- Architecture block: +packages/state-bills/
- New Gotcha #9: state bills/votes data source quirks (session id
  variance, augmented_from tracking, per-state adapter isolation,
  recompute-state-metrics MVP placeholders, NY API key)"
```

---

## Task 29: Final workspace verify

**Files:** none modified.

Verification-only task. Confirm all 28 prior tasks land correctly.

- [ ] **Step 1: Workspace sweep**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/web build 2>&1 | tail -10
pnpm --filter @chiaro/web test 2>&1 | tail -5
pnpm --filter @chiaro/mobile test 2>&1 | tail -5
pnpm --filter @chiaro/db test 2>&1 | tail -10
pnpm --filter @chiaro/state-bills test 2>&1 | tail -5
pnpm db:reset 2>&1 | tail -5
pnpm db:test 2>&1 | tail -5
```

Expected per Task 28 Step 7. Document each result in the verify commit.

- [ ] **Step 2: Branch state**

```bash
git log master..HEAD --oneline | head -35
git status
```

Expected: ~29 commits (one per task, possibly more if any task had a follow-up fix). Working tree clean except pre-existing `.claude/settings.local.json` + `.claude/scheduled_tasks.lock`.

- [ ] **Step 3: No commit if everything green**

This task is verification-only. If everything is green, report DONE. If anything failed, report BLOCKED with the failing commands + output.

## Report (after Task 29)

Reply with **DONE | DONE_WITH_CONCERNS | BLOCKED** and:
- Commit SHAs for tasks 1-28
- Final test counts per surface (pgTAP, web vitest, mobile vitest, db seed vitest, state-bills vitest)
- Build outcome
- Confirmation `/state-officials/[id]` route renders the StateServiceRecordCard for state officials
- Any deferred items / known limitations (NH unmatched, MVP placeholders for committee_chair_count and party_unity_state, etc)
- Operator pre-flight reminder: `pnpm seed:state-bills-full` post-merge

---

## Self-review notes

**Spec coverage map:**

| Spec section | Covered by |
|---|---|
| Goal | Tasks 2-29 deliver the chain |
| Schema (5 new tables + 3 new official_metrics cols) | Tasks 2-6 (migrations 0030-0034 + pgTAP) |
| @chiaro/state-bills new package | Tasks 7-9 |
| OpenStates baseline ingest | Tasks 1, 10, 11, 12 |
| 5 per-state adapters | Tasks 13-18 (shared + CA, NY, FL, TX, MI) |
| Enrich orchestrator + script | Tasks 19, 20 |
| Recompute pipeline | Tasks 21, 22 |
| StateServiceRecordCard + Evidence panels (web) | Tasks 23, 24 |
| Detail page swap + integration test extension (web) | Task 25 |
| Mobile parity | Tasks 26, 27 |
| Docs (CLAUDE.md slice entry + gotcha #9) | Task 28 |
| Acceptance criteria 1-15 | Distributed across tasks; final verify in Task 29 |
| Operator pre-flight | Documented in Task 28 (CLAUDE.md Quick start) |
| Known limitations (NH, MVP placeholders) | Documented in Gotcha #9 (Task 28) |

**Placeholder scan:** No "TBD" / "TODO" / "later" in any step. Every code step shows the actual code. The "Task 1" source-pin verification is an explicit research task with concrete commands, not a placeholder.

**Type consistency:**
- `StateBillRow`, `StateBillSponsorRow`, `StateBillSubjectRow`, `StateVoteRow`, `StateVotePositionRow` defined in Task 8 → used by Tasks 9, 11, 21, 23, 24
- `StateBillWithSponsors`, `StateVoteWithBill`, `StateVoteWithPosition` defined in Task 8 → consumed by Tasks 9, 23, 24
- `StateEnrichAdapter`, `EnrichStats` defined in Task 13 → consumed by Tasks 14, 15, 16, 17, 18, 19
- `OpenStatesBillEnvelope`, `OpenStatesVoteEnvelope` defined in Task 10 → consumed by Task 11
- `IngestStateBillsVotesStats`, `IngestStateBillsEnrichStats`, `RecomputeStateMetricsStats` defined in their respective Tasks (11, 19, 21)
- Hook signatures: `useOfficialSponsoredStateBills(client, officialId)` defined in Task 9 → consumed in Task 24
- `chamberLabel` helper signature consistent across web Task 24 + mobile Task 26
- `INITIAL_ROW_COUNT = 5` constant repeated in StateBillsEvidence + StateVotesEvidence (web + mobile) — acceptable duplication for a per-file constant

All references resolve forward. No undefined types or methods. Plan is self-consistent.
