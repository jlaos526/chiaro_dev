-- Sub-slice 5G: RLS for state_scorecard_orgs + state_scorecard_ratings.
-- Read = authenticated. Write = service_role only.

alter table public.state_scorecard_orgs    enable row level security;
alter table public.state_scorecard_ratings enable row level security;

create policy state_scorecard_orgs_select_authenticated
  on public.state_scorecard_orgs for select to authenticated using (true);
create policy state_scorecard_orgs_insert_service_role
  on public.state_scorecard_orgs for insert to service_role with check (true);
create policy state_scorecard_orgs_update_service_role
  on public.state_scorecard_orgs for update to service_role using (true) with check (true);
create policy state_scorecard_orgs_delete_service_role
  on public.state_scorecard_orgs for delete to service_role using (true);

create policy state_scorecard_ratings_select_authenticated
  on public.state_scorecard_ratings for select to authenticated using (true);
create policy state_scorecard_ratings_insert_service_role
  on public.state_scorecard_ratings for insert to service_role with check (true);
create policy state_scorecard_ratings_update_service_role
  on public.state_scorecard_ratings for update to service_role using (true) with check (true);
create policy state_scorecard_ratings_delete_service_role
  on public.state_scorecard_ratings for delete to service_role using (true);
