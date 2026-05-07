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
select col_type_is('public', 'districts', 'geometry', 'geography(MultiPolygon,4326)', 'geometry is geography');

-- (RLS — added in Task 2) ----------------------------------------------------

-- seed one row as superuser for read tests
-- ON CONFLICT handles the case where the TIGER ingest has already populated this row.
insert into public.districts (tier, state, code, name, geometry, source_version)
values ('federal_house', 'NY', 'NY-01', 'NY-01',
        ST_GeomFromText('MULTIPOLYGON(((-73 40, -72 40, -72 41, -73 41, -73 40)))', 4326)::geography,
        'TIGER 2024')
on conflict (tier, code) do nothing;

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
