begin;

select plan(9);

-- 1. table + columns
select has_table('public', 'user_districts', 'user_districts table exists');
select columns_are('public', 'user_districts',
  array['user_id','district_id','tier','created_at'],
  'user_districts has expected columns');
select col_is_pk('public', 'user_districts', array['user_id','district_id'],
  'composite PK on (user_id, district_id)');

-- 2. seed scenario (as superuser)
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000cc1';
  v_b uuid := '00000000-0000-0000-0000-000000000dd2';
  v_d uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'NY', 'NY-12-test', 'NY-12-test',
          ST_GeomFromText('MULTIPOLYGON(((-73 40, -72 40, -72 41, -73 41, -73 40)))', 4326)::geography,
          'TIGER 2024')
  returning id into v_d;

  insert into public.user_districts (user_id, district_id, tier)
  values (v_a, v_d, 'federal_house'),
         (v_b, v_d, 'federal_house');
end $$;

-- 3. RLS enabled
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'user_districts' $$,
  $$ values (true) $$,
  'RLS is enabled on user_districts'
);

-- 4. user A can SELECT all rows (public-readable per Q6c)
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000cc1","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.user_districts $$,
  $$ values (2) $$,
  'authenticated user A sees both rows in user_districts'
);

-- 5. user A cannot INSERT
select throws_ok(
  $$ insert into public.user_districts (user_id, district_id, tier)
     values ('00000000-0000-0000-0000-000000000cc1',
             (select id from public.districts where code = 'NY-12-test'),
             'federal_house') $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot INSERT into user_districts'
);

-- 6. user A cannot DELETE
select throws_ok(
  $$ delete from public.user_districts
     where user_id = '00000000-0000-0000-0000-000000000cc1' $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot DELETE from user_districts'
);

-- 7. cascade — delete a user removes their user_districts rows
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000cc1';
select results_eq(
  $$ select count(*)::int from public.user_districts $$,
  $$ values (1) $$,
  'cascade delete from auth.users removes their user_districts row'
);

-- 8. cascade — delete a district removes related user_districts rows
delete from public.districts where code = 'NY-12-test';
select is_empty(
  $$ select 1 from public.user_districts $$,
  'cascade delete from districts removes related user_districts rows'
);

select * from finish();
rollback;
