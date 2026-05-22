-- Sub-slice 5H: RLS for state_town_halls + state_district_offices +
-- state_committee_hearings + state_committee_hearing_attendance.
-- Read = authenticated. Write = service_role only.

alter table public.state_town_halls                        enable row level security;
alter table public.state_district_offices                  enable row level security;
alter table public.state_committee_hearings                enable row level security;
alter table public.state_committee_hearing_attendance      enable row level security;

-- state_town_halls
create policy state_town_halls_select_auth
  on public.state_town_halls for select to authenticated using (true);
create policy state_town_halls_insert_svc
  on public.state_town_halls for insert to service_role with check (true);
create policy state_town_halls_update_svc
  on public.state_town_halls for update to service_role using (true) with check (true);
create policy state_town_halls_delete_svc
  on public.state_town_halls for delete to service_role using (true);

-- state_district_offices
create policy state_district_offices_select_auth
  on public.state_district_offices for select to authenticated using (true);
create policy state_district_offices_insert_svc
  on public.state_district_offices for insert to service_role with check (true);
create policy state_district_offices_update_svc
  on public.state_district_offices for update to service_role using (true) with check (true);
create policy state_district_offices_delete_svc
  on public.state_district_offices for delete to service_role using (true);

-- state_committee_hearings
create policy state_committee_hearings_select_auth
  on public.state_committee_hearings for select to authenticated using (true);
create policy state_committee_hearings_insert_svc
  on public.state_committee_hearings for insert to service_role with check (true);
create policy state_committee_hearings_update_svc
  on public.state_committee_hearings for update to service_role using (true) with check (true);
create policy state_committee_hearings_delete_svc
  on public.state_committee_hearings for delete to service_role using (true);

-- state_committee_hearing_attendance
create policy state_committee_hearing_attendance_select_auth
  on public.state_committee_hearing_attendance for select to authenticated using (true);
create policy state_committee_hearing_attendance_insert_svc
  on public.state_committee_hearing_attendance for insert to service_role with check (true);
create policy state_committee_hearing_attendance_update_svc
  on public.state_committee_hearing_attendance for update to service_role using (true) with check (true);
create policy state_committee_hearing_attendance_delete_svc
  on public.state_committee_hearing_attendance for delete to service_role using (true);
