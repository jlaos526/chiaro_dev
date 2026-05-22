-- Sub-slice 5I: RLS for the 4 new state_ethics tables.
-- Read = authenticated. Write = service_role only.

alter table public.state_stock_transactions    enable row level security;
alter table public.state_financial_disclosures enable row level security;
alter table public.state_ethics_complaints     enable row level security;
alter table public.state_official_events       enable row level security;

-- state_stock_transactions
create policy state_stock_transactions_select_auth
  on public.state_stock_transactions for select to authenticated using (true);
create policy state_stock_transactions_insert_svc
  on public.state_stock_transactions for insert to service_role with check (true);
create policy state_stock_transactions_update_svc
  on public.state_stock_transactions for update to service_role using (true) with check (true);
create policy state_stock_transactions_delete_svc
  on public.state_stock_transactions for delete to service_role using (true);

-- state_financial_disclosures
create policy state_financial_disclosures_select_auth
  on public.state_financial_disclosures for select to authenticated using (true);
create policy state_financial_disclosures_insert_svc
  on public.state_financial_disclosures for insert to service_role with check (true);
create policy state_financial_disclosures_update_svc
  on public.state_financial_disclosures for update to service_role using (true) with check (true);
create policy state_financial_disclosures_delete_svc
  on public.state_financial_disclosures for delete to service_role using (true);

-- state_ethics_complaints
create policy state_ethics_complaints_select_auth
  on public.state_ethics_complaints for select to authenticated using (true);
create policy state_ethics_complaints_insert_svc
  on public.state_ethics_complaints for insert to service_role with check (true);
create policy state_ethics_complaints_update_svc
  on public.state_ethics_complaints for update to service_role using (true) with check (true);
create policy state_ethics_complaints_delete_svc
  on public.state_ethics_complaints for delete to service_role using (true);

-- state_official_events
create policy state_official_events_select_auth
  on public.state_official_events for select to authenticated using (true);
create policy state_official_events_insert_svc
  on public.state_official_events for insert to service_role with check (true);
create policy state_official_events_update_svc
  on public.state_official_events for update to service_role using (true) with check (true);
create policy state_official_events_delete_svc
  on public.state_official_events for delete to service_role using (true);
