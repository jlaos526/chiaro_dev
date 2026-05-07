begin;

select plan(11);

-- 1. table exists with expected columns
select has_table('public', 'user_locations', 'user_locations table exists');
select columns_are('public', 'user_locations',
  array['id','home_address_text','home_location','geocodio_response','calibrated_at'],
  'user_locations has expected columns');
select col_type_is('public', 'user_locations', 'home_location', 'geography(Point,4326)', 'home_location is geography');
select col_type_is('public', 'user_locations', 'geocodio_response', 'jsonb', 'geocodio_response is jsonb');

-- 2. seed two users + one location row each (as superuser)
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000aa1';
  v_b uuid := '00000000-0000-0000-0000-000000000bb2';
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
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000aa1","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.user_locations
       where id = '00000000-0000-0000-0000-000000000aa1' $$,
  'user A can SELECT own user_locations row'
);

-- 5. user A cannot SELECT user B's row
select is_empty(
  $$ select 1 from public.user_locations
       where id = '00000000-0000-0000-0000-000000000bb2' $$,
  'user A cannot SELECT user B''s user_locations row'
);

-- 6. user A cannot INSERT
select throws_ok(
  $$ insert into public.user_locations (id, home_address_text, home_location, geocodio_response)
     values ('00000000-0000-0000-0000-000000000aa1',
             'fake', ST_SetSRID(ST_MakePoint(0,0),4326)::geography, '{}'::jsonb) $$,
  '42501', 'permission denied for table user_locations',
  'authenticated cannot INSERT into user_locations'
);

-- 7. user A cannot UPDATE
select throws_ok(
  $$ update public.user_locations set home_address_text = 'hacked'
       where id = '00000000-0000-0000-0000-000000000aa1' $$,
  '42501', 'permission denied for table user_locations',
  'authenticated cannot UPDATE user_locations'
);

-- 8. user A cannot DELETE
select throws_ok(
  $$ delete from public.user_locations
       where id = '00000000-0000-0000-0000-000000000aa1' $$,
  '42501', 'permission denied for table user_locations',
  'authenticated cannot DELETE user_locations'
);

-- 9. cascade delete — superuser deletes auth.users → user_locations row gone
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000aa1';
select is_empty(
  $$ select 1 from public.user_locations
       where id = '00000000-0000-0000-0000-000000000aa1' $$,
  'cascade delete from auth.users removes user_locations row'
);

select * from finish();
rollback;
