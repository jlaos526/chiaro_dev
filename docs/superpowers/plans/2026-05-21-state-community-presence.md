# State Community Presence Implementation Plan (sub-slice 5H)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ComingSoonCard('Community Presence')` on `/state-officials/[id]` with `StateCommunityPresenceCard` showing town halls + committee hearings attended + district offices, sourced from a hybrid adapter pattern (TownHallProject nationwide overlay + 5 per-state stubs × 2 components + OpenStates v3 reuse).

**Architecture:** 4 new state-side tables + 1 attendance M:N (migrations 0042–0045). 11 adapters (1 nationwide + 5×2 per-state + 1 OpenStates reuse), all v1 stubs returning `[]`. 3 new hooks in `@chiaro/officials` (workspace stays at 10). Web + mobile card with 3 collapsible subsections. Em-dash NULL convention per [[feedback-null-vs-zero-metrics]]; jest-expo mutable-mock pattern per [[feedback-jest-expo-dynamic-mock-pattern]].

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP, vitest (db/web), jest-expo (mobile), TanStack Query v5, undici fetch (TownHallProject + OpenStates v3 reuse).

**Spec:** `docs/superpowers/specs/2026-05-21-state-community-presence-design.md`

---

## File structure

**Created (~32):**
```
packages/db/supabase/migrations/
  0042_state_town_halls.sql
  0043_state_district_offices.sql
  0044_state_committee_hearings.sql
  0045_state_community_rls.sql
packages/db/supabase/tests/
  state_community_rls.test.sql
packages/db/supabase/seed/
  state-community-ingest.ts
  state-community-ingest.test.ts
  state-community/
    shared.ts
    shared.test.ts
    town-halls/
      townhallproject.ts + .test.ts
      ca-leginfo.ts + .test.ts
      ny-senate.ts + .test.ts
      fl-doe.ts + .test.ts
      tx-capitol.ts + .test.ts
      mi-legislature.ts + .test.ts
    district-offices/
      ca-leginfo.ts + .test.ts
      ny-senate.ts + .test.ts
      fl-doe.ts + .test.ts
      tx-capitol.ts + .test.ts
      mi-legislature.ts + .test.ts
    committee-hearings/
      openstates-v3.ts + .test.ts
  fixtures/state-community/
    {townhallproject, halls-ca, halls-ny, halls-fl, halls-tx, halls-mi}.json
    {offices-ca, offices-ny, offices-fl, offices-tx, offices-mi}.json
    hearings-openstates.json
apps/web/components/state/
  StateCommunityPresenceCard.tsx
  StateTownHallsList.tsx
  StateCommitteeHearingsList.tsx
  StateDistrictOfficesList.tsx
apps/web/test/components/state/
  StateCommunityPresenceCard.test.tsx
  StateTownHallsList.test.tsx
  StateCommitteeHearingsList.test.tsx
  StateDistrictOfficesList.test.tsx
apps/mobile/components/state/
  StateCommunityPresenceCard.tsx
  StateTownHallsList.tsx
  StateCommitteeHearingsList.tsx
  StateDistrictOfficesList.tsx
apps/mobile/test/components/state/
  StateCommunityPresenceCard.test.tsx
```

**Modified:**
```
packages/db/src/types.ts                                            # regenerated
packages/db/package.json                                            # +seed:state-community
packages/officials/src/types.ts                                     # +3 row types
packages/officials/src/keys.ts                                      # +3 query-key entries
packages/officials/src/queries.ts                                   # +3 fetchers
packages/officials/src/hooks.ts                                     # +3 hooks
packages/officials/src/index.ts                                     # barrel re-exports
packages/officials/test/hooks.test.tsx                              # +3 cases
packages/officials/test/queries.integration.test.ts                 # +3 cases
apps/web/components/state/StateOfficialDetailPage.tsx               # swap
apps/web/test/components/state/StateOfficialDetailPage.test.tsx     # mock + count
apps/mobile/components/state/StateOfficialDetailPage.tsx            # swap
apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx  # mock + count
CLAUDE.md                                                           # slice entry + Gotcha #13 + Quick start
```

---

## Task 1: Migration 0042 — state_town_halls

**Files:**
- Create: `packages/db/supabase/migrations/0042_state_town_halls.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5H: state-legislator town halls + public meetings.
-- Parallels federal town_halls (migration 0022) but uses RESTRICT FK
-- per audit-closure precedent + adds source/external_id for multi-
-- adapter dedup (TownHallProject nationwide overlay + per-state augment).

create table public.state_town_halls (
  id                  uuid primary key default gen_random_uuid(),
  official_id         uuid not null references public.officials(id) on delete restrict,
  event_date          date not null,
  city                text,
  state               char(2) not null,
  format              text check (format in ('in_person','virtual','phone','hybrid')),
  attendance_estimate int,
  source_url          text not null,
  source              text not null,
  external_id         text,
  ingested_at         timestamptz not null default now(),
  unique (source, external_id)
);

create index state_town_halls_official_date_idx
  on public.state_town_halls(official_id, event_date desc);
create index state_town_halls_state_date_idx
  on public.state_town_halls(state, event_date desc);

comment on column public.state_town_halls.source is
  'Which adapter populated this row: townhallproject | ca-leginfo | ny-senate | fl-doe | tx-capitol | mi-legislature.';
comment on column public.state_town_halls.external_id is
  'Per-source stable id used for UPSERT dedup. NULL allowed (NULLs distinct per Postgres default).';
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:reset
```

Expected: migrations 0001–0042 apply cleanly.

- [ ] **Step 3: Verify schema**

```bash
pnpm --filter @chiaro/db exec supabase db query "select column_name, data_type from information_schema.columns where table_name = 'state_town_halls' order by ordinal_position"
```

Expected: all 11 columns present; `format` CHECK constraint visible; `(source, external_id)` UNIQUE constraint present.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0042_state_town_halls.sql
git commit -m "feat(db): 0042 state_town_halls

Sub-slice 5H schema. Parallel to federal town_halls (0022) but with
RESTRICT FK + source/external_id columns for multi-adapter dedup.
TownHallProject nationwide overlay UPSERTs first; per-state adapters
UPSERT second tagged with source='<adapter-slug>'."
```

---

## Task 2: Migration 0043 — state_district_offices

**Files:**
- Create: `packages/db/supabase/migrations/0043_state_district_offices.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5H: state-legislator district offices. Net-new (no federal
-- analogue). 5 per-state adapters scrape state-leg profile pages.

create table public.state_district_offices (
  id            uuid primary key default gen_random_uuid(),
  official_id   uuid not null references public.officials(id) on delete restrict,
  kind          text not null check (kind in ('district','satellite','capitol')),
  street_1      text not null,
  street_2      text,
  city          text not null,
  state         char(2) not null,
  postal_code   text,
  phone         text,
  email         text,
  hours_text    text,
  source_url    text not null,
  ingested_at   timestamptz not null default now()
);

create index state_district_offices_official_idx
  on public.state_district_offices(official_id);

comment on column public.state_district_offices.kind is
  'district | satellite | capitol. State-specific types (regional, constituent service) map to satellite.';
comment on column public.state_district_offices.hours_text is
  'Free-form per state convention. No structured-hours normalization in v1.';
```

- [ ] **Step 2: Apply + verify**

```bash
pnpm db:reset
pnpm --filter @chiaro/db exec supabase db query "select column_name, data_type from information_schema.columns where table_name = 'state_district_offices' order by ordinal_position"
```

Expected: 13 columns present; `kind` CHECK constraint visible.

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/migrations/0043_state_district_offices.sql
git commit -m "feat(db): 0043 state_district_offices

Net-new state-side schema (no federal analogue). kind enum capped at
3 (district/satellite/capitol); state-specific types fold into
satellite. hours_text free-form. FK officials.id RESTRICT per audit
closure."
```

---

## Task 3: Migration 0044 — state_committee_hearings + attendance

**Files:**
- Create: `packages/db/supabase/migrations/0044_state_committee_hearings.sql`

- [ ] **Step 1: Write migration**

```sql
-- Sub-slice 5H: state committee hearings + attendance M:N.
-- Composes with slice 5F state_committee_memberships. OpenStates v3
-- /committees endpoint with ?include=meetings is the primary source.

create table public.state_committee_hearings (
  id                       uuid primary key default gen_random_uuid(),
  openstates_committee_id  text,
  state                    char(2) not null,
  session                  text not null,
  hearing_date             date not null,
  location                 text,
  agenda_topic             text,
  source_url               text not null,
  ingested_at              timestamptz not null default now()
);

create index state_committee_hearings_committee_idx
  on public.state_committee_hearings(openstates_committee_id, hearing_date desc);
create index state_committee_hearings_state_session_idx
  on public.state_committee_hearings(state, session, hearing_date desc);

create table public.state_committee_hearing_attendance (
  hearing_id   uuid not null references public.state_committee_hearings(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  primary key (hearing_id, official_id)
);

create index state_committee_hearing_attendance_official_idx
  on public.state_committee_hearing_attendance(official_id);

comment on column public.state_committee_hearings.openstates_committee_id is
  'Nullable for per-state scrape sources that lack OpenStates ocd-org/... ids.';
comment on column public.state_committee_hearings.session is
  'Per-state session text matching state_bills.session format. Per slice 5D precedent.';
```

- [ ] **Step 2: Apply + verify**

```bash
pnpm db:reset
pnpm --filter @chiaro/db exec supabase db query "select table_name from information_schema.tables where table_name in ('state_committee_hearings','state_committee_hearing_attendance')"
```

Expected: both tables present.

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/migrations/0044_state_committee_hearings.sql
git commit -m "feat(db): 0044 state_committee_hearings + attendance M:N

Composes with slice 5F state_committee_memberships. OpenStates v3
/committees ?include=meetings is primary source. attendance has FK
official_id RESTRICT (preserves history) + hearing_id CASCADE
(delete hearing -> attendance gone)."
```

---

## Task 4: Migration 0045 — RLS + pgTAP plan(18)

**Files:**
- Create: `packages/db/supabase/migrations/0045_state_community_rls.sql`
- Create: `packages/db/supabase/tests/state_community_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

```sql
-- Sub-slice 5H: RLS for state_town_halls + state_district_offices +
-- state_committee_hearings + state_committee_hearing_attendance.
-- Read = authenticated. Write = service_role only.

alter table public.state_town_halls                        enable row level security;
alter table public.state_district_offices                  enable row level security;
alter table public.state_committee_hearings                enable row level security;
alter table public.state_committee_hearing_attendance      enable row level security;

-- state_town_halls
create policy state_town_halls_select_auth
  on public.state_town_halls for select to authenticated using (true);
create policy state_town_halls_insert_svc
  on public.state_town_halls for insert to service_role with check (true);
create policy state_town_halls_update_svc
  on public.state_town_halls for update to service_role using (true) with check (true);
create policy state_town_halls_delete_svc
  on public.state_town_halls for delete to service_role using (true);

-- state_district_offices
create policy state_district_offices_select_auth
  on public.state_district_offices for select to authenticated using (true);
create policy state_district_offices_insert_svc
  on public.state_district_offices for insert to service_role with check (true);
create policy state_district_offices_update_svc
  on public.state_district_offices for update to service_role using (true) with check (true);
create policy state_district_offices_delete_svc
  on public.state_district_offices for delete to service_role using (true);

-- state_committee_hearings
create policy state_committee_hearings_select_auth
  on public.state_committee_hearings for select to authenticated using (true);
create policy state_committee_hearings_insert_svc
  on public.state_committee_hearings for insert to service_role with check (true);
create policy state_committee_hearings_update_svc
  on public.state_committee_hearings for update to service_role using (true) with check (true);
create policy state_committee_hearings_delete_svc
  on public.state_committee_hearings for delete to service_role using (true);

-- state_committee_hearing_attendance
create policy state_committee_hearing_attendance_select_auth
  on public.state_committee_hearing_attendance for select to authenticated using (true);
create policy state_committee_hearing_attendance_insert_svc
  on public.state_committee_hearing_attendance for insert to service_role with check (true);
create policy state_committee_hearing_attendance_update_svc
  on public.state_committee_hearing_attendance for update to service_role using (true) with check (true);
create policy state_committee_hearing_attendance_delete_svc
  on public.state_committee_hearing_attendance for delete to service_role using (true);
```

- [ ] **Step 2: Write pgTAP**

