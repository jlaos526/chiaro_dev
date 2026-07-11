begin;

select plan(8);

-- A2: anon must NOT be able to execute rep_stance_score (revoked in 0060).
select is(
  has_function_privilege('anon', 'public.rep_stance_score(uuid, jsonb)', 'execute'),
  false,
  'anon cannot execute rep_stance_score'
);

-- U20 (0063): the three issue/watchlist SECURITY DEFINER functions must deny
-- anon (PUBLIC's implicit execute stripped) while authenticated keeps its
-- explicit grant.
select is(
  has_function_privilege('anon', 'public.save_user_issue_selections(jsonb)', 'execute'),
  false,
  'anon cannot execute save_user_issue_selections'
);
select is(
  has_function_privilege('anon', 'public.get_rep_issue_alignment(uuid)', 'execute'),
  false,
  'anon cannot execute get_rep_issue_alignment'
);
select is(
  has_function_privilege('anon', 'public.get_rep_watchlist_flags(uuid)', 'execute'),
  false,
  'anon cannot execute get_rep_watchlist_flags'
);
select is(
  has_function_privilege('authenticated', 'public.save_user_issue_selections(jsonb)', 'execute'),
  true,
  'authenticated can execute save_user_issue_selections'
);
select is(
  has_function_privilege('authenticated', 'public.get_rep_issue_alignment(uuid)', 'execute'),
  true,
  'authenticated can execute get_rep_issue_alignment'
);
select is(
  has_function_privilege('authenticated', 'public.get_rep_watchlist_flags(uuid)', 'execute'),
  true,
  'authenticated can execute get_rep_watchlist_flags'
);

-- A4: touch_updated_at must pin search_path (proconfig carries a search_path entry).
select is(
  (select exists (
     select 1 from pg_proc
     where proname = 'touch_updated_at'
       and pronamespace = 'public'::regnamespace
       and proconfig is not null
       and exists (select 1 from unnest(proconfig) c where c like 'search_path=%')
  )),
  true,
  'touch_updated_at pins search_path'
);

select * from finish();
rollback;
