begin;

select plan(9);

-- Helper: create two test users via auth.users insert (trigger creates profiles)
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-00000000000a';
  v_b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values
    (v_a, 'a@example.com', crypt('p', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_b, 'b@example.com', crypt('p', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
end $$;

-- Test 1: trigger created stub rows for both users
select results_eq(
  $$ select count(*)::int from public.profiles where id in
       ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b') $$,
  $$ values (2) $$,
  'Trigger created stub profiles for both users'
);

-- Switch to user A's auth context
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- Test 2: User A updates own row
select lives_ok(
  $$ update public.profiles set display_name='Alice', username='alice', completed=true
      where id='00000000-0000-0000-0000-00000000000a' $$,
  'User A can update own row'
);

-- Test 3: User A attempts to update user B's row → 0 rows affected, no error
select results_eq(
  $$ with upd as (
       update public.profiles set display_name='hax'
        where id='00000000-0000-0000-0000-00000000000b'
       returning 1
     ) select count(*)::int from upd $$,
  $$ values (0) $$,
  'User A update of user B''s row returns 0 rows (RLS filter)'
);

-- Test 4: User A attempts to update id column → permission denied
select throws_ok(
  $$ update public.profiles set id='00000000-0000-0000-0000-00000000000b'
      where id='00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'Updating id is denied by column grant'
);

-- Test 5: User A attempts to update created_at → permission denied
select throws_ok(
  $$ update public.profiles set created_at=now()
      where id='00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'Updating created_at is denied by column grant'
);

-- Test 7 (auth read): User A can read any profile
select results_eq(
  $$ select count(*)::int from public.profiles
      where id in ('00000000-0000-0000-0000-00000000000a',
                   '00000000-0000-0000-0000-00000000000b') $$,
  $$ values (2) $$,
  'Authenticated user can read all profiles'
);

-- Switch to anon
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

-- Test 6: anon select returns 0 rows (RLS, no anon policy)
select results_eq(
  $$ select count(*)::int from public.profiles $$,
  $$ values (0) $$,
  'Anon select returns 0 rows (RLS, no to-anon policy)'
);

-- Reset role to test cascade and uniqueness
reset role;
reset "request.jwt.claims";

-- Test 9: username uniqueness is case-insensitive (run while both A and B exist)
select throws_ok(
  $$ update public.profiles set username='ALICE' where id='00000000-0000-0000-0000-00000000000b' $$,
  '23505',
  null,
  'Case-insensitive username uniqueness enforced'
);

-- Test 8: cascade delete from auth.users → profile gone
delete from auth.users where id='00000000-0000-0000-0000-00000000000a';
select results_eq(
  $$ select count(*)::int from public.profiles where id='00000000-0000-0000-0000-00000000000a' $$,
  $$ values (0) $$,
  'Deleting auth.users row cascades to profiles'
);

select * from finish();
rollback;
