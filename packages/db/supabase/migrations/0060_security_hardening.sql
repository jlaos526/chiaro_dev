-- Slice 56 — security & data-integrity hardening (audit track T1, 2026-06-05).
-- Append-only. Fixes A1 (user_districts cross-user RLS leak), A2 (rep_stance_score
-- anon grant), A3 (user_issue_selections position/importance bounds), A4
-- (touch_updated_at search_path pin). No app code; no types.ts drift.

-- A1: scope user_districts SELECT to the owning user (was `using (true)`, a
-- cross-user location leak; both app readers already filter by auth.uid()).
drop policy if exists "user_districts_select_all" on public.user_districts;

create policy "user_districts_select_self"
  on public.user_districts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- A3: enforce the app-layer (Zod) bounds at the DB so a direct RPC caller can't
-- store out-of-range values that skew get_rep_issue_alignment's agreement math.
alter table public.user_issue_selections
  add constraint user_issue_selections_position_check
  check (position is null or position between 0 and 100);

alter table public.user_issue_selections
  add constraint user_issue_selections_importance_check
  check (importance in (1, 2));

-- A2: rep_stance_score is SECURITY DEFINER over authenticated-only state tables;
-- its only in-app caller (get_rep_issue_alignment) is authenticated. Drop the
-- anon direct-execute grant AND the implicit PUBLIC execute grant that Postgres
-- auto-assigns to every function at creation time (anon inherits EXECUTE through
-- PUBLIC, so revoking from anon alone leaves anon able to execute). authenticated
-- + service_role keep their explicit grants; the internal definer call is unaffected.
revoke execute on function public.rep_stance_score(uuid, jsonb) from anon, public;

-- A4: pin search_path on touch_updated_at (the only public fn missing it).
-- Body unchanged from 0001; now hardened against search_path manipulation.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;
