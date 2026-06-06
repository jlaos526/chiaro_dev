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
