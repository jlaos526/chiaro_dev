begin;

select plan(2);

-- A2: anon must NOT be able to execute rep_stance_score (revoked in 0060).
select is(
  has_function_privilege('anon', 'public.rep_stance_score(uuid, jsonb)', 'execute'),
  false,
  'anon cannot execute rep_stance_score'
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
