-- Sub-slice 5F: RLS for state_committee_memberships.
-- Read = authenticated. Write = service_role only.
-- Mirrors slice 5D/5E state-tables RLS pattern.

alter table public.state_committee_memberships enable row level security;

create policy state_committee_memberships_select_authenticated
  on public.state_committee_memberships for select
  to authenticated using (true);

create policy state_committee_memberships_insert_service_role
  on public.state_committee_memberships for insert
  to service_role with check (true);

create policy state_committee_memberships_update_service_role
  on public.state_committee_memberships for update
  to service_role using (true) with check (true);

create policy state_committee_memberships_delete_service_role
  on public.state_committee_memberships for delete
  to service_role using (true);
