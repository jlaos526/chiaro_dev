-- Slice 3: officials are public-read; only service_role writes (via seed ingest).
-- See spec § Schema migrations → 0010_officials_rls.sql

alter table public.officials enable row level security;

create policy officials_select_all
  on public.officials
  for select
  using (true);
-- No insert/update/delete policies → only service_role bypasses RLS to write.

-- Defense in depth: revoke table-level write grants from public roles.
-- Matches the convention from 0002/0004/0006_*_rls.sql.
revoke insert, update, delete on public.officials from anon, authenticated;
