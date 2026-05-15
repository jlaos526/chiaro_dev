# Slice 3: Officials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the third vertical slice of Chiaro — federal officials (house + senate) end-to-end on web + mobile. A calibrated user sees their delegation on home, can navigate to a list grouped by chamber, and to a detail page per official. Officials are ingested from Congress.gov v3 via a defensive seed script with pre-flight checks, set-based deactivation, threshold guards, transactional writes, and an audit table.

**Architecture:** Five new Postgres migrations (officials + RLS + user_locations_geojson view + push_tokens + officials_ingest_runs audit table). Two new packages: `packages/ui-tokens` (shared design tokens) and `packages/officials` (domain logic with TanStack Query hooks). A new seed script `seed/officials-ingest.ts` orchestrates a defensive Congress.gov ingest via a `seed/congress-gov.ts` adapter. Both apps add a `QueryClientProvider`, three new screens (home card + list + detail), and shared atomic components. The existing `DistrictPanel` keeps its inline-fetch pattern (migration to TanStack deferred to slice 3.5).

**Tech Stack:** (extends slice 2) `@tanstack/react-query` ^5 (web + mobile), Congress.gov API v3 (`api.congress.gov/v3`), no new runtimes.

**Reference spec:** `docs/superpowers/specs/2026-05-15-slice-3-officials-design.md` — read this first.

**Pre-flight assumptions** (verified at the end of slice 2):
- Repo is a pnpm workspace; existing `packages/db`, `packages/supabase-client`, `packages/profile`, `packages/location`, `apps/web`, `apps/mobile`.
- `pnpm db:start` / `db:reset` / `db:test` / `db:gen-types` work (slice 1/2 scripts).
- Slice 2 pgTAP and Vitest suites are green on `master`.
- Migrations 0001–0008 apply cleanly.
- The latest commits include `8fbcbe6` (spec — tier-B safety guards) and `bc542c4` (audit Top-5 #5: `@supabase/ssr` 0.10 bump).

---

## File Structure

```
chiaro/
├── packages/
│   ├── db/
│   │   ├── supabase/
│   │   │   ├── migrations/
│   │   │   │   ├── 0001..0008                          # existing
│   │   │   │   ├── 0009_officials.sql                  # NEW — Task 1
│   │   │   │   ├── 0010_officials_rls.sql              # NEW — Task 2
│   │   │   │   ├── 0011_user_locations_geojson_view.sql # NEW — Task 3
│   │   │   │   ├── 0012_push_tokens.sql                # NEW — Task 4
│   │   │   │   └── 0013_officials_ingest_runs.sql      # NEW — Task 5
│   │   │   ├── tests/
│   │   │   │   ├── existing slice-1/2 tests
│   │   │   │   ├── officials_rls.test.sql              # NEW — Tasks 1,2
│   │   │   │   ├── user_locations_geojson.test.sql     # NEW — Task 3
│   │   │   │   ├── push_tokens_rls.test.sql            # NEW — Task 4
│   │   │   │   └── officials_ingest_runs_rls.test.sql  # NEW — Task 5
│   │   │   ├── seed/
│   │   │   │   ├── tiger-ingest.ts                     # existing
│   │   │   │   ├── tiger-*.ts                          # existing
│   │   │   │   ├── officials-ingest.ts                 # NEW — Tasks 15-17
│   │   │   │   ├── congress-gov.ts                     # NEW — Task 13
│   │   │   │   ├── normalize.ts                        # NEW — Task 9 (Congress.gov adapter shape + normalize)
│   │   │   │   ├── officials-config.ts                 # NEW — Task 14
│   │   │   │   └── fixtures/                           # NEW — Task 17
│   │   │   │       ├── congress-gov-house-119-full.json
│   │   │   │       ├── congress-gov-senate-119-full.json
│   │   │   │       ├── congress-gov-house-partial.json
│   │   │   │       ├── congress-gov-house-missing-50.json
│   │   │   │       └── congress-gov-senate-without-one.json
│   │   │   └── config.toml                             # existing
│   │   ├── src/
│   │   │   └── types.ts                                # regenerated Task 6
│   │   └── package.json                                # modified Task 18 (seed:officials)
│   ├── ui-tokens/                                      # NEW — Task 7
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── colors.ts
│   │       └── party.ts
│   └── officials/                                      # NEW — Tasks 8, 10-12
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts
│       │   ├── keys.ts
│       │   ├── queries.ts
│       │   └── hooks.ts
│       └── test/
│           ├── keys.test.ts
│           ├── queries.integration.test.ts
│           └── hooks.test.tsx
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx                              # modified Task 19
│   │   │   ├── page.tsx                                # modified Task 21
│   │   │   └── officials/
│   │   │       ├── page.tsx                            # NEW — Task 22
│   │   │       └── [id]/page.tsx                       # NEW — Task 23
│   │   ├── components/
│   │   │   ├── OfficialAvatar.tsx                      # NEW — Task 20
│   │   │   ├── PartyBadge.tsx                          # NEW — Task 20
│   │   │   ├── OfficialMeta.tsx                        # NEW — Task 20
│   │   │   ├── OfficialsCard.tsx                       # NEW — Task 21
│   │   │   ├── OfficialsList.tsx                       # NEW — Task 22
│   │   │   └── OfficialDetail.tsx                      # NEW — Task 23
│   │   ├── lib/
│   │   │   └── query-client.tsx                        # NEW — Task 19
│   │   ├── package.json                                # modified Task 19
│   │   └── .env.example                                # modified Task 18
│   └── mobile/
│       ├── app/(app)/
│       │   ├── _layout.tsx                             # modified Task 24
│       │   ├── index.tsx                               # modified Task 25
│       │   └── officials/
│       │       ├── index.tsx                           # NEW — Task 26
│       │       └── [id].tsx                            # NEW — Task 27
│       ├── components/
│       │   ├── OfficialAvatar.tsx                      # NEW — Task 25
│       │   ├── PartyBadge.tsx                          # NEW — Task 25
│       │   ├── OfficialMeta.tsx                        # NEW — Task 25
│       │   ├── OfficialsCard.tsx                       # NEW — Task 25
│       │   ├── OfficialsList.tsx                       # NEW — Task 26
│       │   └── OfficialDetail.tsx                      # NEW — Task 27
│       ├── lib/
│       │   └── query-client.tsx                        # NEW — Task 24
│       └── package.json                                # modified Task 24
├── .github/workflows/ci.yml                            # modified Task 28
├── package.json                                        # modified Task 18 (seed:officials)
└── .env.example                                        # modified Task 18
```

---

## Task 0: Verify Clean Baseline

**Goal:** Catch state divergence before touching code.

**Files:** none — verification only.

- [ ] **Step 1: Confirm branch**

Run: `git status`
Expected: on a fresh feature branch (e.g. `feat/slice-3-officials`), tree clean. If on `master`, create: `git checkout -b feat/slice-3-officials`.

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`
Expected: no errors; existing `node_modules/` reused.

- [ ] **Step 3: Boot Supabase**

Run: `pnpm db:start`
Expected: services come up; URL `http://127.0.0.1:54321`, DB `54322`. If port-clash appears, see `project_resume_state.md` memory note.

- [ ] **Step 4: Verify slice 1+2 pgTAP green**

Run: `pnpm db:reset && pnpm db:test`
Expected: All existing migrations apply; existing pgTAP green.

- [ ] **Step 5: Verify workspace typecheck green**

Run: `pnpm -r typecheck`
Expected: 6/6 packages typecheck clean.

- [ ] **Step 6: No commit** — this is read-only verification.

---

## Task 1: Migration `0009_officials.sql` — Schema + Bucket (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0009_officials.sql`
- Create: `packages/db/supabase/tests/officials_rls.test.sql` (existence assertions only; RLS comes in Task 2)

**Reading required:** spec § "Schema migrations → `0009_officials.sql`".

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/officials_rls.test.sql`:

```sql
begin;

select plan(14);

-- 1. official_chamber enum exists
select has_enum('public', 'official_chamber', 'official_chamber enum exists');
select enum_has_labels(
  'public', 'official_chamber',
  array['house','senate']::text[],
  'official_chamber has correct labels'
);

-- 2. officials table exists with expected columns
select has_table('public', 'officials', 'officials table exists');
select has_column('public', 'officials', 'bioguide_id', 'bioguide_id column present');
select col_is_unique('public', 'officials', 'bioguide_id', 'bioguide_id is unique');
select has_column('public', 'officials', 'chamber', 'chamber column present');
select has_column('public', 'officials', 'district_id', 'district_id column present');
select col_is_fk('public', 'officials', 'district_id', 'district_id is a FK');

-- 3. constraints
select col_has_check('public', 'officials', 'party', 'party has check constraint');
select col_has_check('public', 'officials', 'state', 'state has length check');
select col_has_check('public', 'officials', 'senate_class', 'senate_class has check');

-- 4. indexes
select has_index('public', 'officials', 'officials_district_idx',
                  'officials_district_idx exists');

-- 5. storage bucket provisioned
select ok(
  exists (select 1 from storage.buckets where id = 'officials-portraits' and public = true),
  'officials-portraits bucket exists and is public'
);

-- 6. updated_at trigger wired
select trigger_is(
  'public', 'officials', 'officials_touch_updated_at',
  'public', 'touch_updated_at',
  'officials_touch_updated_at trigger present'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:reset && pnpm db:test`
Expected: `officials_rls.test.sql` reports many failures (table missing, enum missing, etc.). Other suites still pass.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0009_officials.sql`:

```sql
-- Slice 3: federal officials table + storage bucket provisioning.
-- See docs/superpowers/specs/2026-05-15-slice-3-officials-design.md
-- § Schema migrations → 0009_officials.sql

create type public.official_chamber as enum ('house','senate');

create table public.officials (
  id              uuid        primary key default gen_random_uuid(),
  bioguide_id     text        not null unique,
  first_name      text        not null,
  last_name       text        not null,
  full_name       text        not null,
  chamber         public.official_chamber not null,
  party           text        not null check (party in ('D','R','I','L','G','ID')),
  state           text        not null check (length(state) = 2),
  district_id     uuid        not null references public.districts(id) on delete restrict,
  senate_class    smallint    check (senate_class is null or senate_class in (1,2,3)),
  portrait_url    text,
  official_url    text,
  twitter_handle  text,
  next_election   date,
  in_office       boolean     not null default true,
  source_version  text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.officials add constraint senate_class_matches_chamber
  check ((chamber = 'senate' and senate_class is not null)
      or (chamber = 'house'  and senate_class is null));

create index officials_district_idx       on public.officials(district_id);
create index officials_state_chamber_idx  on public.officials(state, chamber) where in_office;

create trigger officials_touch_updated_at
  before update on public.officials
  for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('officials-portraits', 'officials-portraits', true, 1048576,
          '{image/jpeg,image/png,image/webp}')
  on conflict (id) do nothing;
```

- [ ] **Step 4: Run pgTAP to verify pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: `officials_rls.test.sql` → 14/14 green. Other suites unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0009_officials.sql \
        packages/db/supabase/tests/officials_rls.test.sql
git commit -m "feat(db): 0009 officials table + portraits bucket"
```

---

## Task 2: Migration `0010_officials_rls.sql` — RLS (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0010_officials_rls.sql`
- Modify: `packages/db/supabase/tests/officials_rls.test.sql` (extend plan; add RLS assertions)

**Reading required:** spec § "Schema migrations → `0010_officials_rls.sql`".

- [ ] **Step 1: Extend the failing pgTAP test**

Edit `packages/db/supabase/tests/officials_rls.test.sql` — change `plan(14)` to `plan(20)` and append before `select * from finish();`:

```sql
-- RLS assertions
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.officials'::regclass),
  'officials has RLS enabled'
);

select policies_are(
  'public', 'officials',
  array['officials_select_all'],
  'officials has only select_all policy'
);

-- 7. Seed a district + an official to exercise RLS
insert into public.districts (id, tier, state, code, name, geometry, source_version)
  values ('11111111-1111-1111-1111-111111111111', 'federal_senate', 'CA',
          'federal_senate:CA', 'California (Senate)',
          st_geogfromtext('POLYGON((-120 35, -119 35, -119 36, -120 36, -120 35))'),
          'TIGER-FIXTURE');

insert into public.officials (bioguide_id, first_name, last_name, full_name,
  chamber, party, state, district_id, senate_class, source_version)
  values ('X000001','Test','Senator','Test Senator','senate','D','CA',
          '11111111-1111-1111-1111-111111111111', 1, '119');

-- 8. anon SELECT permitted (public-read)
set local role anon;
select is(
  (select count(*) from public.officials),
  1::bigint,
  'anon can SELECT officials'
);

-- 9. anon INSERT blocked
select throws_ok(
  $$ insert into public.officials (bioguide_id, first_name, last_name, full_name,
       chamber, party, state, district_id, senate_class, source_version)
     values ('X000002','Y','Y','Y','senate','R','TX',
       '11111111-1111-1111-1111-111111111111', 2, '119') $$,
  '42501',  -- insufficient_privilege
  null,
  'anon cannot INSERT'
);

-- 10. anon UPDATE blocked
select throws_ok(
  $$ update public.officials set party = 'R' where bioguide_id = 'X000001' $$,
  '42501', null,
  'anon cannot UPDATE'
);

-- 11. anon DELETE blocked
select throws_ok(
  $$ delete from public.officials where bioguide_id = 'X000001' $$,
  '42501', null,
  'anon cannot DELETE'
);

reset role;

-- 12. service_role can INSERT (admin context)
set local role service_role;
select lives_ok(
  $$ insert into public.officials (bioguide_id, first_name, last_name, full_name,
       chamber, party, state, district_id, senate_class, source_version)
     values ('X000003','Z','Z','Z','senate','I','VT',
       '11111111-1111-1111-1111-111111111111', 1, '119') $$,
  'service_role can INSERT'
);
reset role;
```

- [ ] **Step 2: Run test to verify failures**

Run: `pnpm db:reset && pnpm db:test`
Expected: assertions 15–20 fail (RLS not yet enabled).

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0010_officials_rls.sql`:

```sql
-- Slice 3: officials are public-read; only service_role writes (via seed ingest).
-- See spec § Schema migrations → 0010_officials_rls.sql

alter table public.officials enable row level security;

create policy officials_select_all
  on public.officials
  for select
  using (true);
-- No insert/update/delete policies → only service_role bypasses RLS to write.
```

- [ ] **Step 4: Run pgTAP to verify pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: `officials_rls.test.sql` → 20/20 green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0010_officials_rls.sql \
        packages/db/supabase/tests/officials_rls.test.sql
git commit -m "feat(db): 0010 officials RLS — public-read, service-role-write"
```

---

## Task 3: Migration `0011_user_locations_geojson_view.sql` — View (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0011_user_locations_geojson_view.sql`
- Create: `packages/db/supabase/tests/user_locations_geojson.test.sql`

**Reading required:** spec § "Schema migrations → `0011_user_locations_geojson_view.sql`".

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/user_locations_geojson.test.sql`:

```sql
begin;

select plan(5);

-- 1. View exists
select has_view('public', 'user_locations_geojson', 'view exists');

-- 2. View has expected columns
select has_column('public', 'user_locations_geojson', 'home_location_geojson',
                  'home_location_geojson column present');
select col_type_is('public', 'user_locations_geojson', 'home_location_geojson', 'jsonb',
                   'home_location_geojson is jsonb');

-- 3. View inherits RLS via security_invoker
-- Seed: two users, each with their own user_locations row.
insert into auth.users (id, email)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test'),
         ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test');

insert into public.user_locations (user_id, home_address_text, home_location, geocodio_response)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1 A St',
          st_geogfromtext('POINT(-120 35)')::geography, '{}'::jsonb),
         ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2 B St',
          st_geogfromtext('POINT(-121 36)')::geography, '{}'::jsonb);

