-- Sub-slice 5E: RLS for state_finance_summaries + state_finance_individual_donors.
-- Read = authenticated. Write = service_role only. Mirrors slice 5D state_bills_rls
-- + slice 4 finance_rls patterns.

alter table public.state_finance_summaries enable row level security;
alter table public.state_finance_individual_donors enable row level security;

create policy state_finance_summaries_select_authenticated
  on public.state_finance_summaries for select
  to authenticated using (true);

create policy state_finance_summaries_insert_service_role
  on public.state_finance_summaries for insert
  to service_role with check (true);

create policy state_finance_summaries_update_service_role
  on public.state_finance_summaries for update
  to service_role using (true) with check (true);

create policy state_finance_summaries_delete_service_role
  on public.state_finance_summaries for delete
  to service_role using (true);

create policy state_finance_individual_donors_select_authenticated
  on public.state_finance_individual_donors for select
  to authenticated using (true);

create policy state_finance_individual_donors_insert_service_role
  on public.state_finance_individual_donors for insert
  to service_role with check (true);

create policy state_finance_individual_donors_update_service_role
  on public.state_finance_individual_donors for update
  to service_role using (true) with check (true);

create policy state_finance_individual_donors_delete_service_role
  on public.state_finance_individual_donors for delete
  to service_role using (true);