```sql
begin;

select plan(18);

-- 1-4. has_table
select has_table('public', 'state_town_halls',                       'state_town_halls table exists');
select has_table('public', 'state_district_offices',                 'state_district_offices table exists');
select has_table('public', 'state_committee_hearings',               'state_committee_hearings table exists');
select has_table('public', 'state_committee_hearing_attendance',     'state_committee_hearing_attendance table exists');

-- 5-8. RLS enabled
select is((select relrowsecurity from pg_class where relname = 'state_town_halls' and relnamespace = 'public'::regnamespace), true, 'RLS on state_town_halls');
select is((select relrowsecurity from pg_class where relname = 'state_district_offices' and relnamespace = 'public'::regnamespace), true, 'RLS on state_district_offices');
select is((select relrowsecurity from pg_class where relname = 'state_committee_hearings' and relnamespace = 'public'::regnamespace), true, 'RLS on state_committee_hearings');
select is((select relrowsecurity from pg_class where relname = 'state_committee_hearing_attendance' and relnamespace = 'public'::regnamespace), true, 'RLS on state_committee_hearing_attendance');

-- 9. format CHECK rejects bad value.
-- Seed a district + official first.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('state_house', 'CA', 'CA-SCH', 'CA SCH test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-sch')
  on conflict (tier, code) do nothing;
insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state, district_id, in_office, source_version)
select 'ocd-person/fx-sch', 'Test SCH', 'Test', 'SCH', 'state_house', 'D', 'CA',
  (select id from public.districts where code = 'CA-SCH'),
  true, 'FX-sch';

select throws_ok(
  $$ insert into public.state_town_halls (official_id, event_date, state, format, source_url, source)
     values ((select id from public.officials where source_version = 'FX-sch'),
             '2026-01-01', 'CA', 'martian', 'https://x', 'townhallproject') $$,
  '23514',
  'new row for relation "state_town_halls" violates check constraint "state_town_halls_format_check"',
  'format CHECK rejects bad value'
);

-- 10. kind CHECK rejects bad value.
select throws_ok(
  $$ insert into public.state_district_offices (official_id, kind, street_1, city, state, source_url)
     values ((select id from public.officials where source_version = 'FX-sch'),
             'mobile', '123 Main', 'San Jose', 'CA', 'https://x') $$,
  '23514',
  'new row for relation "state_district_offices" violates check constraint "state_district_offices_kind_check"',
  'kind CHECK rejects bad value'
);

-- 11. (source, external_id) UNIQUE allows NULL external_id (NULLs distinct).
insert into public.state_town_halls (official_id, event_date, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-sch'),
          '2026-02-01', 'CA', 'https://x', 'townhallproject', null);
insert into public.state_town_halls (official_id, event_date, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-sch'),
          '2026-02-02', 'CA', 'https://y', 'townhallproject', null);
select pass('(source, external_id) UNIQUE allows two NULL external_id rows');

-- 12. (source, external_id) UNIQUE rejects duplicate non-NULL pair.
insert into public.state_town_halls (official_id, event_date, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-sch'),
          '2026-03-01', 'CA', 'https://z', 'townhallproject', 'thp-1');
select throws_ok(
  $$ insert into public.state_town_halls (official_id, event_date, state, source_url, source, external_id)
     values ((select id from public.officials where source_version = 'FX-sch'),
             '2026-03-02', 'CA', 'https://z2', 'townhallproject', 'thp-1') $$,
  '23505',
  null,
  '(source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- 13. attendance primary key uniqueness.
insert into public.state_committee_hearings (state, session, hearing_date, source_url)
  values ('CA', '20252026', '2026-04-01', 'https://h1');
insert into public.state_committee_hearing_attendance (hearing_id, official_id)
  values ((select id from public.state_committee_hearings where source_url = 'https://h1'),
          (select id from public.officials where source_version = 'FX-sch'));
select throws_ok(
  $$ insert into public.state_committee_hearing_attendance (hearing_id, official_id)
     values ((select id from public.state_committee_hearings where source_url = 'https://h1'),
             (select id from public.officials where source_version = 'FX-sch')) $$,
  '23505',
  null,
  'attendance primary key (hearing_id, official_id) is unique'
);

-- 14. FK official_id RESTRICT on town_halls.
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-sch' $$,
  '23503',
  null,
  'official_id FK on state_town_halls is RESTRICT'
);

-- 15. FK official_id RESTRICT on district_offices.
-- (Same officials row already blocking from town_halls; assert column reference.)
select col_type_is('public', 'state_district_offices', 'official_id', 'uuid',
  'state_district_offices.official_id is uuid (and FK is RESTRICT per migration)');

-- 16. FK official_id RESTRICT on attendance.
select col_type_is('public', 'state_committee_hearing_attendance', 'official_id', 'uuid',
  'state_committee_hearing_attendance.official_id is uuid (and FK is RESTRICT per migration)');

-- 17. FK hearing_id CASCADE on attendance.
delete from public.state_committee_hearings where source_url = 'https://h1';
select is(
  (select count(*)::int from public.state_committee_hearing_attendance
   where hearing_id not in (select id from public.state_committee_hearings)),
  0,
  'hearing_id FK CASCADE: deleting hearing removes attendance rows'
);

-- 18. cleanup verification — placeholder pass.
delete from public.state_town_halls where official_id = (select id from public.officials where source_version = 'FX-sch');
delete from public.officials where source_version = 'FX-sch';
delete from public.districts where source_version = 'FX-sch';
select pass('cleanup applied');

select * from finish();
rollback;
```

- [ ] **Step 3: Run + verify**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -25
```

Expected: migrations 0001–0045 apply; `state_community_rls.test.sql` reports 18/18 (or bump `plan(N)` ±1 if minor drift). Total pgTAP: 355 → 373 across 28 files.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0045_state_community_rls.sql \
        packages/db/supabase/tests/state_community_rls.test.sql
git commit -m "feat(db): 0045 RLS for state_community_* + pgTAP plan(18)

read=authenticated, write=service_role on all 4 new tables (town_halls,
district_offices, committee_hearings, attendance). pgTAP covers tables,
RLS-enabled, format/kind CHECKs, (source, external_id) UNIQUE NULL
semantics, attendance primary-key uniqueness, FK RESTRICT/CASCADE
directions."
```

---

## Task 5: Regenerate Database type

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Regenerate**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

- [ ] **Step 2: Verify**

```bash
grep -c "state_town_halls\|state_district_offices\|state_committee_hearings\|state_committee_hearing_attendance" packages/db/src/types.ts
```

Expected: ≥4 occurrences (one table block header per new table).

- [ ] **Step 3: Workspace typecheck**

```bash
pnpm -r typecheck 2>&1 | tail -5
```

Expected: all 10 packages clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for state_community_* tables"
```

---

## Task 6: OpenStates v3 meetings cache audit / fetcher extension

**Files:**
- Possibly modify: `packages/db/supabase/seed/openstates-committees-fetch.ts`

This task answers an open spec question: does slice 5F's `.cache/openstates/committees/*.json` already include `meetings[]`, or does the fetcher need extending?

- [ ] **Step 1: Inspect existing fetcher**

```bash
cat packages/db/supabase/seed/openstates-committees-fetch.ts | grep -n "include\|meetings"
```

Look for the `?include=` query string. Slice 5F's fetcher likely uses `?include=memberships,subcommittees` (or similar). If `meetings` is NOT in that list, add it.

- [ ] **Step 2: Test if cache has meetings**

If you have a populated cache (e.g., from a prior `pnpm seed:openstates-committees-fetch --state=CA`), check:

```bash
test -f packages/db/supabase/seed/.cache/openstates/committees/CA.json && \
  cat packages/db/supabase/seed/.cache/openstates/committees/CA.json | jq '.[0].meetings // "MISSING"' | head -5
```

Expected output: either an array of meetings or `"MISSING"`.

If no cache exists, fetch one state to populate (requires `OPENSTATES_API_KEY`):

```bash
OPENSTATES_API_KEY=$OPENSTATES_API_KEY pnpm seed:openstates-committees-fetch --state=CA
```

- [ ] **Step 3a (if meetings present): no fetcher change needed**

Continue to Step 5.

- [ ] **Step 3b (if meetings missing): extend fetcher**

Open `packages/db/supabase/seed/openstates-committees-fetch.ts`. Find the line with `?include=` and add `meetings` to it:

```ts
// before:
const url = `https://v3.openstates.org/committees?jurisdiction=${state}&include=memberships,subcommittees&page=${page}`

// after:
const url = `https://v3.openstates.org/committees?jurisdiction=${state}&include=memberships,subcommittees,meetings&page=${page}`
```

Adjust the actual line based on what's in the file.

- [ ] **Step 4 (if fetcher extended): re-fetch + verify**

```bash
OPENSTATES_API_KEY=$OPENSTATES_API_KEY pnpm seed:openstates-committees-fetch --state=CA --force
cat packages/db/supabase/seed/.cache/openstates/committees/CA.json | jq '.[0].meetings // "MISSING"' | head -5
```

Expected: meetings array present (may be empty `[]` for committees with no meetings on file).

- [ ] **Step 5: Commit (if fetcher changed)**

```bash
git add packages/db/supabase/seed/openstates-committees-fetch.ts
git commit -m "feat(seed): include meetings[] in OpenStates v3 committees fetch

Slice 5H committee-hearings adapter needs meetings[] from the
/committees ?include= query. Cache re-fetch required after this
change (operator runs --force on existing state caches)."
```

If fetcher wasn't changed (meetings already included), skip Step 5 and report a no-op commit message in the slice 5H final summary.

---

## Task 7: @chiaro/officials — types + queries + hooks + barrel

**Files:**
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/keys.ts`
- Modify: `packages/officials/src/queries.ts`
- Modify: `packages/officials/src/hooks.ts`
- Modify: `packages/officials/src/index.ts`
- Modify: `packages/officials/test/hooks.test.tsx`

Per slice 5E + 5F + 5G lesson: barrel re-exports happen UP FRONT (not a fix-up).

- [ ] **Step 1: Inspect existing files**

```bash
cat packages/officials/src/types.ts | tail -30
cat packages/officials/src/keys.ts
cat packages/officials/src/queries.ts | grep -n "^export" | head -10
cat packages/officials/src/hooks.ts | grep -n "^export" | head -10
cat packages/officials/src/index.ts
```

This shows existing patterns for slice 5E/5F/5G state-side hooks/queries — mirror exactly.

- [ ] **Step 2: types.ts**

After existing state-side type exports, append:

```ts
export type StateTownHallRow =
  Database['public']['Tables']['state_town_halls']['Row']

export type StateDistrictOfficeRow =
  Database['public']['Tables']['state_district_offices']['Row']

export type StateCommitteeHearingRow =
  Database['public']['Tables']['state_committee_hearings']['Row']
```

- [ ] **Step 3: keys.ts**

Add to `officialsKeys`:

```ts
stateTownHalls: (officialId: string) =>
  ['officials', 'stateTownHalls', officialId] as const,
stateDistrictOffices: (officialId: string) =>
  ['officials', 'stateDistrictOffices', officialId] as const,
stateCommitteeHearings: (officialId: string, session?: string) =>
  ['officials', 'stateCommitteeHearings', officialId, session ?? 'latest'] as const,
```

- [ ] **Step 4: queries.ts**

Append (reuse existing `ChiaroClient` import + Supabase-PostgREST FK-disambiguation precedent from slice 5G):

```ts
import type {
  StateTownHallRow,
  StateDistrictOfficeRow,
  StateCommitteeHearingRow,
} from './types.ts'

/**
 * Past 12 months + upcoming, ordered by event_date desc.
 * 12-month window is fixed in v1; operator-tunable via env later.
 */
export async function fetchOfficialStateTownHalls(
  client: ChiaroClient,
  officialId: string,
): Promise<StateTownHallRow[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

  const { data, error } = await client
    .from('state_town_halls')
    .select('*')
    .eq('official_id', officialId)
    .gte('event_date', cutoff)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateTownHallRow[]
}

/**
 * Custom priority order: district → satellite → capitol.
 * Postgres text-asc would put capitol first (alphabetical), so use
 * a CASE WHEN in the JS-side sort instead.
 */
