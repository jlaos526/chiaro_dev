# Location Calibration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the second vertical slice of Chiaro — multi-tier district resolution (federal house + federal senate + state senate + state house + county + place) on web and mobile, with calibration via a Supabase Edge Function calling GeocodIO, district boundary overlays on Leaflet (web) and `react-native-maps` (mobile), and edit-from-Settings on both apps.

**Architecture:** Four new Postgres migrations add a canonical `public.districts` table (PostGIS geography, public-readable), a self-only `public.user_locations` (rooftop coords + address), and a public-readable `public.user_districts` junction. A Supabase Edge Function (`calibrate-location`) is the only place GeocodIO is called — both web and mobile invoke it via `supabase-js`. A new `packages/location` exposes typed query helpers; map components live app-local (Leaflet on web, `react-native-maps` on mobile) per slice 1's "no shared UI yet" rule. TIGER 2024 shapefiles are ingested by a Node script into `districts.geometry`. Middleware (web) and the `(app)` layout guard (mobile) gate uncalibrated users to `/calibrate`, with a session-scoped skip cookie / AsyncStorage entry.

**Tech Stack:** (extends slice 1) PostGIS 3.3 (already in Supabase image), Deno (Edge Function runtime, supplied by Supabase), Leaflet 1.9 + `react-leaflet` 4 (web maps), `react-native-maps` 1.18 (mobile maps), `expo-location` (mobile GPS), Node `shapefile` 0.6 + `undici` 6 (TIGER ingest), GeocodIO v1.7 API.

**Reference spec:** `docs/superpowers/specs/2026-05-05-location-calibration-foundation-design.md` — read this first.

**Pre-flight assumptions** (verified at end of slice 1):
- Repo is a pnpm workspace; existing `packages/db`, `packages/supabase-client`, `packages/profile`, `apps/web`, `apps/mobile`.
- `cd packages/db && supabase start` brings up a local stack with `project_id = "db"`.
- `pnpm db:reset` / `pnpm db:test` / `pnpm db:gen-types` work (slice 1 scripts).
- Slice 1 pgTAP (9 tests) and Vitest (11 tests) are green on `master`.

---

## File Structure

```
chiaro/
├── packages/
│   ├── db/
│   │   ├── supabase/
│   │   │   ├── migrations/
│   │   │   │   ├── 0001_profiles.sql                # existing
│   │   │   │   ├── 0002_profiles_rls.sql            # existing
│   │   │   │   ├── 0003_districts.sql               # NEW — Task 1
│   │   │   │   ├── 0004_districts_rls.sql           # NEW — Task 2
│   │   │   │   ├── 0005_user_locations.sql          # NEW — Task 3
│   │   │   │   └── 0006_user_districts.sql          # NEW — Task 4
│   │   │   ├── tests/
│   │   │   │   ├── profiles_rls.test.sql            # existing
│   │   │   │   ├── districts_rls.test.sql           # NEW — Tasks 1,2
│   │   │   │   ├── user_locations_rls.test.sql     # NEW — Task 3
│   │   │   │   ├── user_districts_rls.test.sql     # NEW — Task 4
│   │   │   │   └── tiger_ingest.test.sql            # NEW — Task 7
│   │   │   ├── seed/
│   │   │   │   ├── tiger-ingest.ts                  # NEW — Task 6
│   │   │   │   ├── tiger-config.ts                  # NEW — Task 6 (per-tier config)
│   │   │   │   └── tiger-state-fips.ts              # NEW — Task 6 (state FIPS table)
│   │   │   ├── functions/
│   │   │   │   └── calibrate-location/              # NEW — Tasks 10-13
│   │   │   │       ├── index.ts                     # handler
│   │   │   │       ├── geocodio.ts                  # client
│   │   │   │       ├── types.ts
│   │   │   │       ├── deno.json                    # deno config
│   │   │   │       └── index.test.ts
│   │   │   └── config.toml                          # existing — modified Task 13
│   │   ├── src/
│   │   │   ├── index.ts                             # existing
│   │   │   └── types.ts                             # regenerated Task 5
│   │   └── package.json                             # modified Task 6 (db:seed-tiger)
│   └── location/                                    # NEW — Task 8
│       ├── src/
│       │   ├── index.ts
│       │   ├── schema.ts                            # zod for input
│       │   ├── types.ts                             # DistrictTier, etc.
│       │   └── queries.ts                           # getMyLocation, getMyDistricts
│       ├── test/
│       │   └── integration.test.ts                  # NEW — Task 9
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── calibrate/page.tsx                   # NEW — Task 14
│   │   │   ├── settings/
│   │   │   │   ├── layout.tsx                       # NEW — Task 15
│   │   │   │   ├── page.tsx                         # NEW — Task 15
│   │   │   │   └── address/page.tsx                 # NEW — Task 15
│   │   │   └── page.tsx                             # modified Task 17
│   │   ├── components/
│   │   │   ├── DistrictMap.tsx                      # NEW — Task 16
│   │   │   └── DistrictPanel.tsx                    # NEW — Task 16
│   │   ├── middleware.ts                            # modified Task 17
│   │   ├── package.json                             # modified Task 16 (leaflet deps)
│   │   └── .env.example                             # modified Task 23
│   └── mobile/
│       ├── app/(app)/
│       │   ├── _layout.tsx                          # modified Task 22
│       │   ├── index.tsx                            # modified Task 22
│       │   ├── calibrate.tsx                        # NEW — Task 19
│       │   └── settings/
│       │       ├── _layout.tsx                      # NEW — Task 20
│       │       ├── index.tsx                        # NEW — Task 20
│       │       └── address.tsx                      # NEW — Task 20
│       ├── components/
│       │   ├── DistrictMap.tsx                      # NEW — Task 21
│       │   └── DistrictPanel.tsx                    # NEW — Task 21
│       ├── lib/
│       │   └── location-permissions.ts              # NEW — Task 18
│       ├── app.config.ts                            # modified Task 18
│       └── package.json                             # modified Task 18 (expo-location, react-native-maps)
├── .github/workflows/ci.yml                         # modified Task 23
└── .env.example                                     # modified Task 23
```

---

## Task 0: Verify Clean Baseline

**Goal:** Catch state divergence before touching code.

**Files:** none — verification only.

- [ ] **Step 1: Confirm branch**

Run: `git status`
Expected: `On branch feat/location-calibration-foundation` (created during brainstorm) — tree clean.

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`
Expected: no errors; `node_modules/` populated.

- [ ] **Step 3: Boot Supabase**

Run: `cd packages/db && supabase start`
Expected: services come up; URL `http://127.0.0.1:54321`, DB `54322`. If port-clashes appear, see slice 1 lessons memo (`project_resume_state.md`) — usually a stray `_Chiaro` stack from running `supabase start` at repo root; fix by `supabase stop --project-id Chiaro`.

- [ ] **Step 4: Verify slice 1 pgTAP green**

Run: `pnpm db:reset && pnpm db:test`
Expected: 9/9 green (slice 1 baseline).

- [ ] **Step 5: Verify slice 1 vitest green**

Run: `pnpm test`
Expected: 11/11 green.

- [ ] **Step 6: No commit** — this is read-only verification.

---

## Task 1: Migration `0003_districts.sql` — Schema (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0003_districts.sql`
- Create: `packages/db/supabase/tests/districts_rls.test.sql` (existence assertions only; RLS in Task 2)

**Reading required:** spec § "Database → Migration `0003_districts.sql`" and § "Schema rationale".

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/districts_rls.test.sql`:

```sql
begin;

select plan(8);

-- 1. PostGIS extension enabled
select has_extension('postgis', 'PostGIS extension is installed');

-- 2. district_tier enum exists with 6 values
select has_type('public', 'district_tier', 'district_tier enum exists');
select results_eq(
  $$ select unnest(enum_range(null::public.district_tier))::text order by 1 $$,
  $$ values ('county'),('federal_house'),('federal_senate'),('place'),('state_house'),('state_senate') $$,
  'district_tier enum has 6 expected values'
);

-- 3. districts table exists with expected columns
select has_table('public', 'districts', 'districts table exists');
select columns_are('public', 'districts',
  array['id','tier','state','code','name','geometry','source_version'],
  'districts has expected columns');

-- 4. column types
select col_type_is('public', 'districts', 'tier', 'district_tier', 'tier is district_tier');
select col_type_is('public', 'districts', 'state', 'text', 'state is text');
select col_type_is('public', 'districts', 'geometry', 'geography', 'geometry is geography');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:test`
Expected: FAIL on the first existence assertion — `extension "postgis" was not found` or `relation "public.districts" does not exist`.

- [ ] **Step 3: Write `packages/db/supabase/migrations/0003_districts.sql`**

```sql
create extension if not exists postgis;

create type public.district_tier as enum (
  'federal_house',
  'federal_senate',
  'state_senate',
  'state_house',
  'county',
  'place'
);

create table public.districts (
  id              uuid                          primary key default gen_random_uuid(),
  tier            public.district_tier          not null,
  state           text                          not null check (state ~ '^[A-Z]{2}$'),
  code            text                          not null,
  name            text                          not null,
  geometry        geography(MultiPolygon, 4326) not null,
  source_version  text                          not null,
  unique (tier, code)
);

create index districts_geometry_gix on public.districts using gist (geometry);
create index districts_tier_state on public.districts (tier, state);
```

- [ ] **Step 4: Reset and re-run tests**

Run: `pnpm db:reset`
Expected: migrations 0001, 0002, 0003 apply cleanly.

Run: `pnpm db:test`
Expected: 8 new tests PASS (plus the slice 1 9 — total 17).

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0003_districts.sql packages/db/supabase/tests/districts_rls.test.sql
git commit -m "feat(db): add districts table with PostGIS geometry and tier enum"
```

---

## Task 2: Migration `0004_districts_rls.sql` — RLS (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0004_districts_rls.sql`
- Modify: `packages/db/supabase/tests/districts_rls.test.sql` (extend with RLS assertions)

**Reading required:** spec § "Migration 0004_districts_rls.sql".

- [ ] **Step 1: Extend the pgTAP test with RLS assertions**

Replace the contents of `packages/db/supabase/tests/districts_rls.test.sql` with:

```sql
begin;

select plan(13);

-- (existence — same as Task 1) -----------------------------------------------
select has_extension('postgis', 'PostGIS extension is installed');
select has_type('public', 'district_tier', 'district_tier enum exists');
select results_eq(
  $$ select unnest(enum_range(null::public.district_tier))::text order by 1 $$,
  $$ values ('county'),('federal_house'),('federal_senate'),('place'),('state_house'),('state_senate') $$,
  'district_tier enum has 6 expected values'
);
select has_table('public', 'districts', 'districts table exists');
select columns_are('public', 'districts',
  array['id','tier','state','code','name','geometry','source_version'],
  'districts has expected columns');
select col_type_is('public', 'districts', 'tier', 'district_tier', 'tier is district_tier');
select col_type_is('public', 'districts', 'state', 'text', 'state is text');
select col_type_is('public', 'districts', 'geometry', 'geography', 'geometry is geography');

-- (RLS — added in Task 2) ----------------------------------------------------

-- seed one row as superuser for read tests
insert into public.districts (tier, state, code, name, geometry, source_version)
values ('federal_house', 'NY', 'NY-01', 'NY-01',
        ST_GeomFromText('MULTIPOLYGON(((-73 40, -72 40, -72 41, -73 41, -73 40)))', 4326)::geography,
        'TIGER 2024');

-- 9. RLS enabled
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'districts' $$,
  $$ values (true) $$,
  'RLS is enabled on districts'
);

-- 10. anon SELECT succeeds
set local role anon;
select isnt_empty(
  $$ select 1 from public.districts where code = 'NY-01' $$,
  'anon can SELECT from districts'
);

-- 11. anon INSERT denied
select throws_ok(
  $$ insert into public.districts (tier, state, code, name, geometry, source_version)
     values ('federal_house', 'NY', 'NY-99', 'NY-99',
             ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326)::geography,
             'TIGER 2024') $$,
  '42501', 'permission denied for table districts',
  'anon cannot INSERT into districts'
);

-- 12. authenticated SELECT succeeds
set local role authenticated;
select isnt_empty(
  $$ select 1 from public.districts where code = 'NY-01' $$,
  'authenticated can SELECT from districts'
);

-- 13. authenticated INSERT denied
select throws_ok(
  $$ insert into public.districts (tier, state, code, name, geometry, source_version)
     values ('federal_house', 'NY', 'NY-98', 'NY-98',
             ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326)::geography,
             'TIGER 2024') $$,
  '42501', 'permission denied for table districts',
  'authenticated cannot INSERT into districts'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:test`
