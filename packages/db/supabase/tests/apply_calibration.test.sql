begin;

select plan(8);

-- 1. function exists with the expected signature
select has_function(
  'public', 'apply_calibration',
  array['text','double precision','double precision','jsonb','jsonb'],
  'apply_calibration RPC exists'
);

-- 2. seed test users + districts
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000ee1';
  v_b uuid := '00000000-0000-0000-0000-000000000ee2';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-cal-rpc-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-cal-rpc-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.districts (tier, state, code, name, geometry, source_version)
  values
    ('federal_house', 'CA', 'CA-12-rpctest', 'CA-12 (rpc-test)',
     ST_GeomFromText('MULTIPOLYGON(((-122 37, -121 37, -121 38, -122 38, -122 37)))', 4326)::geography,
     'TIGER 2024-test'),
    ('county', 'CA', '06075-rpctest', 'SF County (rpc-test)',
     ST_GeomFromText('MULTIPOLYGON(((-122 37, -121 37, -121 38, -122 38, -122 37)))', 4326)::geography,
     'TIGER 2024-test')
  on conflict (tier, code) do nothing;
end $$;

-- Disable throttle for the happy-path assertions; we re-enable it below for the rate-limit test.
set local app.calibrate_throttle_seconds = '0';

-- 3. unauthenticated (no auth.uid()) raises
select throws_ok(
  $$ select public.apply_calibration('123 Main', 37.5, -122.0, '{}'::jsonb, '[]'::jsonb) $$,
  'P0001', 'unauthenticated',
  'apply_calibration without auth.uid() raises unauthenticated'
);

-- 4. switch to user A's authenticated context
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000ee1","role":"authenticated"}';

-- 5. happy path: returned JSON has the expected shape
select results_eq(
  $$ select public.apply_calibration(
       '350 5th Ave',
       37.7749,
       -122.4194,
       '{"location":{"lat":37.7749,"lng":-122.4194}}'::jsonb,
       '[{"tier":"federal_house","code":"CA-12-rpctest","state":"CA","name":"CA-12 House"},
         {"tier":"county","code":"06075-rpctest","state":"CA","name":"SF County"}]'::jsonb
     ) -> 'districts' @> '[{"tier":"federal_house","code":"CA-12-rpctest"}]'::jsonb $$,
  $$ values (true) $$,
  'apply_calibration return JSON includes the matched federal_house district'
);

-- 6. user_districts has exactly 2 rows for the matched tuples
select results_eq(
  $$ select count(*)::int from public.user_districts
       where user_id = '00000000-0000-0000-0000-000000000ee1' $$,
  $$ values (2) $$,
  'user_districts has 2 rows after apply_calibration with 2 matched tuples'
);

-- 7. unknown district codes are silently dropped; replacement is atomic
select public.apply_calibration(
  '456 Other St',
  37.0, -122.0,
  '{"location":{"lat":37.0,"lng":-122.0}}'::jsonb,
  '[{"tier":"federal_house","code":"NONEXISTENT-RPC","state":"CA","name":"missing"},
    {"tier":"county","code":"06075-rpctest","state":"CA","name":"SF County"}]'::jsonb
);

select results_eq(
  $$ select count(*)::int from public.user_districts
       where user_id = '00000000-0000-0000-0000-000000000ee1' $$,
  $$ values (1) $$,
  'unmatched district codes dropped; replacement atomic (count goes 2 -> 1)'
);

-- 8. rate limit fires when throttle window is non-zero
set local app.calibrate_throttle_seconds = '60';

select throws_ok(
  $$ select public.apply_calibration(
       '789 Rapid St', 37.5, -122.5,
       '{}'::jsonb, '[]'::jsonb
     ) $$,
  'P0001', 'calibrating_too_frequently',
  'second call within throttle window raises calibrating_too_frequently'
);

-- 9. authenticated still cannot bypass the RPC and write user_locations directly
select throws_ok(
  $$ insert into public.user_locations (id, home_address_text, home_location, geocodio_response)
     values ('00000000-0000-0000-0000-000000000ee1',
             'bypass', ST_SetSRID(ST_MakePoint(0,0),4326)::geography, '{}'::jsonb) $$,
  '42501', 'permission denied for table user_locations',
  'authenticated cannot write user_locations directly (RPC is the only path)'
);

-- 10. cascade delete from auth.users → user_locations + user_districts cleaned
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000ee1';

select is_empty(
  $$ select 1 from public.user_locations where id = '00000000-0000-0000-0000-000000000ee1' $$,
  'cascade delete from auth.users removes the user_locations row'
);

select * from finish();
rollback;