export async function fetchOfficialStateDistrictOffices(
  client: ChiaroClient,
  officialId: string,
): Promise<StateDistrictOfficeRow[]> {
  const { data, error } = await client
    .from('state_district_offices')
    .select('*')
    .eq('official_id', officialId)
  if (error) throw error
  const priority: Record<string, number> = { district: 0, satellite: 1, capitol: 2 }
  return ((data ?? []) as StateDistrictOfficeRow[]).sort((a, b) => {
    return (priority[a.kind] ?? 99) - (priority[b.kind] ?? 99)
  })
}

/**
 * Two-step fetcher (PostgREST cannot filter on joined columns per slice 5G):
 * 1. Find hearing_ids from state_committee_hearing_attendance where official_id matches
 * 2. Fetch hearings with .in('id', hearingIds) [+ session filter if provided]
 * If session not provided, infer most-recent session from this official's hearings.
 */
export async function fetchOfficialStateCommitteeHearings(
  client: ChiaroClient,
  officialId: string,
  session?: string,
): Promise<StateCommitteeHearingRow[]> {
  // Step 1: find hearing ids this official attended.
  const attRows = await client
    .from('state_committee_hearing_attendance')
    .select('hearing_id')
    .eq('official_id', officialId)
  if (attRows.error) throw attRows.error
  const hearingIds = Array.from(new Set((attRows.data ?? []).map(r => r.hearing_id)))
  if (hearingIds.length === 0) return []

  // Step 2: optionally infer most-recent session.
  let effectiveSession = session
  if (!effectiveSession) {
    const recent = await client
      .from('state_committee_hearings')
      .select('session')
      .in('id', hearingIds)
      .order('hearing_date', { ascending: false })
      .limit(1)
    if (recent.error) throw recent.error
    effectiveSession = recent.data?.[0]?.session
    if (!effectiveSession) return []
  }

  // Step 3: fetch hearings filtered to hearing_ids + session.
  const { data, error } = await client
    .from('state_committee_hearings')
    .select('*')
    .in('id', hearingIds)
    .eq('session', effectiveSession)
    .order('hearing_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StateCommitteeHearingRow[]
}
```

- [ ] **Step 5: hooks.ts**

Append (reuse existing FIVE_MIN/THIRTY_MIN/useQuery/UseQueryResult/ChiaroClient/officialsKeys imports — do NOT redeclare):

```ts
import {
  fetchOfficialStateTownHalls,
  fetchOfficialStateDistrictOffices,
  fetchOfficialStateCommitteeHearings,
} from './queries.ts'
import type {
  StateTownHallRow,
  StateDistrictOfficeRow,
  StateCommitteeHearingRow,
} from './types.ts'

export function useOfficialStateTownHalls(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateTownHallRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateTownHalls(officialId),
    queryFn: () => fetchOfficialStateTownHalls(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateDistrictOffices(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateDistrictOfficeRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateDistrictOffices(officialId),
    queryFn: () => fetchOfficialStateDistrictOffices(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}

export function useOfficialStateCommitteeHearings(
  client: ChiaroClient,
  officialId: string,
  session?: string,
): UseQueryResult<StateCommitteeHearingRow[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateCommitteeHearings(officialId, session),
    queryFn: () => fetchOfficialStateCommitteeHearings(client, officialId, session),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}
```

All three explicit `UseQueryResult<T, Error>` return annotations per TS2742 fix (slice 5D lesson).

- [ ] **Step 6: index.ts barrel**

Add to existing `export type { ... } from './types.ts'` block:

```ts
StateTownHallRow,
StateDistrictOfficeRow,
StateCommitteeHearingRow,
```

Add to existing `export { ... } from './hooks.ts'` block:

```ts
useOfficialStateTownHalls,
useOfficialStateDistrictOffices,
useOfficialStateCommitteeHearings,
```

If queries are barrel-exported too, add `fetchOfficialStateTownHalls`, `fetchOfficialStateDistrictOffices`, `fetchOfficialStateCommitteeHearings`.

- [ ] **Step 7: Hook tests**

Open `packages/officials/test/hooks.test.tsx`. Append 3 describe blocks:

```tsx
describe('useOfficialStateTownHalls', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateTownHalls').mockResolvedValue([
      { id: 'h1', official_id: 'oid', event_date: '2026-01-15',
        city: 'San Jose', state: 'CA', format: 'hybrid',
        attendance_estimate: 120, source_url: 'https://x',
        source: 'townhallproject', external_id: 'thp-1',
        ingested_at: '2025-01-01' },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const { result } = renderHook(() => useOfficialStateTownHalls({} as never, 'oid'), { wrapper: wrap })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.format).toBe('hybrid')
  })
})

describe('useOfficialStateDistrictOffices', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateDistrictOffices').mockResolvedValue([
      { id: 'o1', official_id: 'oid', kind: 'district',
        street_1: '123 Main', street_2: null, city: 'San Jose', state: 'CA',
        postal_code: '95113', phone: '(408) 555-0100', email: null,
        hours_text: 'Mon-Fri 9-5', source_url: 'https://x', ingested_at: '2025-01-01' },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const { result } = renderHook(() => useOfficialStateDistrictOffices({} as never, 'oid'), { wrapper: wrap })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.kind).toBe('district')
  })
})

describe('useOfficialStateCommitteeHearings', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateCommitteeHearings').mockResolvedValue([
      { id: 'hr1', openstates_committee_id: 'ocd-org/x', state: 'CA',
        session: '20252026', hearing_date: '2026-03-01',
        location: 'Capitol Room 1', agenda_topic: 'SB-91',
        source_url: 'https://x', ingested_at: '2025-01-01' },
    ] as never)
  })
  it('returns hooked rows', async () => {
    const { result } = renderHook(() => useOfficialStateCommitteeHearings({} as never, 'oid'), { wrapper: wrap })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.agenda_topic).toBe('SB-91')
  })
})
```

- [ ] **Step 8: Run + commit**

```bash
pnpm --filter @chiaro/officials test hooks
pnpm --filter @chiaro/officials typecheck
```

Expected: existing tests pass + 3 new cases.

```bash
git add packages/officials/src/types.ts packages/officials/src/keys.ts \
        packages/officials/src/queries.ts packages/officials/src/hooks.ts \
        packages/officials/src/index.ts packages/officials/test/hooks.test.tsx
git commit -m "feat(officials): state community types + queries + hooks + barrel

3 new hooks: useOfficialStateTownHalls (past 12mo + upcoming, desc),
useOfficialStateDistrictOffices (priority order district>satellite>capitol),
useOfficialStateCommitteeHearings (2-step PostgREST fetcher joining via
attendance M:N, infers most-recent session when omitted).

All 3 explicit UseQueryResult<T, Error> return annotations (TS2742 fix).
index.ts barrel re-exports up front (slice 5E lesson).
3 new vitest cases."
```

---

## Task 8: state-community/shared.ts adapter interface + helpers

**Files:**
- Create: `packages/db/supabase/seed/state-community/shared.ts`
- Create: `packages/db/supabase/seed/state-community/shared.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-community/.gitkeep`

- [ ] **Step 1: Create fixture dir**

```bash
mkdir -p packages/db/supabase/seed/fixtures/state-community
```

Create empty `packages/db/supabase/seed/fixtures/state-community/.gitkeep`.

- [ ] **Step 2: Write shared.ts**

```ts
import type { Client } from 'pg'

export type CommunityComponent = 'halls' | 'offices' | 'hearings'

export interface NormalizedTownHall {
  official_openstates_person_id?: string
  legislator_name?: string
  event_date: string
  city?: string
  state: string
  format?: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  attendance_estimate?: number
  source_url: string
  source: string
  external_id?: string
}

export interface NormalizedDistrictOffice {
  official_openstates_person_id: string
  kind: 'district' | 'satellite' | 'capitol'
  street_1: string
  street_2?: string
  city: string
  state: string
  postal_code?: string
  phone?: string
  email?: string
  hours_text?: string
  source_url: string
}

export interface NormalizedCommitteeHearing {
  openstates_committee_id?: string
  state: string
  session: string
  hearing_date: string
  location?: string
  agenda_topic?: string
  source_url: string
  attendees_openstates_person_ids: string[]
}

export interface StateCommunityAdapter {
  slug: string
  component: CommunityComponent
  covered_states: string[]
  fetchEvents(opts: {
    client: Client
    state?: string
    session?: string
    fetcher?: () => Promise<unknown[]>
  }): Promise<Array<NormalizedTownHall | NormalizedDistrictOffice | NormalizedCommitteeHearing>>
}

export interface StateCommunityStats {
  component: CommunityComponent
  adapter_slug: string
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/**
 * UPSERT a town hall row. Returns true if rated row was written, false
 * if the official is unknown (caller appends to officialsUnmatched).
 * Dedup via (source, external_id) UNIQUE; when external_id is null,
 * inserts always create a new row (NULLs distinct per Postgres default).
 */
export async function upsertTownHall(
  client: Client,
  th: NormalizedTownHall,
): Promise<boolean> {
  if (!th.official_openstates_person_id) {
    return false
  }
  const off = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [th.official_openstates_person_id],
  )
  if (off.rowCount === 0) return false

  await client.query(`
    insert into public.state_town_halls (
      official_id, event_date, city, state, format,
      attendance_estimate, source_url, source, external_id
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (source, external_id) where external_id is not null
    do update set
      event_date          = excluded.event_date,
      city                = excluded.city,
      format              = excluded.format,
      attendance_estimate = excluded.attendance_estimate,
      source_url          = excluded.source_url,
      ingested_at         = now()
  `, [
    off.rows[0]!.id, th.event_date, th.city ?? null, th.state, th.format ?? null,
    th.attendance_estimate ?? null, th.source_url, th.source, th.external_id ?? null,
  ])
  return true
}

/**
 * UPSERT a district office row. Returns true on success, false when
 * the official is unknown.
 * No natural dedup key (offices rarely change ids across scrapes);
 * caller is responsible for clearing/recomputing per re-ingest run.
 */
export async function upsertDistrictOffice(
  client: Client,
  off: NormalizedDistrictOffice,
): Promise<boolean> {
  const o = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [off.official_openstates_person_id],
  )
  if (o.rowCount === 0) return false

  await client.query(`
    insert into public.state_district_offices (
      official_id, kind, street_1, street_2, city, state,
      postal_code, phone, email, hours_text, source_url
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    o.rows[0]!.id, off.kind, off.street_1, off.street_2 ?? null,
    off.city, off.state, off.postal_code ?? null, off.phone ?? null,
    off.email ?? null, off.hours_text ?? null, off.source_url,
  ])
  return true
}

/**
 * UPSERT a committee hearing + attendance rows in a single transaction.
 * Returns number of successfully-matched attendee officials (unmatched
 * appended to stats by caller).
 */
export async function upsertCommitteeHearing(
  client: Client,
  h: NormalizedCommitteeHearing,
): Promise<{ matched: number; unmatched: string[] }> {
  // Try to dedupe by (openstates_committee_id, hearing_date) when committee id present.
  let hearingId: string
  if (h.openstates_committee_id) {
    const existing = await client.query<{ id: string }>(
      `select id from public.state_committee_hearings
        where openstates_committee_id = $1 and hearing_date = $2`,
      [h.openstates_committee_id, h.hearing_date],
    )
    if ((existing.rowCount ?? 0) > 0) {
      hearingId = existing.rows[0]!.id
    } else {
      const ins = await client.query<{ id: string }>(`
        insert into public.state_committee_hearings (
          openstates_committee_id, state, session, hearing_date,
          location, agenda_topic, source_url
        ) values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `, [h.openstates_committee_id, h.state, h.session, h.hearing_date,
          h.location ?? null, h.agenda_topic ?? null, h.source_url])
      hearingId = ins.rows[0]!.id
    }
  } else {
    const ins = await client.query<{ id: string }>(`
      insert into public.state_committee_hearings (
        openstates_committee_id, state, session, hearing_date,
        location, agenda_topic, source_url
      ) values (null, $1, $2, $3, $4, $5, $6)
      returning id
    `, [h.state, h.session, h.hearing_date,
        h.location ?? null, h.agenda_topic ?? null, h.source_url])
    hearingId = ins.rows[0]!.id
  }

  let matched = 0
  const unmatched: string[] = []
  for (const personId of h.attendees_openstates_person_ids) {
    const off = await client.query<{ id: string }>(
      'select id from public.officials where openstates_person_id = $1',
      [personId],
    )
    if (off.rowCount === 0) {
      unmatched.push(personId)
      continue
    }
    await client.query(`
      insert into public.state_committee_hearing_attendance (hearing_id, official_id)
      values ($1, $2)
      on conflict (hearing_id, official_id) do nothing
    `, [hearingId, off.rows[0]!.id])
    matched += 1
  }
  return { matched, unmatched }
}
```

- [ ] **Step 3: Write shared.test.ts**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import {
  upsertTownHall,
  upsertDistrictOffice,
  upsertCommitteeHearing,
} from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-SCM', 'CA SCM test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-scm')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-scm', 'Test SCM', 'Test', 'SCM', 'state_house', 'D', 'CA',
      d.id, true, 'FX-scm'
    from public.districts d where d.code = 'CA-SCM'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_town_halls where official_id = $1', [officialId])
  await client.query('delete from public.state_district_offices where official_id = $1', [officialId])
  await client.query(`delete from public.state_committee_hearings
    where id in (select hearing_id from public.state_committee_hearing_attendance where official_id = $1)`,
    [officialId])
  await client.query("delete from public.officials where source_version = 'FX-scm'")
  await client.query("delete from public.districts where source_version = 'FX-scm'")
  await client.end()
})

