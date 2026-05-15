-- Slice 3: officials are public-read; only service_role writes (via seed ingest).
-- See spec § Schema migrations → 0010_officials_rls.sql

alter table public.officials enable row level security;

create policy officials_select_all
  on public.officials
  for select
  using (true);
-- No insert/update/delete policies → only service_role bypasses RLS to write.
