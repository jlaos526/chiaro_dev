-- Slice 4: bills tables are public-read; only service_role writes.
-- Defense in depth: revoke table-level write grants from public roles
-- (matches the convention from 0010_officials_rls.sql).

alter table public.bills          enable row level security;
alter table public.bill_subjects  enable row level security;
alter table public.bill_sponsors  enable row level security;

create policy bills_select_all          on public.bills          for select using (true);
create policy bill_subjects_select_all  on public.bill_subjects  for select using (true);
create policy bill_sponsors_select_all  on public.bill_sponsors  for select using (true);

revoke insert, update, delete on public.bills          from anon, authenticated;
revoke insert, update, delete on public.bill_subjects  from anon, authenticated;
revoke insert, update, delete on public.bill_sponsors  from anon, authenticated;
