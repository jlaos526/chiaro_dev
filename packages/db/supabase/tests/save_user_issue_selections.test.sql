begin;
select plan(4);

-- Seed a user (mirrors apply_calibration.test.sql auth.users column set) + a
-- minimal catalog (one topic, one lens) so the composite FK on
-- user_issue_selections is satisfiable.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
values ('00000000-0000-0000-0000-000000000a52', 'q@x.io',
        crypt('p', gen_salt('bf')), now(),
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.issue_topics (slug, display_name, description)
  values ('gun-policy','Gun Policy','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type)
  values ('gun-policy','gun-rights','Gun Rights','stance');

select has_function('public', 'save_user_issue_selections', array['jsonb'], 'fn exists');

-- Act as the user.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a52"}';

select public.save_user_issue_selections(
  '[{"topic_slug":"gun-policy","lens_slug":"gun-rights","display_order":0,"position":67,"importance":2}]'::jsonb);

reset role;
select is((select count(*)::int from public.user_issue_selections), 1, 'one selection saved');
select is((select importance from public.user_issue_selections), 2::smallint, 'importance saved');

-- Second call replaces (atomic), not appends.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a52"}';
select public.save_user_issue_selections('[]'::jsonb);
reset role;
select is((select count(*)::int from public.user_issue_selections), 0, 'empty payload clears selections');

select * from finish();
rollback;