describe('upsertTownHall', () => {
  it('inserts a row for a known official', async () => {
    const ok = await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://x',
      source: 'townhallproject', external_id: 'thp-1', format: 'hybrid',
    })
    expect(ok).toBe(true)
    const r = await client.query<{ format: string }>(
      'select format from public.state_town_halls where official_id = $1', [officialId])
    expect(r.rows[0]!.format).toBe('hybrid')
  })

  it('returns false for unknown openstates_person_id', async () => {
    const ok = await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://x',
      source: 'townhallproject',
    })
    expect(ok).toBe(false)
  })

  it('idempotent on (source, external_id) — second call updates', async () => {
    await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://x',
      source: 'townhallproject', external_id: 'thp-1', format: 'in_person',
    })
    await upsertTownHall(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      event_date: '2026-01-15', state: 'CA', source_url: 'https://y',
      source: 'townhallproject', external_id: 'thp-1', format: 'hybrid',
    })
    const r = await client.query<{ c: number; format: string }>(
      'select count(*)::int as c, max(format) as format from public.state_town_halls where official_id = $1',
      [officialId])
    expect(r.rows[0]!.c).toBe(1)
    expect(r.rows[0]!.format).toBe('hybrid')
  })
})

describe('upsertDistrictOffice', () => {
  it('inserts a row for a known official', async () => {
    const ok = await upsertDistrictOffice(client, {
      official_openstates_person_id: 'ocd-person/fx-scm',
      kind: 'district', street_1: '123 Main', city: 'San Jose',
      state: 'CA', source_url: 'https://x',
    })
    expect(ok).toBe(true)
    const r = await client.query<{ kind: string }>(
      'select kind from public.state_district_offices where official_id = $1', [officialId])
    expect(r.rows[0]!.kind).toBe('district')
  })

  it('returns false for unknown openstates_person_id', async () => {
    const ok = await upsertDistrictOffice(client, {
      official_openstates_person_id: 'ocd-person/UNKNOWN',
      kind: 'district', street_1: '123', city: 'X', state: 'CA',
      source_url: 'https://x',
    })
    expect(ok).toBe(false)
  })
})

describe('upsertCommitteeHearing', () => {
  it('inserts hearing + attendance for known official', async () => {
    const result = await upsertCommitteeHearing(client, {
      openstates_committee_id: 'ocd-org/test',
      state: 'CA', session: '20252026', hearing_date: '2026-03-01',
      location: 'Capitol', agenda_topic: 'SB-91', source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm'],
    })
    expect(result.matched).toBe(1)
    expect(result.unmatched).toEqual([])
    const r = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_committee_hearing_attendance where official_id = $1',
      [officialId])
    expect(r.rows[0]!.c).toBe(1)
  })

  it('records unmatched attendees', async () => {
    const result = await upsertCommitteeHearing(client, {
      state: 'CA', session: '20252026', hearing_date: '2026-03-01',
      source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm', 'ocd-person/UNKNOWN'],
    })
    expect(result.matched).toBe(1)
    expect(result.unmatched).toEqual(['ocd-person/UNKNOWN'])
  })

  it('idempotent: re-inserting same hearing dedupes by (openstates_committee_id, hearing_date)', async () => {
    await upsertCommitteeHearing(client, {
      openstates_committee_id: 'ocd-org/dedup',
      state: 'CA', session: '20252026', hearing_date: '2026-04-01',
      source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm'],
    })
    await upsertCommitteeHearing(client, {
      openstates_committee_id: 'ocd-org/dedup',
      state: 'CA', session: '20252026', hearing_date: '2026-04-01',
      source_url: 'https://x',
      attendees_openstates_person_ids: ['ocd-person/fx-scm'],
    })
    const r = await client.query<{ c: number }>(
      `select count(*)::int as c from public.state_committee_hearings
       where openstates_committee_id = 'ocd-org/dedup' and hearing_date = '2026-04-01'`)
    expect(r.rows[0]!.c).toBe(1)
  })
})
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community/shared'
pnpm --filter @chiaro/db typecheck
```

Expected: 8 cases pass.

```bash
git add packages/db/supabase/seed/state-community/shared.ts \
        packages/db/supabase/seed/state-community/shared.test.ts \
        packages/db/supabase/seed/fixtures/state-community/.gitkeep
git commit -m "feat(db): state-community/shared.ts adapter interface + 3 helpers

CommunityComponent type + 3 normalized envelope types + adapter
interface. Helpers:
- upsertTownHall: dedup via (source, external_id) UNIQUE WHERE
  external_id IS NOT NULL (NULLs always insert fresh rows).
- upsertDistrictOffice: insert-only (no natural dedup key for offices;
  operator clears-and-recomputes per re-ingest).
- upsertCommitteeHearing: dedup by (openstates_committee_id, hearing_date)
  when committee id present; always insert otherwise. Plus attendance
  M:N upserts with per-attendee match/unmatch tracking.

8 vitest cases against real local Supabase."
```

---

## Task 9: TownHallProject nationwide adapter + 5 per-state town-hall adapters

**Files:**
- Create: `packages/db/supabase/seed/state-community/town-halls/townhallproject.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/state-community/town-halls/{ca-leginfo,ny-senate,fl-doe,tx-capitol,mi-legislature}.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-community/{townhallproject,halls-ca,halls-ny,halls-fl,halls-tx,halls-mi}.json`

6 adapter files all sharing the same structure. All v1 stubs returning `[]` (fixtures inject via `opts.fetcher`).

- [ ] **Step 1: Create 6 fixtures**

Each fixture is a JSON file with `{ "events": NormalizedTownHall[] }`. Example for `townhallproject.json`:

```json
{
  "events": [
    { "official_openstates_person_id": "ocd-person/fx-thp-ca-1", "event_date": "2026-03-15", "city": "San Jose", "state": "CA", "format": "hybrid", "attendance_estimate": 120, "source_url": "https://thp.example/1", "source": "townhallproject", "external_id": "thp-1" },
    { "official_openstates_person_id": "ocd-person/fx-thp-ny-1", "event_date": "2026-04-20", "city": "Albany", "state": "NY", "format": "in_person", "source_url": "https://thp.example/2", "source": "townhallproject", "external_id": "thp-2" }
  ]
}
```

For per-state fixtures, change `source` field accordingly:
- `halls-ca.json` → `source: 'ca-leginfo'`, 1-2 CA events
- `halls-ny.json` → `source: 'ny-senate'`
- `halls-fl.json` → `source: 'fl-doe'`
- `halls-tx.json` → `source: 'tx-capitol'`
- `halls-mi.json` → `source: 'mi-legislature'`

- [ ] **Step 2: Implement TownHallProject (nationwide)**

`packages/db/supabase/seed/state-community/town-halls/townhallproject.ts`:

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export const townhallproject: StateCommunityAdapter = {
  slug: 'townhallproject',
  component: 'halls',
  covered_states: ALL_STATES,
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires townhallproject.com API parser
    // (likely https://townhallproject-86312.firebaseapp.com/api/townHalls).
    return []
  },
}
```

- [ ] **Step 3: Implement 5 per-state town-hall adapters**

Each follows the same template. `ca-leginfo.ts`:

```ts
import type { StateCommunityAdapter, NormalizedTownHall } from '../shared.ts'

export const caLeginfoTownHalls: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'halls',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub: operator wires leginfo.ca.gov member-events scrape.
    return []
  },
}
```

Repeat for `ny-senate.ts` (`nySenateTownHalls`, covered=`['NY']`), `fl-doe.ts` (`flDoeTownHalls`, covered=`['FL']`), `tx-capitol.ts` (`txCapitolTownHalls`, covered=`['TX']`), `mi-legislature.ts` (`miLegislatureTownHalls`, covered=`['MI']`).

- [ ] **Step 4: Implement 6 test files**

Template (mirror slice 5G adapter tests — no DB required for object inspection + fetcher injection). `townhallproject.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { townhallproject } from './townhallproject.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'townhallproject.json')

describe('townhallproject adapter', () => {
  it('happy path: fixture events normalized via fetcher injection', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await townhallproject.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { state: string }).state).toBe(fixture.events[0].state)
  })

  it('production stub returns empty array', async () => {
    const events = await townhallproject.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
  })

  it('reports correct slug + component', () => {
    expect(townhallproject.slug).toBe('townhallproject')
    expect(townhallproject.component).toBe('halls')
  })

  it('covered_states contains all 50', () => {
    expect(townhallproject.covered_states.length).toBe(50)
    for (const s of townhallproject.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})
```

For per-state test files, swap the import + fixture path + slug expectation + covered_states length expectation (=1) and the regex test for the specific state.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community/town-halls'
pnpm --filter @chiaro/db typecheck
```

Expected: 6 files × 4 cases = 24 cases pass.

```bash
git add packages/db/supabase/seed/state-community/town-halls/ \
        packages/db/supabase/seed/fixtures/state-community/townhallproject.json \
        packages/db/supabase/seed/fixtures/state-community/halls-*.json
git commit -m "feat(seed): town-halls adapters (townhallproject + 5 per-state)

6 adapters: TownHallProject nationwide (covers all 50 states) +
5 per-state augment stubs (CA leginfo, NY senate, FL DOE, TX capitol,
MI legislature). All v1 ship as stubs returning []; operator wires
production parsers. Fixture-injected tests verify normalization shape.

24 vitest cases (6 files x 4 cases)."
```

---

## Task 10: 5 per-state district-office adapters

**Files:**
- Create: `packages/db/supabase/seed/state-community/district-offices/{ca-leginfo,ny-senate,fl-doe,tx-capitol,mi-legislature}.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-community/offices-{ca,ny,fl,tx,mi}.json`

Identical structure to Task 9 per-state adapters but `component: 'offices'`.

- [ ] **Step 1: Create 5 fixtures**

Example `offices-ca.json`:

```json
{
  "events": [
    { "official_openstates_person_id": "ocd-person/fx-off-ca-1", "kind": "district", "street_1": "1234 Main St", "city": "San Jose", "state": "CA", "postal_code": "95113", "phone": "(408) 555-0100", "hours_text": "Mon-Fri 9am-5pm", "source_url": "https://leginfo.ca.gov/member/1" },
    { "official_openstates_person_id": "ocd-person/fx-off-ca-1", "kind": "satellite", "street_1": "5678 Oak Ave", "city": "Gilroy", "state": "CA", "postal_code": "95020", "source_url": "https://leginfo.ca.gov/member/1" }
  ]
}
```

Repeat for NY/FL/TX/MI with state-appropriate addresses.

- [ ] **Step 2: Implement 5 adapters**

Template `ca-leginfo.ts`:

```ts
import type { StateCommunityAdapter, NormalizedDistrictOffice } from '../shared.ts'

