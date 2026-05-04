begin;

select plan(1);

-- Test 1: trigger fires on auth.users insert and creates a stub profile row
do $$
declare
  v_user_id uuid;
begin
  v_user_id := extensions.uuid_generate_v4();
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_user_id, 'trigger-test@example.com', crypt('password', gen_salt('bf')),
          now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
end $$;

select results_eq(
  $$ select display_name, username, completed
       from public.profiles
      where id = (select id from auth.users where email = 'trigger-test@example.com') $$,
  $$ values (null::text, null::citext, false) $$,
  'Trigger creates stub profile row with nulls and completed=false'
);

select * from finish();
rollback;
