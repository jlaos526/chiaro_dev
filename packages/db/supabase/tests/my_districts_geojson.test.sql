begin;

select plan(6);

-- Slice 67 C9 (S1/S2 dedupe): my_districts_geojson returns the caller's
-- districts with the shared federal_senate whole-state geometry emitted once
-- (S1 keeps it, S2 gets NULL) while both rows are still returned so both
-- senate toggles + the list survive. getMyDistricts stitches the NULL back.

-- 1. view exists
select has_view('public', 'my_districts_geojson', 'my_districts_geojson view exists');

-- 2. exposes the expected columns
select columns_are('public', 'my_districts_geojson',
  array['id','tier','state','code','name','geometry'],
  'view has expected columns');

-- 3. geometry column is jsonb (inherited from districts_geojson)
select col_type_is('public', 'my_districts_geojson', 'geometry', 'jsonb',
  'geometry is jsonb GeoJSON');

-- 4. seed a user with two same-geometry senate seats (S1/S2) + one county,
--    all as superuser.
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-00000d15701a';
  v_geo  geography := ST_GeomFromText(
    'MULTIPOLYGON(((-124 42, -114 42, -114 32, -124 32, -124 42)))', 4326)::geography;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_user, 'geojson-view-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  -- Two senate rows sharing identical geometry (the whole-state outline).
  -- Codes are test-suffixed (NOT the real CA-S1/CA-S2) so they don't collide
  -- with the TIGER-seeded senate rows on districts' unique (tier, code) when
  -- this runs after seed:tiger in CI. Same (state, tier) so the view's
  -- row_number() partition still groups them — that's what drives the dedupe,
  -- not the code string.
  insert into public.districts (tier, state, code, name, geometry, source_version) values
    ('federal_senate', 'CA', 'CA-S1-GJTEST', 'CA U.S. Senate (Class 1) [test]', v_geo, 'FX-geojson-view'),
    ('federal_senate', 'CA', 'CA-S2-GJTEST', 'CA U.S. Senate (Class 2) [test]', v_geo, 'FX-geojson-view'),
    ('county',         'CA', 'CA-COUNTY-GJ', 'GeoJSON view test county',
       ST_GeomFromText('MULTIPOLYGON(((-122 37, -121 37, -121 38, -122 38, -122 37)))', 4326)::geography,
       'FX-geojson-view');

  insert into public.user_districts (user_id, district_id, tier)
  select v_user, id, tier from public.districts where source_version = 'FX-geojson-view';
end $$;

-- 5. act as the seeded user
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000d15701a","role":"authenticated"}';

-- 5a. all three district rows are returned (both senate seats survive for the
--     list + toggles; nothing is dropped)
select results_eq(
  $$ select count(*)::int from public.my_districts_geojson $$,
  $$ values (3) $$,
  'all 3 of the caller''s district rows are returned'
);

-- 5b. THE DEDUPE: exactly one of the two senate rows carries geometry
select results_eq(
  $$ select count(*)::int from public.my_districts_geojson
       where tier = 'federal_senate' and geometry is not null $$,
  $$ values (1) $$,
  'senate geometry is emitted exactly once (S1/S2 deduped)'
);

-- 5c. the non-duplicated county row keeps its geometry
select isnt_empty(
  $$ select 1 from public.my_districts_geojson
       where code = 'CA-COUNTY-GJ' and geometry is not null $$,
  'non-senate (county) row retains its geometry'
);

select * from finish();
rollback;
