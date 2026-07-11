-- Slice 69 (audit U19 + U20): security hardening pass 2, following the
-- slice-56 (0060) precedent. RLS + grant changes only — zero types.ts drift.

-- U19: scope profiles SELECT to the owning user. Was `using (true)` (0002) —
-- any authenticated session could enumerate every user's display_name /
-- username / completed (a uuid → identity mapping). Both app readers
-- (getMyProfile / updateMyProfile's UPDATE...RETURNING) already self-scope
-- via `.eq('id', uid)`, so no consumer changes. Same shape as the slice-56
-- user_districts fix (Gotcha #32a).
drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_self"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- U20: strip the implicit PUBLIC EXECUTE grant (auto-granted at function
-- creation — Gotcha #32b) from the three SECURITY DEFINER functions slice 56
-- didn't cover. Each already guards on auth.uid() internally, so this is
-- defense-in-depth: it makes the grant surface uniform with apply_calibration
-- (0008) and rep_stance_score (0060). `authenticated` keeps its explicit
-- grant (0056/0058).
revoke execute on function public.save_user_issue_selections(jsonb) from anon, public;
revoke execute on function public.get_rep_issue_alignment(uuid)     from anon, public;
revoke execute on function public.get_rep_watchlist_flags(uuid)     from anon, public;