export const caLeginfoOffices: StateCommunityAdapter = {
  slug: 'ca-leginfo',
  component: 'offices',
  covered_states: ['CA'],
  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedDistrictOffice[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

Note: this `ca-leginfo` adapter shares `slug` with the town-halls one. That's intentional — both can co-exist because they're in different `component` namespaces. Orchestrator dispatches by `(slug, component)` tuple.

Repeat for NY/FL/TX/MI (`nySenateOffices`, etc).

- [ ] **Step 3: Implement 5 test files**

Mirror Task 9 per-state test template, swap `component` expectation to `'offices'` + fixture path + slug.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community/district-offices'
pnpm --filter @chiaro/db typecheck
```

Expected: 5 files × 4 cases = 20 cases.

```bash
git add packages/db/supabase/seed/state-community/district-offices/ \
        packages/db/supabase/seed/fixtures/state-community/offices-*.json
git commit -m "feat(seed): district-offices adapters (5 per-state stubs)

5 per-state adapters (CA leginfo, NY senate, FL DOE, TX capitol,
MI legislature). All v1 stubs returning []; operator wires production
profile-page scrapers per state.

Note: slug 'ca-leginfo' shared with town-halls adapter — disambiguated
by (slug, component) tuple in orchestrator dispatch.

20 vitest cases."
```

---

## Task 11: OpenStates v3 committee-hearings adapter

**Files:**
- Create: `packages/db/supabase/seed/state-community/committee-hearings/openstates-v3.ts` + `.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-community/hearings-openstates.json`

Reuses 5F cache infrastructure when populated; v1 ships as stub returning `[]`.

- [ ] **Step 1: Create fixture**

`hearings-openstates.json`:

```json
{
  "events": [
    { "openstates_committee_id": "ocd-org/fx-comm-ca-1", "state": "CA", "session": "20252026", "hearing_date": "2026-03-15", "location": "Capitol Room 4202", "agenda_topic": "SB-91 (Mental Health Parity)", "source_url": "https://v3.openstates.org/committees/ocd-org/fx-comm-ca-1", "attendees_openstates_person_ids": ["ocd-person/fx-h-ca-1", "ocd-person/fx-h-ca-2"] },
    { "openstates_committee_id": "ocd-org/fx-comm-ny-1", "state": "NY", "session": "2025", "hearing_date": "2026-02-08", "location": "Albany Senate Chamber", "agenda_topic": "S.234", "source_url": "https://v3.openstates.org/committees/ocd-org/fx-comm-ny-1", "attendees_openstates_person_ids": ["ocd-person/fx-h-ny-1"] }
  ]
}
```

- [ ] **Step 2: Implement adapter**

`openstates-v3.ts`:

```ts
import type {
  StateCommunityAdapter,
  NormalizedCommitteeHearing,
} from '../shared.ts'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const CACHE_DIR = process.env.OPENSTATES_COMMITTEES_CACHE_DIR
  ?? join(process.cwd(), 'packages', 'db', 'supabase', 'seed', '.cache', 'openstates', 'committees')

/**
 * Reads committee envelopes from the slice 5F cache (
 * .cache/openstates/committees/<state>.json) and extracts hearings
 * from each committee's meetings[] array. v1 stub returns [] if cache
 * dir is empty.
 */
export const openstatesV3Hearings: StateCommunityAdapter = {
  slug: 'openstates-v3',
  component: 'hearings',
  covered_states: ALL_STATES,

  async fetchEvents(opts) {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedCommitteeHearing[]> }).fetcher
    if (fetcher) return fetcher()

    const targetStates = opts.state ? [opts.state] : ALL_STATES
    const out: NormalizedCommitteeHearing[] = []
    for (const state of targetStates) {
      const cachePath = join(CACHE_DIR, `${state}.json`)
      if (!existsSync(cachePath)) continue
      try {
        const committees = JSON.parse(await readFile(cachePath, 'utf8')) as Array<{
          id: string
          jurisdiction?: { name?: string }
          current_session?: { identifier?: string }
          meetings?: Array<{
            date: string
            location?: string
            agenda_topic?: string
            attendance?: Array<{ person?: { id?: string } }>
          }>
        }>
        for (const c of committees) {
          if (!c.meetings) continue
          for (const m of c.meetings) {
            out.push({
              openstates_committee_id: c.id,
              state,
              session: opts.session ?? c.current_session?.identifier ?? '',
              hearing_date: m.date,
              location: m.location,
              agenda_topic: m.agenda_topic,
              source_url: `https://v3.openstates.org/committees/${c.id}`,
              attendees_openstates_person_ids: (m.attendance ?? [])
                .map(a => a.person?.id)
                .filter((id): id is string => !!id),
            })
          }
        }
      } catch {
        // Skip malformed cache file silently — operator inspects via stats.errors
      }
    }
    return out
  },
}
```

- [ ] **Step 3: Test**

```ts
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openstatesV3Hearings } from './openstates-v3.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'state-community', 'hearings-openstates.json')

describe('openstatesV3Hearings adapter', () => {
  it('happy path: fetcher injection returns fixture events', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const events = await openstatesV3Hearings.fetchEvents({
      client: {} as never,
      fetcher: async () => fixture.events,
    } as never)
    expect(events.length).toBe(fixture.events.length)
    expect((events[0] as { openstates_committee_id?: string }).openstates_committee_id)
      .toBe(fixture.events[0].openstates_committee_id)
  })

  it('production stub returns empty array when cache dir absent', async () => {
    process.env.OPENSTATES_COMMITTEES_CACHE_DIR = '/nonexistent/path'
    const events = await openstatesV3Hearings.fetchEvents({ client: {} as never } as never)
    expect(events).toEqual([])
    delete process.env.OPENSTATES_COMMITTEES_CACHE_DIR
  })

  it('reports correct slug + component', () => {
    expect(openstatesV3Hearings.slug).toBe('openstates-v3')
    expect(openstatesV3Hearings.component).toBe('hearings')
  })

  it('covered_states contains all 50', () => {
    expect(openstatesV3Hearings.covered_states.length).toBe(50)
  })
})
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-community/committee-hearings'
pnpm --filter @chiaro/db typecheck
```

Expected: 4 cases pass.

```bash
git add packages/db/supabase/seed/state-community/committee-hearings/ \
        packages/db/supabase/seed/fixtures/state-community/hearings-openstates.json
git commit -m "feat(seed): openstates-v3 committee-hearings adapter

Reuses slice 5F cache infrastructure (.cache/openstates/committees/
<state>.json). Production path: walks cached committee envelopes,
extracts meetings[] arrays, normalizes to NormalizedCommitteeHearing.
v1 returns [] if cache dir absent.

OPENSTATES_COMMITTEES_CACHE_DIR env var overrides cache path for tests.

4 vitest cases."
```

---

## Task 12: state-community-ingest orchestrator + pnpm script

**Files:**
- Create: `packages/db/supabase/seed/state-community-ingest.ts`
- Create: `packages/db/supabase/seed/state-community-ingest.test.ts`
- Modify: `packages/db/package.json` (+1 script)

- [ ] **Step 1: Failing test**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateCommunity } from './state-community-ingest.ts'
import type { StateCommunityAdapter } from './state-community/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})
afterEach(async () => { await client.end() })

function mkAdapter(overrides: Partial<StateCommunityAdapter>): StateCommunityAdapter {
  return {
    slug: 'test',
    component: 'halls',
    covered_states: ['CA'],
    async fetchEvents() { return [] },
    ...overrides,
  }
}

describe('ingestStateCommunity', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', component: 'halls', async fetchEvents() { return [] } }),
      mkAdapter({ slug: 'b', component: 'offices', async fetchEvents() { return [] } }),
    ]
    const stats = await ingestStateCommunity({ client, adapters })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
    expect(stats.byAdapter).toHaveLength(2)
  })

  it('--component filter restricts to that component', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', component: 'halls',   async fetchEvents() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', component: 'offices', async fetchEvents() { calls.push('b'); return [] } }),
    ]
    await ingestStateCommunity({ client, component: 'halls', adapters })
    expect(calls).toEqual(['a'])
  })

  it('--state filter passes state through to adapter and filters covered_states', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({ slug: 'a', covered_states: ['CA'], async fetchEvents(o) { calls.push({ slug: 'a', state: o.state }); return [] } }),
      mkAdapter({ slug: 'b', covered_states: ['NY'], async fetchEvents() { calls.push({ slug: 'b' }); return [] } }),
    ]
    await ingestStateCommunity({ client, state: 'CA', adapters })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('one adapter throwing: others still run with skipOnError', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchEvents() { throw new Error('a broke') } }),
      mkAdapter({ slug: 'b', async fetchEvents() { return [] } }),
    ]
    const stats = await ingestStateCommunity({ client, skipOnError: true, adapters })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byAdapter.find(s => s.adapter_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchEvents() { throw new Error('boom') } }),
      mkAdapter({ slug: 'b', async fetchEvents() { return [] } }),
    ]
    await expect(ingestStateCommunity({ client, adapters })).rejects.toThrow(/boom/)
  })

  it('--component=all runs halls + offices + hearings adapters', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', component: 'halls',    async fetchEvents() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', component: 'offices',  async fetchEvents() { calls.push('b'); return [] } }),
      mkAdapter({ slug: 'c', component: 'hearings', async fetchEvents() { calls.push('c'); return [] } }),
    ]
    await ingestStateCommunity({ client, component: 'all', adapters })
    expect(calls).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test state-community-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement orchestrator**

```ts
import { Client } from 'pg'
import {
  type CommunityComponent,
  type StateCommunityAdapter,
  type StateCommunityStats,
  upsertTownHall,
  upsertDistrictOffice,
  upsertCommitteeHearing,
  type NormalizedTownHall,
  type NormalizedDistrictOffice,
  type NormalizedCommitteeHearing,
} from './state-community/shared.ts'
import { townhallproject } from './state-community/town-halls/townhallproject.ts'
import { caLeginfoTownHalls }     from './state-community/town-halls/ca-leginfo.ts'
import { nySenateTownHalls }      from './state-community/town-halls/ny-senate.ts'
import { flDoeTownHalls }         from './state-community/town-halls/fl-doe.ts'
import { txCapitolTownHalls }     from './state-community/town-halls/tx-capitol.ts'
import { miLegislatureTownHalls } from './state-community/town-halls/mi-legislature.ts'
import { caLeginfoOffices }       from './state-community/district-offices/ca-leginfo.ts'
import { nySenateOffices }        from './state-community/district-offices/ny-senate.ts'
import { flDoeOffices }           from './state-community/district-offices/fl-doe.ts'
import { txCapitolOffices }       from './state-community/district-offices/tx-capitol.ts'
import { miLegislatureOffices }   from './state-community/district-offices/mi-legislature.ts'
import { openstatesV3Hearings }   from './state-community/committee-hearings/openstates-v3.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
  // halls first (TownHallProject nationwide baseline, then per-state augment)
  townhallproject,
  caLeginfoTownHalls, nySenateTownHalls, flDoeTownHalls, txCapitolTownHalls, miLegislatureTownHalls,
  // offices
  caLeginfoOffices, nySenateOffices, flDoeOffices, txCapitolOffices, miLegislatureOffices,
  // hearings
  openstatesV3Hearings,
]

export interface IngestStateCommunityOpts {
  component?: CommunityComponent | 'all'
  state?: string
  session?: string
  skipOnError?: boolean
  adapters?: StateCommunityAdapter[]
  client?: Client
}

export interface IngestStateCommunityStats {
  adaptersAttempted: number
  adaptersOk: number
  totalRowsUpserted: number
  totalOfficialsUnmatched: number
  byAdapter: StateCommunityStats[]
}