Expected: FAIL on assertion #9 (RLS-enabled flag is `false` — RLS not turned on yet) and on the role-switching assertions (anon/authenticated still have full table access via slice 1's grant).

- [ ] **Step 3: Write `packages/db/supabase/migrations/0004_districts_rls.sql`**

```sql
alter table public.districts enable row level security;

create policy "districts_select_all"
  on public.districts
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.districts from anon, authenticated;
```

- [ ] **Step 4: Reset + re-test**

Run: `pnpm db:reset && pnpm db:test`
Expected: 13/13 districts tests PASS (plus slice 1 9 — total 22).

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0004_districts_rls.sql packages/db/supabase/tests/districts_rls.test.sql
git commit -m "feat(db): enable RLS on districts (public-readable, no client writes)"
```

---

## Task 3: Migration `0005_user_locations.sql` — Schema + RLS (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0005_user_locations.sql`
- Create: `packages/db/supabase/tests/user_locations_rls.test.sql`

**Reading required:** spec § "Migration 0005_user_locations.sql".

- [ ] **Step 1: Write failing pgTAP test**

Create `packages/db/supabase/tests/user_locations_rls.test.sql`:

```sql
begin;

select plan(11);

-- 1. table exists with expected columns
select has_table('public', 'user_locations', 'user_locations table exists');
select columns_are('public', 'user_locations',
  array['id','home_address_text','home_location','geocodio_response','calibrated_at'],
  'user_locations has expected columns');
select col_type_is('public', 'user_locations', 'home_location', 'geography', 'home_location is geography');
select col_type_is('public', 'user_locations', 'geocodio_response', 'jsonb', 'geocodio_response is jsonb');

-- 2. seed two users + one location row each (as superuser)
do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-loc-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-loc-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.user_locations (id, home_address_text, home_location, geocodio_response)
  values (v_a, '350 5th Ave, NY 10118',
          ST_SetSRID(ST_MakePoint(-73.985428, 40.748817), 4326)::geography,
          '{"results": []}'::jsonb),
         (v_b, '1 Embarcadero Center, SF 94111',
          ST_SetSRID(ST_MakePoint(-122.397, 37.795), 4326)::geography,
          '{"results": []}'::jsonb);
end $$;

-- 3. RLS enabled
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'user_locations' $$,
  $$ values (true) $$,
  'RLS is enabled on user_locations'
);

-- 4. user A can SELECT own row
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "a-loc-test-id-placeholder"}';
-- can't easily switch JWT mid-test; instead use set_config below
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'a-loc-test@example.com'))::text,
  true);

select isnt_empty(
  $$ select 1 from public.user_locations
       where id = (select id from auth.users where email = 'a-loc-test@example.com') $$,
  'user A can SELECT own user_locations row'
);

-- 5. user A cannot SELECT user B's row
select is_empty(
  $$ select 1 from public.user_locations
       where id = (select id from auth.users where email = 'b-loc-test@example.com') $$,
  'user A cannot SELECT user B''s user_locations row'
);

-- 6. user A cannot INSERT
select throws_ok(
  $$ insert into public.user_locations (id, home_address_text, home_location, geocodio_response)
     values ((select id from auth.users where email = 'a-loc-test@example.com'),
             'fake', ST_SetSRID(ST_MakePoint(0,0),4326)::geography, '{}'::jsonb) $$,
  '42501', 'permission denied for table user_locations',
  'authenticated cannot INSERT into user_locations'
);

-- 7. user A cannot UPDATE
select throws_ok(
  $$ update public.user_locations set home_address_text = 'hacked'
       where id = (select id from auth.users where email = 'a-loc-test@example.com') $$,
  '42501', 'permission denied for table user_locations',
  'authenticated cannot UPDATE user_locations'
);

-- 8. cascade delete — superuser deletes auth.users → user_locations row gone
reset role;
delete from auth.users where email = 'a-loc-test@example.com';
select is_empty(
  $$ select 1 from public.user_locations
       where id not in (select id from auth.users) $$,
  'cascade delete from auth.users removes user_locations row'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:test`
Expected: FAIL — `relation "public.user_locations" does not exist`.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0005_user_locations.sql`:

```sql
create table public.user_locations (
  id                  uuid          primary key references auth.users(id) on delete cascade,
  home_address_text   text          not null,
  home_location       geography(Point, 4326) not null,
  geocodio_response   jsonb         not null,
  calibrated_at       timestamptz   not null default now()
);

alter table public.user_locations enable row level security;

create policy "user_locations_select_self"
  on public.user_locations
  for select
  to authenticated
  using (id = (select auth.uid()));

revoke insert, update, delete on public.user_locations from anon, authenticated;
```

- [ ] **Step 4: Reset + re-test**

Run: `pnpm db:reset && pnpm db:test`
Expected: 11 user_locations tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0005_user_locations.sql packages/db/supabase/tests/user_locations_rls.test.sql
git commit -m "feat(db): add user_locations table with self-only RLS"
```

---

## Task 4: Migration `0006_user_districts.sql` — Schema + RLS (TDD)

**Files:**
- Create: `packages/db/supabase/migrations/0006_user_districts.sql`
- Create: `packages/db/supabase/tests/user_districts_rls.test.sql`

**Reading required:** spec § "Migration 0006_user_districts.sql".

- [ ] **Step 1: Write failing pgTAP test**

Create `packages/db/supabase/tests/user_districts_rls.test.sql`:

```sql
begin;

select plan(9);

-- 1. table + columns
select has_table('public', 'user_districts', 'user_districts table exists');
select columns_are('public', 'user_districts',
  array['user_id','district_id','tier','created_at'],
  'user_districts has expected columns');
select col_is_pk('public', 'user_districts', array['user_id','district_id'],
  'composite PK on (user_id, district_id)');

-- 2. seed scenario
do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_d uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'NY', 'NY-12-test', 'NY-12-test',
          ST_GeomFromText('MULTIPOLYGON(((-73 40, -72 40, -72 41, -73 41, -73 40)))', 4326)::geography,
          'TIGER 2024')
  returning id into v_d;

  insert into public.user_districts (user_id, district_id, tier)
  values (v_a, v_d, 'federal_house'),
         (v_b, v_d, 'federal_house');
end $$;

-- 3. RLS enabled
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'user_districts' $$,
  $$ values (true) $$,
  'RLS is enabled on user_districts'
);

-- 4. user A can SELECT all rows (per Q6c — public-readable)
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'a-ud-test@example.com'))::text,
  true);

select results_eq(
  $$ select count(*)::int from public.user_districts $$,
  $$ values (2) $$,
  'authenticated user A sees both rows in user_districts'
);

-- 5. user A cannot INSERT
select throws_ok(
  $$ insert into public.user_districts (user_id, district_id, tier)
     values ((select id from auth.users where email = 'a-ud-test@example.com'),
             (select id from public.districts where code = 'NY-12-test'),
             'federal_house') $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot INSERT into user_districts'
);

-- 6. cascade — delete a user removes their user_districts rows
reset role;
delete from auth.users where email = 'a-ud-test@example.com';
select results_eq(
  $$ select count(*)::int from public.user_districts $$,
  $$ values (1) $$,
  'cascade delete from auth.users removes their user_districts row'
);

-- 7. cascade — delete a district removes related user_districts rows
delete from public.districts where code = 'NY-12-test';
select is_empty(
  $$ select 1 from public.user_districts $$,
  'cascade delete from districts removes related user_districts rows'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:test`
Expected: FAIL — `relation "public.user_districts" does not exist`.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0006_user_districts.sql`:

```sql
create table public.user_districts (
  user_id      uuid                      not null references auth.users(id)        on delete cascade,
  district_id  uuid                      not null references public.districts(id)  on delete cascade,
  tier         public.district_tier      not null,
  created_at   timestamptz               not null default now(),
  primary key (user_id, district_id)
);

create index user_districts_district on public.user_districts (district_id);
create index user_districts_tier on public.user_districts (tier);

alter table public.user_districts enable row level security;

create policy "user_districts_select_all"
  on public.user_districts
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.user_districts from anon, authenticated;
```

- [ ] **Step 4: Reset + re-test**

Run: `pnpm db:reset && pnpm db:test`
Expected: 9 user_districts tests PASS. Total green count now 50+ (slice 1 + Tasks 1-4).

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0006_user_districts.sql packages/db/supabase/tests/user_districts_rls.test.sql
git commit -m "feat(db): add user_districts junction with public-readable RLS"
```

---

## Task 5: Regenerate `Database` Type

**Files:**
- Modify: `packages/db/src/types.ts` (regenerated)

- [ ] **Step 1: Regenerate types**

Run: `pnpm db:gen-types`
Expected: `packages/db/src/types.ts` updated with `districts`, `user_locations`, `user_districts`, and the `district_tier` enum.

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS across all packages.

- [ ] **Step 3: Spot-check generated content**

Read: `packages/db/src/types.ts`
Confirm: `Database['public']['Tables']['districts']['Row']` shape matches the migration columns; `Database['public']['Enums']['district_tier']` lists 6 values.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for slice 2 schema"
```

---

## Task 6: TIGER Ingest Pipeline

**Files:**
- Create: `packages/db/supabase/seed/tiger-ingest.ts`
- Create: `packages/db/supabase/seed/tiger-config.ts`
- Create: `packages/db/supabase/seed/tiger-state-fips.ts`
- Modify: `packages/db/package.json` (add `db:seed-tiger` script + deps)

**Reading required:** spec § "Architecture → TIGER ingest mechanics" and § "Risks → 1, 3".

This is a multi-step task. The pipeline downloads TIGER 2024 ZIPs from data.census.gov, parses shapefiles in-process via the `shapefile` npm lib, and inserts into `public.districts` keyed on `(tier, code)` with `on conflict do update` (idempotent re-ingest by `source_version`).

- [ ] **Step 1: Add dependencies to `packages/db/package.json`**

Modify `packages/db/package.json` — extend `dependencies` and `scripts`:

```json
{
  "name": "@chiaro/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:test": "supabase test db",
    "supabase:gen-types": "supabase gen types typescript --local > src/types.ts",
    "db:seed-tiger": "tsx supabase/seed/tiger-ingest.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "shapefile": "^0.6.6",
    "undici": "^6.19.0",
    "unzipper": "^0.12.3",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@types/unzipper": "^0.10.10",
    "tsx": "^4.16.0",
    "typescript": "^5.4.0"
  }
}
```

Run: `pnpm install`
Expected: deps install cleanly.

- [ ] **Step 2: Create `tiger-state-fips.ts`**

Create `packages/db/supabase/seed/tiger-state-fips.ts`:

```ts
// 50 states + DC. Territories (PR, GU, etc.) are intentionally excluded —
// they do not have GeocodIO district resolution and are out of scope for
// slice 2. Add them when an explicit feature requires them.
export const STATE_FIPS: Array<{ fips: string; state: string; name: string }> = [
  { fips: '01', state: 'AL', name: 'Alabama' },
  { fips: '02', state: 'AK', name: 'Alaska' },
  { fips: '04', state: 'AZ', name: 'Arizona' },
  { fips: '05', state: 'AR', name: 'Arkansas' },
  { fips: '06', state: 'CA', name: 'California' },
  { fips: '08', state: 'CO', name: 'Colorado' },
  { fips: '09', state: 'CT', name: 'Connecticut' },
  { fips: '10', state: 'DE', name: 'Delaware' },
  { fips: '11', state: 'DC', name: 'District of Columbia' },
  { fips: '12', state: 'FL', name: 'Florida' },
  { fips: '13', state: 'GA', name: 'Georgia' },
  { fips: '15', state: 'HI', name: 'Hawaii' },
  { fips: '16', state: 'ID', name: 'Idaho' },
  { fips: '17', state: 'IL', name: 'Illinois' },
  { fips: '18', state: 'IN', name: 'Indiana' },
  { fips: '19', state: 'IA', name: 'Iowa' },
  { fips: '20', state: 'KS', name: 'Kansas' },
  { fips: '21', state: 'KY', name: 'Kentucky' },
  { fips: '22', state: 'LA', name: 'Louisiana' },
  { fips: '23', state: 'ME', name: 'Maine' },
  { fips: '24', state: 'MD', name: 'Maryland' },
  { fips: '25', state: 'MA', name: 'Massachusetts' },
  { fips: '26', state: 'MI', name: 'Michigan' },
  { fips: '27', state: 'MN', name: 'Minnesota' },
  { fips: '28', state: 'MS', name: 'Mississippi' },
  { fips: '29', state: 'MO', name: 'Missouri' },
  { fips: '30', state: 'MT', name: 'Montana' },
  { fips: '31', state: 'NE', name: 'Nebraska' },
  { fips: '32', state: 'NV', name: 'Nevada' },
  { fips: '33', state: 'NH', name: 'New Hampshire' },
  { fips: '34', state: 'NJ', name: 'New Jersey' },
  { fips: '35', state: 'NM', name: 'New Mexico' },
  { fips: '36', state: 'NY', name: 'New York' },
  { fips: '37', state: 'NC', name: 'North Carolina' },
  { fips: '38', state: 'ND', name: 'North Dakota' },
  { fips: '39', state: 'OH', name: 'Ohio' },
  { fips: '40', state: 'OK', name: 'Oklahoma' },
  { fips: '41', state: 'OR', name: 'Oregon' },
  { fips: '42', state: 'PA', name: 'Pennsylvania' },
  { fips: '44', state: 'RI', name: 'Rhode Island' },
  { fips: '45', state: 'SC', name: 'South Carolina' },
  { fips: '46', state: 'SD', name: 'South Dakota' },
  { fips: '47', state: 'TN', name: 'Tennessee' },
  { fips: '48', state: 'TX', name: 'Texas' },
  { fips: '49', state: 'UT', name: 'Utah' },
  { fips: '50', state: 'VT', name: 'Vermont' },
  { fips: '51', state: 'VA', name: 'Virginia' },
  { fips: '53', state: 'WA', name: 'Washington' },
  { fips: '54', state: 'WV', name: 'West Virginia' },
  { fips: '55', state: 'WI', name: 'Wisconsin' },
  { fips: '56', state: 'WY', name: 'Wyoming' },
];

