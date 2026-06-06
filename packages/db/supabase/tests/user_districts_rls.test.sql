begin;

select plan(11);

-- 1. table + columns + PK (structure)
select has_table('public', 'user_districts', 'user_districts table exists');
select columns_are('public', 'user_districts',
  array['user_id','district_id','tier','created_at'],
  'user_districts has expected columns');
select col_is_pk('public', 'user_districts', array['user_id','district_id'],
  'composite PK on (user_id, district_id)');

-- 2. RLS enabled
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'user_districts' $$,
  $$ values (true) $$,
  'RLS is enabled on user_districts'
);

-- 3. seed one district + two users + one user_districts row each (as superuser)
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-0000000d1aa1';
  v_b uuid := '00000000-0000-0000-0000-0000000d1bb2';
  v_dist uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'CA', 'CA-12-udtest', 'CA-12 (ud-test)',
          ST_GeomFromText('MULTIPOLYGON(((-122 37, -121 37, -121 38, -122 38, -122 37)))', 4326)::geography,
          'TIGER 2024-test')
  returning id into v_dist;

  insert into public.user_districts (user_id, district_id, tier)
  values (v_a, v_dist, 'federal_house'),
         (v_b, v_dist, 'federal_house');
end $$;

-- 4. act as user A
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000d1aa1","role":"authenticated"}';

-- 5. user A sees own row
select isnt_empty(
  $$ select 1 from public.user_districts
       where user_id = '00000000-0000-0000-0000-0000000d1aa1' $$,
  'user A can SELECT own user_districts row'
);

-- 6. user A CANNOT see user B's row (THE FIX — fails under the old using(true) policy)
select is_empty(
  $$ select 1 from public.user_districts
       where user_id = '00000000-0000-0000-0000-0000000d1bb2' $$,
  'user A cannot SELECT user B''s user_districts row'
);

-- 7. user A cannot INSERT (writes revoked; go through apply_calibration)
select throws_ok(
  $$ insert into public.user_districts (user_id, district_id, tier)
     select '00000000-0000-0000-0000-0000000d1aa1', id, 'federal_house'
       from public.districts where code = 'CA-12-udtest' $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot INSERT into user_districts'
);

-- 8. user A cannot UPDATE
select throws_ok(
  $$ update public.user_districts set tier = 'federal_senate'
       where user_id = '00000000-0000-0000-0000-0000000d1aa1' $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot UPDATE user_districts'
);

-- 9. user A cannot DELETE
select throws_ok(
  $$ delete from public.user_districts
       where user_id = '00000000-0000-0000-0000-0000000d1aa1' $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot DELETE user_districts'
);

-- 10. cascade — delete a user removes their user_districts rows
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000d1aa1';
select results_eq(
  $$ select count(*)::int from public.user_districts $$,
  $$ values (1) $$,
  'cascade delete from auth.users removes their user_districts row'
);

-- 11. cascade — delete a district removes related user_districts rows
delete from public.districts where code = 'CA-12-udtest';
select is_empty(
  $$ select 1 from public.user_districts $$,
  'cascade delete from districts removes related user_districts rows'
);

select * from finish();
rollback;