export async function ingestStateCommunity(
  opts: IngestStateCommunityOpts,
): Promise<IngestStateCommunityStats> {
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

  const byAdapter: StateCommunityStats[] = []
  try {
    for (const adapter of adapters) {
      const adapterStats: StateCommunityStats = {
        component: adapter.component,
        adapter_slug: adapter.slug,
        rowsUpserted: 0,
        officialsMatched: 0,
        officialsUnmatched: [],
        errors: [],
      }
      try {
        const events = await adapter.fetchEvents({
          client, state: opts.state, session: opts.session,
        })
        for (const event of events) {
          if (adapter.component === 'halls') {
            const ok = await upsertTownHall(client, event as NormalizedTownHall)
            if (ok) {
              adapterStats.rowsUpserted += 1
              adapterStats.officialsMatched += 1
            } else if ((event as NormalizedTownHall).official_openstates_person_id) {
              adapterStats.officialsUnmatched.push((event as NormalizedTownHall).official_openstates_person_id!)
            }
          } else if (adapter.component === 'offices') {
            const ok = await upsertDistrictOffice(client, event as NormalizedDistrictOffice)
            if (ok) {
              adapterStats.rowsUpserted += 1
              adapterStats.officialsMatched += 1
            } else {
              adapterStats.officialsUnmatched.push((event as NormalizedDistrictOffice).official_openstates_person_id)
            }
          } else if (adapter.component === 'hearings') {
            const result = await upsertCommitteeHearing(client, event as NormalizedCommitteeHearing)
            adapterStats.rowsUpserted += 1
            adapterStats.officialsMatched += result.matched
            adapterStats.officialsUnmatched.push(...result.unmatched)
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
  const sessionArg   = process.argv.find(a => a.startsWith('--session='))
  const skipOnError  = process.argv.includes('--skip-on-error')

  const component = componentArg
    ? componentArg.split('=')[1] as CommunityComponent | 'all'
    : 'all'
  const state   = stateArg ? stateArg.split('=')[1] : undefined
  const session = sessionArg ? sessionArg.split('=')[1] : undefined

  ingestStateCommunity({ component, state, session, skipOnError })
    .then(stats => {
      console.log(`State community ingest summary:`)
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

- [ ] **Step 4: Add pnpm script**

Open `packages/db/package.json`. Add:

```json
"seed:state-community": "tsx supabase/seed/state-community-ingest.ts",
```

Match neighboring scripts' invocation pattern.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/db test state-community-ingest
pnpm --filter @chiaro/db typecheck
```

Expected: 6 cases pass.

```bash
git add packages/db/supabase/seed/state-community-ingest.ts \
        packages/db/supabase/seed/state-community-ingest.test.ts \
        packages/db/package.json
git commit -m "feat(db): state-community-ingest orchestrator + pnpm script

Dispatches all 12 adapters (6 halls + 5 offices + 1 hearings) or filters
via --component=halls|offices|hearings|all + --state=XX. TownHallProject
runs FIRST in halls dispatch order so per-state augment can dedup against
its rows via (source, external_id).

Per-adapter isolation matches slice 5G: thrown errors in byAdapter[N].
errors; --skip-on-error keeps siblings running.

CLI: pnpm seed:state-community --component=halls|offices|hearings|all
  [--state=XX] [--session=YYYY] [--skip-on-error]

6 vitest cases."
```

---

## Task 13: Web StateTownHallsList + StateCommitteeHearingsList + StateDistrictOfficesList sub-list components

**Files:**
- Create: `apps/web/components/state/StateTownHallsList.tsx` + 1 test
- Create: `apps/web/components/state/StateCommitteeHearingsList.tsx` + 1 test
- Create: `apps/web/components/state/StateDistrictOfficesList.tsx` + 1 test

3 dumb list components — pure props in, JSX out. No hook calls; parent card hooks data and passes via prop.

- [ ] **Step 1: Inspect existing patterns**

```bash
cat apps/web/components/state/StateServiceRecordCard.tsx | head -80
```

Note the `COLORS.signal.success` / `COLORS.signal.error` / `COLORS.neutral.textMuted` / `COLORS.brand.text` token vocabulary (slice 5G discovery).

- [ ] **Step 2: Implement StateTownHallsList**

```tsx
'use client'

import type { StateTownHallRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateTownHallRow[] }

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual:   'Virtual',
  phone:     'Phone',
  hybrid:    'Hybrid',
}

export function StateTownHallsList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No town halls in the past 12 months.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <a key={r.id} href={r.source_url} target="_blank" rel="noopener noreferrer"
           style={{
             display: 'flex', justifyContent: 'space-between', gap: 12,
             padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
             borderRadius: 6, fontSize: 13, textDecoration: 'none',
             color: COLORS.brand.text,
           }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>
              {r.event_date}{r.city ? ` · ${r.city}, ${r.state}` : ` · ${r.state}`}
            </div>
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
              {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
            </div>
          </div>
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

- [ ] **Step 3: Implement StateCommitteeHearingsList**

```tsx
'use client'

import { useState } from 'react'
import type { StateCommitteeHearingRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateCommitteeHearingRow[] }

export function StateCommitteeHearingsList({ rows }: Props) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) {
    return <div style={mutedStyle}>No committee hearings attended in current session.</div>
  }
  const visible = showAll ? rows : rows.slice(0, 3)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {visible.map(r => (
        <div key={r.id} style={{
          padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13, color: COLORS.brand.text,
        }}>
          <div style={{ fontWeight: 500 }}>
            {r.hearing_date}{r.location ? ` · ${r.location}` : ''}
          </div>
          {r.agenda_topic && (
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              Agenda: {r.agenda_topic}
            </div>
          )}
        </div>
      ))}
      {!showAll && rows.length > 3 && (
        <button onClick={() => setShowAll(true)}
          style={{
            border: 'none', background: 'transparent',
            color: COLORS.neutral.textMuted, fontSize: 12,
            cursor: 'pointer', textAlign: 'left',
          }}>
          and {rows.length - 3} more
        </button>
      )}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
```

- [ ] **Step 4: Implement StateDistrictOfficesList**

```tsx
'use client'

import type { StateDistrictOfficeRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateDistrictOfficeRow[] }

const KIND_LABEL: Record<string, string> = {
  district:  'District Office',
  satellite: 'Satellite Office',
  capitol:   'Capitol Office',
}

export function StateDistrictOfficesList({ rows }: Props) {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No district offices on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      {rows.map(r => (
        <div key={r.id} style={{ fontSize: 13, color: COLORS.brand.text }}>
          <div style={{ fontWeight: 600 }}>
            {KIND_LABEL[r.kind] ?? r.kind} · {r.city}, {r.state}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.street_1}{r.street_2 ? `, ${r.street_2}` : ''}
            {r.postal_code ? `, ${r.postal_code}` : ''}
            {r.phone && (
              <>
                <br />
                {r.phone}
              </>
            )}
            {r.hours_text && (
              <>
                <br />
                Hours: {r.hours_text}
              </>
            )}
          </div>
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

- [ ] **Step 5: Tests for all 3**

`StateTownHallsList.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateTownHallsList } from '@/components/state/StateTownHallsList'

describe('StateTownHallsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateTownHallsList rows={[]} />)
    expect(getByText(/No town halls in the past 12 months/i)).toBeInTheDocument()
  })

  it('renders rows with format and attendance', () => {
    const rows = [{
      id: 't1', official_id: 'oid', event_date: '2026-03-15',
      city: 'San Jose', state: 'CA', format: 'hybrid',
      attendance_estimate: 120, source_url: 'https://x',
      source: 'townhallproject', external_id: 't1', ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/Hybrid/i)).toBeInTheDocument()
    expect(getByText(/~120 attendees/i)).toBeInTheDocument()
    expect(getByText(/San Jose, CA/i)).toBeInTheDocument()
  })

  it('renders Format n/a when format is null', () => {
    const rows = [{
      id: 't1', official_id: 'oid', event_date: '2026-03-15',
      city: null, state: 'CA', format: null,
      attendance_estimate: null, source_url: 'https://x',
      source: 'townhallproject', external_id: null, ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateTownHallsList rows={rows} />)
    expect(getByText(/Format n\/a/i)).toBeInTheDocument()
  })
})
```

`StateCommitteeHearingsList.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateCommitteeHearingsList } from '@/components/state/StateCommitteeHearingsList'

describe('StateCommitteeHearingsList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateCommitteeHearingsList rows={[]} />)
    expect(getByText(/No committee hearings attended/i)).toBeInTheDocument()
  })

  it('renders 3 rows + and-N-more button when count > 3', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`, openstates_committee_id: 'ocd-org/x',
      state: 'CA', session: '20252026',
      hearing_date: `2026-03-0${i + 1}`, location: 'Capitol',
      agenda_topic: `Bill SB-${i}`, source_url: 'https://x',
      ingested_at: '2026-01-01',
    })) as never[]
    const { getByText, queryByText } = render(<StateCommitteeHearingsList rows={rows} />)
    expect(getByText(/Bill SB-0/i)).toBeInTheDocument()
    expect(getByText(/Bill SB-2/i)).toBeInTheDocument()
    expect(queryByText(/Bill SB-3/i)).not.toBeInTheDocument()
    expect(getByText(/and 2 more/i)).toBeInTheDocument()
  })

  it('expanding and-N-more button shows all rows', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`, openstates_committee_id: 'ocd-org/x',
      state: 'CA', session: '20252026',
      hearing_date: `2026-03-0${i + 1}`, location: 'Capitol',
      agenda_topic: `Bill SB-${i}`, source_url: 'https://x',
      ingested_at: '2026-01-01',
    })) as never[]
    const { getByText, queryByText } = render(<StateCommitteeHearingsList rows={rows} />)
    fireEvent.click(getByText(/and 2 more/i))
    expect(getByText(/Bill SB-4/i)).toBeInTheDocument()
    expect(queryByText(/and 2 more/i)).not.toBeInTheDocument()
  })
})
```

`StateDistrictOfficesList.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateDistrictOfficesList } from '@/components/state/StateDistrictOfficesList'

