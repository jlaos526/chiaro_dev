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
select col_type_is('public', 'districts', 'geometry', 'geography(MultiPolygon,4326)', 'geometry is geography');

select * from finish();
rollback;