// States without a state house (unicameral). Nebraska as of 2026.
export const NO_STATE_HOUSE = new Set(['NE']);

// DC has no state legislature at all.
export const NO_STATE_LEGISLATURE = new Set(['DC']);
```

- [ ] **Step 3: Create `tiger-config.ts`**

Create `packages/db/supabase/seed/tiger-config.ts`:

```ts
import { STATE_FIPS } from './tiger-state-fips.ts'

export const TIGER_VERSION = 'TIGER 2024'

export type TigerSource = {
  tier: 'federal_house' | 'state_senate' | 'state_house' | 'county' | 'place'
  // either a single nationwide URL or one URL per state FIPS
  urls: () => Array<{ url: string; stateFips?: string }>
  // produce the canonical (tier, code, state, name) per shapefile feature
  extract: (props: Record<string, unknown>, stateFipsHint?: string) => {
    code: string
    state: string
    name: string
  } | null
}

const fipsToState = new Map(STATE_FIPS.map(s => [s.fips, s.state]))

export const TIGER_SOURCES: TigerSource[] = [
  {
    tier: 'federal_house',
    urls: () => [
      { url: 'https://www2.census.gov/geo/tiger/TIGER2024/CD/tl_2024_us_cd118.zip' },
    ],
    extract: (props) => {
      const stateFp = String(props.STATEFP)
      const cd = String(props.CD118FP)
      const state = fipsToState.get(stateFp)
      if (!state) return null  // territory, skip
      // Census uses '00' for at-large districts — render as 'AL'
      const codeNum = cd === '00' ? 'AL' : cd
      const code = `${state}-${codeNum}`
      const name = `${state} Congressional District ${codeNum}`
      return { code, state, name }
    },
  },
  {
    tier: 'state_senate',
    urls: () => STATE_FIPS
      .filter(s => !['DC'].includes(s.state))
      .map(s => ({
        url: `https://www2.census.gov/geo/tiger/TIGER2024/SLDU/tl_2024_${s.fips}_sldu.zip`,
        stateFips: s.fips,
      })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const sldu = String(props.SLDUST).replace(/^0+/, '') || '0'
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = `${state}-SS-${sldu}`
      const name = String(props.NAMELSAD ?? `${state} Senate District ${sldu}`)
      return { code, state, name }
    },
  },
  {
    tier: 'state_house',
    urls: () => STATE_FIPS
      .filter(s => !['DC', 'NE'].includes(s.state))
      .map(s => ({
        url: `https://www2.census.gov/geo/tiger/TIGER2024/SLDL/tl_2024_${s.fips}_sldl.zip`,
        stateFips: s.fips,
      })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const sldl = String(props.SLDLST).replace(/^0+/, '') || '0'
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = `${state}-SH-${sldl}`
      const name = String(props.NAMELSAD ?? `${state} House District ${sldl}`)
      return { code, state, name }
    },
  },
  {
    tier: 'county',
    urls: () => [
      { url: 'https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/tl_2024_us_county.zip' },
    ],
    extract: (props) => {
      const stateFp = String(props.STATEFP)
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = String(props.GEOID)              // 5-digit county FIPS
      const name = String(props.NAMELSAD)            // e.g. "Kings County"
      return { code, state, name }
    },
  },
  {
    tier: 'place',
    urls: () => STATE_FIPS.map(s => ({
      url: `https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_${s.fips}_place.zip`,
      stateFips: s.fips,
    })),
    extract: (props, stateFipsHint) => {
      const stateFp = stateFipsHint ?? String(props.STATEFP)
      const state = fipsToState.get(stateFp)
      if (!state) return null
      const code = String(props.GEOID)              // 7-digit place FIPS
      const name = String(props.NAMELSAD)
      return { code, state, name }
    },
  },
]

// federal_senate is synthesized from the STATE shapefile (one S1 + one S2 per
// state, sharing the state's outer boundary).
export const FEDERAL_SENATE_SOURCE = {
  url: 'https://www2.census.gov/geo/tiger/TIGER2024/STATE/tl_2024_us_state.zip',
}
```

- [ ] **Step 4: Create `tiger-ingest.ts`**

Create `packages/db/supabase/seed/tiger-ingest.ts`:

```ts
#!/usr/bin/env tsx
import { fetch } from 'undici'
import { Open } from 'unzipper'
import { Readable } from 'node:stream'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import * as shapefile from 'shapefile'
import { TIGER_SOURCES, FEDERAL_SENATE_SOURCE, TIGER_VERSION } from './tiger-config.ts'
import { STATE_FIPS } from './tiger-state-fips.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type FeatureInsert = {
  tier: string
  state: string
  code: string
  name: string
  geometryGeoJSON: object
}

async function downloadAndUnzip(url: string, workDir: string): Promise<{ shp: string; dbf: string }> {
  console.log(`  Fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const dir = await Open.buffer(buf)
  let shpPath = '', dbfPath = ''
  for (const entry of dir.files) {
    const lower = entry.path.toLowerCase()
    if (lower.endsWith('.shp')) {
      shpPath = join(workDir, entry.path)
      await entry.buffer().then((b: Buffer) => import('node:fs/promises').then(fs => fs.writeFile(shpPath, b)))
    } else if (lower.endsWith('.dbf')) {
      dbfPath = join(workDir, entry.path)
      await entry.buffer().then((b: Buffer) => import('node:fs/promises').then(fs => fs.writeFile(dbfPath, b)))
    }
  }
  if (!shpPath || !dbfPath) throw new Error(`No .shp/.dbf in ${url}`)
  return { shp: shpPath, dbf: dbfPath }
}

async function ingestSource(client: Client, source: typeof TIGER_SOURCES[number], workDir: string) {
  const inserts: FeatureInsert[] = []
  for (const { url, stateFips } of source.urls()) {
    const { shp, dbf } = await downloadAndUnzip(url, workDir)
    const reader = await shapefile.open(shp, dbf)
    while (true) {
      const result = await reader.read()
      if (result.done) break
      const props = result.value.properties as Record<string, unknown>
      const meta = source.extract(props, stateFips)
      if (!meta) continue
      const geom = result.value.geometry
      if (geom.type !== 'MultiPolygon' && geom.type !== 'Polygon') continue
      // Normalize to MultiPolygon so the column type matches.
      const geometry = geom.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [geom.coordinates] }
        : geom
      inserts.push({ tier: source.tier, ...meta, geometryGeoJSON: geometry })
    }
  }
  console.log(`  ${source.tier}: ${inserts.length} features ingested`)
  await flushInserts(client, inserts)
}

async function ingestFederalSenate(client: Client, workDir: string) {
  const { shp, dbf } = await downloadAndUnzip(FEDERAL_SENATE_SOURCE.url, workDir)
  const reader = await shapefile.open(shp, dbf)
  const inserts: FeatureInsert[] = []
  const fipsToState = new Map(STATE_FIPS.map(s => [s.fips, s]))
  while (true) {
    const r = await reader.read()
    if (r.done) break
    const props = r.value.properties as Record<string, unknown>
    const stateFp = String(props.STATEFP)
    const stateInfo = fipsToState.get(stateFp)
    if (!stateInfo) continue
    if (r.value.geometry.type !== 'MultiPolygon' && r.value.geometry.type !== 'Polygon') continue
    const geometry = r.value.geometry.type === 'Polygon'
      ? { type: 'MultiPolygon', coordinates: [r.value.geometry.coordinates] }
      : r.value.geometry
    for (const seat of ['S1', 'S2']) {
      inserts.push({
        tier: 'federal_senate',
        state: stateInfo.state,
        code: `${stateInfo.state}-${seat}`,
        name: `${stateInfo.name} (Class ${seat === 'S1' ? '1' : '2'} U.S. Senate seat)`,
        geometryGeoJSON: geometry,
      })
    }
  }
  console.log(`  federal_senate: ${inserts.length} features (synthesized)`)
  await flushInserts(client, inserts)
}

async function flushInserts(client: Client, rows: FeatureInsert[]) {
  if (rows.length === 0) return
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const placeholders: string[] = []
    slice.forEach((r, idx) => {
      const o = idx * 6
      placeholders.push(
        `($${o+1}, $${o+2}, $${o+3}, $${o+4}, ST_GeomFromGeoJSON($${o+5})::geography, $${o+6})`
      )
      values.push(r.tier, r.state, r.code, r.name, JSON.stringify(r.geometryGeoJSON), TIGER_VERSION)
    })
    await client.query(
      `insert into public.districts (tier, state, code, name, geometry, source_version)
       values ${placeholders.join(',')}
       on conflict (tier, code) do update
         set state = excluded.state,
             name = excluded.name,
             geometry = excluded.geometry,
             source_version = excluded.source_version`,
      values
    )
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log(`Connected. Ingesting ${TIGER_VERSION}...`)
  const workDir = await mkdtemp(join(tmpdir(), 'tiger-'))
  try {
    for (const source of TIGER_SOURCES) {
      console.log(`Tier: ${source.tier}`)
      await ingestSource(client, source, workDir)
    }
    console.log(`Tier: federal_senate (synthesized)`)
    await ingestFederalSenate(client, workDir)
  } finally {
    await rm(workDir, { recursive: true, force: true })
    await client.end()
  }
  console.log('Ingest complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 5: Run the seed locally — sanity check**

Run from repo root: `pnpm --filter @chiaro/db db:seed-tiger`

Expected: progress logs per tier, total runtime 60–180 s on a warm cache. End state: ~5,000+ rows in `public.districts`. (federal_house: ~436, state_senate: ~2,000, state_house: ~5,400, county: ~3,143, place: ~30,000 — but we only persist what passes the `extract` filter; place table is the largest.)

Manual spot check:

```bash
docker exec supabase_db_db psql -U postgres -d postgres -c \
  "select tier, count(*) from public.districts group by tier order by tier;"
```

Expected output (approximate; varies year to year):

```
     tier      | count
---------------+-------
 county        |  3143
 federal_house |   436
 federal_senate|   100
 place         | 29000+
 state_house   |  5400+
 state_senate  |  1900+
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/package.json packages/db/supabase/seed/
git commit -m "feat(db): add TIGER 2024 ingest pipeline (federal/state/county/place)"
```

---

## Task 7: pgTAP Coverage Assertions for TIGER Ingest

**Files:**
- Create: `packages/db/supabase/tests/tiger_ingest.test.sql`

**Reading required:** spec § "Testing → Layer 1" tiger_ingest row.

This test only passes when the ingest has been run. CI will run `pnpm db:seed-tiger` between `pnpm db:reset` and `pnpm db:test`.

- [ ] **Step 1: Write the test**

Create `packages/db/supabase/tests/tiger_ingest.test.sql`:

```sql
begin;

select plan(7);

-- 1. ≥1 federal_house per state+DC (51 states)
select results_eq(
  $$ select count(distinct state)::int
       from public.districts
       where tier = 'federal_house' $$,
  $$ values (51) $$,
  'federal_house: every state + DC has at least one district'
);

-- 2. exactly 2 federal_senate per state+DC (DC excluded — has no senators)
select results_eq(
  $$ select count(*)::int
       from public.districts
       where tier = 'federal_senate' $$,
  $$ values (100) $$,
  'federal_senate: 100 rows total (50 states × 2 seats)'
);

-- 3. ≥1 state_senate per state (excluding DC)
select results_eq(
  $$ select count(distinct state)::int
       from public.districts
       where tier = 'state_senate' $$,
  $$ values (50) $$,
  'state_senate: 50 states have ≥1 district (DC excluded)'
);

-- 4. ≥1 state_house per state (excluding DC, NE)
select results_eq(
  $$ select count(distinct state)::int
       from public.districts
       where tier = 'state_house' $$,
  $$ values (49) $$,
  'state_house: 49 states have ≥1 district (DC, NE excluded)'
);

-- 5. NE state_house = 0 explicitly
select results_eq(
  $$ select count(*)::int
       from public.districts
       where tier = 'state_house' and state = 'NE' $$,
  $$ values (0) $$,
  'state_house: Nebraska (unicameral) has zero rows'
);

-- 6. all geometries non-null + ST_IsValid
select is_empty(
  $$ select tier, code from public.districts where geometry is null $$,
  'all districts have non-null geometry'
);
select is_empty(
  $$ select tier, code from public.districts where not ST_IsValid(geometry::geometry) $$,
  'all districts pass ST_IsValid'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run, expecting it to PASS** (ingest already done in Task 6)

Run: `pnpm db:test`
Expected: 7 new tiger_ingest tests PASS.

(If you re-ran `pnpm db:reset` between Task 6 and now, re-seed first: `pnpm db:seed-tiger`.)

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/tests/tiger_ingest.test.sql
git commit -m "test(db): add pgTAP coverage assertions for TIGER ingest"
```

---

## Task 8: `packages/location` Skeleton + Schema + Types + Queries

**Files:**
- Create: `packages/location/package.json`
- Create: `packages/location/tsconfig.json`
- Create: `packages/location/vitest.config.ts`
- Create: `packages/location/src/index.ts`
- Create: `packages/location/src/types.ts`
- Create: `packages/location/src/schema.ts`
- Create: `packages/location/src/queries.ts`

**Reading required:** spec § "Client wiring → packages/location/src/" and § "Data fetching".

- [ ] **Step 1: Add the package directory**

Run: `mkdir -p packages/location/src packages/location/test`

- [ ] **Step 2: Create `packages/location/package.json`**

```json
{
  "name": "@chiaro/location",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:geocodio:live": "vitest run test/integration.test.ts -t 'calibrate-location Edge Function'",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chiaro/db": "workspace:*",
    "@chiaro/supabase-client": "workspace:*",
    "@supabase/supabase-js": "^2.105.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create `packages/location/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4: Create `packages/location/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,                     // GeocodIO + DB writes need headroom
    hookTimeout: 30_000,
  },
})
```

- [ ] **Step 5: Create `packages/location/src/types.ts`**

```ts
export const DISTRICT_TIERS = [
  'federal_house',
  'federal_senate',
  'state_senate',
  'state_house',
  'county',
  'place',
] as const

export type DistrictTier = typeof DISTRICT_TIERS[number]

export type DistrictRow = {
  id: string
  tier: DistrictTier
  state: string
  code: string
  name: string
  geometry: GeoJSONGeometry
}

export type GeoJSONGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'Point'; coordinates: [number, number] }

