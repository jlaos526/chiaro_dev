-- RLS for state_bills + state_bill_sponsors + state_bill_subjects.
-- Read = authenticated (state bills are public data); write = service_role only.
-- Mirrors federal slice-4 0015 pattern.

alter table public.state_bills            enable row level security;
alter table public.state_bill_sponsors    enable row level security;
alter table public.state_bill_subjects    enable row level security;

create policy state_bills_select on public.state_bills
  for select to authenticated using (true);
create policy state_bill_sponsors_select on public.state_bill_sponsors
  for select to authenticated using (true);
create policy state_bill_subjects_select on public.state_bill_subjects
  for select to authenticated using (true);

-- Explicitly REVOKE write paths from anon and authenticated.
revoke insert, update, delete on public.state_bills            from anon, authenticated;
revoke insert, update, delete on public.state_bill_sponsors    from anon, authenticated;
revoke insert, update, delete on public.state_bill_subjects    from anon, authenticated;
