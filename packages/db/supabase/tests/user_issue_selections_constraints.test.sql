begin;

select plan(7);

-- Seed a user + minimal catalog so the composite FK + PK are satisfiable.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
values ('00000000-0000-0000-0000-0000000c0001', 'cons@x.io',
        crypt('p', gen_salt('bf')), now(),
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.issue_topics (slug, display_name, description)
  values ('gun-policy','Gun Policy','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type)
  values ('gun-policy','gun-rights','Gun Rights','stance');

-- valid rows live
select lives_ok(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 0, 1) $$,
  'position=0, importance=1 accepted');
delete from public.user_issue_selections;
select lives_ok(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 100, 2) $$,
  'position=100, importance=2 accepted');
delete from public.user_issue_selections;
select lives_ok(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', NULL, 1) $$,
  'position=NULL accepted');
delete from public.user_issue_selections;

-- out-of-range rejected by the CHECK constraints
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 101, 1) $$,
  '%user_issue_selections_position_check%', 'position=101 rejected');
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', -1, 1) $$,
  '%user_issue_selections_position_check%', 'position=-1 rejected');
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 50, 3) $$,
  '%user_issue_selections_importance_check%', 'importance=3 rejected');
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 50, 0) $$,
  '%user_issue_selections_importance_check%', 'importance=0 rejected');

select * from finish();
rollback;
