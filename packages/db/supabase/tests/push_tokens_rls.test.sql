begin;

select plan(10);

-- 1. push_platform enum exists
select has_enum('public', 'push_platform', 'push_platform enum exists');

-- 2. push_platform has expected labels
select enum_has_labels(
  'public', 'push_platform',
  array['ios','android','web']::text[],
  'push_platform has labels ios/android/web'
);

-- 3. push_tokens table exists
select has_table('public', 'push_tokens', 'push_tokens table exists');

-- 4. composite primary key on (user_id, token)
select col_is_pk('public', 'push_tokens', array['user_id','token'],
  'composite PK on (user_id, token)');

-- 5. RLS enabled
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'push_tokens' $$,
  $$ values (true) $$,
  'RLS is enabled on push_tokens'
);

-- Seed two users C and D
do $$
declare
  v_c uuid := '00000000-0000-0000-0000-000000000cc3';
  v_d uuid := '00000000-0000-0000-0000-000000000dd4';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_c, 'c-pt-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_d, 'd-pt-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
end $$;

-- Switch to user C's auth context
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000cc3","role":"authenticated"}';

-- 6. user C can INSERT own token
select lives_ok(
  $$ insert into public.push_tokens (user_id, token, platform)
     values ('00000000-0000-0000-0000-000000000cc3', 'token-c-ios', 'ios') $$,
  'user C can INSERT own push_tokens row'
);

-- 7. user C cannot INSERT for user D — RLS WITH CHECK violation
select throws_ok(
  $$ insert into public.push_tokens (user_id, token, platform)
     values ('00000000-0000-0000-0000-000000000dd4', 'token-d-ios', 'ios') $$,
  '42501',
  null,
  'user C cannot INSERT push_tokens row for user D (RLS WITH CHECK)'
);

-- 8. user C sees only own row
select results_eq(
  $$ select count(*)::int from public.push_tokens $$,
  $$ values (1) $$,
  'user C sees only own push_tokens row'
);

-- 9. user C can DELETE own token
select lives_ok(
  $$ delete from public.push_tokens
     where user_id = '00000000-0000-0000-0000-000000000cc3'
       and token   = 'token-c-ios' $$,
  'user C can DELETE own push_tokens row'
);

-- 10. anon sees no rows
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

select results_eq(
  $$ select count(*)::int from public.push_tokens $$,
  $$ values (0) $$,
  'anon sees no push_tokens rows'
);

select * from finish();
rollback;