-- 4. User A sees only their own row through the view
set local role authenticated;
set local "request.jwt.claim.sub" to 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.user_locations_geojson),
  1::bigint,
  'authenticated user A sees only own row'
);

-- 5. anon sees nothing
reset role;
set local role anon;
select is(
  (select count(*) from public.user_locations_geojson),
  0::bigint,
  'anon sees nothing'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:reset && pnpm db:test`
Expected: view-does-not-exist failures.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0011_user_locations_geojson_view.sql`:

```sql
-- Slice 3: user_locations_geojson view mirrors districts_geojson (migration 0007).
-- security_invoker = true → view inherits caller's RLS on user_locations (self-only).
-- See spec § Schema migrations → 0011_user_locations_geojson_view.sql

create or replace view public.user_locations_geojson
  with (security_invoker = true) as
select
  user_id,
  home_address_text,
  st_asgeojson(home_location::geometry)::jsonb as home_location_geojson,
  created_at,
  updated_at
from public.user_locations;

grant select on public.user_locations_geojson to authenticated;
```

- [ ] **Step 4: Run pgTAP to verify pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: `user_locations_geojson.test.sql` → 5/5 green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0011_user_locations_geojson_view.sql \
        packages/db/supabase/tests/user_locations_geojson.test.sql
git commit -m "feat(db): 0011 user_locations_geojson view (mirrors districts_geojson)"
```

---

## Task 4: Migration `0012_push_tokens.sql` — Schema + RLS (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0012_push_tokens.sql`
- Create: `packages/db/supabase/tests/push_tokens_rls.test.sql`

**Reading required:** spec § "Schema migrations → `0012_push_tokens.sql`".

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/push_tokens_rls.test.sql`:

```sql
begin;

select plan(10);

select has_enum('public', 'push_platform', 'push_platform enum exists');
select enum_has_labels(
  'public', 'push_platform',
  array['ios','android','web']::text[],
  'push_platform labels correct'
);
select has_table('public', 'push_tokens', 'push_tokens table exists');
select col_is_pk('public', 'push_tokens', array['user_id','token'],
                  'composite PK (user_id, token)');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  'push_tokens has RLS enabled'
);

-- Seed two users
insert into auth.users (id, email)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@test'),
         ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'd@test');

-- User C inserts their own token
set local role authenticated;
set local "request.jwt.claim.sub" to 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select lives_ok(
  $$ insert into public.push_tokens (user_id, token, platform)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'expoTokenC', 'ios') $$,
  'user C can INSERT own token'
);

-- User C cannot INSERT for user D
select throws_ok(
  $$ insert into public.push_tokens (user_id, token, platform)
     values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'expoTokenForD', 'android') $$,
  '42501', null,
  'user C cannot INSERT token for user D'
);

-- User C sees only their own row
select is(
  (select count(*) from public.push_tokens),
  1::bigint,
  'user C sees only own tokens'
);

-- User C deletes own token
select lives_ok(
  $$ delete from public.push_tokens
     where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and token = 'expoTokenC' $$,
  'user C can DELETE own token'
);

reset role;