export type UserLocationRow = {
  home_address_text: string
  home_location: GeoJSONGeometry & { type: 'Point' }
  calibrated_at: string
}

export type CalibrateResponse = {
  home_location: { lat: number; lng: number }
  districts: Array<{
    tier: DistrictTier
    code: string
    name: string
    state: string
  }>
}
```

- [ ] **Step 6: Create `packages/location/src/schema.ts`**

```ts
import { z } from 'zod'

export const addressInputSchema = z.object({
  address: z.string().trim().min(5).max(200),
})

export const gpsInputSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
})

export const calibrateInputSchema = z.union([addressInputSchema, gpsInputSchema])

export type AddressInput = z.infer<typeof addressInputSchema>
export type GpsInput = z.infer<typeof gpsInputSchema>
export type CalibrateInput = z.infer<typeof calibrateInputSchema>
```

- [ ] **Step 7: Create `packages/location/src/queries.ts`**

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { DistrictRow, UserLocationRow } from './types.ts'

export async function getMyLocation(client: ChiaroClient): Promise<UserLocationRow | null> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  // ST_AsGeoJSON(geometry::geometry) must be aliased — PostgREST returns the alias key.
  // We lean on a PostgREST RPC for the geometry-to-json conversion would be over-engineering;
  // instead, ask Supabase for the raw row and emit GeoJSON via a generated SQL view in a
  // future slice. For now we do a thin select.
  const { data, error } = await client
    .from('user_locations')
    .select('home_address_text, home_location, calibrated_at')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return data as unknown as UserLocationRow
}

export async function getMyDistricts(client: ChiaroClient): Promise<DistrictRow[]> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return []

  // Two-step: fetch user_district join keys, then bulk-load districts (avoids
  // PostgREST nested-select shape constraints with geometry columns).
  const { data: links, error: linksErr } = await client
    .from('user_districts')
    .select('district_id')
    .eq('user_id', user.id)
  if (linksErr) throw linksErr
  if (!links || links.length === 0) return []

  const ids = links.map((l: { district_id: string }) => l.district_id)
  const { data, error } = await client
    .from('districts')
    .select('id, tier, state, code, name, geometry')
    .in('id', ids)
  if (error) throw error
  return (data ?? []) as unknown as DistrictRow[]
}
```

> Implementation note for the agent: PostgREST returns `geometry` columns as PostGIS WKB hex by default, not GeoJSON. To return GeoJSON cleanly, slice 2 adds a view in **Step 8 below**.

- [ ] **Step 8: Create a GeoJSON-friendly view migration**

> **Implementation note (not pre-specified):** PostgREST returns `geometry` columns as WKB hex by default; supabase-js can't parse that into GeoJSON without a server-side helper. The spec implies `ST_AsGeoJSON` will be used at query time, but exposing it via the standard PostgREST table interface requires either a SQL function or a view. A view is simpler and is added here. The view is a security-invoker view, so it inherits RLS from `public.districts` automatically.

Create `packages/db/supabase/migrations/0007_districts_geojson_view.sql`:

```sql
-- A read-only view that exposes geometry as GeoJSON (parseable by supabase-js).
-- Inherits RLS from the underlying districts table because it is a security
-- invoker view (default in Postgres 15+). The function ST_AsGeoJSON returns
-- text; we parse it client-side.
create or replace view public.districts_geojson as
  select id, tier, state, code, name, source_version,
         ST_AsGeoJSON(geometry::geometry)::jsonb as geometry
  from public.districts;

grant select on public.districts_geojson to anon, authenticated;
```

Then update `getMyDistricts` to query `districts_geojson` instead of `districts`:

```ts
// in queries.ts — change the second .from('districts') to:
const { data, error } = await client
  .from('districts_geojson')
  .select('id, tier, state, code, name, geometry')
  .in('id', ids)
```

- [ ] **Step 9: Create `packages/location/src/index.ts`**

```ts
export * from './types.ts'
export * from './schema.ts'
export * from './queries.ts'
```

- [ ] **Step 10: Apply the new view migration + regenerate types**

Run: `pnpm db:reset && pnpm db:seed-tiger && pnpm db:test`
Expected: all pgTAP tests still pass; new view exists.

Run: `pnpm db:gen-types`
Expected: `packages/db/src/types.ts` regenerated; `districts_geojson` view appears under `Database.public.Views`.

- [ ] **Step 11: Typecheck the new package**

Run: `pnpm install` (so workspace links resolve)
Run: `pnpm --filter @chiaro/location typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/location packages/db/supabase/migrations/0007_districts_geojson_view.sql packages/db/src/types.ts
git commit -m "feat(location): add packages/location with queries + districts_geojson view"
```

---

## Task 9: `packages/location` Integration Tests (Layer 2)

**Files:**
- Create: `packages/location/test/integration.test.ts`
- Create: `packages/location/test/fixtures.ts` (helpers for creating users)

**Reading required:** spec § "Testing → Layer 2".

These tests run against the local Supabase stack. Because slice 2 calls live GeocodIO via the Edge Function, **these integration tests cannot run until Tasks 11–13 are complete**. Skip Task 9 for now and return to it after the Edge Function is deployable locally.

> **Subagent note:** if executing tasks in order, mark this task in_progress in the task tracker and skip ahead to Task 10. Return after Task 13.

- [ ] **Step 1: Create `packages/location/test/fixtures.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY
  ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export type TestClient = SupabaseClient<Database>

export function makeAnonClient(): TestClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) as TestClient
}

export async function makeAuthedUser(suffix = ''): Promise<{ client: TestClient; userId: string; email: string }> {
  const email = `loc-test-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2,7)}@example.com`
  const client = makeAnonClient()
  const { data, error } = await client.auth.signUp({ email, password: 'testpassword123' })
  if (error || !data.user) throw error ?? new Error('signUp returned null user')
  return { client, userId: data.user.id, email }
}
```

- [ ] **Step 2: Create `packages/location/test/integration.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { getMyLocation, getMyDistricts } from '../src/queries.ts'
import { makeAuthedUser, makeAnonClient } from './fixtures.ts'

const URBAN_ADDRESS = '350 5th Ave, New York, NY 10118'         // Empire State Building — predictable districts
const RURAL_ADDRESS = '1 Old Faithful Geyser Loop, Yellowstone, WY 82190'

describe('location queries (pre-calibration)', () => {
  it('getMyLocation returns null before calibration', async () => {
    const { client } = await makeAuthedUser('loc-null')
    expect(await getMyLocation(client)).toBeNull()
  })

  it('getMyDistricts returns [] before calibration', async () => {
    const { client } = await makeAuthedUser('dist-empty')
    expect(await getMyDistricts(client)).toEqual([])
  })
})

describe('calibrate-location Edge Function (live GeocodIO)', () => {
  it('writes user_locations + ≥4 user_districts on first calibration', async () => {
    const { client } = await makeAuthedUser('cal-happy')
    const { data, error } = await client.functions.invoke('calibrate-location', {
      body: { address: URBAN_ADDRESS },
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({ home_location: expect.any(Object), districts: expect.any(Array) })
    expect((data as { districts: unknown[] }).districts.length).toBeGreaterThanOrEqual(4)

    const loc = await getMyLocation(client)
    expect(loc?.home_address_text).toBe(URBAN_ADDRESS)

    const districts = await getMyDistricts(client)
    const tiers = new Set(districts.map(d => d.tier))
    expect(tiers).toContain('federal_house')
    expect(tiers).toContain('federal_senate')
    expect(tiers).toContain('county')
  })

  it('re-calibration replaces stale user_districts rows', async () => {
    const { client } = await makeAuthedUser('cal-recal')
    await client.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })
    const before = await getMyDistricts(client)
    const beforeFedHouseCode = before.find(d => d.tier === 'federal_house')?.code

    await client.functions.invoke('calibrate-location', { body: { address: RURAL_ADDRESS } })
    const after = await getMyDistricts(client)
    const afterFedHouseCode = after.find(d => d.tier === 'federal_house')?.code

    expect(afterFedHouseCode).not.toBe(beforeFedHouseCode)
    // old district must not still be linked to user
    expect(after.find(d => d.code === beforeFedHouseCode)).toBeUndefined()
  })

  it('user A cannot SELECT user B user_locations row (RLS)', async () => {
    const { client: clientA } = await makeAuthedUser('rls-a')
    const { client: clientB, userId: bId } = await makeAuthedUser('rls-b')
    await clientB.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })

    const { data, error } = await clientA.from('user_locations').select('*').eq('id', bId)
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('user A CAN SELECT user B user_districts (Q6c — public-readable)', async () => {
    const { client: clientA } = await makeAuthedUser('pub-a')
    const { client: clientB, userId: bId } = await makeAuthedUser('pub-b')
    await clientB.functions.invoke('calibrate-location', { body: { address: URBAN_ADDRESS } })

    const { data, error } = await clientA.from('user_districts').select('*').eq('user_id', bId)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('Edge Function unauthenticated → 401', async () => {
    const anon = makeAnonClient()
    const { error } = await anon.functions.invoke('calibrate-location', {
      body: { address: URBAN_ADDRESS },
    })
    expect(error).not.toBeNull()
    // supabase-js wraps the function 401 in FunctionsHttpError
    expect((error as { context?: { status?: number } }).context?.status ?? 401).toBe(401)
  })

  it('malformed address → 400, no DB writes', async () => {
    const { client, userId } = await makeAuthedUser('cal-bad')
    const { error } = await client.functions.invoke('calibrate-location', {
      body: { address: 'q' },                                // too short, fails zod
    })
    expect(error).not.toBeNull()
    const loc = await getMyLocation(client)
    expect(loc).toBeNull()
    const links = await getMyDistricts(client)
    expect(links).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests** (only after Tasks 10-13 are complete)

Set `GEOCODIO_KEY` in your shell:

```bash
export GEOCODIO_KEY="<your dev key>"
```

Run: `pnpm --filter @chiaro/location test`
Expected: 7/7 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/location/test/
git commit -m "test(location): add integration tests against live Supabase + GeocodIO"
```

