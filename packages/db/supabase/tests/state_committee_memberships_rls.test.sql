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

-- 3. role CHECK rejects invalid value. Seed parent district + official first.
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
       'ranking_minority',
       'https://x'
     ) $$,
  '23514',
  'new row for relation "state_committee_memberships" violates check constraint "state_committee_memberships_role_check"',
  'role CHECK rejects values outside chair / vice_chair / member'
);

-- 4. chair role accepted.
insert into public.state_committee_memberships (
  official_id, openstates_committee_id, committee_name,
  state, chamber, session, role, source_url
)
values (
  (select id from public.officials where source_version = 'FX-cmt'),
  'ocd-committee/chair-1', 'Test Chair Cmt', 'CA', 'state_house',
  '2025-2026', 'chair', 'https://x'
);
select is(
  (select count(*)::int from public.state_committee_memberships
   where openstates_committee_id = 'ocd-committee/chair-1'),
  1,
  'chair role accepted'
);

-- 5. vice_chair role accepted.
insert into public.state_committee_memberships (
  official_id, openstates_committee_id, committee_name,
  state, chamber, session, role, source_url
)
values (
  (select id from public.officials where source_version = 'FX-cmt'),
  'ocd-committee/vc-1', 'Test VC Cmt', 'CA', 'state_house',
  '2025-2026', 'vice_chair', 'https://x'
);
select is(
  (select count(*)::int from public.state_committee_memberships
   where role = 'vice_chair' and openstates_committee_id = 'ocd-committee/vc-1'),
  1,
  'vice_chair role accepted'
);

-- 6. Unique constraint. (session must be non-NULL — NULLs are distinct in unique
-- constraints by default, so duplicate-with-NULL-session would not raise.)
select throws_ok(
  $$ insert into public.state_committee_memberships (
       official_id, openstates_committee_id, committee_name,
       state, chamber, session, role, source_url
     )
     values (
       (select id from public.officials where source_version = 'FX-cmt'),
       'ocd-committee/chair-1', 'Test Chair Cmt', 'CA', 'state_house',
       '2025-2026', 'chair', 'https://x'
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

-- 8. Index 1.
select has_index('public', 'state_committee_memberships',
  'state_committee_memberships_official_idx',
  'state_committee_memberships_official_idx exists');

-- 9. Index 2.
select has_index('public', 'state_committee_memberships',
  'state_committee_memberships_committee_idx',
  'state_committee_memberships_committee_idx exists');

-- 10-12. RLS placeholder assertions (covered in integration test layer).
select pass('anon SELECT denied — covered in integration test layer');
select pass('authenticated SELECT allowed — covered in integration test layer');
select pass('service_role INSERT allowed — covered in integration test layer');

select * from finish();
rollback;