-- anon sees nothing
set local role anon;
select is(
  (select count(*) from public.push_tokens),
  0::bigint,
  'anon sees no push_tokens'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify failures**

Run: `pnpm db:reset && pnpm db:test`
Expected: push_tokens table/enum not yet defined.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0012_push_tokens.sql`:

```sql
-- Slice 3: push tokens table for future vote-alert notifications.
-- Self-only RLS: each user manages their own tokens.
-- See spec § Schema migrations → 0012_push_tokens.sql

create type public.push_platform as enum ('ios','android','web');

create table public.push_tokens (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  token      text        not null,
  platform   public.push_platform not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy push_tokens_select_self
  on public.push_tokens
  for select
  using (auth.uid() = user_id);

create policy push_tokens_upsert_self
  on public.push_tokens
  for insert
  with check (auth.uid() = user_id);

create policy push_tokens_delete_self
  on public.push_tokens
  for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 4: Run pgTAP to verify pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: `push_tokens_rls.test.sql` → 10/10 green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0012_push_tokens.sql \
        packages/db/supabase/tests/push_tokens_rls.test.sql
git commit -m "feat(db): 0012 push_tokens table with self-only RLS"
```

---

## Task 5: Migration `0013_officials_ingest_runs.sql` — Audit Table (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0013_officials_ingest_runs.sql`
- Create: `packages/db/supabase/tests/officials_ingest_runs_rls.test.sql`

**Reading required:** spec § "Schema migrations → `0013_officials_ingest_runs.sql`".

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/officials_ingest_runs_rls.test.sql`:

```sql
begin;

select plan(7);

select has_table('public', 'officials_ingest_runs', 'audit table exists');
select has_column('public', 'officials_ingest_runs', 'status', 'status column present');
select col_has_check('public', 'officials_ingest_runs', 'status',
                     'status has check constraint');
select has_index('public', 'officials_ingest_runs', 'officials_ingest_runs_started_idx',
                  'started_at index exists');
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.officials_ingest_runs'::regclass),
  'officials_ingest_runs has RLS enabled'
);

-- Service role can insert
set local role service_role;
select lives_ok(
  $$ insert into public.officials_ingest_runs (congress, source, status)
     values ('119', 'congress.gov.v3', 'completed') $$,
  'service_role can INSERT into audit table'
);
reset role;

-- anon sees nothing (no policies → RLS denies all to non-service-role)
set local role anon;
select is(
  (select count(*) from public.officials_ingest_runs),
  0::bigint,
  'anon sees zero rows (no select policy)'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify failures**

Run: `pnpm db:reset && pnpm db:test`
Expected: table missing.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0013_officials_ingest_runs.sql`:

```sql
-- Slice 3: per-run audit trail for officials ingest (Decisions #13).
-- Service-role-only — no client read/write access.
-- See spec § Schema migrations → 0013_officials_ingest_runs.sql

create table public.officials_ingest_runs (
  id                 uuid        primary key default gen_random_uuid(),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  congress           text        not null,
  source             text        not null,
  fetched_count      int,
  ingested_count     int,
  deactivated_count  int,
  status             text        not null
                       check (status in ('in_progress','completed','failed','aborted')),
  error              text,
  flags              text[],
  notes              text
);

create index officials_ingest_runs_started_idx
  on public.officials_ingest_runs(started_at desc);

alter table public.officials_ingest_runs enable row level security;
-- No policies → only service_role bypasses RLS.
```

- [ ] **Step 4: Run pgTAP to verify pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: `officials_ingest_runs_rls.test.sql` → 7/7 green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0013_officials_ingest_runs.sql \
        packages/db/supabase/tests/officials_ingest_runs_rls.test.sql
git commit -m "feat(db): 0013 officials_ingest_runs audit table (service-role only)"
```

---

## Task 6: Regenerate `Database` Type

**Files:**
- Modify: `packages/db/src/types.ts` (regenerated)

- [ ] **Step 1: Regenerate types**

Run: `pnpm db:gen-types`
Expected: `packages/db/src/types.ts` updated with `officials`, `push_tokens`, `officials_ingest_runs`, and `user_locations_geojson` view.

- [ ] **Step 2: Verify presence of new entities**

Run:
```bash
grep -c "officials:" packages/db/src/types.ts
grep -c "push_tokens:" packages/db/src/types.ts
grep -c "officials_ingest_runs:" packages/db/src/types.ts
grep -c "user_locations_geojson:" packages/db/src/types.ts
```
Expected: each `>= 1`.

- [ ] **Step 3: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: clean (the new types are additive — existing packages don't reference them yet).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for slice 3 entities"
```

---

## Task 7: `packages/ui-tokens` — Skeleton + Colors + Party Palette

**Files:**
- Create: `packages/ui-tokens/package.json`
- Create: `packages/ui-tokens/tsconfig.json`
- Create: `packages/ui-tokens/src/index.ts`
- Create: `packages/ui-tokens/src/colors.ts`
- Create: `packages/ui-tokens/src/party.ts`

**Reading required:** spec § Decisions #12 + § "UI surfaces — Shared atomic components".

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@chiaro/ui-tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.4.0" }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create colors.ts**

Create `packages/ui-tokens/src/colors.ts`:

```ts
// Brand colors lifted from existing inline hex values in slice 1/2 components.
// Migrating call sites is slice 3.5 cleanup; the constants live here.

export const COLORS = {
  brand: {
    primary: '#5b6cff',
    accent: '#1f9b88',
    text: '#1a1714',
  },
  neutral: {
    background: '#ffffff',
    surface: '#f7f6f4',
    border: '#e6e3df',
    mute: '#807a72',
  },
  signal: {
    error: '#c5364a',
    warning: '#d68a1f',
    success: '#1f9b88',
  },
} as const

export type BrandColor = typeof COLORS
```

- [ ] **Step 4: Create party.ts**

Create `packages/ui-tokens/src/party.ts`:

```ts
// Party palette + display labels. Used by PartyBadge in both web and mobile.
// Values match the party check constraint in 0009_officials.sql.

export type PartyCode = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export const PARTY_COLOR: Record<PartyCode, string> = {
  D:  '#3b6ed1',   // Democratic blue
  R:  '#d13b3b',   // Republican red
  I:  '#7d57c1',   // Independent purple
  L:  '#f7c63d',   // Libertarian gold
  G:  '#3da75b',   // Green
  ID: '#7d57c1',   // Independent (alt encoding)
}

export const PARTY_LABEL: Record<PartyCode, string> = {
  D:  'Democratic',
  R:  'Republican',
  I:  'Independent',
  L:  'Libertarian',
  G:  'Green',
  ID: 'Independent',
}

export const PARTY_SHORT: Record<PartyCode, string> = {
  D: 'D', R: 'R', I: 'I', L: 'L', G: 'G', ID: 'I',
}
```

- [ ] **Step 5: Create index.ts**

Create `packages/ui-tokens/src/index.ts`:

```ts
export { COLORS, type BrandColor } from './colors.ts'
export {
  type PartyCode,
  PARTY_COLOR,
  PARTY_LABEL,
  PARTY_SHORT,
} from './party.ts'
```

- [ ] **Step 6: Install + typecheck**

Run: `pnpm install`
Expected: workspace picks up new package; no errors.

Run: `pnpm --filter @chiaro/ui-tokens typecheck`
Expected: clean.

Run: `pnpm -r typecheck`
Expected: 7/7 packages clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-tokens/ pnpm-lock.yaml
git commit -m "feat(ui-tokens): add @chiaro/ui-tokens with brand + party palette"
```

---

## Task 8: `packages/officials` — Skeleton + Types

**Files:**
- Create: `packages/officials/package.json`
- Create: `packages/officials/tsconfig.json`
- Create: `packages/officials/vitest.config.ts`
- Create: `packages/officials/src/index.ts`
- Create: `packages/officials/src/types.ts`

**Reading required:** spec § "Architecture → Monorepo additions" + § "Data-fetching layer".

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@chiaro/officials",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "@supabase/supabase-js": "^2.105.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@tanstack/react-query": "^5.59.0",
    "@types/react": "^19.0.0",
    "react": "^19.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    testTimeout: 15_000,
  },
})
```

- [ ] **Step 4: Create types.ts**

Create `packages/officials/src/types.ts`:

```ts
import type { Database } from '@chiaro/db'

export type OfficialRow = Database['public']['Tables']['officials']['Row']
export type Chamber = OfficialRow['chamber']
export type Party = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export interface OfficialWithDistrict extends OfficialRow {
  district: {
    id: string
    tier: Database['public']['Tables']['districts']['Row']['tier']
    state: string
    code: string
    name: string
  }
}
```

> **Why no `NormalizedMember` here?** The Congress.gov-specific normalized shape lives in the seed pipeline (`packages/db/supabase/seed/normalize.ts`, Task 9) — that's where it's produced and consumed. Putting it in `@chiaro/officials` would create a workspace dependency cycle (officials → db → officials) which Turborepo refuses.

- [ ] **Step 5: Create empty index.ts**

Create `packages/officials/src/index.ts`:

```ts
export type {
  OfficialRow,
  OfficialWithDistrict,
  Chamber,
  Party,
} from './types.ts'
```

- [ ] **Step 6: Install + typecheck**

Run: `pnpm install`
Run: `pnpm --filter @chiaro/officials typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/officials/ pnpm-lock.yaml
git commit -m "feat(officials): add @chiaro/officials package skeleton + shared types"
```

---

## Task 9: Seed-side Normalize + Zod Schema

**Files:**
- Create: `packages/db/supabase/seed/normalize.ts`
- Create: `packages/db/supabase/seed/normalize.test.ts`

> **Where this lives, and why:** the spec § Architecture diagram placed `schemas.ts` under `packages/officials/`, but doing so would force `packages/db` (which contains the seed scripts that use the normalize fn) to depend on `@chiaro/officials`, while `@chiaro/officials` already depends on `@chiaro/db` for `Database`. That's a workspace cycle Turborepo refuses to build. The normalize layer is Congress.gov-API-specific and seed-only — `@chiaro/officials` doesn't need it. So it lives here in seed/. The spec's diagram is updated retroactively to reflect this (see also Task 8's `NormalizedMember` note).

**Reading required:** spec § "Ingest pipeline → NormalizedMember shape".

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CongressGovMemberSchema, normalizeMember } from './normalize.ts'

describe('CongressGovMemberSchema', () => {
  it('parses a senator response', () => {
    const raw = {
      bioguideId: 'F000062',
      firstName: 'Dianne',
      lastName: 'Feinstein',
      directOrderName: 'Dianne Feinstein',
      partyName: 'Democratic',
      state: 'California',
      stateCode: 'CA',
      chamber: 'Senate',
      terms: { item: [{ chamber: 'Senate', startYear: 2017, endYear: 2023 }] },
      district: null,
      senateClass: 1,
      officialWebsiteUrl: 'https://www.feinstein.senate.gov',
      nextElection: null,
    }
    const parsed = CongressGovMemberSchema.parse(raw)
    expect(parsed.bioguideId).toBe('F000062')
  })

  it('rejects bad shape', () => {
    expect(() => CongressGovMemberSchema.parse({ bioguideId: 123 })).toThrow()
  })
})

describe('normalizeMember', () => {
  it('normalizes a house member', () => {
    const raw = {
      bioguideId: 'P000197',
      firstName: 'Nancy',
      lastName: 'Pelosi',
      directOrderName: 'Nancy Pelosi',
      partyName: 'Democratic',
      state: 'California',
      stateCode: 'CA',
      chamber: 'House of Representatives',
      district: 11,
      senateClass: null,
      terms: { item: [{ chamber: 'House of Representatives', startYear: 2023, endYear: 2025 }] },
      officialWebsiteUrl: 'https://pelosi.house.gov',
      nextElection: '2026-11-03',
    }
    const member = normalizeMember(raw)
    expect(member.chamber).toBe('house')
    expect(member.party).toBe('D')
    expect(member.state).toBe('CA')
    expect(member.districtNumber).toBe(11)
    expect(member.senateClass).toBeNull()
    expect(member.portraitUrl).toBe(
      'https://bioguide.congress.gov/bioguide/photo/P/P000197.jpg',
    )
  })

  it('maps senator with class', () => {
    const raw = {
      bioguideId: 'S000033',
      firstName: 'Bernard',
      lastName: 'Sanders',
      directOrderName: 'Bernard Sanders',
      partyName: 'Independent',
      state: 'Vermont',
      stateCode: 'VT',
      chamber: 'Senate',
      district: null,
      senateClass: 1,
      terms: { item: [] },
      officialWebsiteUrl: 'https://www.sanders.senate.gov',
      nextElection: null,
    }
    const member = normalizeMember(raw)
    expect(member.chamber).toBe('senate')
    expect(member.party).toBe('I')
    expect(member.senateClass).toBe(1)
    expect(member.districtNumber).toBeNull()
  })

  it('handles at-large house seat', () => {
    const raw = {
      bioguideId: 'P000123',
      firstName: 'X',
      lastName: 'Y',
      directOrderName: 'X Y',
      partyName: 'Republican',
      state: 'Wyoming',
      stateCode: 'WY',
      chamber: 'House of Representatives',
      district: 0,  // Congress.gov encodes at-large as 0 (verify at impl time)
      senateClass: null,
      terms: { item: [] },
      officialWebsiteUrl: null,
      nextElection: null,
    }
    const member = normalizeMember(raw)
    expect(member.districtNumber).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm --filter @chiaro/db test supabase/seed/normalize.test.ts`
Expected: "normalize.ts not found" or "CongressGovMemberSchema is undefined". (Task 13 sets up the vitest config in @chiaro/db; if that hasn't run yet, add a minimal `vitest.config.ts` from Task 13 Step 2 now.)

- [ ] **Step 3: Implement normalize.ts**

Create `packages/db/supabase/seed/normalize.ts`:

```ts
import { z } from 'zod'

export type Chamber = 'house' | 'senate'
export type Party = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export interface NormalizedMember {
  bioguideId: string
  firstName: string
  lastName: string
  fullName: string
  chamber: Chamber
  party: Party
  state: string                    // 2-letter
  districtNumber: number | null    // null for senators; 0 for at-large house
  senateClass: 1 | 2 | 3 | null    // null for house
  portraitUrl: string
  officialUrl: string | null
  nextElection: string | null      // YYYY-MM-DD
}

export const CongressGovMemberSchema = z.object({
  bioguideId: z.string().min(5),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  directOrderName: z.string().min(1),
  partyName: z.string(),
  state: z.string(),       // full state name
  stateCode: z.string().length(2),
  chamber: z.string(),     // "Senate" or "House of Representatives"
  district: z.number().nullable(),
  senateClass: z.number().nullable(),
  terms: z.object({
    item: z.array(z.object({
      chamber: z.string(),
      startYear: z.number(),
      endYear: z.number().nullable().optional(),
    })),
  }),
  officialWebsiteUrl: z.string().url().nullable(),
  nextElection: z.string().nullable(),
})

export type CongressGovMember = z.infer<typeof CongressGovMemberSchema>

const PARTY_MAP: Record<string, Party> = {
  Democratic: 'D',
  Republican: 'R',
  Independent: 'I',
  Libertarian: 'L',
  Green: 'G',
  // Falls through to ID for unknown — captured by the table check constraint
}

function mapParty(partyName: string): Party {
  return PARTY_MAP[partyName] ?? 'ID'
}

function buildPortraitUrl(bioguideId: string): string {
  const firstLetter = bioguideId[0].toUpperCase()
  return `https://bioguide.congress.gov/bioguide/photo/${firstLetter}/${bioguideId}.jpg`
}

function normalizeChamber(raw: string): 'house' | 'senate' {
  if (raw === 'Senate') return 'senate'
  if (raw === 'House of Representatives') return 'house'
  throw new Error(`Unexpected chamber: ${raw}`)
}

export function normalizeMember(raw: unknown): NormalizedMember {
  const m = CongressGovMemberSchema.parse(raw)
  const chamber = normalizeChamber(m.chamber)
  return {
    bioguideId: m.bioguideId,
    firstName: m.firstName,
    lastName: m.lastName,
    fullName: m.directOrderName,
    chamber,
    party: mapParty(m.partyName),
    state: m.stateCode,
    districtNumber: chamber === 'senate' ? null : (m.district ?? null),
    senateClass: chamber === 'senate'
      ? (m.senateClass === 1 || m.senateClass === 2 || m.senateClass === 3
          ? m.senateClass
          : null)
      : null,
    portraitUrl: buildPortraitUrl(m.bioguideId),
    officialUrl: m.officialWebsiteUrl ?? null,
    nextElection: m.nextElection ?? null,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @chiaro/db test supabase/seed/normalize.test.ts`
Expected: 4/4 green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/normalize.ts \
        packages/db/supabase/seed/normalize.test.ts
git commit -m "feat(seed): NormalizedMember + zod + normalizeMember for Congress.gov"
```

---

## Task 10: `packages/officials` — Query Keys + Tests

**Files:**
- Create: `packages/officials/src/keys.ts`
- Create: `packages/officials/test/keys.test.ts`
- Modify: `packages/officials/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/officials/test/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { officialsKeys } from '../src/keys.ts'

describe('officialsKeys', () => {
  it('exposes the all root', () => {
    expect(officialsKeys.all).toEqual(['officials'])
  })

  it('lists() is under all', () => {
    expect(officialsKeys.lists()).toEqual(['officials', 'list'])
  })

  it('myList is under lists', () => {
    expect(officialsKeys.myList()).toEqual(['officials', 'list', 'mine'])
  })

  it('detail(id) is under all', () => {
    expect(officialsKeys.detail('abc')).toEqual(['officials', 'detail', 'abc'])
  })

  it('keys are stable across invocations (referentially equal arrays would be invalidating)', () => {
    // Just ensures deep equality across calls; TanStack matches by value not reference.
    expect(officialsKeys.detail('abc')).toEqual(officialsKeys.detail('abc'))
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm --filter @chiaro/officials test`
Expected: import error.

- [ ] **Step 3: Implement keys.ts**

Create `packages/officials/src/keys.ts`:

```ts
// Hierarchical query keys for TanStack Query.
// Invalidate `officialsKeys.all` to clear everything;
// `officialsKeys.detail(id)` to surgically refresh one row after a mutation.

export const officialsKeys = {
  all: ['officials'] as const,
  lists: () => [...officialsKeys.all, 'list'] as const,
  myList: () => [...officialsKeys.lists(), 'mine'] as const,
  detail: (id: string) => [...officialsKeys.all, 'detail', id] as const,
} as const
```

- [ ] **Step 4: Re-export**

Append to `packages/officials/src/index.ts`:

```ts
export { officialsKeys } from './keys.ts'
```

- [ ] **Step 5: Tests pass**

Run: `pnpm --filter @chiaro/officials test`
Expected: 9/9 green (4 schemas + 5 keys).

- [ ] **Step 6: Commit**

```bash
git add packages/officials/src/keys.ts \
        packages/officials/src/index.ts \
        packages/officials/test/keys.test.ts
git commit -m "feat(officials): hierarchical TanStack Query key factory"
```

---

## Task 11: `packages/officials` — Raw Fetchers + Integration Tests

**Files:**
- Create: `packages/officials/src/queries.ts`
- Create: `packages/officials/test/queries.integration.test.ts`
- Modify: `packages/officials/src/index.ts`

**Reading required:** spec § "Data-fetching layer (`packages/officials`)".

- [ ] **Step 1: Write integration test**

Create `packages/officials/test/queries.integration.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'
import { fetchMyOfficials, fetchOfficial } from '../src/queries.ts'

// Local-Supabase integration tests. Requires `pnpm db:reset` (or fresh state).
// Uses the service_role key to seed data, then a regular anon client to read.

const URL  = 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY!
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

let svc: SupabaseClient<Database>
let anon: SupabaseClient<Database>
let testUserId: string
let districtSenateCA: string
let districtHouseCA12: string

beforeAll(async () => {
  svc  = createClient<Database>(URL, SVC)
  anon = createClient<Database>(URL, ANON)

  // Seed two districts
  const { data: dCA1, error: e1 } = await svc.from('districts').insert({
    tier: 'federal_senate',
    state: 'CA',
    code: 'federal_senate:CA',
    name: 'California (Senate)',
    geometry: 'POLYGON((-120 35, -119 35, -119 36, -120 36, -120 35))',
    source_version: 'FX',
  }).select().single()
  expect(e1).toBeNull()
  districtSenateCA = dCA1!.id

  const { data: dCA2, error: e2 } = await svc.from('districts').insert({
    tier: 'federal_house',
    state: 'CA',
    code: 'federal_house:CA:12',
    name: 'California 12th',
    geometry: 'POLYGON((-122.5 37.5, -122 37.5, -122 38, -122.5 38, -122.5 37.5))',
    source_version: 'FX',
  }).select().single()
  expect(e2).toBeNull()
  districtHouseCA12 = dCA2!.id

  // Seed 3 officials: 2 senators (same district) + 1 house rep
  await svc.from('officials').insert([
    { bioguide_id: 'P000197', first_name: 'Nancy', last_name: 'Pelosi',
      full_name: 'Nancy Pelosi', chamber: 'house', party: 'D', state: 'CA',
      district_id: districtHouseCA12, senate_class: null, source_version: '119' },
    { bioguide_id: 'F000062', first_name: 'Dianne', last_name: 'Feinstein',
      full_name: 'Dianne Feinstein', chamber: 'senate', party: 'D', state: 'CA',
      district_id: districtSenateCA, senate_class: 1, source_version: '119' },
    { bioguide_id: 'P000145', first_name: 'Alex', last_name: 'Padilla',
      full_name: 'Alex Padilla', chamber: 'senate', party: 'D', state: 'CA',
      district_id: districtSenateCA, senate_class: 3, source_version: '119' },
  ])

  // Seed a test user with both districts linked
  const { data: u, error: ue } = await svc.auth.admin.createUser({
    email: 'integration@test', email_confirm: true, password: 'test1234',
  })
  expect(ue).toBeNull()
  testUserId = u.user!.id

  await svc.from('user_districts').insert([
    { user_id: testUserId, district_id: districtSenateCA },
    { user_id: testUserId, district_id: districtHouseCA12 },
  ])

  // Sign in as that user on the anon client
  const { error: se } = await anon.auth.signInWithPassword({
    email: 'integration@test', password: 'test1234',
  })
  expect(se).toBeNull()
})

afterAll(async () => {
  if (svc) {
    await svc.from('officials').delete().in('bioguide_id', ['P000197','F000062','P000145'])
    await svc.from('user_districts').delete().eq('user_id', testUserId)
    await svc.from('districts').delete().in('id', [districtSenateCA, districtHouseCA12])
    await svc.auth.admin.deleteUser(testUserId)
  }
})

describe('fetchMyOfficials', () => {
  it('returns the 3 officials joined via user_districts', async () => {
    const officials = await fetchMyOfficials(anon)
    expect(officials).toHaveLength(3)
    const ids = officials.map((o) => o.bioguide_id).sort()
    expect(ids).toEqual(['F000062', 'P000145', 'P000197'])
  })

  it('includes district join', async () => {
    const officials = await fetchMyOfficials(anon)
    const pelosi = officials.find((o) => o.bioguide_id === 'P000197')!
    expect(pelosi.district.code).toBe('federal_house:CA:12')
  })
})

describe('fetchOfficial', () => {
  it('returns one official with district', async () => {
    const officials = await fetchMyOfficials(anon)
    const target = officials.find((o) => o.bioguide_id === 'P000145')!
    const detail = await fetchOfficial(anon, target.id)
    expect(detail.bioguide_id).toBe('P000145')
    expect(detail.district.tier).toBe('federal_senate')
  })

  it('throws on unknown id', async () => {
    await expect(
      fetchOfficial(anon, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm db:reset && pnpm --filter @chiaro/officials test`
Expected: import error — `fetchMyOfficials` not defined.

- [ ] **Step 3: Implement queries.ts**

Create `packages/officials/src/queries.ts`:

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { OfficialWithDistrict } from './types.ts'

const SELECT_WITH_DISTRICT =
  '*, district:districts!officials_district_id_fkey(id,tier,state,code,name)'

export async function fetchMyOfficials(
  client: ChiaroClient,
): Promise<OfficialWithDistrict[]> {
  // Resolve user's auth.uid() server-side via RLS-aware join through user_districts.
  const { data: { user } } = await client.auth.getUser()
  if (!user) return []

  const { data: districtIds, error: dErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', user.id)
  if (dErr) throw dErr
  if (!districtIds || districtIds.length === 0) return []

  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT)
    .eq('in_office', true)
    .in('district_id', districtIds.map((d) => d.district_id))
    .order('chamber', { ascending: true })
    .order('last_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as OfficialWithDistrict[]
}

export async function fetchOfficial(
  client: ChiaroClient,
  id: string,
): Promise<OfficialWithDistrict> {
  const { data, error } = await client
    .from('officials')
    .select(SELECT_WITH_DISTRICT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as OfficialWithDistrict
}
```

- [ ] **Step 4: Re-export**

Append to `packages/officials/src/index.ts`:

```ts
export { fetchMyOfficials, fetchOfficial } from './queries.ts'
```

- [ ] **Step 5: Source env + run tests**

```bash
export SUPABASE_ANON_KEY=$(supabase status --output json | jq -r .ANON_KEY)
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status --output json | jq -r .SERVICE_ROLE_KEY)
pnpm --filter @chiaro/officials test
```
Expected: 4 integration tests pass + 9 unit tests pass → 13/13 green.

- [ ] **Step 6: Commit**

```bash
git add packages/officials/src/queries.ts \
        packages/officials/src/index.ts \
        packages/officials/test/queries.integration.test.ts
git commit -m "feat(officials): fetchMyOfficials + fetchOfficial with integration tests"
```

---

## Task 12: `packages/officials` — TanStack Hooks

**Files:**
- Create: `packages/officials/src/hooks.ts`
- Create: `packages/officials/test/hooks.test.tsx`
- Modify: `packages/officials/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/officials/test/hooks.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { useMyOfficials, useOfficial } from '../src/hooks.ts'
import * as queries from '../src/queries.ts'

function wrapper(client: QueryClient) {
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useMyOfficials', () => {
  it('returns data via fetchMyOfficials', async () => {
    const stub = [{ id: '1', bioguide_id: 'P000197', district: { id: 'd1' } }] as any
    const spy = vi.spyOn(queries, 'fetchMyOfficials').mockResolvedValue(stub)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const fakeClient = {} as ChiaroClient
    const { result } = renderHook(() => useMyOfficials(fakeClient), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stub)
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('useOfficial', () => {
  it('returns data via fetchOfficial', async () => {
    const stub = { id: 'a', bioguide_id: 'F000062', district: { id: 'd2' } } as any
    vi.spyOn(queries, 'fetchOfficial').mockResolvedValue(stub)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useOfficial({} as ChiaroClient, 'a'), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stub)
  })
})
```

- [ ] **Step 2: Add test dependencies**

Edit `packages/officials/package.json`, append to `devDependencies`:

```json
"@testing-library/react": "^16.0.0",
"@testing-library/dom": "^10.4.0",
"jsdom": "^25.0.0"
```

Run: `pnpm install`

- [ ] **Step 3: Run test to confirm failure**

Run: `pnpm --filter @chiaro/officials test test/hooks.test.tsx`
Expected: import error — `useMyOfficials` not defined.

- [ ] **Step 4: Implement hooks.ts**

Create `packages/officials/src/hooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { officialsKeys } from './keys.ts'
import { fetchMyOfficials, fetchOfficial } from './queries.ts'

const FIVE_MIN  = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useMyOfficials(client: ChiaroClient) {
  return useQuery({
    queryKey: officialsKeys.myList(),
    queryFn: () => fetchMyOfficials(client),
    staleTime: FIVE_MIN,
    gcTime:    THIRTY_MIN,
  })
}

export function useOfficial(client: ChiaroClient, id: string) {
  return useQuery({
    queryKey: officialsKeys.detail(id),
    queryFn: () => fetchOfficial(client, id),
    staleTime: FIVE_MIN,
    gcTime:    THIRTY_MIN,
    enabled: !!id,
  })
}
```

- [ ] **Step 5: Re-export**

Append to `packages/officials/src/index.ts`:

```ts
export { useMyOfficials, useOfficial } from './hooks.ts'
```

- [ ] **Step 6: All tests pass**

Run: `pnpm --filter @chiaro/officials test`
Expected: 15/15 green (4 schemas + 5 keys + 4 queries integration + 2 hooks).

- [ ] **Step 7: Commit**

```bash
git add packages/officials/src/hooks.ts \
        packages/officials/src/index.ts \
        packages/officials/test/hooks.test.tsx \
        packages/officials/package.json \
        pnpm-lock.yaml
git commit -m "feat(officials): useMyOfficials + useOfficial TanStack Query hooks"
```

---

## Task 13: Congress.gov Adapter (`congress-gov.ts`) + Tests

**Files:**
- Create: `packages/db/supabase/seed/congress-gov.ts`
- Create: `packages/db/supabase/seed/congress-gov.test.ts`
- Create: `packages/db/supabase/seed/fixtures/congress-gov-house-119.json` (small fixture — 5 records suffices for adapter tests)
- Modify: `packages/db/package.json` (add zod, vitest dev deps — do NOT add @chiaro/officials, see Task 9 note)
- Create: `packages/db/vitest.config.ts`

**Reading required:** spec § "Ingest pipeline → Source: Congress.gov v3 + Adapter pattern".

- [ ] **Step 1: Add test dependencies to packages/db**

Edit `packages/db/package.json` — add to dependencies + devDependencies:

```json
"dependencies": {
  ...existing,
  "zod": "^3.23.0"
},
"devDependencies": {
  ...existing,
  "vitest": "^2.0.0"
}
```

Add `"test": "vitest run"` to scripts.

> **Note: do NOT add `@chiaro/officials` here.** `packages/db` is the lower-level package; `@chiaro/officials` depends on `@chiaro/db` (for the `Database` type). Adding the reverse direction would create a workspace cycle that Turborepo refuses to build. Seed scripts that need the Congress.gov-specific normalize layer use the local `./normalize.ts` from Task 9.

- [ ] **Step 2: Create vitest config**

Create `packages/db/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/seed/**/*.test.ts'],
    testTimeout: 20_000,
  },
})
```

- [ ] **Step 3: Create the small fixture**

Create `packages/db/supabase/seed/fixtures/congress-gov-house-119.json`:

```json
{
  "members": [
    {
      "bioguideId": "P000197", "firstName": "Nancy", "lastName": "Pelosi",
      "directOrderName": "Nancy Pelosi", "partyName": "Democratic",
      "state": "California", "stateCode": "CA", "chamber": "House of Representatives",
      "district": 11, "senateClass": null,
      "terms": { "item": [{ "chamber": "House of Representatives", "startYear": 2023 }] },
      "officialWebsiteUrl": "https://pelosi.house.gov", "nextElection": "2026-11-03"
    },
    {
      "bioguideId": "S001234", "firstName": "Pat", "lastName": "Smith",
      "directOrderName": "Pat Smith", "partyName": "Republican",
      "state": "Texas", "stateCode": "TX", "chamber": "House of Representatives",
      "district": 5, "senateClass": null,
      "terms": { "item": [] },
      "officialWebsiteUrl": "https://smith.house.gov", "nextElection": "2026-11-03"
    }
  ],
  "pagination": { "next": null }
}
```

- [ ] **Step 4: Write the failing test**

Create `packages/db/supabase/seed/congress-gov.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchMembers } from './congress-gov.ts'

describe('fetchMembers', () => {
  it('paginates and normalizes house members', async () => {
    const fixture = await import('./fixtures/congress-gov-house-119.json', {
      with: { type: 'json' },
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(fixture.default), { status: 200 }),
    )

    const members = await fetchMembers('house', '119', 'TEST_KEY')
    expect(members).toHaveLength(2)
    expect(members[0].bioguideId).toBe('P000197')
    expect(members[0].chamber).toBe('house')
    expect(members[0].state).toBe('CA')

    // Verify auth header
    const calledUrl = fetchSpy.mock.calls[0]![0]
    const init     = fetchSpy.mock.calls[0]![1] as RequestInit
    expect(String(calledUrl)).toContain('api.congress.gov/v3/member')
    expect((init.headers as Record<string,string>)['X-API-Key']).toBe('TEST_KEY')
    fetchSpy.mockRestore()
  })

  it('continues fetching when pagination.next is non-null', async () => {
    const page1 = {
      members: [{ bioguideId: 'X000001', firstName:'A', lastName:'B',
        directOrderName:'A B', partyName:'Democratic', state:'CA', stateCode:'CA',
        chamber:'Senate', district:null, senateClass:1, terms:{item:[]},
        officialWebsiteUrl:null, nextElection:null }],
      pagination: { next: 'https://api.congress.gov/v3/member?offset=250&limit=250' },
    }
    const page2 = {
      members: [{ bioguideId: 'X000002', firstName:'C', lastName:'D',
        directOrderName:'C D', partyName:'Republican', state:'TX', stateCode:'TX',
        chamber:'Senate', district:null, senateClass:2, terms:{item:[]},
        officialWebsiteUrl:null, nextElection:null }],
      pagination: { next: null },
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))

    const members = await fetchMembers('senate', '119', 'TEST_KEY')
    expect(members).toHaveLength(2)
    expect(members.map((m) => m.bioguideId)).toEqual(['X000001','X000002'])
    fetchSpy.mockRestore()
  })

  it('throws on non-2xx', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    )
    await expect(fetchMembers('house', '119', 'BAD')).rejects.toThrow(/403/)
    fetchSpy.mockRestore()
  })
})
```

- [ ] **Step 5: Run failing test**

Run: `pnpm --filter @chiaro/db test`
Expected: `fetchMembers` not defined.

- [ ] **Step 6: Implement congress-gov.ts**

Create `packages/db/supabase/seed/congress-gov.ts`:

```ts
import { normalizeMember, type NormalizedMember } from './normalize.ts'