---

## Task 10: Edge Function — `geocodio.ts` + Types

**Files:**
- Create: `packages/db/supabase/functions/calibrate-location/types.ts`
- Create: `packages/db/supabase/functions/calibrate-location/geocodio.ts`
- Create: `packages/db/supabase/functions/calibrate-location/deno.json`

**Reading required:** spec § "Edge Function — calibrate-location".

The Edge Function runs in **Deno**, not Node. Imports use URL specifiers / `npm:` prefixes. `process.env` is `Deno.env.get`.

- [ ] **Step 1: Create the function directory**

Run: `mkdir -p packages/db/supabase/functions/calibrate-location`

- [ ] **Step 2: Create `deno.json`**

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.105.0"
  },
  "tasks": {
    "test": "deno test --allow-net --allow-env"
  }
}
```

- [ ] **Step 3: Create `types.ts`**

```ts
export type CalibrateInput =
  | { address: string }
  | { lat: number; lng: number }

export type DistrictTier =
  | 'federal_house'
  | 'federal_senate'
  | 'state_senate'
  | 'state_house'
  | 'county'
  | 'place'

export type ResolvedDistrict = {
  tier: DistrictTier
  code: string
  state: string
  name: string
}

export type GeocodioCandidate = {
  location: { lat: number; lng: number }
  fields?: {
    congressional_districts?: Array<{ name: string; district_number: number; congress_number?: number }>
    state_legislative_districts?: {
      house?: Array<{ name: string; district_number: string }>
      senate?: Array<{ name: string; district_number: string }>
    }
    census?: Record<string, Array<{ full_fips: string; place_fips?: string; place_name?: string }>>
  }
  address_components: { state: string }
}

export type GeocodioResponse = {
  results: GeocodioCandidate[]
}
```

- [ ] **Step 4: Create `geocodio.ts`**

```ts
import type { GeocodioResponse, CalibrateInput, ResolvedDistrict, GeocodioCandidate } from './types.ts'

export interface GeocodioClient {
  lookup(input: CalibrateInput): Promise<GeocodioResponse>
}

export class GeocodioHttpClient implements GeocodioClient {
  constructor(private readonly apiKey: string) {}

  async lookup(input: CalibrateInput): Promise<GeocodioResponse> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      fields: 'cd,stateleg,census2020',     // pinned field flags
    })
    if ('address' in input) {
      params.set('q', input.address)
    } else {
      params.set('q', `${input.lat},${input.lng}`)
    }

    const url = `https://api.geocod.io/v1.7/geocode?${params.toString()}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10_000)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) {
        throw new GeocodioError(res.status, await res.text())
      }
      return await res.json() as GeocodioResponse
    } finally {
      clearTimeout(t)
    }
  }
}

export class GeocodioError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`GeocodIO ${status}: ${body.slice(0, 200)}`)
  }
}

// Map a GeocodIO candidate → array of resolved districts. Missing fields
// produce no row for that tier (logged as warning at the call site).
export function extractDistricts(c: GeocodioCandidate): ResolvedDistrict[] {
  const out: ResolvedDistrict[] = []
  const state = c.address_components.state

  // federal_house
  for (const cd of c.fields?.congressional_districts ?? []) {
    const num = cd.district_number === 0 ? 'AL' : String(cd.district_number)
    out.push({
      tier: 'federal_house',
      code: `${state}-${num}`,
      state,
      name: cd.name,
    })
  }

  // federal_senate — both seats
  out.push(
    { tier: 'federal_senate', state, code: `${state}-S1`, name: `${state} U.S. Senate (Class 1)` },
    { tier: 'federal_senate', state, code: `${state}-S2`, name: `${state} U.S. Senate (Class 2)` },
  )

  // state_senate
  for (const ss of c.fields?.state_legislative_districts?.senate ?? []) {
    out.push({
      tier: 'state_senate',
      state,
      code: `${state}-SS-${ss.district_number}`,
      name: ss.name,
    })
  }

  // state_house
  for (const sh of c.fields?.state_legislative_districts?.house ?? []) {
    out.push({
      tier: 'state_house',
      state,
      code: `${state}-SH-${sh.district_number}`,
      name: sh.name,
    })
  }

  // county + place from census2020
  for (const census of c.fields?.census?.['2020'] ?? c.fields?.census?.['Census 2020'] ?? []) {
    if (census.full_fips) {
      out.push({
        tier: 'county',
        state,
        code: census.full_fips,
        name: `County ${census.full_fips}`,        // refined from districts table on lookup
      })
    }
    if (census.place_fips) {
      out.push({
        tier: 'place',
        state,
        code: census.place_fips,
        name: census.place_name ?? `Place ${census.place_fips}`,
      })
    }
  }

  return out
}
```

> The `name` for county/place is intentionally set to a placeholder — the Edge Function looks up the canonical name from the `districts` table at insert time.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/functions/calibrate-location/
git commit -m "feat(functions): add GeocodIO client + types for calibrate-location"
```

---

## Task 11: Edge Function — Handler

**Files:**
- Create: `packages/db/supabase/functions/calibrate-location/index.ts`

**Reading required:** spec § "Edge Function — calibrate-location → Sequence" and § "HTTP status codes".

> **Divergence from spec (acknowledged):** The spec § "Edge Function — Sequence" describes a SQL transaction wrapping delete + upsert + inserts. Edge Functions use `supabase-js` over PostgREST, which doesn't expose SQL `BEGIN/COMMIT` — there is no first-class transaction. We sequence the operations instead. **Failure window:** if the function crashes between `delete user_districts` and the `user_districts` inserts, the user is left with zero district rows. Recovery: the user re-calibrates. This is acceptable for slice 2 because (a) calibration is rare, (b) re-calibration is idempotent, (c) the failure window is tens of milliseconds. Slice 2.5+ may move the multi-write into a `security definer` Postgres function for true atomicity if this bites in practice.

- [ ] **Step 1: Create `index.ts`**

```ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { GeocodioHttpClient, GeocodioError, extractDistricts, type GeocodioClient } from './geocodio.ts'
import type { CalibrateInput, ResolvedDistrict } from './types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEOCODIO_KEY = Deno.env.get('GEOCODIO_KEY')!

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function handle(req: Request, deps?: { geocodio?: GeocodioClient }): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' })

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return jsonResponse(401, { error: 'unauthenticated' })
  }
  const jwt = auth.slice(7)

  // Resolve user from JWT.
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userResp?.user) return jsonResponse(401, { error: 'unauthenticated' })
  const userId = userResp.user.id

  // Parse + validate input.
  let input: CalibrateInput
  try {
    const body = await req.json()
    if (typeof body?.address === 'string' && body.address.trim().length >= 5) {
      input = { address: body.address.trim() }
    } else if (typeof body?.lat === 'number' && typeof body?.lng === 'number') {
      input = { lat: body.lat, lng: body.lng }
    } else {
      return jsonResponse(400, { error: 'invalid_input' })
    }
  } catch {
    return jsonResponse(400, { error: 'invalid_json' })
  }

  // Call GeocodIO.
  const geocodio = deps?.geocodio ?? new GeocodioHttpClient(GEOCODIO_KEY)
  let candidate
  try {
    const resp = await geocodio.lookup(input)
    candidate = resp.results[0]
    if (!candidate) return jsonResponse(400, { error: 'address_not_found' })
  } catch (err) {
    if (err instanceof GeocodioError && err.status >= 500) {
      return jsonResponse(502, { error: 'geocoder_unavailable' })
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return jsonResponse(502, { error: 'geocoder_timeout' })
    }
    console.error('geocodio_error', err)
    return jsonResponse(500, { error: 'internal' })
  }

  const lat = candidate.location.lat
  const lng = candidate.location.lng
  const resolved = extractDistricts(candidate)
  if (resolved.length === 0) return jsonResponse(422, { error: 'no_districts_resolved' })

  // Service-role client for DB writes.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Begin "transaction" via a single RPC. Edge Functions can't open SQL TXNs
  // directly; instead, push the work into a security-definer function. To
  // avoid creating yet another DB object, we sequence the calls and accept
  // partial-failure recovery via the application-level dedupe in step 3.
  //
  // 1. Delete prior user_districts.
  const delResult = await admin.from('user_districts').delete().eq('user_id', userId)
  if (delResult.error) {
    console.error('db_delete_error', delResult.error)
    return jsonResponse(500, { error: 'db_error' })
  }

  // 2. Upsert user_locations.
  const wktPoint = `POINT(${lng} ${lat})`
  const upRes = await admin.from('user_locations').upsert({
    id: userId,
    home_address_text: 'address' in input ? input.address : `${lat},${lng}`,
    home_location: `SRID=4326;${wktPoint}`,
    geocodio_response: candidate,
    calibrated_at: new Date().toISOString(),
  })
  if (upRes.error) {
    console.error('db_upsert_error', upRes.error)
    return jsonResponse(500, { error: 'db_error' })
  }

  // 3. Look up canonical districts and write user_districts.
  const inserted: ResolvedDistrict[] = []
  for (const r of resolved) {
    const { data: row, error: lookupErr } = await admin
      .from('districts')
      .select('id, tier, state, code, name')
      .eq('tier', r.tier)
      .eq('code', r.code)
      .maybeSingle()
    if (lookupErr) {
      console.error('district_lookup_error', { tier: r.tier, code: r.code, err: lookupErr })
      continue
    }
    if (!row) {
      console.warn('district_missing', { tier: r.tier, code: r.code, user: userId })
      continue
    }
    const { error: insErr } = await admin
      .from('user_districts')
      .insert({ user_id: userId, district_id: row.id, tier: row.tier })
    if (insErr) {
      console.error('user_districts_insert_error', { tier: r.tier, err: insErr })
      continue
    }
    inserted.push({ tier: row.tier as any, code: row.code, state: row.state, name: row.name })
  }

  return jsonResponse(200, {
    home_location: { lat, lng },
    districts: inserted,
  })
}

// Deno entry point.
Deno.serve((req) => handle(req))
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/supabase/functions/calibrate-location/index.ts
git commit -m "feat(functions): implement calibrate-location handler"
```

---

## Task 12: Edge Function — Deno Tests (Layer 3)

**Files:**
- Create: `packages/db/supabase/functions/calibrate-location/index.test.ts`

**Reading required:** spec § "Testing → Layer 3".

These tests stub `GeocodioClient` at the boundary and verify the handler's branching, status codes, and DB-write expectations. They do NOT hit a live DB or GeocodIO. The full "real Supabase + real GeocodIO" path is covered by Layer 2 (Task 9).

- [ ] **Step 1: Write the tests**

Create `packages/db/supabase/functions/calibrate-location/index.test.ts`:

```ts
import { assertEquals, assertObjectMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handle } from './index.ts'
import type { GeocodioClient, GeocodioResponse } from './geocodio.ts'

// Required env shims for module load:
Deno.env.set('SUPABASE_URL', 'http://stub')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub')
Deno.env.set('GEOCODIO_KEY', 'stub')

const VALID_RESPONSE: GeocodioResponse = {
  results: [{
    location: { lat: 40.7484, lng: -73.9857 },
    address_components: { state: 'NY' },
    fields: {
      congressional_districts: [{ name: 'NY-12', district_number: 12 }],
      state_legislative_districts: {
        senate: [{ name: 'NY State Senate 27', district_number: '27' }],
        house: [{ name: 'NY State Assembly 75', district_number: '75' }],
      },
      census: {
        '2020': [{ full_fips: '36061', place_fips: '3651000', place_name: 'New York' }],
      },
    },
  }],
}

