begin;

select plan(5);

-- 1. View exists
select has_view('public', 'user_locations_geojson', 'view exists');

-- 2. View has expected columns
select has_column('public', 'user_locations_geojson', 'home_location_geojson',
                  'home_location_geojson column present');
select col_type_is('public', 'user_locations_geojson', 'home_location_geojson', 'jsonb',
                   'home_location_geojson is jsonb');

-- 3. Seed: two users, each with their own user_locations row.
--    user_locations.id is the PK and references auth.users(id) (one row per user).
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000aa1';
  v_b uuid := '00000000-0000-0000-0000-000000000bb2';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-geojson-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-geojson-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.user_locations (id, home_address_text, home_location, geocodio_response)
  values (v_a, '1 A St',
          st_geogfromtext('SRID=4326;POINT(-120 35)'),
          '{}'::jsonb),
         (v_b, '2 B St',
          st_geogfromtext('SRID=4326;POINT(-121 36)'),
          '{}'::jsonb);
end $$;

-- 4. User A sees only their own row through the view (RLS via security_invoker)
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000aa1","role":"authenticated"}';
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