describe('StateDistrictOfficesList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<StateDistrictOfficesList rows={[]} />)
    expect(getByText(/No district offices on file/i)).toBeInTheDocument()
  })

  it('renders office with address + phone + hours', () => {
    const rows = [{
      id: 'o1', official_id: 'oid', kind: 'district',
      street_1: '1234 Main St', street_2: null, city: 'San Jose',
      state: 'CA', postal_code: '95113', phone: '(408) 555-0100',
      email: null, hours_text: 'Mon-Fri 9am-5pm', source_url: 'https://x',
      ingested_at: '2026-01-01',
    }] as never[]
    const { getByText } = render(<StateDistrictOfficesList rows={rows} />)
    expect(getByText(/District Office/i)).toBeInTheDocument()
    expect(getByText(/1234 Main St/i)).toBeInTheDocument()
    expect(getByText(/\(408\) 555-0100/i)).toBeInTheDocument()
    expect(getByText(/Mon-Fri 9am-5pm/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run + commit**

```bash
pnpm --filter @chiaro/web test 'state/State(TownHalls|CommitteeHearings|DistrictOffices)List'
pnpm --filter @chiaro/web typecheck
```

Expected: 8 cases pass.

```bash
git add apps/web/components/state/State{TownHallsList,CommitteeHearingsList,DistrictOfficesList}.tsx \
        apps/web/test/components/state/State{TownHallsList,CommitteeHearingsList,DistrictOfficesList}.test.tsx
git commit -m "feat(web): 3 sub-list components for community presence

StateTownHallsList: clickable rows opening source_url, format label
+ attendance estimate; empty state.
StateCommitteeHearingsList: 3-item preview + 'and N more' expandable;
caps overflow.
StateDistrictOfficesList: kind-labeled blocks with inline address +
phone + hours_text.

All 3 are pure-props components (parent card owns the hooks). Tokens
from @chiaro/ui-tokens (signal/neutral/brand vocabulary).

8 vitest cases."
```

---

## Task 14: Web StateCommunityPresenceCard + swap

**Files:**
- Create: `apps/web/components/state/StateCommunityPresenceCard.tsx`
- Create: `apps/web/test/components/state/StateCommunityPresenceCard.test.tsx`
- Modify: `apps/web/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Inspect client-hook pattern**

```bash
grep -n "createSupabaseBrowserClient\|useChiaroClient" apps/web/components/state/StateServiceRecordCard.tsx
```

Use whatever pattern is there. Per slice 5G discovery: `createSupabaseBrowserClient` from `@/lib/supabase/client` wrapped in `useMemo`.

- [ ] **Step 2: Failing test**

```tsx
import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { StateCommunityPresenceCard } from '@/components/state/StateCommunityPresenceCard'
import * as officials from '@chiaro/officials'

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const allEmpty = () => {
  vi.spyOn(officials, 'useOfficialStateTownHalls').mockReturnValue({
    data: [], isLoading: false, isSuccess: true,
  } as never)
  vi.spyOn(officials, 'useOfficialStateDistrictOffices').mockReturnValue({
    data: [], isLoading: false, isSuccess: true,
  } as never)
  vi.spyOn(officials, 'useOfficialStateCommitteeHearings').mockReturnValue({
    data: [], isLoading: false, isSuccess: true,
  } as never)
}

describe('StateCommunityPresenceCard', () => {
  it('renders empty state when all 3 hooks return []', () => {
    allEmpty()
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/No community-presence data available/i)).toBeInTheDocument()
  })

  it('renders summary row with counts', () => {
    vi.spyOn(officials, 'useOfficialStateTownHalls').mockReturnValue({
      data: [{ id: 't1', official_id: 'oid', event_date: '2026-01-01',
        city: null, state: 'CA', format: null, attendance_estimate: null,
        source_url: 'https://x', source: 'townhallproject', external_id: null, ingested_at: '2026-01-01' }],
      isLoading: false, isSuccess: true,
    } as never)
    vi.spyOn(officials, 'useOfficialStateDistrictOffices').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    vi.spyOn(officials, 'useOfficialStateCommitteeHearings').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/1 town hall/i)).toBeInTheDocument()
  })

  it('subsections start collapsed; clicking expands', () => {
    vi.spyOn(officials, 'useOfficialStateTownHalls').mockReturnValue({
      data: [{ id: 't1', official_id: 'oid', event_date: '2026-01-01',
        city: 'San Jose', state: 'CA', format: 'hybrid', attendance_estimate: 50,
        source_url: 'https://x', source: 'thp', external_id: null, ingested_at: '2026-01-01' }],
      isLoading: false, isSuccess: true,
    } as never)
    vi.spyOn(officials, 'useOfficialStateDistrictOffices').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    vi.spyOn(officials, 'useOfficialStateCommitteeHearings').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    const { getByText, queryByText, getByRole } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(queryByText(/San Jose, CA/i)).not.toBeInTheDocument()
    fireEvent.click(getByRole('button', { name: /Town halls/i }))
    expect(getByText(/San Jose, CA/i)).toBeInTheDocument()
  })

  it('renders loading state when any hook is loading', () => {
    vi.spyOn(officials, 'useOfficialStateTownHalls').mockReturnValue({
      data: undefined, isLoading: true, isSuccess: false,
    } as never)
    vi.spyOn(officials, 'useOfficialStateDistrictOffices').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    vi.spyOn(officials, 'useOfficialStateCommitteeHearings').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/Loading community presence/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Implement card**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialStateTownHalls,
  useOfficialStateDistrictOffices,
  useOfficialStateCommitteeHearings,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateTownHallsList } from './StateTownHallsList'
import { StateCommitteeHearingsList } from './StateCommitteeHearingsList'
import { StateDistrictOfficesList } from './StateDistrictOfficesList'

interface Props { officialId: string }

export function StateCommunityPresenceCard({ officialId }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const halls    = useOfficialStateTownHalls(client, officialId)
  const offices  = useOfficialStateDistrictOffices(client, officialId)
  const hearings = useOfficialStateCommitteeHearings(client, officialId)

  const [openHalls, setOpenHalls]       = useState(false)
  const [openHearings, setOpenHearings] = useState(false)
  const [openOffices, setOpenOffices]   = useState(false)

  if (halls.isLoading || offices.isLoading || hearings.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={mutedStyle}>Loading community presence…</div>
      </section>
    )
  }

  const allEmpty =
    (halls.data ?? []).length === 0 &&
    (offices.data ?? []).length === 0 &&
    (hearings.data ?? []).length === 0

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Community Presence</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No community-presence data available for this legislator yet.
        </div>
      </section>
    )
  }

  // Header counts: render '—' when data still loading or hook errored (not just empty).
  // Empty array → render '0' for true-zero per [[feedback-null-vs-zero-metrics]].
  const hallCount     = halls.data?.length    ?? null
  const officeCount   = offices.data?.length  ?? null
  const hearingCount  = hearings.data?.length ?? null

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Community Presence</h2>

      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {hallCount    != null ? `${hallCount} town hall${hallCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {hearingCount != null ? `${hearingCount} hearing${hearingCount === 1 ? '' : 's'} attended` : '—'} ·{' '}
        {officeCount  != null ? `${officeCount} office${officeCount === 1 ? '' : 's'}` : '—'}
      </div>

      <Subsection
        label={`Town halls (${hallCount ?? '—'})`}
        open={openHalls}
        onToggle={() => setOpenHalls(v => !v)}
      >
        <StateTownHallsList rows={halls.data ?? []} />
      </Subsection>

      <Subsection
        label={`Committee hearings attended (${hearingCount ?? '—'})`}
        open={openHearings}
        onToggle={() => setOpenHearings(v => !v)}
      >
        <StateCommitteeHearingsList rows={hearings.data ?? []} />
      </Subsection>

      <Subsection
        label={`District offices (${officeCount ?? '—'})`}
        open={openOffices}
        onToggle={() => setOpenOffices(v => !v)}
      >
        <StateDistrictOfficesList rows={offices.data ?? []} />
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

- [ ] **Step 4: Update StateOfficialDetailPage**

Read current `StateOfficialDetailPage.tsx`. Find `<ComingSoonCard title="Community Presence" />`. Replace with:

```tsx
<StateCommunityPresenceCard officialId={official.id} />
```

Add import: `import { StateCommunityPresenceCard } from '@/components/state/StateCommunityPresenceCard'`.

In the detail-page test (`StateOfficialDetailPage.test.tsx`), add to existing mocks:

```tsx
vi.spyOn(officials, 'useOfficialStateTownHalls').mockReturnValue({
  data: [], isLoading: false, isSuccess: true,
} as never)
vi.spyOn(officials, 'useOfficialStateDistrictOffices').mockReturnValue({
  data: [], isLoading: false, isSuccess: true,
} as never)
vi.spyOn(officials, 'useOfficialStateCommitteeHearings').mockReturnValue({
  data: [], isLoading: false, isSuccess: true,
} as never)
```

Decrement any ComingSoonCard count assertion by 1. Add a positive assertion that `Community Presence` renders.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/web test 'state/StateCommunityPresenceCard|state/StateOfficialDetailPage'
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build
```

Expected: all green; Next 15 build clean.

```bash
git add apps/web/components/state/StateCommunityPresenceCard.tsx \
        apps/web/test/components/state/StateCommunityPresenceCard.test.tsx \
        apps/web/components/state/StateOfficialDetailPage.tsx \
        apps/web/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(web): StateCommunityPresenceCard + swap ComingSoonCard

Card with 3 collapsible subsections (Town halls / Committee hearings
/ District offices). Header summary row distinguishes em-dash (no data)
from numeric counts. Composes 3 hooks + 3 sub-list components from
prior task.

Detail page test mocked + count decremented (only Ethics &
Accountability ComingSoonCard remains).

4 vitest cases for card + adjusted detail-page count."
```

---

## Task 15: Mobile sub-list components + StateCommunityPresenceCard + swap

**Files:**
- Create: `apps/mobile/components/state/State{TownHallsList,CommitteeHearingsList,DistrictOfficesList}.tsx`
- Create: `apps/mobile/components/state/StateCommunityPresenceCard.tsx`
- Create: `apps/mobile/test/components/state/StateCommunityPresenceCard.test.tsx`
- Modify: `apps/mobile/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`

RN parity. Per [[feedback-jest-expo-dynamic-mock-pattern]]: mutable `let mockX = DEFAULT` reset in `beforeEach`.

- [ ] **Step 1: Implement 3 sub-list components (RN)**

`StateTownHallsList.tsx`:

```tsx
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import type { StateTownHallRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person', virtual: 'Virtual', phone: 'Phone', hybrid: 'Hybrid',
}

interface Props { rows: StateTownHallRow[] }

export function StateTownHallsList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No town halls in the past 12 months.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <Pressable key={r.id} onPress={() => Linking.openURL(r.source_url)} style={styles.row}>
          <Text style={styles.title}>
            {r.event_date}{r.city ? ` · ${r.city}, ${r.state}` : ` · ${r.state}`}
          </Text>
          <Text style={styles.meta}>
            {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
            {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list:  { gap: 6, padding: 8 },
  row:   { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta:  { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
})
```

`StateCommitteeHearingsList.tsx`:

```tsx
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { StateCommitteeHearingRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateCommitteeHearingRow[] }

export function StateCommitteeHearingsList({ rows }: Props) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) {
    return <Text style={styles.muted}>No committee hearings attended in current session.</Text>
  }
  const visible = showAll ? rows : rows.slice(0, 3)
  return (
    <View style={styles.list}>
      {visible.map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.title}>
            {r.hearing_date}{r.location ? ` · ${r.location}` : ''}
          </Text>
          {r.agenda_topic && <Text style={styles.meta}>Agenda: {r.agenda_topic}</Text>}
        </View>
      ))}
      {!showAll && rows.length > 3 && (
        <Pressable onPress={() => setShowAll(true)}>
          <Text style={styles.more}>and {rows.length - 3} more</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list:  { gap: 6, padding: 8 },
  row:   { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta:  { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  more:  { fontSize: 12, color: COLORS.neutral.textMuted },
})
```

`StateDistrictOfficesList.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import type { StateDistrictOfficeRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const KIND_LABEL: Record<string, string> = {
  district: 'District Office', satellite: 'Satellite Office', capitol: 'Capitol Office',
}

interface Props { rows: StateDistrictOfficeRow[] }

export function StateDistrictOfficesList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No district offices on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.title}>
            {KIND_LABEL[r.kind] ?? r.kind} · {r.city}, {r.state}
          </Text>
          <Text style={styles.meta}>
            {r.street_1}{r.street_2 ? `, ${r.street_2}` : ''}
            {r.postal_code ? `, ${r.postal_code}` : ''}
            {r.phone ? `\n${r.phone}` : ''}
            {r.hours_text ? `\nHours: ${r.hours_text}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list:  { gap: 10, padding: 8 },
  row:   {},
  title: { fontSize: 13, fontWeight: '600', color: COLORS.brand.text },
  meta:  { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
})
```

- [ ] **Step 2: Implement StateCommunityPresenceCard (RN)**

```tsx
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import {
  useOfficialStateTownHalls,
  useOfficialStateDistrictOffices,
  useOfficialStateCommitteeHearings,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateTownHallsList } from './StateTownHallsList'
import { StateCommitteeHearingsList } from './StateCommitteeHearingsList'
import { StateDistrictOfficesList } from './StateDistrictOfficesList'

interface Props { officialId: string }

export function StateCommunityPresenceCard({ officialId }: Props) {
  const halls    = useOfficialStateTownHalls(supabase, officialId)
  const offices  = useOfficialStateDistrictOffices(supabase, officialId)
  const hearings = useOfficialStateCommitteeHearings(supabase, officialId)

  const [openHalls, setOpenHalls]       = useState(false)
  const [openHearings, setOpenHearings] = useState(false)
  const [openOffices, setOpenOffices]   = useState(false)

  if (halls.isLoading || offices.isLoading || hearings.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Community Presence</Text>
        <Text style={styles.muted}>Loading community presence…</Text>
      </View>
    )
  }

  const hallCount    = halls.data?.length    ?? null
  const officeCount  = offices.data?.length  ?? null
  const hearingCount = hearings.data?.length ?? null

  const allEmpty = (hallCount === 0 && officeCount === 0 && hearingCount === 0)

  if (allEmpty) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Community Presence</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No community-presence data available for this legislator yet.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Community Presence</Text>

      <Text style={styles.summary}>
        {hallCount    != null ? `${hallCount} town hall${hallCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {hearingCount != null ? `${hearingCount} hearing${hearingCount === 1 ? '' : 's'} attended` : '—'} ·{' '}
        {officeCount  != null ? `${officeCount} office${officeCount === 1 ? '' : 's'}` : '—'}
      </Text>

      <Subsection
        label={`Town halls (${hallCount ?? '—'})`}
        open={openHalls}
        onToggle={() => setOpenHalls(v => !v)}
      >
        <StateTownHallsList rows={halls.data ?? []} />
      </Subsection>

      <Subsection
        label={`Committee hearings attended (${hearingCount ?? '—'})`}
        open={openHearings}
        onToggle={() => setOpenHearings(v => !v)}
      >
        <StateCommitteeHearingsList rows={hearings.data ?? []} />
      </Subsection>

      <Subsection
        label={`District offices (${officeCount ?? '—'})`}
        open={openOffices}
        onToggle={() => setOpenOffices(v => !v)}
      >
        <StateDistrictOfficesList rows={offices.data ?? []} />
      </Subsection>
    </View>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}>
        <Text style={styles.subsectionLabel}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
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

- [ ] **Step 3: Card test (jest-expo mutable-mock pattern)**

```tsx
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StateCommunityPresenceCard } from '../../../components/state/StateCommunityPresenceCard'

let mockHalls: unknown[]   = []
let mockOffices: unknown[] = []
let mockHearings: unknown[] = []
let mockLoadingHalls = false

jest.mock('@/lib/supabase', () => ({ supabase: {} }))

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials') as object
  return {
    ...actual,
    useOfficialStateTownHalls:         () => ({ data: mockHalls,    isLoading: mockLoadingHalls, isSuccess: !mockLoadingHalls }),
    useOfficialStateDistrictOffices:   () => ({ data: mockOffices,  isLoading: false, isSuccess: true }),
    useOfficialStateCommitteeHearings: () => ({ data: mockHearings, isLoading: false, isSuccess: true }),
  }
})

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockHalls = []; mockOffices = []; mockHearings = []; mockLoadingHalls = false
})