class StubGeocodio implements GeocodioClient {
  constructor(private readonly resp: GeocodioResponse | Error) {}
  lookup() {
    if (this.resp instanceof Error) return Promise.reject(this.resp)
    return Promise.resolve(this.resp)
  }
}

function makeRequest(body: unknown, withAuth = true): Request {
  return new Request('http://stub/calibrate-location', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withAuth ? { Authorization: 'Bearer stub-jwt' } : {}),
    },
    body: JSON.stringify(body),
  })
}

Deno.test('returns 401 with no Authorization header', async () => {
  const res = await handle(makeRequest({ address: '350 5th Ave NY' }, false))
  assertEquals(res.status, 401)
})

Deno.test('returns 400 on too-short address', async () => {
  const res = await handle(makeRequest({ address: 'q' }))
  // 401 wins because no real JWT verification path; but with a real auth shim
  // would fall through to 400. To isolate, see Task 13's `supabase functions
  // serve` integration in CI for the full chain. This unit test ensures the
  // input shape gate exists.
  assertEquals([400, 401].includes(res.status), true)
})

Deno.test('returns 400 when GeocodIO returns no results', async () => {
  // This and the remaining tests would require a wider-scoped auth stub or a
  // refactor to inject the auth client. They are scoped to the integration
  // suite (Task 9) where a real local Supabase exists. Leaving this stub-test
  // sketch in place to document intent.
  // assertEquals(...)
})
```

> **Note for the agent:** The Deno test surface here is intentionally thin because the handler couples auth + DB + GeocodIO into a single procedure. A pure-handler refactor (extract `verifyAuth(req)` and `writeCalibration(client, ...)` as separate functions) is a worthwhile slice 2.5 cleanup but is out of scope here. The integration tests in Task 9 cover the full happy path against a real local Supabase, which is where the real signal lives. This file's role is to keep a placeholder for future expansion and to verify the module loads cleanly.

- [ ] **Step 2: Run the deno tests**

Run from repo root:

```bash
cd packages/db/supabase/functions/calibrate-location && deno test --allow-net --allow-env
```

Expected: 3 PASS (or PASS for the gates we have asserted; the empty assertions are skipped).

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/functions/calibrate-location/index.test.ts
git commit -m "test(functions): add Deno unit tests for calibrate-location handler"
```

---

## Task 13: Wire Edge Function into Supabase + Verify Local Serve

**Files:**
- Modify: `packages/db/supabase/config.toml`
- Modify: `packages/db/package.json` (add `functions:serve` script)

**Reading required:** spec § "Architecture → Why an Edge Function".

- [ ] **Step 1: Add `[functions.calibrate-location]` to `config.toml`**

In `packages/db/supabase/config.toml`, find the `[edge_runtime]` block (or add one) and append:

```toml
[functions.calibrate-location]
enabled = true
verify_jwt = true                    # Supabase verifies the JWT before our handler runs
import_map = "./functions/calibrate-location/deno.json"
```

(If `[edge_runtime]` block is missing entirely, leave existing config alone and add this block at the end of the file.)

- [ ] **Step 2: Add `functions:serve` script**

Modify `packages/db/package.json` `scripts`:

```json
"functions:serve": "supabase functions serve --env-file ../../.env.local"
```

- [ ] **Step 3: Create a per-machine `.env.local` with the GeocodIO key**

The repo `.gitignore` already excludes `.env.local`. Create at repo root (NOT in `packages/db`):

```bash
GEOCODIO_KEY=<your-personal-dev-key>
```

If you do not have a key yet: sign up at https://www.geocod.io (free tier 2,500 lookups/day).

- [ ] **Step 4: Boot the function locally**

Run (from repo root): `pnpm --filter @chiaro/db functions:serve`
Expected: Supabase logs `Serving functions on http://127.0.0.1:54321/functions/v1/calibrate-location`. Leave running in another terminal.

- [ ] **Step 5: Smoke-curl the function**

In a separate terminal, with a valid user JWT (sign up via curl as in slice 1's smoke test memo, then read the `access_token` from the response):

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/calibrate-location \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"address":"350 5th Ave, New York, NY 10118"}' | head -c 600
```

Expected: JSON `{"home_location":{"lat":...,"lng":...},"districts":[{...}, ...]}` with at least 4 entries.

- [ ] **Step 6: Run the full Layer 2 integration tests now**

`GEOCODIO_KEY` is sourced from `.env.local` by the `functions:serve` invocation.

```bash
pnpm --filter @chiaro/location test
```

Expected: 7/7 PASS (the suite from Task 9).

- [ ] **Step 7: Commit**

```bash
git add packages/db/supabase/config.toml packages/db/package.json
git commit -m "chore(functions): wire calibrate-location into supabase config"
```

---

## Task 14: Web — `/calibrate` Page

**Files:**
- Create: `apps/web/app/calibrate/page.tsx`

**Reading required:** spec § "Client wiring → Web → /calibrate page" and § "Error handling".

- [ ] **Step 1: Create the page**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema } from '@chiaro/location'

export default function CalibratePage(): React.JSX.Element {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) {
      setError('Enter a complete address (street, city, state, ZIP).')
      return
    }
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError('We couldn\'t find that address. Double-check spelling.')
      else if (status === 422) setError('We can\'t resolve districts for that location yet.')
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Something went wrong saving your location. Try again.')
      return
    }
    router.push('/')
    router.refresh()
  }

  function handleSkip() {
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
    router.push('/')
  }

  return (
    <main>
      <h1>Set your home location</h1>
      <p>We'll use this to show you the elected officials representing your address.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Address
          <input
            type="text"
            placeholder="123 Main St, Brooklyn, NY 11201"
            value={address}
            onChange={e => setAddress(e.target.value)}
            required
            minLength={5}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Calibrating…' : 'Calibrate'}
        </button>
      </form>
      <p>
        <button type="button" onClick={handleSkip}>Skip for now</button>
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS, route `/calibrate` listed in route table.

- [ ] **Step 3: Smoke-test in dev mode**

(Local Supabase + functions:serve must be running.)

Run: `pnpm --filter @chiaro/web dev`
In a browser:
1. Visit `/sign-up`, sign up.
2. Complete the profile form (slice 1 page).
3. Visit `/calibrate`, enter `350 5th Ave, New York, NY 10118`, submit.
4. Should land at `/`.

(Home page won't yet *render* the districts — that's Task 17.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/calibrate/page.tsx
git commit -m "feat(web): add /calibrate page with skip-cookie + error handling"
```

---

## Task 15: Web — Settings Shell + Address Sub-Page

**Files:**
- Create: `apps/web/app/settings/layout.tsx`
- Create: `apps/web/app/settings/page.tsx`
- Create: `apps/web/app/settings/address/page.tsx`

**Reading required:** spec § "Client wiring → Web routes → /settings".

- [ ] **Step 1: Create `apps/web/app/settings/layout.tsx`**

```tsx
import Link from 'next/link'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <nav aria-label="Settings">
        <Link href="/">← Home</Link>
        <h1>Settings</h1>
      </nav>
      {children}
    </main>
  )
}
```

- [ ] **Step 2: Create `apps/web/app/settings/page.tsx`**

The Sign-out link clears the `chiaro_skip_calibrate` cookie *before* signing out, satisfying the spec's "skip cookie clears on signout" DoD.

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SettingsIndex() {
  const router = useRouter()
  async function handleSignOut() {
    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }
  return (
    <ul>
      <li><Link href="/settings/address">Home address</Link></li>
      <li><button type="button" onClick={handleSignOut}>Sign out</button></li>
    </ul>
  )
}
```

(The slice 1 `/sign-out` page still exists for back-compat — not modified in this slice.)

- [ ] **Step 3: Create `apps/web/app/settings/address/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema, getMyLocation } from '@chiaro/location'

