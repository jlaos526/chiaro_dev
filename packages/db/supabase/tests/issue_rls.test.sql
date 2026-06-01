begin;
select plan(6);

-- NOTE: This pgTAP build lacks the 3-arg row_security_is_on(schema,table,desc)
-- and policies_are(...) helpers. The three RLS-enabled checks and two
-- policy-presence checks below are written against pg_class / pg_policies to
-- encode the identical intent (mirrors the catalog-query idiom used by the
-- other *_rls.test.sql files in this suite). The INSERT-privilege check uses
-- core has_table_privilege, which IS available.

-- 1-3. RLS is enabled on all three issue-priorities tables.
select is(
  (select relrowsecurity from pg_class
     where relname = 'issue_topics' and relnamespace = 'public'::regnamespace),
  true, 'RLS on issue_topics');
select is(
  (select relrowsecurity from pg_class
     where relname = 'issue_lenses' and relnamespace = 'public'::regnamespace),
  true, 'RLS on issue_lenses');
select is(
  (select relrowsecurity from pg_class
     where relname = 'user_issue_selections' and relnamespace = 'public'::regnamespace),
  true, 'RLS on user_issue_selections');

-- 4. issue_topics has exactly the read policy (and only that policy).
select results_eq(
  $$ select policyname from pg_policies
       where schemaname = 'public' and tablename = 'issue_topics'
       order by policyname $$,
  $$ values ('issue_topics_read'::name) $$,
  'topics read policy present');

-- 5. user_issue_selections has exactly the select-self policy (and only that).
select results_eq(
  $$ select policyname from pg_policies
       where schemaname = 'public' and tablename = 'user_issue_selections'
       order by policyname $$,
  $$ values ('user_issue_selections_select_self'::name) $$,
  'selections select-self policy present');

-- 6. authenticated cannot directly INSERT selections (writes go through the
--    SECURITY DEFINER save_user_issue_selections RPC).
select ok(
  not has_table_privilege('authenticated', 'public.user_issue_selections', 'INSERT'),
  'authenticated cannot directly INSERT selections');

select * from finish();
rollback;
