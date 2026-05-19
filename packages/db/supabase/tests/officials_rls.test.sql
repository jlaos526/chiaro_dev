begin;

select plan(25);

-- 1. official_chamber enum exists
select has_enum('public', 'official_chamber', 'official_chamber enum exists');
select enum_has_labels(
  'public', 'official_chamber',
  array['federal_house','federal_senate','state_house','state_senate','state_legislature']::text[],
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
-- Note: party CHECK was dropped in migration 0029 to allow state-legislator
-- party labels (Nonpartisan, DFL, Working Families, Progressive, etc.).
-- Display normalization moves to @chiaro/ui-tokens.
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

-- 7. column inventory + types (locks the schema shape)
-- Migration 0029 added openstates_person_id, district_code, title (state-leg fields).
select columns_are(
  'public', 'officials',
  array[
    'id','bioguide_id','first_name','last_name','full_name','chamber','party',
    'state','district_id','senate_class','portrait_url','official_url',
    'twitter_handle','next_election','in_office','source_version',
    'created_at','updated_at','opensecrets_id','fec_candidate_id',
    'openstates_person_id','district_code','title'
  ]::name[],
  'officials has the expected 23 columns'
);
select col_type_is(
  'public', 'officials', 'chamber', 'official_chamber',
  'chamber column is bound to the official_chamber enum'
);

-- 8. partial index officials_state_chamber_idx exists
select has_index(
  'public', 'officials', 'officials_state_chamber_idx',
  'officials_state_chamber_idx exists'
);

-- 9. named cross-column constraint senate_class_matches_chamber exists
select ok(
  exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'officials'
      and c.conname = 'senate_class_matches_chamber'
      and c.contype = 'c'
  ),
  'senate_class_matches_chamber named constraint present'
);

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
          st_geogfromtext('MULTIPOLYGON(((-120 35, -119 35, -119 36, -120 36, -120 35)))'),
          'TIGER-FIXTURE');

insert into public.officials (bioguide_id, first_name, last_name, full_name,
  chamber, party, state, district_id, senate_class, source_version)
  values ('X000001','Test','Senator','Test Senator','federal_senate','D','CA',
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
     values ('X000002','Y','Y','Y','federal_senate','R','TX',
       '11111111-1111-1111-1111-111111111111', 2, '119') $$,
  '42501',
  null,
  'anon cannot INSERT'
);

-- 10. anon UPDATE blocked (table grant revoked → throws 42501)
select throws_ok(
  $$ update public.officials set party = 'R' where bioguide_id = 'X000001' $$,
  '42501', null,
  'anon cannot UPDATE (permission denied at table grant level)'
);

-- 11. anon DELETE blocked (table grant revoked → throws 42501)
select throws_ok(
  $$ delete from public.officials where bioguide_id = 'X000001' $$,
  '42501', null,
  'anon cannot DELETE (permission denied at table grant level)'
);

reset role;

-- 12. service_role can INSERT (admin context)
set local role service_role;
select lives_ok(
  $$ insert into public.officials (bioguide_id, first_name, last_name, full_name,
       chamber, party, state, district_id, senate_class, source_version)
     values ('X000003','Z','Z','Z','federal_senate','I','VT',
       '11111111-1111-1111-1111-111111111111', 1, '119') $$,
  'service_role can INSERT'
);
-- 13. service_role INSERT actually wrote the row
select is(
  (select count(*) from public.officials where bioguide_id = 'X000003'),
  1::bigint,
  'service_role INSERT actually wrote X000003'
);
reset role;

select * from finish();
rollback;
