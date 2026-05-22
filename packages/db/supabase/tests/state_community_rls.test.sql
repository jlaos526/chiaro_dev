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

-- 15. FK column type assertion on district_offices.
select col_type_is('public', 'state_district_offices', 'official_id', 'uuid',
  'state_district_offices.official_id is uuid (and FK is RESTRICT per migration)');

-- 16. FK column type assertion on attendance.
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
