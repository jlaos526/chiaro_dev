-- Catalog tables: public read (anon + authenticated); writes service-role only.
alter table public.issue_topics enable row level security;
alter table public.issue_lenses enable row level security;
create policy "issue_topics_read" on public.issue_topics
  for select to anon, authenticated using (true);
create policy "issue_lenses_read" on public.issue_lenses
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.issue_topics from anon, authenticated;
revoke insert, update, delete on public.issue_lenses from anon, authenticated;

-- User selections: select-self only; writes via save_user_issue_selections (SECURITY DEFINER).
alter table public.user_issue_selections enable row level security;
create policy "user_issue_selections_select_self" on public.user_issue_selections
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_issue_selections from anon, authenticated;