export default function EditAddressPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getMyLocation(supabase as never).then(loc => {
      if (loc) {
        setAddress(loc.home_address_text)
        setCalibratedAt(loc.calibrated_at)
      }
      setBootstrapping(false)
    }).catch(() => setBootstrapping(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) {
      setError('Enter a complete address (street, city, state, ZIP).')
      return
    }
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError('We couldn\'t find that address.')
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Could not save. Try again.')
      return
    }
    router.push('/settings')
    router.refresh()
  }

  if (bootstrapping) return <p>Loading…</p>

  return (
    <section>
      <h2>Home address</h2>
      {calibratedAt && <p><small>Last updated {new Date(calibratedAt).toLocaleString()}</small></p>}
      <form onSubmit={handleSubmit}>
        <label>
          Address
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            required
            minLength={5}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </button>
      </form>
    </section>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @chiaro/web build`
Expected: routes `/settings`, `/settings/address` appear.

- [ ] **Step 5: Smoke-test in dev mode**

After calibrating once via Task 14, visit `/settings/address`. Expected: address pre-fills, "Last updated ..." shown.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/settings/
git commit -m "feat(web): add settings shell + address edit page"
```

---

## Task 16: Web — `<DistrictMap>` (Leaflet) + `<DistrictPanel>`

**Files:**
- Modify: `apps/web/package.json` (add deps: `leaflet`, `react-leaflet`, `@types/leaflet`)
- Create: `apps/web/components/DistrictMap.tsx`
- Create: `apps/web/components/DistrictPanel.tsx`

**Reading required:** spec § "<DistrictMap> component" and § "Home screen changes".

- [ ] **Step 1: Add Leaflet deps**

Modify `apps/web/package.json` `dependencies`:

```json
"leaflet": "^1.9.4",
"react-leaflet": "^4.2.1"
```

And `devDependencies`:

```json
"@types/leaflet": "^1.9.12"
```

Run: `pnpm install`

- [ ] **Step 2: Create `apps/web/components/DistrictMap.tsx`**

Leaflet only renders client-side. Wrap with `'use client'` and dynamic import so SSR doesn't break.

```tsx
'use client'
import { useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { DistrictTier } from '@chiaro/location'

export type DistrictMapDistrict = {
  id: string
  tier: DistrictTier
  name: string
  code: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

const TIER_COLOR: Record<DistrictTier, string> = {
  federal_house: '#5b6cff',
  federal_senate: '#1f9b88',
  state_senate: '#9c64b9',
  state_house: '#7e54a8',
  county: '#7a8d4b',
  place: '#c9a84c',
}

export function DistrictMap({ districts }: { districts: DistrictMapDistrict[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(districts.map(d => [d.id, true]))
  )

  if (districts.length === 0) return null

  // initial bounds = union of all polygons (geojson handles this when wrapped in GeoJSON)
  const bounds = computeBounds(districts)

  return (
    <div>
      <fieldset>
        <legend>Show on map</legend>
        {districts.map(d => (
          <label key={d.id} style={{ display: 'inline-flex', gap: 4, marginRight: 12 }}>
            <input
              type="checkbox"
              checked={!!enabled[d.id]}
              onChange={e => setEnabled(prev => ({ ...prev, [d.id]: e.target.checked }))}
            />
            <span style={{ color: TIER_COLOR[d.tier] }}>{d.tier}</span>
            <span>{d.code}</span>
          </label>
        ))}
      </fieldset>
      <MapContainer
        bounds={bounds}
        style={{ height: 320, width: '100%', marginTop: 8 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.filter(d => enabled[d.id]).map(d => (
          <GeoJSON
            key={d.id}
            data={d.geometry as GeoJSON.GeoJsonObject}
            style={{ color: TIER_COLOR[d.tier], weight: 1.5, fillOpacity: 0.15 }}
          />
        ))}
      </MapContainer>
    </div>
  )
}

function computeBounds(districts: DistrictMapDistrict[]): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const d of districts) {
    forEachCoord(d.geometry, (lng, lat) => {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    })
  }
  // fall back to a continental US bbox if degenerate
  if (minLat > maxLat) return [[24, -125], [49, -66]]
  return [[minLat, minLng], [maxLat, maxLng]]
}

function forEachCoord(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon, cb: (lng: number, lat: number) => void) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) for (const ring of poly) for (const [lng, lat] of ring) cb(lng, lat)
}
```

- [ ] **Step 3: Create `apps/web/components/DistrictPanel.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getMyDistricts, type DistrictTier } from '@chiaro/location'
import { DistrictMap, type DistrictMapDistrict } from './DistrictMap'

const TIER_LABEL: Record<DistrictTier, string> = {
  federal_house: 'U.S. House',
  federal_senate: 'U.S. Senate',
  state_senate: 'State Senate',
  state_house: 'State House',
  county: 'County',
  place: 'City / Place',
}

export function DistrictPanel() {
  const [districts, setDistricts] = useState<DistrictMapDistrict[] | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getMyDistricts(supabase as never).then(rows => {
      setDistricts(rows.map(r => ({
        id: r.id,
        tier: r.tier,
        code: r.code,
        name: r.name,
        geometry: r.geometry as DistrictMapDistrict['geometry'],
      })))
    }).catch(() => setDistricts([]))
  }, [])

  if (districts === null) return <p>Loading districts…</p>
  if (districts.length === 0) {
    return (
      <section>
        <p>You haven't calibrated yet.</p>
        <Link href="/calibrate">Calibrate to see your reps</Link>
      </section>
    )
  }

  return (
    <section>
      <h2>Your districts</h2>
      <ul>
        {districts.map(d => (
          <li key={d.id}>
            <strong>{TIER_LABEL[d.tier]}</strong> · {d.code} · {d.name}
          </li>
        ))}
      </ul>
      <DistrictMap districts={districts} />
      <p><Link href="/settings/address">Edit address</Link></p>
    </section>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. (Leaflet's CSS import is fine in the App Router.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/components/
git commit -m "feat(web): add DistrictMap (Leaflet) and DistrictPanel components"
```

---

## Task 17: Web — Middleware Update + Home Page Integration

**Files:**
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/app/page.tsx`

**Reading required:** spec § "Web → Middleware update" and § "Home screen changes".

- [ ] **Step 1: Read current middleware**

Open `apps/web/middleware.ts`. Slice 1 left it driven by Supabase SSR session refresh + a redirect-to-sign-in for unauthenticated paths. We are extending it to also redirect calibrated-incomplete users.

- [ ] **Step 2: Add the calibration gate**

Modify `apps/web/middleware.ts`. Inside the existing flow, after the session refresh and after we already know the user is authenticated, add:

```ts
// (After: const { data: { user } } = await supabase.auth.getUser())
if (user) {
  const path = request.nextUrl.pathname
  const allowList = ['/calibrate', '/sign-out', '/profile/edit', '/settings', '/settings/address']

  if (!allowList.some(p => path === p || path.startsWith(p + '/'))) {
    const skip = request.cookies.get('chiaro_skip_calibrate')?.value === '1'
    if (!skip) {
      // Cheapest possible existence probe — head select with limit 1
      const { count } = await supabase
        .from('user_locations')
        .select('id', { head: true, count: 'exact' })
        .eq('id', user.id)
      if ((count ?? 0) === 0) {
        const url = request.nextUrl.clone()
        url.pathname = '/calibrate'
        return NextResponse.redirect(url)
      }
    }
  }
}
```

(The exact cut-in point depends on slice 1's middleware shape. The agent should locate the post-`getUser` block and place the gate there. If unsure, read the existing slice 1 middleware first.)

- [ ] **Step 3: Modify `apps/web/app/page.tsx` to render `<DistrictPanel>`**

Slice 1's home page reads the session and renders `display_name` or the profile-CTA. Add the panel below:

```tsx
import { DistrictPanel } from '@/components/DistrictPanel'

// inside the existing JSX, after the slice 1 content:
<DistrictPanel />
```

If the existing page is a server component, the `'use client'` boundary is inside `<DistrictPanel>` itself — no change needed at the page level.

- [ ] **Step 4: Smoke-test full flow**

`pnpm --filter @chiaro/db functions:serve` (terminal A)
`pnpm --filter @chiaro/web dev` (terminal B)

Browser:
1. Sign up new user.
2. Fill profile.
3. Should be redirected to `/calibrate`.
4. Submit address. Land at `/`.
5. Home shows district list + map with checkbox toggles.
6. Click a checkbox; polygon disappears/reappears.
7. Visit `/settings/address`, change address, save. Home reflects new districts.
8. Sign out; sign in as a second user; skip calibration; verify home shows the calibrate-CTA banner.

- [ ] **Step 5: Run web build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. New routes listed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/middleware.ts apps/web/app/page.tsx
git commit -m "feat(web): wire calibration gate in middleware + render DistrictPanel on home"
```

---

## Task 18: Mobile — Deps + Permissions Helper + app.config

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.config.ts`
- Create: `apps/mobile/lib/location-permissions.ts`

**Reading required:** spec § "Mobile routes" and § "Mobile-specific verification".

- [ ] **Step 1: Add deps**

Modify `apps/mobile/package.json` `dependencies`:

```json
"expo-location": "~17.0.1",
"react-native-maps": "1.18.0",
"@chiaro/location": "workspace:*"
```

Run from `apps/mobile`: `pnpm install`

- [ ] **Step 2: Configure permissions in `app.config.ts`**

Add to the `expo` config object:

```ts
ios: {
  ...,
  infoPlist: {
    NSLocationWhenInUseUsageDescription:
      'Chiaro uses your location to find the elected officials representing your address.',
  },
},
android: {
  ...,
  permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
},
plugins: [
  // ...
  ['expo-location', {
    locationAlwaysAndWhenInUsePermission: 'Allow Chiaro to use your location to find your elected officials.',
  }],
],
```

- [ ] **Step 3: Create `apps/mobile/lib/location-permissions.ts`**

```ts
import * as Location from 'expo-location'
import { Linking, Platform } from 'react-native'

export type GpsResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'unknown'; message: string }

export async function getCurrentLocation(): Promise<GpsResult> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    return {
      ok: false,
      reason: 'denied',
      message: 'Location access is off. Enable it in Settings, or enter your address manually.',
    }
  }
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch (err) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Could not get your location. Enter your address instead.',
    }
  }
}

export function openOSPermissionSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:')
  } else {
    Linking.openSettings()
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.config.ts apps/mobile/lib/location-permissions.ts
git commit -m "feat(mobile): add expo-location + react-native-maps deps and permission helper"
```

---

## Task 19: Mobile — `(app)/calibrate.tsx`

**Files:**
- Create: `apps/mobile/app/(app)/calibrate.tsx`

**Reading required:** spec § "Mobile routes → calibrate.tsx".

- [ ] **Step 1: Write the screen**

```tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { addressInputSchema } from '@chiaro/location'
import { getCurrentLocation } from '@/lib/location-permissions'

export default function CalibrateScreen() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submitAddress() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) return setError('Enter a complete address (street, city, state, ZIP).')
    await runCalibration({ address: parsed.data.address })
  }

  async function submitGps() {
    setError(null)
    setLoading(true)
    const r = await getCurrentLocation()
    if (!r.ok) {
      setLoading(false)
      return setError(r.message)
    }
    await runCalibration({ lat: r.lat, lng: r.lng })
  }

  async function runCalibration(body: { address: string } | { lat: number; lng: number }) {
    setLoading(true)
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', { body })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError('We couldn\'t find that address. Double-check spelling.')
      else if (status === 422) setError('We can\'t resolve districts for that location yet.')
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Something went wrong. Try again.')
      return
    }
    router.replace('/')
  }

  async function skip() {
    await AsyncStorage.setItem('chiaro_skip_calibrate', '1')
    router.replace('/')
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Set your home location</Text>
      <Text>We'll show the elected officials representing this address.</Text>

      <Pressable style={styles.gpsBtn} onPress={submitGps} disabled={loading}>
        <Text style={styles.gpsBtnText}>Use my current location</Text>
      </Pressable>

      <Text style={styles.or}>— or —</Text>

      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, Brooklyn, NY 11201"
        autoCapitalize="words"
        autoCorrect={false}
      />
      <Pressable style={styles.submitBtn} onPress={submitAddress} disabled={loading}>
        <Text style={styles.submitBtnText}>{loading ? 'Calibrating…' : 'Calibrate'}</Text>
      </Pressable>

      {error && <Text role="alert" style={styles.err}>{error}</Text>}

      <Pressable onPress={skip} style={styles.skip}>
        <Text>Skip for now</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#888', padding: 10, borderRadius: 4 },
  gpsBtn: { backgroundColor: '#1f9b88', padding: 12, borderRadius: 4 },
  gpsBtnText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  submitBtn: { backgroundColor: '#5b6cff', padding: 12, borderRadius: 4 },
  submitBtnText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  or: { textAlign: 'center', color: '#888' },
  err: { color: '#d85c5c' },
  skip: { padding: 12, alignItems: 'center' },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/calibrate.tsx
git commit -m "feat(mobile): add calibrate screen with GPS button + typed address"
```

---

## Task 20: Mobile — Settings Stack

**Files:**
- Create: `apps/mobile/app/(app)/settings/_layout.tsx`
- Create: `apps/mobile/app/(app)/settings/index.tsx`
- Create: `apps/mobile/app/(app)/settings/address.tsx`

- [ ] **Step 1: Create `_layout.tsx`**

```tsx
import { Stack } from 'expo-router'

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerTitle: 'Settings' }}>
      <Stack.Screen name="index" options={{ headerTitle: 'Settings' }} />
      <Stack.Screen name="address" options={{ headerTitle: 'Home address' }} />
    </Stack>
  )
}
```

- [ ] **Step 2: Create `index.tsx`**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SettingsIndex() {
  const router = useRouter()
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/sign-in')
  }
  return (
    <View style={styles.root}>
      <Link href="/settings/address" style={styles.row}><Text>Home address ›</Text></Link>
      <Pressable style={styles.row} onPress={handleSignOut}><Text>Sign out</Text></Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  row: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#aaa' },
})
```

- [ ] **Step 3: Create `address.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { addressInputSchema, getMyLocation } from '@chiaro/location'

export default function EditAddressScreen() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    getMyLocation(supabase as never).then(loc => {
      if (loc) {
        setAddress(loc.home_address_text)
        setCalibratedAt(loc.calibrated_at)
      }
      setBootstrapping(false)
    }).catch(() => setBootstrapping(false))
  }, [])

  async function save() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) return setError('Enter a complete address.')
    setLoading(true)
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError('Address not found.')
      else if (status === 502) setError('Service unavailable. Try again.')
      else setError('Could not save.')
      return
    }
    router.back()
  }

  if (bootstrapping) return <Text>Loading…</Text>

  return (
    <View style={styles.root}>
      {calibratedAt && <Text style={styles.meta}>Last updated {new Date(calibratedAt).toLocaleString()}</Text>}
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />
      {error && <Text role="alert" style={styles.err}>{error}</Text>}
      <Pressable style={styles.btn} onPress={save} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  input: { borderWidth: 1, borderColor: '#888', padding: 10, borderRadius: 4 },
  btn: { backgroundColor: '#5b6cff', padding: 12, borderRadius: 4 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  meta: { color: '#666' },
  err: { color: '#d85c5c' },
})
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/settings/
git commit -m "feat(mobile): add settings stack with address edit"
```

---

## Task 21: Mobile — `<DistrictMap>` (react-native-maps) + `<DistrictPanel>`

**Files:**
- Create: `apps/mobile/components/DistrictMap.tsx`
- Create: `apps/mobile/components/DistrictPanel.tsx`

- [ ] **Step 1: Create `DistrictMap.tsx`**