describe('StateCommunityPresenceCard (mobile)', () => {
  it('renders empty state when all 3 sources empty', () => {
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/No community-presence data available/i)).toBeTruthy()
  })

  it('renders summary row with counts', () => {
    mockHalls = [{ id: 't1', official_id: 'oid', event_date: '2026-01-01',
      city: null, state: 'CA', format: null, attendance_estimate: null,
      source_url: 'https://x', source: 'townhallproject', external_id: null, ingested_at: '2026-01-01' }]
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/1 town hall/i)).toBeTruthy()
  })

  it('subsections collapsed by default; clicking expands', () => {
    mockHalls = [{ id: 't1', official_id: 'oid', event_date: '2026-01-01',
      city: 'San Jose', state: 'CA', format: 'hybrid', attendance_estimate: 50,
      source_url: 'https://x', source: 'thp', external_id: null, ingested_at: '2026-01-01' }]
    const { getByText, queryByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(queryByText(/San Jose, CA/i)).toBeNull()
    fireEvent.press(getByText(/Town halls/i))
    expect(getByText(/San Jose, CA/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoadingHalls = true
    const { getByText } = wrap(<StateCommunityPresenceCard officialId="oid" />)
    expect(getByText(/Loading community presence/i)).toBeTruthy()
  })
})
```

- [ ] **Step 4: Swap mobile detail page**

In `apps/mobile/components/state/StateOfficialDetailPage.tsx`, find `<ComingSoonCard title="Community Presence" />` and replace with `<StateCommunityPresenceCard officialId={official.id} />`. Add the import.

In the test (`apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`), add to the existing `jest.mock('@chiaro/officials', ...)` block:

```tsx
useOfficialStateTownHalls:         () => ({ data: [], isLoading: false, isSuccess: true }),
useOfficialStateDistrictOffices:   () => ({ data: [], isLoading: false, isSuccess: true }),
useOfficialStateCommitteeHearings: () => ({ data: [], isLoading: false, isSuccess: true }),
```

Decrement the placeholder count. Add a positive assertion for the new card.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @chiaro/mobile test 'state/StateCommunityPresenceCard|state/StateOfficialDetailPage'
pnpm --filter @chiaro/mobile typecheck
```

Expected: all green.

```bash
git add apps/mobile/components/state/State{TownHallsList,CommitteeHearingsList,DistrictOfficesList,CommunityPresenceCard,OfficialDetailPage}.tsx \
        apps/mobile/test/components/state/State{CommunityPresenceCard,OfficialDetailPage}.test.tsx
git commit -m "feat(mobile): StateCommunityPresenceCard + 3 sub-list components + swap

Mobile parity with web Task 14. RN primitives (Pressable, View, Text,
Linking, StyleSheet). Per slice 5F lesson, jest-expo uses mutable
mockHalls/mockOffices/mockHearings + beforeEach reset (NOT
jest.resetModules + doMock + require).

4 vitest cases for card + detail-page swap."
```

---

## Task 16: Officials integration test extension

**Files:**
- Modify: `packages/officials/test/queries.integration.test.ts`

- [ ] **Step 1: Add describe block**

Append to the existing file:

```ts
describe('state_community_* RLS + 3 fetchers', () => {
  let officialIdLocal: string
  let hearingId: string
  let townHallId: string
  let officeId: string

  beforeAll(async () => {
    const off = await svc.from('officials').select('id').eq('chamber', 'state_house').limit(1).single()
    if (off.error) throw off.error
    officialIdLocal = off.data!.id

    const th = await svc.from('state_town_halls').insert({
      official_id: officialIdLocal, event_date: '2026-01-15',
      city: 'San Jose', state: 'CA', format: 'hybrid',
      attendance_estimate: 100, source_url: 'https://x',
      source: 'townhallproject', external_id: 'th-integ',
    }).select('id').single()
    if (th.error) throw th.error
    townHallId = th.data!.id

    const o = await svc.from('state_district_offices').insert({
      official_id: officialIdLocal, kind: 'district',
      street_1: '123 Main', city: 'San Jose', state: 'CA',
      source_url: 'https://x',
    }).select('id').single()
    if (o.error) throw o.error
    officeId = o.data!.id

    const h = await svc.from('state_committee_hearings').insert({
      openstates_committee_id: 'ocd-org/integ',
      state: 'CA', session: '20252026', hearing_date: '2026-02-15',
      source_url: 'https://x',
    }).select('id').single()
    if (h.error) throw h.error
    hearingId = h.data!.id

    await svc.from('state_committee_hearing_attendance').insert({
      hearing_id: hearingId, official_id: officialIdLocal,
    })
  })

  afterAll(async () => {
    await svc.from('state_committee_hearing_attendance').delete().eq('hearing_id', hearingId)
    await svc.from('state_committee_hearings').delete().eq('id', hearingId)
    await svc.from('state_district_offices').delete().eq('id', officeId)
    await svc.from('state_town_halls').delete().eq('id', townHallId)
  })

  it('anon SELECT denied (RLS empty array)', async () => {
    const { data } = await unauth.from('state_town_halls').select('*').eq('id', townHallId)
    expect(data ?? []).toHaveLength(0)
  })

  it('authd SELECT allowed for town_halls + offices + hearings', async () => {
    const t = await anon.from('state_town_halls').select('*').eq('id', townHallId)
    expect(t.data).toHaveLength(1)
    const o = await anon.from('state_district_offices').select('*').eq('id', officeId)
    expect(o.data).toHaveLength(1)
    const h = await anon.from('state_committee_hearings').select('*').eq('id', hearingId)
    expect(h.data).toHaveLength(1)
  })

  it('fetchOfficialStateCommitteeHearings joins via attendance M:N', async () => {
    const { fetchOfficialStateCommitteeHearings } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateCommitteeHearings(anon as never, officialIdLocal)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const found = rows.find(r => r.id === hearingId)
    expect(found).toBeDefined()
  })
})
```

The slice 5G implementer (Task 19) discovered the existing test scaffold has `anon` (signed in, used as authenticated) and `unauth` (separate ephemeral client with distinct `storageKey`) — reuse those names instead of `authd`. Confirm by inspecting the top of the existing file.

- [ ] **Step 2: Run + commit**

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  pnpm --filter @chiaro/officials test queries.integration
```

```bash
git add packages/officials/test/queries.integration.test.ts
git commit -m "test(officials): state_community_* RLS + join integration

3 new cases: anon SELECT denied (RLS empty array), authd SELECT
allowed on all 4 tables, fetchOfficialStateCommitteeHearings joins
via attendance M:N. Reuses anon/unauth client pair (slice 5G pattern)."
```

---

## Task 17: CLAUDE.md updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add slice 5H entry**

In `## Slices delivered`, after the existing slice 5G entry:

```markdown
- **Sub-slice 5H — state community presence** (2026-05-21): hybrid adapter pattern (TownHallProject nationwide overlay + 5 per-state stubs × 2 components + OpenStates v3 committee-hearings reuse from 5F). Migrations 0042 (state_town_halls), 0043 (state_district_offices), 0044 (state_committee_hearings + attendance M:N), 0045 (RLS). New `StateCommunityPresenceCard` web + mobile replaces `ComingSoonCard('Community Presence')` on `/state-officials/[id]`. 3 new hooks in `@chiaro/officials`. 11 adapters ship as stubs; operator wires production parsers per (source, state). After this slice: only Ethics & Accountability ComingSoonCard remains.
```

- [ ] **Step 2: Update Quick start**

After existing `pnpm seed:state-scorecards` line, append:

```bash
pnpm seed:state-community --component=halls|offices|hearings|all   # ingest community-presence data (stubs in v1)
```

- [ ] **Step 3: Add Gotcha #13**

In `## Gotchas`, after the existing #12, append:

```markdown
13. **state_town_halls dedup uses (source, external_id) UNIQUE WHERE external_id IS NOT NULL** — NULLs are distinct per Postgres default, so adapters that omit `external_id` get fresh rows on every re-ingest. TownHallProject sets `external_id` for stable dedup; per-state augment adapters SHOULD set deterministic `external_id` derived from the source page (e.g. URL hash) to avoid bloat. Reverse: orchestrator runs TownHallProject FIRST so per-state adapters can either supplement or selectively UPSERT against TownHallProject rows.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 5H entry + per-source dedup gotcha + Quick start

5H slice entry. Gotcha #13 documents NULL-external_id-allowed-fresh-row
semantics in state_town_halls dedup + the orchestrator-runs-TownHall
Project-first ordering. New seed:state-community CLI."
```

---

## Task 18: Final verify + memory + handoff

**Files:**
- None (verification + memory writes only)

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @chiaro/web build
pnpm db:reset
pnpm db:test
```

Expected:
- All 10 packages typecheck clean
- All package test scripts pass via turbo
- Next 15 build clean
- All migrations 0001–0045 apply
- All pgTAP plans pass (count bumps by 18 from Task 4); TIGER 4-failures expected per CLAUDE.md gotcha #6

- [ ] **Step 2: Branch state**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: 16–20 commits on `slice-5h-community-presence` ahead of master.

- [ ] **Step 3: Durable-lessons memory**

Write `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice5h_community_presence.md` capturing:
- Final squash SHA (after merge)
- Hybrid adapter pattern (1st slice to combine nationwide overlay + per-state + OpenStates-reuse)
- `(source, external_id) UNIQUE WHERE external_id IS NOT NULL` dedup semantics
- 2-step PostgREST hearings fetcher (continued lesson from 5G)
- Em-dash NULL convention reused
- v1 stub-shipping pattern reused
- 10 known limitations from spec

Update `MEMORY.md` index with one-line entry.

- [ ] **Step 4: Hand off via finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch`. Recommended: option 1 (squash merge to master locally), matching prior 7 sub-slices.

---

## Verification Checklist (post-Task 18)

- [ ] All 4 new tables + 1 attendance M:N present; RLS enabled on all 5; correct FK directions (RESTRICT to officials.id; CASCADE on attendance.hearing_id)
- [ ] 11 adapters compile + tested + return `[]` from production stub
- [ ] Orchestrator dispatches all 12 adapters with `--component` / `--state` / `--skip-on-error` filters working
- [ ] All 3 hooks resolve correctly; hearings uses 2-step fetcher
- [ ] Web + mobile `StateCommunityPresenceCard` mounts on `/state-officials/[id]` replacing ComingSoonCard
- [ ] Header summary row distinguishes em-dash (NULL) from numeric (0+) counts
- [ ] Subsections start collapsed; click-to-toggle works on web + mobile
- [ ] Workspace typecheck clean across all 10 packages
- [ ] pgTAP total plans bumped by 18 (355 → 373) across 28 files
- [ ] No new env vars required
- [ ] OpenStates fetcher meetings[] decision documented (Task 6 outcome — either no-op or 1 commit extending fetcher)

## Known v1 limitations carried over from spec

1. All 11 adapters ship as stubs returning `[]`; production parsers per (source, state) are operator follow-up.
2. State coverage = core 5 + TownHallProject nationwide overlay; other 45 states out of v1 scope.
3. `hours_text` is free-form per state convention; no normalization.
4. `external_id` dedup is per-source-adapter responsibility; cross-source dedup not automatic.
5. Committee-hearing attendance accuracy depends on OpenStates `meetings[].attendance[]`; sparse for FL/TX.
6. Town-hall 12-month window is hardcoded in the hook.
7. No notification or calendar export of upcoming town halls.
8. `kind` values capped at 3 (district/satellite/capitol); state-specific types fold into satellite.
9. RLS matches slice 5D/5E/5F/5G; no fine-grained policies.
10. Federal `town_halls` (migration 0022) stays unchanged — state-side mirrors with RESTRICT, federal not retroactively flipped.