const API_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250

type RawPage = {
  members: unknown[]
  pagination: { next: string | null }
}

function buildUrl(chamber: 'house' | 'senate', congress: string): string {
  const chamberFilter = chamber === 'house' ? 'house' : 'senate'
  return `${API_BASE}/member?congress=${congress}&currentMember=true&chamber=${chamberFilter}&limit=${PAGE_SIZE}&offset=0`
}

async function fetchPage(url: string, apiKey: string): Promise<RawPage> {
  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Congress.gov ${res.status}: ${await res.text()}`)
  }
  return await res.json() as RawPage
}

export async function fetchMembers(
  chamber: 'house' | 'senate',
  congress: string,
  apiKey: string,
): Promise<NormalizedMember[]> {
  const out: NormalizedMember[] = []
  let url: string | null = buildUrl(chamber, congress)

  while (url) {
    const page: RawPage = await fetchPage(url, apiKey)
    for (const raw of page.members) {
      out.push(normalizeMember(raw))
    }
    url = page.pagination.next
  }

  return out
}
```

- [ ] **Step 7: Tests pass**

Run: `pnpm install && pnpm --filter @chiaro/db test`
Expected: 3/3 green.

- [ ] **Step 8: Commit**

```bash
git add packages/db/package.json packages/db/vitest.config.ts \
        packages/db/supabase/seed/congress-gov.ts \
        packages/db/supabase/seed/congress-gov.test.ts \
        packages/db/supabase/seed/fixtures/ \
        pnpm-lock.yaml
git commit -m "feat(seed): congress-gov adapter with paginated fetchMembers + tests"
```

---

## Task 14: `officials-config.ts` — Constants + At-Large Reconciliation

**Files:**
- Create: `packages/db/supabase/seed/officials-config.ts`

**Reading required:** spec § "Ingest pipeline → At-large house seats".

- [ ] **Step 1: Verify TIGER at-large convention**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "select state, code from public.districts
      where tier='federal_house' and state in ('AK','DE','MT','ND','SD','VT','WY')
      order by state;"
```
Expected: One row per at-large state with `code` ending in `:0` or `:1` or `:AL` — record the actual suffix in `OFFICIALS_AT_LARGE_DISTRICT_NUMBER` below.

- [ ] **Step 2: Write the config**

Create `packages/db/supabase/seed/officials-config.ts`:

```ts
// Slice 3 ingest constants. Updated per congress cycle.
// See spec § Decisions #13 + § Ingest pipeline.

export const OFFICIALS_CONGRESS = '119'
export const OFFICIALS_SOURCE = 'congress.gov.v3'

// Pre-flight sanity checks (spec Improvement 2).
// Refuse to proceed if fetched counts are absurdly low — almost
// certainly an API hiccup, not real turnover.
export const MIN_HOUSE_COUNT  = 400   // House has 435 voting + delegates
export const MIN_SENATE_COUNT = 95    // Senate has 100

// Threshold guard (spec Improvement 3).
// If toDeactivate > max(THRESHOLD_ABS, ceil(active * THRESHOLD_PCT)),
// require explicit --allow-deactivations=N CLI flag.
export const DEACTIVATE_THRESHOLD_ABS = 5
export const DEACTIVATE_THRESHOLD_PCT = 0.01  // 1% of currently-active

// At-large house seats: confirm TIGER's encoding via Step 1 above and
// set the matching value here. Default below assumes TIGER encodes
// as district 0 for at-large.
export const AT_LARGE_STATES = new Set(['AK','DE','MT','ND','SD','VT','WY'])
export const AT_LARGE_DISTRICT_NUMBER = 0

export const OFFICIALS_DB_URL =
  process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @chiaro/db typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/seed/officials-config.ts
git commit -m "feat(seed): officials-config with congress, thresholds, at-large convention"
```

---

## Task 15: `officials-ingest.ts` — Core Flow (Preflight + Transaction + Upsert)

**Files:**
- Create: `packages/db/supabase/seed/officials-ingest.ts` (initial — first 6 steps of spec § Ingest flow)

**Reading required:** spec § "Ingest pipeline → Ingest flow (defensive)" steps 1-6.

- [ ] **Step 1: Write the script skeleton**

Create `packages/db/supabase/seed/officials-ingest.ts`:

```ts
#!/usr/bin/env tsx
// Slice 3 officials ingest — defensive Congress.gov v3 pipeline.
// See spec § Ingest pipeline. Run via `pnpm seed:officials`.

import { Client } from 'pg'
import type { NormalizedMember } from './normalize.ts'
import { fetchMembers } from './congress-gov.ts'
import {
  OFFICIALS_CONGRESS,
  OFFICIALS_SOURCE,
  OFFICIALS_DB_URL,
  MIN_HOUSE_COUNT,
  MIN_SENATE_COUNT,
  AT_LARGE_STATES,
  AT_LARGE_DISTRICT_NUMBER,
  DEACTIVATE_THRESHOLD_ABS,
  DEACTIVATE_THRESHOLD_PCT,
} from './officials-config.ts'

export interface IngestArgs {
  apiKey:               string
  allowDeactivations?:  number      // explicit ack of expected deactivation count
  congress?:            string      // override OFFICIALS_CONGRESS (for tests)
  fetcher?:             typeof fetchMembers   // injection for tests
}

export interface IngestStats {
  runId:             string
  fetched:           number
  ingested:          number
  unresolved:        Array<{ bioguideId: string; reason: string }>
  deactivated:       number
  status:            'completed' | 'failed' | 'aborted'
  error?:            string
}

type DistrictKey  = string   // 'federal_house:CA:12' or 'federal_senate:CA'
type DistrictMap  = Map<DistrictKey, string>   // → district.id

// ---- helpers ----

function districtKey(member: NormalizedMember): DistrictKey | null {
  if (member.chamber === 'senate') {
    return `federal_senate:${member.state}`
  }
  if (AT_LARGE_STATES.has(member.state)) {
    return `federal_house:${member.state}:${AT_LARGE_DISTRICT_NUMBER}`
  }
  if (member.districtNumber === null) return null
  return `federal_house:${member.state}:${member.districtNumber}`
}

async function loadDistrictMap(client: Client): Promise<DistrictMap> {
  const rows = await client.query<{
    id: string; tier: string; state: string; code: string;
  }>(`select id, tier, state, code from public.districts
      where tier in ('federal_house','federal_senate')`)
  const map = new Map<DistrictKey, string>()
  for (const r of rows.rows) {
    if (r.tier === 'federal_senate') {
      map.set(`federal_senate:${r.state}`, r.id)
    } else if (r.tier === 'federal_house') {
      // r.code is e.g. 'federal_house:CA:12'
      map.set(r.code, r.id)
    }
  }
  return map
}

async function upsertOfficial(
  client: Client,
  member: NormalizedMember,
  districtId: string,
  congress: string,
): Promise<void> {
  await client.query(`
    insert into public.officials (
      bioguide_id, first_name, last_name, full_name, chamber, party, state,
      district_id, senate_class, portrait_url, official_url, twitter_handle,
      next_election, in_office, source_version
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14)
    on conflict (bioguide_id) do update set
      first_name     = excluded.first_name,
      last_name      = excluded.last_name,
      full_name      = excluded.full_name,
      chamber        = excluded.chamber,
      party          = excluded.party,
      state          = excluded.state,
      district_id    = excluded.district_id,
      senate_class   = excluded.senate_class,
      portrait_url   = excluded.portrait_url,
      official_url   = excluded.official_url,
      twitter_handle = excluded.twitter_handle,
      next_election  = excluded.next_election,
      in_office      = true,
      source_version = excluded.source_version
  `, [
    member.bioguideId, member.firstName, member.lastName, member.fullName,
    member.chamber, member.party, member.state, districtId, member.senateClass,
    member.portraitUrl, member.officialUrl, null, member.nextElection,
    congress,
  ])
}

// ---- main flow ----

export async function ingestOfficials(args: IngestArgs): Promise<IngestStats> {
  const congress = args.congress ?? OFFICIALS_CONGRESS
  const fetcher  = args.fetcher  ?? fetchMembers

  const client = new Client({ connectionString: OFFICIALS_DB_URL })
  await client.connect()

  // Step 1: open audit run (outside transaction so it persists on failure)
  const flags = args.allowDeactivations !== undefined
    ? [`--allow-deactivations=${args.allowDeactivations}`]
    : []
  const openRes = await client.query<{ id: string }>(`
    insert into public.officials_ingest_runs (congress, source, status, flags)
    values ($1,$2,'in_progress',$3) returning id
  `, [congress, OFFICIALS_SOURCE, flags])
  const runId = openRes.rows[0].id

  const stats: IngestStats = {
    runId, fetched: 0, ingested: 0, unresolved: [], deactivated: 0,
    status: 'completed',
  }

  try {
    // Step 2: fetch both chambers in parallel
    const [house, senate] = await Promise.all([
      fetcher('house',  congress, args.apiKey),
      fetcher('senate', congress, args.apiKey),
    ])
    stats.fetched = house.length + senate.length

    // Step 3: pre-flight sanity check (Improvement 2)
    if (house.length < MIN_HOUSE_COUNT) {
      throw new Error(`Pre-flight failed: house count ${house.length} < ${MIN_HOUSE_COUNT}`)
    }
    if (senate.length < MIN_SENATE_COUNT) {
      throw new Error(`Pre-flight failed: senate count ${senate.length} < ${MIN_SENATE_COUNT}`)
    }

    // Step 4: load district lookup
    const districts = await loadDistrictMap(client)

    // Step 5: BEGIN transaction
    await client.query('BEGIN')

    // Step 6: resolve + upsert
    const ingestedBioguideIds: string[] = []
    for (const member of [...house, ...senate]) {
      const key = districtKey(member)
      const districtId = key ? districts.get(key) : undefined
      if (!districtId) {
        stats.unresolved.push({
          bioguideId: member.bioguideId,
          reason: `district not found for key=${key ?? '<none>'}`,
        })
        continue
      }
      await upsertOfficial(client, member, districtId, congress)
      ingestedBioguideIds.push(member.bioguideId)
      stats.ingested++
    }

    // (Steps 7-11 in Task 16)
    await closeRun(client, runId, stats, 'completed')
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    stats.status = 'failed'
    stats.error = err instanceof Error ? err.message : String(err)
    await failRun(client, runId, stats.error).catch(() => {})
    throw err
  } finally {
    await client.end()
  }

  return stats
}

// ---- audit-row writers ----

async function closeRun(
  client: Client, runId: string, stats: IngestStats,
  status: 'completed' | 'aborted',
): Promise<void> {
  await client.query(`
    update public.officials_ingest_runs
      set status = $1, completed_at = now(),
          fetched_count = $2, ingested_count = $3, deactivated_count = $4
      where id = $5
  `, [status, stats.fetched, stats.ingested, stats.deactivated, runId])
}

async function failRun(
  client: Client, runId: string, error: string,
): Promise<void> {
  // Separate transaction — failRun must persist even after ROLLBACK.
  await client.query(`
    update public.officials_ingest_runs
      set status = 'failed', completed_at = now(), error = $1
      where id = $2
  `, [error.slice(0, 4000), runId])
}

// ---- CLI entry ----

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.CONGRESS_GOV_API_KEY
  if (!apiKey) {
    console.error('CONGRESS_GOV_API_KEY env var is required')
    process.exit(1)
  }
  const allowFlag = process.argv.find((a) => a.startsWith('--allow-deactivations='))
  const allowDeactivations = allowFlag
    ? Number(allowFlag.split('=')[1])
    : undefined

  ingestOfficials({ apiKey, allowDeactivations })
    .then((stats) => {
      console.log(JSON.stringify(stats, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('Ingest failed:', err)
      process.exit(2)
    })
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @chiaro/db typecheck`
Expected: clean.

- [ ] **Step 3: Commit (no tests yet — Task 17 adds them)**

```bash
git add packages/db/supabase/seed/officials-ingest.ts
git commit -m "feat(seed): officials-ingest core flow — preflight + transaction + upsert"
```

---

## Task 16: `officials-ingest.ts` — Safety Guards + Set-Based Deactivation

**Files:**
- Modify: `packages/db/supabase/seed/officials-ingest.ts` (steps 7-11 of spec § Ingest flow)

**Reading required:** spec § "Ingest pipeline → Ingest flow" steps 7-11 + § Decisions #13.

- [ ] **Step 1: Replace placeholder block with deactivation + threshold logic**

Edit `packages/db/supabase/seed/officials-ingest.ts` — find the comment `// (Steps 7-11 in Task 16)` and replace **just that comment line** with this block:

```ts
    // Step 7: compute deactivation set (Improvement 1)
    const toDeactRes = await client.query<{ count: string }>(`
      select count(*)::text as count from public.officials
        where in_office = true and bioguide_id != all($1::text[])
    `, [ingestedBioguideIds])
    const toDeactivate = Number(toDeactRes.rows[0].count)

    // Step 8: threshold guard (Improvement 3)
    const activeRes = await client.query<{ count: string }>(`
      select count(*)::text as count from public.officials where in_office = true
    `)
    const active = Number(activeRes.rows[0].count)
    const threshold = Math.max(
      DEACTIVATE_THRESHOLD_ABS,
      Math.ceil(active * DEACTIVATE_THRESHOLD_PCT),
    )

    if (toDeactivate > threshold &&
        args.allowDeactivations !== toDeactivate) {
      // ROLLBACK, mark aborted, surface the exact flag the operator must add
      throw new Error(
        `Refusing to deactivate ${toDeactivate} officials (threshold=${threshold}). ` +
        `If this is expected (e.g., congressional turnover), re-run with ` +
        `--allow-deactivations=${toDeactivate}`,
      )
    }

    // Step 9: set-based deactivation
    const deactRes = await client.query<{ id: string }>(`
      update public.officials
        set in_office = false
        where in_office = true
          and bioguide_id != all($1::text[])
        returning id
    `, [ingestedBioguideIds])
    stats.deactivated = deactRes.rowCount ?? 0
```

(The closing `await closeRun(...)` and `await client.query('COMMIT')` are already in place from Task 15.)

- [ ] **Step 2: Update error path for threshold-guard aborts**

In the `catch` block, distinguish "aborted by guard" from "failed by error". Edit:

```ts
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    const isAbort = /Pre-flight failed|Refusing to deactivate/.test(msg)
    stats.status = isAbort ? 'aborted' : 'failed'
    stats.error = msg
    if (isAbort) {
      await abortRun(client, runId, msg).catch(() => {})
    } else {
      await failRun(client, runId, msg).catch(() => {})
    }
    throw err
  } finally {
```

Add the `abortRun` helper next to `failRun`:

```ts
async function abortRun(
  client: Client, runId: string, error: string,
): Promise<void> {
  await client.query(`
    update public.officials_ingest_runs
      set status = 'aborted', completed_at = now(), error = $1
      where id = $2
  `, [error.slice(0, 4000), runId])
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @chiaro/db typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/seed/officials-ingest.ts
git commit -m "feat(seed): officials-ingest safety guards + set-based deactivation"
```

---

## Task 17: Integration Tests — 5 Scenarios

**Files:**
- Create: `packages/db/supabase/seed/officials-ingest.test.ts`
- Create: `packages/db/supabase/seed/fixtures/congress-gov-house-119-full.json` (e.g., 441 stub house members)
- Create: `packages/db/supabase/seed/fixtures/congress-gov-senate-119-full.json` (100 stub senators)
- Create: `packages/db/supabase/seed/fixtures/congress-gov-house-partial.json` (350 members — triggers pre-flight abort)
- Create: `packages/db/supabase/seed/fixtures/congress-gov-house-missing-50.json` (391 members — 50 from full set removed)
- Create: `packages/db/supabase/seed/fixtures/congress-gov-senate-without-one.json` (99 senators — 1 missing)

**Reading required:** spec § "Verification plan" (5 scenarios).

> **Note on fixture generation:** writing 441 fictional house members by hand is impractical. Generate fixtures programmatically inside a single beforeAll, then save to disk during a one-time setup step. The test file should both generate the JSON files (if absent) and consume them. The fixtures must satisfy the seed/district map — for each (state, district) used, the corresponding `districts` row must exist (TIGER seed creates these in setUp).

- [ ] **Step 1: Fixture generator + integration test**

Create `packages/db/supabase/seed/officials-ingest.test.ts`:

```ts
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestOfficials } from './officials-ingest.ts'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const FIX_DIR    = join(__dirname, 'fixtures')
const DB_URL     = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const TEST_STATES = ['CA','TX','NY','FL','WY']   // last is at-large

async function ensureFixtures() {
  await mkdir(FIX_DIR, { recursive: true })

  // Build "full" fixtures (101 senators, 441 house) inline so they live in code.
  // Each member is keyed by (state, districtNumber).
  const senateFull = TEST_STATES.flatMap((state, i) => [
    senatorRecord(`S${state}1`, state, 1, 'Democratic'),
    senatorRecord(`S${state}2`, state, 2, 'Republican'),
  ])
  // pad to >= MIN_SENATE_COUNT (95) by generating fake additional 90
  for (let i = 0; i < 90; i++) {
    senateFull.push(senatorRecord(`S0PAD${i.toString().padStart(3,'0')}`, 'CA', 3, 'Democratic'))
  }

  const houseFull = []
  // CA 1-15, TX 1-15, NY 1-15, FL 1-15, WY at-large (0)
  for (const state of ['CA','TX','NY','FL']) {
    for (let n = 1; n <= 15; n++) {
      houseFull.push(houseRecord(`H${state}${n}`, state, n, n % 2 ? 'Democratic' : 'Republican'))
    }
  }
  houseFull.push(houseRecord('HWY1', 'WY', 0, 'Republican'))

  // pad to ~440 — fill with fake CA seats
  for (let i = houseFull.length; i < 440; i++) {
    houseFull.push(houseRecord(`HPAD${i.toString().padStart(3,'0')}`, 'CA', 1, 'Democratic'))
  }

  await writeJson('congress-gov-house-119-full.json',   pageOf(houseFull))
  await writeJson('congress-gov-senate-119-full.json',  pageOf(senateFull))

  await writeJson('congress-gov-house-partial.json',
    pageOf(houseFull.slice(0, 350)))   // pre-flight abort: 350 < MIN_HOUSE_COUNT (400)

  await writeJson('congress-gov-house-missing-50.json',
    pageOf(houseFull.slice(50)))       // 50 fewer than full → 50 should deactivate

  await writeJson('congress-gov-senate-without-one.json',
    pageOf(senateFull.slice(1)))       // 99 instead of 100
}

function senatorRecord(bioguideId: string, stateCode: string, senateClass: 1|2|3, partyName: string) {
  return {
    bioguideId, firstName: 'F'+bioguideId, lastName: 'L'+bioguideId,
    directOrderName: 'F'+bioguideId+' L'+bioguideId,
    partyName, state: stateCode, stateCode, chamber: 'Senate',
    district: null, senateClass,
    terms: { item: [{ chamber: 'Senate', startYear: 2023 }] },
    officialWebsiteUrl: 'https://example.gov', nextElection: '2026-11-03',
  }
}

function houseRecord(bioguideId: string, stateCode: string, district: number, partyName: string) {
  return {
    bioguideId, firstName: 'F'+bioguideId, lastName: 'L'+bioguideId,
    directOrderName: 'F'+bioguideId+' L'+bioguideId,
    partyName, state: stateCode, stateCode, chamber: 'House of Representatives',
    district, senateClass: null,
    terms: { item: [{ chamber: 'House of Representatives', startYear: 2023 }] },
    officialWebsiteUrl: 'https://example.gov', nextElection: '2026-11-03',
  }
}

function pageOf(members: unknown[]) {
  return { members, pagination: { next: null } }
}

async function writeJson(name: string, body: unknown) {
  await writeFile(join(FIX_DIR, name), JSON.stringify(body, null, 2))
}

async function loadFixture(name: string): Promise<any> {
  return JSON.parse(await readFile(join(FIX_DIR, name), 'utf8'))
}

function fetcherFor(houseFile: string, senateFile: string) {
  return async (chamber: 'house'|'senate', _c: string, _k: string) => {
    const j = await loadFixture(chamber === 'house' ? houseFile : senateFile)
    const { normalizeMember } = await import('./normalize.ts')
    return j.members.map(normalizeMember)
  }
}

async function seedDistricts(client: Client) {
  // Seed all districts referenced by full fixtures.
  // Senate: one per TEST_STATE
  // House:  CA 1, TX 1..15, NY 1..15, FL 1..15, WY 0, plus padding "CA:1" already exists
  await client.query(`delete from public.officials`)
  await client.query(`delete from public.districts where source_version='FIX'`)

  for (const state of TEST_STATES) {
    await client.query(
      `insert into public.districts (tier,state,code,name,geometry,source_version)
       values ('federal_senate',$1,$2,$3,
         st_geogfromtext('POLYGON((-120 35, -119 35, -119 36, -120 36, -120 35))'),
         'FIX')
       on conflict (code) do nothing`,
      [state, `federal_senate:${state}`, `${state} Senate`],
    )
  }
  for (const state of ['CA','TX','NY','FL']) {
    for (let n = 1; n <= 15; n++) {
      await client.query(
        `insert into public.districts (tier,state,code,name,geometry,source_version)
         values ('federal_house',$1,$2,$3,
           st_geogfromtext('POLYGON((-120 35, -119 35, -119 36, -120 36, -120 35))'),
           'FIX')
         on conflict (code) do nothing`,
        [state, `federal_house:${state}:${n}`, `${state} ${n}th`],
      )
    }
  }
  // WY at-large
  await client.query(
    `insert into public.districts (tier,state,code,name,geometry,source_version)
     values ('federal_house','WY','federal_house:WY:0','Wyoming At-Large',
       st_geogfromtext('POLYGON((-120 35, -119 35, -119 36, -120 36, -120 35))'),
       'FIX')
     on conflict (code) do nothing`,
  )
}

beforeAll(async () => {
  await ensureFixtures()
})

let client: Client
beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await seedDistricts(client)
})
afterEach(async () => {
  await client.end()
})

describe('officials-ingest — happy path', () => {
  it('ingests ~541 members and writes a completed audit row', async () => {
    const stats = await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json',
                          'congress-gov-senate-119-full.json'),
    })
    expect(stats.status).toBe('completed')
    expect(stats.ingested).toBeGreaterThan(500)
    expect(stats.deactivated).toBe(0)
    const audit = await client.query(
      `select status, ingested_count from public.officials_ingest_runs where id=$1`,
      [stats.runId],
    )
    expect(audit.rows[0].status).toBe('completed')
  })
})

describe('officials-ingest — pre-flight abort (Improvement 2)', () => {
  it('aborts when house count < MIN_HOUSE_COUNT and does not touch officials', async () => {
    const before = await client.query(`select count(*)::text from public.officials`)
    await expect(ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-partial.json',
                          'congress-gov-senate-119-full.json'),
    })).rejects.toThrow(/Pre-flight/)
    const after = await client.query(`select count(*)::text from public.officials`)
    expect(after.rows[0].count).toBe(before.rows[0].count)

    const audit = await client.query(
      `select status from public.officials_ingest_runs
       where source='congress.gov.v3' order by started_at desc limit 1`,
    )
    expect(audit.rows[0].status).toBe('aborted')
  })
})

describe('officials-ingest — threshold guard (Improvement 3)', () => {
  it('first ingests full set then rolls back when --allow-deactivations missing', async () => {
    // First run: full set populates DB
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json',
                          'congress-gov-senate-119-full.json'),
    })

    // Second run: 50 fewer — should refuse without flag
    await expect(ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-missing-50.json',
                          'congress-gov-senate-119-full.json'),
    })).rejects.toThrow(/Refusing to deactivate.*--allow-deactivations/)

    const stillActive = await client.query(
      `select count(*)::text from public.officials where in_office=true`,
    )
    expect(Number(stillActive.rows[0].count)).toBeGreaterThan(500)
  })

  it('proceeds when --allow-deactivations matches', async () => {
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json',
                          'congress-gov-senate-119-full.json'),
    })
    const stats2 = await ingestOfficials({
      apiKey: 'FX',
      allowDeactivations: 50,
      fetcher: fetcherFor('congress-gov-house-missing-50.json',
                          'congress-gov-senate-119-full.json'),
    })
    expect(stats2.deactivated).toBe(50)
    expect(stats2.status).toBe('completed')
  })
})

describe('officials-ingest — within-congress departure (Improvement 1)', () => {
  it('deactivates a member absent from fetch, even if source_version matches', async () => {
    // Run with full set
    await ingestOfficials({
      apiKey: 'FX',
      fetcher: fetcherFor('congress-gov-house-119-full.json',
                          'congress-gov-senate-119-full.json'),
    })
    // Now run with the senate-without-one fixture
    const stats = await ingestOfficials({
      apiKey: 'FX',
      allowDeactivations: 1,
      fetcher: fetcherFor('congress-gov-house-119-full.json',
                          'congress-gov-senate-without-one.json'),
    })
    expect(stats.deactivated).toBe(1)
    const inactive = await client.query(
      `select count(*)::text from public.officials where in_office=false`,
    )
    expect(Number(inactive.rows[0].count)).toBe(1)
  })
})

describe('officials-ingest — transaction atomicity (Improvement 4)', () => {
  it('rolls back upsert if a later step throws', async () => {
    const broken = async (_c:'house'|'senate', _v:string, _k:string) => {
      // Throw mid-flow by returning a member with an unresolvable district.
      // To force a thrown error rather than just unresolved, return a normalized
      // record whose districtKey() returns a key that exists in our fixture seed,
      // then break the upsert: skip seedDistricts to make district missing.
      throw new Error('Simulated fetcher crash')
    }
    const before = await client.query(`select count(*)::text from public.officials`)
    await expect(ingestOfficials({ apiKey: 'FX', fetcher: broken })).rejects.toThrow(/Simulated/)
    const after = await client.query(`select count(*)::text from public.officials`)
    expect(after.rows[0].count).toBe(before.rows[0].count)
    const audit = await client.query(
      `select status, error from public.officials_ingest_runs
       where source='congress.gov.v3' order by started_at desc limit 1`,
    )
    expect(audit.rows[0].status).toBe('failed')
    expect(audit.rows[0].error).toContain('Simulated')
  })
})
```

- [ ] **Step 2: Reset DB before running**

Run: `pnpm db:reset`
Expected: existing migrations applied. (Slice 2's TIGER seed not run here — tests seed their own districts.)

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @chiaro/db test supabase/seed/officials-ingest.test.ts`
Expected: 6/6 green (happy path + 4 guard scenarios + atomicity).

- [ ] **Step 4: Run all db tests together**

Run: `pnpm --filter @chiaro/db test`
Expected: previous adapter tests (3) + ingest scenarios (6) = 9/9 green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/officials-ingest.test.ts \
        packages/db/supabase/seed/fixtures/
git commit -m "test(seed): 5 ingest scenarios covering safety guards"
```

---

## Task 18: Root Scripts + `.env.example` Updates

**Files:**
- Modify: `package.json` (root)
- Modify: `packages/db/package.json`
- Modify: `.env.example`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Add `seed:officials` to packages/db**

Edit `packages/db/package.json`, append to `scripts`:

```json
"db:seed-officials": "tsx supabase/seed/officials-ingest.ts"
```

- [ ] **Step 2: Add `seed:officials` to root package.json**

Edit `package.json`, append to `scripts`:

```json
"seed:officials": "pnpm --filter @chiaro/db db:seed-officials",
"seed:tiger": "pnpm --filter @chiaro/db db:seed-tiger"
```

(Keep `seed:tiger` mirrored from existing `db:seed-tiger` for symmetry.)

- [ ] **Step 3: Add env vars to root `.env.example`**

Append to `.env.example`:

```bash
# Congress.gov API key for officials ingest (slice 3).
# Free signup: https://api.data.gov/signup/
# Used by `pnpm seed:officials`. Server-side only — never exposed to clients.
CONGRESS_GOV_API_KEY=
```

- [ ] **Step 4: Add env vars to web `.env.example`**

Append to `apps/web/.env.example`:

```bash
# Slice 3: read-only on the client — server actions / API routes may use this
# only if we add a proxy endpoint later. Not exposed to the browser.
CONGRESS_GOV_API_KEY=
```

- [ ] **Step 5: Verify the script entry resolves**

Run: `pnpm seed:officials --help 2>&1 || true`
Expected: prints "CONGRESS_GOV_API_KEY env var is required" then exits 1. Confirms wiring.

- [ ] **Step 6: Commit**

```bash
git add package.json packages/db/package.json .env.example apps/web/.env.example
git commit -m "chore(slice-3): wire seed:officials script + env documentation"
```

---

## Task 19: `apps/web` — TanStack Query Provider Setup

**Files:**
- Modify: `apps/web/package.json` (add deps)
- Create: `apps/web/lib/query-client.tsx`
- Modify: `apps/web/app/layout.tsx`

**Reading required:** spec § "Per-app `QueryClientProvider` setup".

- [ ] **Step 1: Install deps**

Edit `apps/web/package.json` — add to `dependencies`:

```json
"@tanstack/react-query": "^5.59.0",
"@chiaro/officials": "workspace:*",
"@chiaro/ui-tokens": "workspace:*"
```

Add to `devDependencies`:

```json
"@tanstack/react-query-devtools": "^5.59.0"
```

Run: `pnpm install`

- [ ] **Step 2: Create query-client wrapper**

Create `apps/web/lib/query-client.tsx`:

```tsx
'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,         // 1 min default
        gcTime:    5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserClient: QueryClient | undefined

function getClient() {
  if (typeof window === 'undefined') return makeClient()       // SSR — new per request
  if (!browserClient) browserClient = makeClient()
  return browserClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(getClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 3: Wire into layout.tsx**

Edit `apps/web/app/layout.tsx` — wrap children:

```tsx
import { QueryProvider } from '@/lib/query-client'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

(Preserve any existing head/metadata logic — only add the QueryProvider wrapper inside body.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: clean.

- [ ] **Step 5: Smoke build**

Run: `pnpm --filter @chiaro/web build`
Expected: Next build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/lib/query-client.tsx apps/web/app/layout.tsx pnpm-lock.yaml
git commit -m "feat(web): add @tanstack/react-query provider in root layout"
```

---

## Task 20: `apps/web` — Shared Atomic Components

**Files:**
- Create: `apps/web/components/OfficialAvatar.tsx`
- Create: `apps/web/components/PartyBadge.tsx`
- Create: `apps/web/components/OfficialMeta.tsx`

- [ ] **Step 1: OfficialAvatar**

Create `apps/web/components/OfficialAvatar.tsx`:

```tsx
import { COLORS } from '@chiaro/ui-tokens'

interface Props {
  fullName: string
  portraitUrl?: string | null
  size?: number   // px
}

export function OfficialAvatar({ fullName, portraitUrl, size = 64 }: Props) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  if (portraitUrl) {
    return (
      <img
        src={portraitUrl}
        alt={fullName}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={fullName}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: COLORS.neutral.surface,
        color: COLORS.brand.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600, fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}
```

- [ ] **Step 2: PartyBadge**

Create `apps/web/components/PartyBadge.tsx`:

```tsx
import { PARTY_COLOR, PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'

interface Props { party: PartyCode }

export function PartyBadge({ party }: Props) {
  return (
    <span
      aria-label={PARTY_LABEL[party]}
      title={PARTY_LABEL[party]}
      style={{
        display: 'inline-block',
        background: PARTY_COLOR[party],
        color: '#fff',
        borderRadius: 12,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.4,
      }}
    >
      {PARTY_SHORT[party]}
    </span>
  )
}
```

- [ ] **Step 3: OfficialMeta**

Create `apps/web/components/OfficialMeta.tsx`:

```tsx
import type { OfficialWithDistrict } from '@chiaro/officials'

interface Props { official: OfficialWithDistrict }

export function OfficialMeta({ official }: Props) {
  const chamberLabel = official.chamber === 'house' ? 'House' : 'Senate'
  const districtSuffix = official.chamber === 'house'
    ? ` · ${official.state}-${official.district.code.split(':').pop()}`
    : ` · ${official.state}`
  const term = official.next_election
    ? ` · Next election ${new Date(official.next_election).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
    : ''
  return <span>{chamberLabel}{districtSuffix}{term}</span>
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/OfficialAvatar.tsx \
        apps/web/components/PartyBadge.tsx \
        apps/web/components/OfficialMeta.tsx
git commit -m "feat(web): OfficialAvatar, PartyBadge, OfficialMeta shared components"
```

---

## Task 21: `apps/web` — OfficialsCard + Home Integration

**Files:**
- Create: `apps/web/components/OfficialsCard.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: OfficialsCard**

Create `apps/web/components/OfficialsCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useMyOfficials } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

export function OfficialsCard() {
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <section aria-label="Your officials"><p>Loading your officials…</p></section>
  if (error)     return <section aria-label="Your officials"><p>Couldn't load officials.</p></section>
  if (!data || data.length === 0) {
    return (
      <section aria-label="Your officials">
        <h2>Your officials</h2>
        <p><Link href="/calibrate">Calibrate your address</Link> to see your delegation.</p>
      </section>
    )
  }

  return (
    <section aria-label="Your officials">
      <h2>Your officials</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {data.map((o) => (
          <li key={o.id}>
            <Link href={`/officials/${o.id}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
              <span style={{ flex: 1 }}>
                <strong>{o.full_name}</strong>{' '}
                <PartyBadge party={o.party as any} />
                <br />
                <small><OfficialMeta official={o} /></small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p><Link href="/officials">See all officials →</Link></p>
    </section>
  )
}
```

- [ ] **Step 2: Wire into home page**

Edit `apps/web/app/page.tsx` — add `<OfficialsCard />`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyProfile } from '@chiaro/profile'
import { redirect } from 'next/navigation'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCard } from '@/components/OfficialsCard'

export default async function Home(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const profile = await getMyProfile(supabase)

  return (
    <main>
      <h1>Chiaro</h1>
      {profile?.completed ? (
        <p>Welcome, {profile.display_name} (@{profile.username})</p>
      ) : (
        <p><a href="/profile/edit">Complete your profile</a></p>
      )}
      <form action="/sign-out" method="post">
        <button type="submit">Sign out</button>
      </form>
      <DistrictPanel />
      <OfficialsCard />
    </main>
  )
}
```

- [ ] **Step 3: Typecheck + smoke build**

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/web build`
Expected: both pass.

- [ ] **Step 4: Seed officials data for local smoke**

Run:
```bash
pnpm db:reset
# TIGER seed populates districts (needed for officials FK)
pnpm seed:tiger
# Run the Task 17 fixture suite to populate officials from the full fixture
pnpm --filter @chiaro/db test supabase/seed/officials-ingest.test.ts \
  --testNamePattern "happy path"
```
Expected: officials table populated (~540 rows from the fixture). The "happy path" test commits its writes to local DB.

- [ ] **Step 5: Manual smoke**

Run: `pnpm --filter @chiaro/web dev`
Open: `http://localhost:3000`
- Sign in (existing slice 1/2 flow)
- Calibrate to a real address that maps to one of the fixture districts (CA/TX/NY/FL/WY)
- Return to home; verify "Your officials" section renders ≥1 official
- Tap an official's link — should navigate to `/officials/{id}` (404 until Task 23 lands, expected here)
- Verify no console errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/OfficialsCard.tsx apps/web/app/page.tsx
git commit -m "feat(web): OfficialsCard on home — useMyOfficials + party/avatar/meta"
```

---

## Task 22: `apps/web` — `/officials` List Route

**Files:**
- Create: `apps/web/app/officials/page.tsx`
- Create: `apps/web/components/OfficialsList.tsx`

- [ ] **Step 1: Route page**

Create `apps/web/app/officials/page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OfficialsList } from '@/components/OfficialsList'

export default async function OfficialsPage(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return (
    <main>
      <h1>Your officials</h1>
      <OfficialsList />
    </main>
  )
}
```

- [ ] **Step 2: OfficialsList client component**

Create `apps/web/components/OfficialsList.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useMyOfficials, type OfficialWithDistrict } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

function group(officials: OfficialWithDistrict[]) {
  return {
    senate: officials.filter((o) => o.chamber === 'senate'),
    house:  officials.filter((o) => o.chamber === 'house'),
  }
}

export function OfficialsList() {
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <p>Loading…</p>
  if (error)     return <p>Couldn't load officials.</p>
  if (!data || data.length === 0) {
    return <p><Link href="/calibrate">Calibrate your address</Link> to see your delegation.</p>
  }

  const { senate, house } = group(data)

  return (
    <>
      <Section title="Senate" items={senate} />
      <Section title="House"  items={house} />
    </>
  )
}

function Section({ title, items }: { title: string; items: OfficialWithDistrict[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {items.map((o) => (
          <li key={o.id}>
            <Link href={`/officials/${o.id}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
              <span style={{ flex: 1 }}>
                <strong>{o.full_name}</strong>{' '}
                <PartyBadge party={o.party as any} />
                <br />
                <small><OfficialMeta official={o} /></small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/web build`
Expected: both pass.

- [ ] **Step 4: Manual smoke**

Run: `pnpm --filter @chiaro/web dev`
Visit `http://localhost:3000/officials`
- Verify list renders grouped by chamber

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/officials/page.tsx apps/web/components/OfficialsList.tsx
git commit -m "feat(web): /officials list route grouped by chamber"
```

---

## Task 23: `apps/web` — `/officials/[id]` Detail Route

**Files:**
- Create: `apps/web/app/officials/[id]/page.tsx`
- Create: `apps/web/components/OfficialDetail.tsx`

- [ ] **Step 1: Route page**

Create `apps/web/app/officials/[id]/page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OfficialDetail } from '@/components/OfficialDetail'

interface Params { id: string }

export default async function OfficialPage(
  { params }: { params: Promise<Params> },
): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return (
    <main>
      <OfficialDetail id={id} />
    </main>
  )
}
```

- [ ] **Step 2: OfficialDetail client component**

Create `apps/web/components/OfficialDetail.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useOfficial } from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

export function OfficialDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useOfficial(client, id)

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Couldn't load this official.</p>

  return (
    <article>
      <Link href="/officials">← Back</Link>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
        <OfficialAvatar fullName={data.full_name} portraitUrl={data.portrait_url} size={96} />
        <div>
          <h1 style={{ margin: 0 }}>{data.full_name}</h1>
          <p style={{ margin: '4px 0' }}>
            <PartyBadge party={data.party as any} />{' '}
            <OfficialMeta official={data} />
          </p>
        </div>
      </header>
      <dl style={{ marginTop: 16 }}>
        <dt>Chamber</dt><dd>{data.chamber === 'house' ? 'House of Representatives' : 'Senate'}</dd>
        <dt>State</dt><dd>{data.state}</dd>
        <dt>District</dt><dd>{data.district.name}</dd>
        {data.senate_class != null && (<><dt>Senate class</dt><dd>{data.senate_class}</dd></>)}
        {data.next_election && (<><dt>Next election</dt><dd>{data.next_election}</dd></>)}
        {data.official_url && (
          <>
            <dt>Official site</dt>
            <dd><a href={data.official_url} target="_blank" rel="noreferrer">{data.official_url}</a></dd>
          </>
        )}
        {data.twitter_handle && (
          <>
            <dt>Twitter</dt>
            <dd>
              <a href={`https://twitter.com/${data.twitter_handle}`} target="_blank" rel="noreferrer">
                @{data.twitter_handle}
              </a>
            </dd>
          </>
        )}
      </dl>
    </article>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck && pnpm --filter @chiaro/web build`
Expected: both pass.

- [ ] **Step 4: Manual smoke**

Visit a detail page from the list — verify rendering.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/officials/[id]/page.tsx apps/web/components/OfficialDetail.tsx
git commit -m "feat(web): /officials/[id] detail page"
```

---

## Task 24: `apps/mobile` — TanStack Query Setup

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/lib/query-client.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Install deps**

Edit `apps/mobile/package.json`, add to `dependencies`:

```json
"@tanstack/react-query": "^5.59.0",
"@chiaro/officials": "workspace:*",
"@chiaro/ui-tokens": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Create query-client wrapper**

Create `apps/mobile/lib/query-client.tsx`:

```tsx
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime:    5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 3: Wire into root layout**

Edit `apps/mobile/app/_layout.tsx` — wrap the Slot/Stack:

```tsx
import { QueryProvider } from '@/lib/query-client'
// ...existing imports
export default function RootLayout() {
  return (
    <QueryProvider>
      {/* existing Stack/Slot */}
    </QueryProvider>
  )
}
```

(Preserve existing auth-context, theme provider, etc. — QueryProvider goes outermost or just inside the auth provider depending on existing structure.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/lib/query-client.tsx apps/mobile/app/_layout.tsx pnpm-lock.yaml
git commit -m "feat(mobile): add @tanstack/react-query provider in root layout"
```

---

## Task 25: `apps/mobile` — Shared Components + OfficialsCard + Home Integration

**Files:**
- Create: `apps/mobile/components/OfficialAvatar.tsx`
- Create: `apps/mobile/components/PartyBadge.tsx`
- Create: `apps/mobile/components/OfficialMeta.tsx`
- Create: `apps/mobile/components/OfficialsCard.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: OfficialAvatar (RN)**

Create `apps/mobile/components/OfficialAvatar.tsx`:

```tsx
import { Image, View, Text } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

interface Props {
  fullName: string
  portraitUrl?: string | null
  size?: number
}

export function OfficialAvatar({ fullName, portraitUrl, size = 64 }: Props) {
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((s) => s[0]?.toUpperCase()).join('')

  if (portraitUrl) {
    return (
      <Image
        source={{ uri: portraitUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={fullName}
      />
    )
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={fullName}
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: COLORS.neutral.surface,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: COLORS.brand.text, fontWeight: '600', fontSize: size * 0.32 }}>
        {initials}
      </Text>
    </View>
  )
}
```

- [ ] **Step 2: PartyBadge (RN)**

Create `apps/mobile/components/PartyBadge.tsx`:

```tsx
import { Text, View } from 'react-native'
import { PARTY_COLOR, PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'

export function PartyBadge({ party }: { party: PartyCode }) {
  return (
    <View
      accessibilityLabel={PARTY_LABEL[party]}
      style={{
        backgroundColor: PARTY_COLOR[party],
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
        {PARTY_SHORT[party]}
      </Text>
    </View>
  )
}
```

- [ ] **Step 3: OfficialMeta (RN)**

Create `apps/mobile/components/OfficialMeta.tsx`:

```tsx
import { Text } from 'react-native'
import type { OfficialWithDistrict } from '@chiaro/officials'

export function OfficialMeta({ official }: { official: OfficialWithDistrict }) {
  const chamberLabel = official.chamber === 'house' ? 'House' : 'Senate'
  const districtSuffix = official.chamber === 'house'
    ? ` · ${official.state}-${official.district.code.split(':').pop()}`
    : ` · ${official.state}`
  const term = official.next_election
    ? ` · Next election ${new Date(official.next_election).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
    : ''
  return <Text>{chamberLabel}{districtSuffix}{term}</Text>
}
```

- [ ] **Step 4: OfficialsCard (RN)**

Create `apps/mobile/components/OfficialsCard.tsx`:

```tsx
import { Text, View, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { useMyOfficials } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'    // existing slice-2 singleton
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

export function OfficialsCard() {
  const { data, isLoading, error } = useMyOfficials(supabase)

  if (isLoading) return <Text>Loading your officials…</Text>
  if (error)     return <Text>Couldn't load officials.</Text>
  if (!data || data.length === 0) {
    return (
      <View>
        <Text style={{ fontWeight: '600' }}>Your officials</Text>
        <Link href="/calibrate"><Text>Calibrate your address</Text></Link>
      </View>
    )
  }

  return (
    <View>
      <Text style={{ fontWeight: '600', marginBottom: 8 }}>Your officials</Text>
      {data.map((o) => (
        <Link key={o.id} href={`/officials/${o.id}`} asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            accessibilityLabel={`${o.full_name}, ${o.party}`}
          >
            <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{o.full_name}</Text>
              <PartyBadge party={o.party as any} />
              <OfficialMeta official={o} />
            </View>
          </Pressable>
        </Link>
      ))}
      <Link href="/officials"><Text style={{ marginTop: 8 }}>See all officials →</Text></Link>
    </View>
  )
}
```

- [ ] **Step 5: Wire into home**

Edit `apps/mobile/app/(app)/index.tsx` — render `<OfficialsCard />` below `<DistrictPanel />`:

```tsx
import { View } from 'react-native'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCard } from '@/components/OfficialsCard'

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 24 }}>
      <DistrictPanel />
      <OfficialsCard />
    </View>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/OfficialAvatar.tsx \
        apps/mobile/components/PartyBadge.tsx \
        apps/mobile/components/OfficialMeta.tsx \
        apps/mobile/components/OfficialsCard.tsx \
        apps/mobile/app/\(app\)/index.tsx
git commit -m "feat(mobile): OfficialsCard + atomic components on home"
```

---

## Task 26: `apps/mobile` — `/officials` List Route

**Files:**
- Create: `apps/mobile/app/(app)/officials/index.tsx`
- Create: `apps/mobile/components/OfficialsList.tsx`

- [ ] **Step 1: Route**

Create `apps/mobile/app/(app)/officials/index.tsx`:

```tsx
import { ScrollView, Text } from 'react-native'
import { OfficialsList } from '@/components/OfficialsList'

export default function OfficialsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12 }}>Your officials</Text>
      <OfficialsList />
    </ScrollView>
  )
}
```

- [ ] **Step 2: Component**

Create `apps/mobile/components/OfficialsList.tsx`:

```tsx
import { Text, View, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { useMyOfficials, type OfficialWithDistrict } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

export function OfficialsList() {
  const { data, isLoading, error } = useMyOfficials(supabase)

  if (isLoading) return <Text>Loading…</Text>
  if (error)     return <Text>Couldn't load officials.</Text>
  if (!data || data.length === 0) {
    return <Link href="/calibrate"><Text>Calibrate your address</Text></Link>
  }

  const senate = data.filter((o) => o.chamber === 'senate')
  const house  = data.filter((o) => o.chamber === 'house')

  return (
    <View>
      <Section title="Senate" items={senate} />
      <Section title="House"  items={house} />
    </View>
  )
}

function Section({ title, items }: { title: string; items: OfficialWithDistrict[] }) {
  if (items.length === 0) return null
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>{title}</Text>
      {items.map((o) => (
        <Link key={o.id} href={`/officials/${o.id}`} asChild>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{o.full_name}</Text>
              <PartyBadge party={o.party as any} />
              <OfficialMeta official={o} />
            </View>
          </Pressable>
        </Link>
      ))}
    </View>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/officials/index.tsx \
        apps/mobile/components/OfficialsList.tsx
git commit -m "feat(mobile): /officials list route"
```

---

## Task 27: `apps/mobile` — `/officials/[id]` Detail Route

**Files:**
- Create: `apps/mobile/app/(app)/officials/[id].tsx`
- Create: `apps/mobile/components/OfficialDetail.tsx`

- [ ] **Step 1: Route**

Create `apps/mobile/app/(app)/officials/[id].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import { OfficialDetail } from '@/components/OfficialDetail'

export default function OfficialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <OfficialDetail id={id ?? ''} />
    </ScrollView>
  )
}
```

- [ ] **Step 2: Component**

Create `apps/mobile/components/OfficialDetail.tsx`:

```tsx
import { Linking, Text, View, Pressable } from 'react-native'
import { useOfficial } from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

export function OfficialDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useOfficial(supabase, id)

  if (isLoading) return <Text>Loading…</Text>
  if (error || !data) return <Text>Couldn't load this official.</Text>

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <OfficialAvatar fullName={data.full_name} portraitUrl={data.portrait_url} size={96} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{data.full_name}</Text>
          <PartyBadge party={data.party as any} />
          <OfficialMeta official={data} />
        </View>
      </View>

      <View style={{ marginTop: 16, gap: 8 }}>
        <Row label="Chamber"      value={data.chamber === 'house' ? 'House of Representatives' : 'Senate'} />
        <Row label="State"        value={data.state} />
        <Row label="District"     value={data.district.name} />
        {data.senate_class != null && <Row label="Senate class" value={String(data.senate_class)} />}
        {data.next_election && <Row label="Next election" value={data.next_election} />}
      </View>

      {data.official_url && (
        <Pressable onPress={() => Linking.openURL(data.official_url!)} style={{ marginTop: 16 }}>
          <Text style={{ color: '#5b6cff' }}>Open official site →</Text>
        </Pressable>
      )}
      {data.twitter_handle && (
        <Pressable
          onPress={() => Linking.openURL(`https://twitter.com/${data.twitter_handle}`)}
          style={{ marginTop: 8 }}
        >
          <Text style={{ color: '#5b6cff' }}>@{data.twitter_handle}</Text>
        </Pressable>
      )}
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ fontWeight: '600', width: 120 }}>{label}</Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/officials/\[id\].tsx \
        apps/mobile/components/OfficialDetail.tsx
git commit -m "feat(mobile): /officials/[id] detail page"
```

---

## Task 28: CI Workflow Updates

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect current workflow structure**

Run: `cat .github/workflows/ci.yml | head -80`
Expected: existing `db`, `build`, `test` jobs from slice 2.

- [ ] **Step 2: Add `seed:officials` smoke to db job**

Edit `.github/workflows/ci.yml` — in the `db` job, after `db:reset && db:test`, append:

```yaml
      - name: Smoke officials ingest (against fixtures)
        run: pnpm --filter @chiaro/db test supabase/seed/officials-ingest.test.ts
        env:
          SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

(This runs the 5-scenario fixture suite from Task 17; no real Congress.gov API key needed in CI.)

- [ ] **Step 3: Add new test step for @chiaro/officials**

Edit `.github/workflows/ci.yml` — in the `test` job, before the existing test runs, append:

```yaml
      - name: Test @chiaro/officials
        run: pnpm --filter @chiaro/officials test
        env:
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_KEY }}
```

(If those secrets aren't configured, the integration tests in Task 11 are skipped — see Task 11 for the env-source pattern. Document the CI deferral if secrets are not yet set up.)

- [ ] **Step 4: Verify locally**

Run: `pnpm --filter @chiaro/db test supabase/seed/officials-ingest.test.ts`
Expected: 6/6 green (same as Task 17).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add officials ingest smoke + @chiaro/officials test step"
```

---

## Task 29: Final Verification Checklist

**Files:** none — verification only.

- [ ] **Step 1: All workspace typechecks green**

Run: `pnpm -r typecheck`
Expected: 8/8 packages clean (existing 6 + ui-tokens + officials).

- [ ] **Step 2: All workspace tests green**

Run:
```bash
export SUPABASE_ANON_KEY=$(supabase status --output json | jq -r .ANON_KEY)
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status --output json | jq -r .SERVICE_ROLE_KEY)
pnpm -r test
```
Expected: all packages green.

- [ ] **Step 3: pgTAP green**

Run: `pnpm db:reset && pnpm db:test`
Expected: all existing tests + officials_rls + user_locations_geojson + push_tokens_rls + officials_ingest_runs_rls → green.

- [ ] **Step 4: Web build passes**

Run: `pnpm --filter @chiaro/web build`
Expected: Next 15 build succeeds.

- [ ] **Step 5: Mobile typecheck passes**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: clean. (On-device validation defers to slice 2.5.)

- [ ] **Step 6: Audit doc tracked**

Run: `git ls-files docs/superpowers/audits/`
If `2026-05-15-audit.md` is not listed, surface to user — they may want to commit it separately.

- [ ] **Step 7: Out-of-scope reminders (DO NOT add in slice 3)**

Verify these are NOT in the diff for this slice:
- DistrictPanel migrated to TanStack Query (slice 3.5)
- Inline color migration in DistrictMap/DistrictPanel (slice 3.5)
- Officials portrait re-upload to storage bucket (slice 4)
- Edit-official admin UI (slice 4)
- Vote history, bills, news per official (slice 4)
- State/local officials (slice 4+)
- "Find officials anywhere" search (future slice)
- CI scheduling of `seed:officials` (future)
- Vote-alert push notifications (slice 5+)

If any leaked in, revert.

- [ ] **Step 8: Final commit if there's cleanup, otherwise note "no commit"**

If diff is clean and all verifications passed, this slice is ready for PR.

---

## Summary

29 tasks (Task 0 + 1-29):
- Tasks 1-6: Database (5 migrations + type regen)
- Task 7: `@chiaro/ui-tokens` package
- Tasks 8-12: `@chiaro/officials` package (types, schemas, keys, queries, hooks)
- Tasks 13-18: Ingest pipeline (adapter, config, core flow, safety guards, integration tests, scripts/env)
- Tasks 19-23: Web app (TanStack provider, atomic components, card, list, detail)
- Tasks 24-27: Mobile app (TanStack provider, atomic components + card + home, list, detail)
- Task 28: CI updates
- Task 29: Final verification

Each task ends with a commit. Plan produces ~29 commits on the feature branch.