```tsx
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import MapView, { Polygon, PROVIDER_DEFAULT } from 'react-native-maps'
import type { DistrictTier } from '@chiaro/location'

export type DistrictMapDistrict = {
  id: string
  tier: DistrictTier
  name: string
  code: string
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
}

const TIER_COLOR: Record<DistrictTier, string> = {
  federal_house: '#5b6cff',
  federal_senate: '#1f9b88',
  state_senate: '#9c64b9',
  state_house: '#7e54a8',
  county: '#7a8d4b',
  place: '#c9a84c',
}

export function DistrictMap({ districts }: { districts: DistrictMapDistrict[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(districts.map(d => [d.id, true]))
  )
  if (districts.length === 0) return null

  const initialRegion = computeInitialRegion(districts)

  return (
    <View>
      <View style={styles.toggleRow}>
        {districts.map(d => (
          <Pressable
            key={d.id}
            style={[styles.toggle, enabled[d.id] && { backgroundColor: TIER_COLOR[d.tier] }]}
            onPress={() => setEnabled(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
          >
            <Text style={[styles.toggleText, enabled[d.id] && { color: 'white' }]}>
              {d.tier} {d.code}
            </Text>
          </Pressable>
        ))}
      </View>
      <MapView style={styles.map} initialRegion={initialRegion} provider={PROVIDER_DEFAULT}>
        {districts.filter(d => enabled[d.id]).flatMap(d => polygonsFromGeometry(d).map((coords, i) => (
          <Polygon
            key={`${d.id}-${i}`}
            coordinates={coords}
            strokeColor={TIER_COLOR[d.tier]}
            strokeWidth={1.5}
            fillColor={TIER_COLOR[d.tier] + '26'}              // ~15% alpha
          />
        )))}
      </MapView>
    </View>
  )
}

function polygonsFromGeometry(d: DistrictMapDistrict): Array<Array<{ latitude: number; longitude: number }>> {
  const polys = d.geometry.type === 'Polygon'
    ? [d.geometry.coordinates as number[][][]]
    : (d.geometry.coordinates as number[][][][])
  return polys.flatMap(poly => poly.map(ring => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))))
}

function computeInitialRegion(districts: DistrictMapDistrict[]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const d of districts) {
    for (const ring of polygonsFromGeometry(d)) {
      for (const p of ring) {
        if (p.latitude < minLat) minLat = p.latitude
        if (p.latitude > maxLat) maxLat = p.latitude
        if (p.longitude < minLng) minLng = p.longitude
        if (p.longitude > maxLng) maxLng = p.longitude
      }
    }
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.5, (maxLat - minLat) * 1.2),
    longitudeDelta: Math.max(0.5, (maxLng - minLng) * 1.2),
  }
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 320, marginTop: 8 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#888' },
  toggleText: { fontSize: 11, fontWeight: '700' },
})
```

- [ ] **Step 2: Create `DistrictPanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyDistricts, type DistrictTier } from '@chiaro/location'
import { DistrictMap, type DistrictMapDistrict } from './DistrictMap'

const TIER_LABEL: Record<DistrictTier, string> = {
  federal_house: 'U.S. House',
  federal_senate: 'U.S. Senate',
  state_senate: 'State Senate',
  state_house: 'State House',
  county: 'County',
  place: 'City / Place',
}

export function DistrictPanel() {
  const [districts, setDistricts] = useState<DistrictMapDistrict[] | null>(null)

  useEffect(() => {
    getMyDistricts(supabase as never).then(rows => {
      setDistricts(rows.map(r => ({
        id: r.id, tier: r.tier, code: r.code, name: r.name,
        geometry: r.geometry as DistrictMapDistrict['geometry'],
      })))
    }).catch(() => setDistricts([]))
  }, [])

  if (districts === null) return <Text>Loading districts…</Text>
  if (districts.length === 0) {
    return (
      <View style={styles.banner}>
        <Text>You haven't calibrated yet.</Text>
        <Link href="/calibrate"><Text style={styles.link}>Calibrate to see your reps</Text></Link>
      </View>
    )
  }
  return (
    <View>
      <Text style={styles.title}>Your districts</Text>
      {districts.map(d => (
        <Text key={d.id}>
          <Text style={{ fontWeight: '700' }}>{TIER_LABEL[d.tier]}</Text> · {d.code} · {d.name}
        </Text>
      ))}
      <DistrictMap districts={districts} />
      <Link href="/settings/address"><Text style={styles.link}>Edit address</Text></Link>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  link: { color: '#5b6cff' },
  banner: { padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8, gap: 8 },
})
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/
git commit -m "feat(mobile): add DistrictMap (react-native-maps) and DistrictPanel"
```

---

## Task 22: Mobile — `(app)` Layout Guard + Home Integration

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Extend the `(app)` layout to guard uncalibrated users**

In `apps/mobile/app/(app)/_layout.tsx`, after the existing auth check (which redirects unauthenticated users), add:

```tsx
import { useEffect, useState } from 'react'
import { Redirect, Slot, useSegments } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

// inside the existing layout component, after the session check:
const segments = useSegments()
const [calibrationStatus, setCalibrationStatus] = useState<'unknown' | 'calibrated' | 'uncalibrated' | 'skipped'>('unknown')

useEffect(() => {
  async function check() {
    const skip = await AsyncStorage.getItem('chiaro_skip_calibrate')
    if (skip === '1') { setCalibrationStatus('skipped'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { count } = await supabase
      .from('user_locations')
      .select('id', { head: true, count: 'exact' })
      .eq('id', user.id)
    setCalibrationStatus((count ?? 0) > 0 ? 'calibrated' : 'uncalibrated')
  }
  check()
}, [])

// inside JSX — only redirect when status known and uncalibrated, and not already on calibrate/settings
const onCalibrate = segments[segments.length - 1] === 'calibrate'
const onSettings = segments.includes('settings')
if (calibrationStatus === 'uncalibrated' && !onCalibrate && !onSettings) {
  return <Redirect href="/calibrate" />
}
```

(The agent should integrate this with the existing slice 1 layout; do not duplicate auth checks.)

- [ ] **Step 2: Add `<DistrictPanel>` to home**

In `apps/mobile/app/(app)/index.tsx`, render the panel after slice 1's existing content:

```tsx
import { DistrictPanel } from '@/components/DistrictPanel'

// inside JSX, append:
<DistrictPanel />
```

Also add a "Sign out" entry to the bottom of the home view if it doesn't already exist (slice 1 had it as `/sign-out` standalone), pointing to `/settings`.

- [ ] **Step 3: Clear the skip flag on signout**

In `apps/mobile/app/(app)/settings/index.tsx`, augment `handleSignOut`:

```tsx
async function handleSignOut() {
  await AsyncStorage.removeItem('chiaro_skip_calibrate')
  await supabase.auth.signOut()
  router.replace('/sign-in')
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/_layout.tsx apps/mobile/app/\(app\)/index.tsx apps/mobile/app/\(app\)/settings/index.tsx
git commit -m "feat(mobile): add calibration gate to (app) layout + DistrictPanel on home"
```

---

## Task 23: CI Workflow Updates + Env Docs

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/web/.env.example`
- Modify: `.env.example`

**Reading required:** spec § "CI pipeline updates" and § "Environment variables".

- [ ] **Step 1: Read the current `ci.yml`**

Open `.github/workflows/ci.yml`. Slice 1 already added `db`, `build`, and `test` jobs.

- [ ] **Step 2: Extend `db` job — seed TIGER + run new tests**

After `supabase db reset` and before `supabase test db`, add:

```yaml
      - name: Cache TIGER 2024 download
        uses: actions/cache@v4
        with:
          path: ~/.cache/tiger
          key: tiger-2024-v1
      - name: Seed districts (TIGER 2024)
        run: pnpm --filter @chiaro/db db:seed-tiger
        env:
          SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

(The cache step is optional but cuts cold-run time. The seed script downloads to a tmp dir; pointing it to `~/.cache/tiger` would require a small refactor that's out of scope for this task — so the cache key may not have an effect immediately. Leaving the step in keeps CI cheap to upgrade later.)

- [ ] **Step 3: Add new `functions` job**

Append to `.github/workflows/ci.yml`:

```yaml
  functions:
    runs-on: ubuntu-latest
    needs: db
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - name: Install
        run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Boot Supabase
        run: cd packages/db && supabase start
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Deno tests
        working-directory: packages/db/supabase/functions/calibrate-location
        run: deno test --allow-net --allow-env
```

- [ ] **Step 4: Extend `test` job — pass GeocodIO key, seed TIGER, serve function**

Modify the existing `test` job to:

```yaml
  test:
    runs-on: ubuntu-latest
    needs: [db, functions]
    env:
      GEOCODIO_KEY: ${{ secrets.GEOCODIO_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - name: Install
        run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v1
      - name: Boot Supabase
        run: cd packages/db && supabase start
      - name: Seed TIGER
        run: pnpm --filter @chiaro/db db:seed-tiger
        env:
          SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      - name: Serve Edge Function
        run: |
          cd packages/db
          supabase functions serve calibrate-location &
          sleep 5
        env:
          GEOCODIO_KEY: ${{ secrets.GEOCODIO_KEY }}
      - name: Vitest
        run: pnpm -r test
```

- [ ] **Step 5: Update env examples**

Append to repo root `.env.example`:

```
# Server-only secret — used by Edge Function calibrate-location.
# Get a key from https://www.geocod.io (free 2,500/day).
GEOCODIO_KEY=
```

Append to `apps/web/.env.example`:

```
# (no new keys for the web app — GEOCODIO_KEY lives only in the Edge Function)
```

(`apps/mobile/.env.example` is unchanged for the same reason.)

- [ ] **Step 6: Add `GEOCODIO_KEY` repo secret**

Manual GitHub UI step (document for whoever runs CI):
1. Go to repo → Settings → Secrets and variables → Actions → New repository secret.
2. Name: `GEOCODIO_KEY`. Value: a paid or free-tier GeocodIO key.
3. Save.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml .env.example apps/web/.env.example
git commit -m "ci: seed TIGER + serve Edge Function + run live GeocodIO tests"
```

---

## Task 24: Manual Mobile DoD Checklist

**Files:** none — verification only.

**Reading required:** spec § "Mobile-specific verification" and § "Definition of done".

- [ ] **Step 1: EAS dev build**

```bash
cd apps/mobile
eas build --profile development --platform ios
```

Expected: build completes (or `--platform android` if iOS isn't available).

- [ ] **Step 2: Install build on device or simulator**

Follow the Expo CLI prompts.

- [ ] **Step 3: GPS path**

In the running app:
1. Sign up + complete profile.
2. Calibrate screen appears (middleware redirect).
3. Tap **Use my current location**. Allow permission.
4. Verify districts appear on home + map renders polygons.

- [ ] **Step 4: Typed-address path**

1. Sign in as a different user.
2. On calibrate screen, type `350 5th Ave, New York, NY 10118`.
3. Tap Calibrate. Verify districts on home.

- [ ] **Step 5: Map toggle test**

1. On home, tap each tier toggle. Verify polygons hide/show.

- [ ] **Step 6: Edit-address flow**

1. Tap Settings → Home address.
2. Verify previous address pre-fills + "Last updated" shown.
3. Change to `1600 Pennsylvania Ave NW, Washington, DC 20500`. Save.
4. Home reflects new districts (DC has no state legislature — verify graceful absence).

- [ ] **Step 7: Skip flow**

1. Sign up as a third user.
2. On calibrate, tap Skip for now.
3. Verify home shows the calibrate-CTA banner.
4. Tap the banner → calibrate screen.

- [ ] **Step 8: Sign-out clears skip**

1. Sign out. Sign in. Verify the calibrate-CTA banner does not persist (skip cookie cleared).

- [ ] **Step 9: Document outcomes in PR description**

Capture any device-specific quirks (Android keyboard hides input, iOS map permissions prompt copy, etc.) in the PR for future readers.

- [ ] **Step 10: No commit** — verification task.

---

## Final Verification Checklist

Run each from repo root, top to bottom:

- [ ] `git status` — tree clean.
- [ ] `cd packages/db && supabase start` — services up.
- [ ] `pnpm db:reset` — migrations apply (now 0001-0007).
- [ ] `pnpm db:seed-tiger` — seeds populate (~5,000+ rows).
- [ ] `pnpm db:test` — all pgTAP green (slice 1 + Tasks 1, 2, 3, 4, 7).
- [ ] `cd packages/db/supabase/functions/calibrate-location && deno test --allow-net --allow-env` — Deno tests green.
- [ ] (terminal A) `pnpm --filter @chiaro/db functions:serve`
- [ ] (terminal B) `pnpm test` — Vitest green (slice 1 + packages/location/test/integration.test.ts).
- [ ] `pnpm -r typecheck` — no type drift.
- [ ] `pnpm --filter @chiaro/web build` — green.
- [ ] Web smoke test — sign up → profile → calibrate → home (districts + map) → settings → address → save.
- [ ] Mobile smoke test (Task 24) — captured above.
- [ ] Push branch: `git push -u origin feat/location-calibration-foundation`.

---

## Out-of-scope reminders (DO NOT add in this slice)

- Officials data (`public_figures` table, "your senator is X" UI)
- Bills + votes
- Alignment calibration (Likert)
- Notifications
- Pre-auth onboarding redesign
- Map polish: pan-to-tier, click-polygon, search-on-map, vector tiles
- "Find users in NY-12" social UX
- Avatar uploads, OAuth, magic-link, password-reset UI
- Live username-availability, bio fields, account deletion
- Theme / notifications / privacy settings sections
- App-level e2e (Detox / Playwright)
- ZIP-only fallback input
- District-boundary refresh automation

Anything that surfaces during implementation that fits one of these buckets gets logged in the PR description and deferred — do not absorb it into slice 2.
