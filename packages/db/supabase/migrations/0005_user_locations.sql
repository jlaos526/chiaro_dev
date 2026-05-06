create table public.user_locations (
  id                  uuid          primary key references auth.users(id) on delete cascade,
  home_address_text   text          not null,
  home_location       geography(Point, 4326) not null,
  geocodio_response   jsonb         not null,
  calibrated_at       timestamptz   not null default now()
);

alter table public.user_locations enable row level security;

create policy "user_locations_select_self"
  on public.user_locations
  for select
  to authenticated
  using (id = (select auth.uid()));

revoke insert, update, delete on public.user_locations from anon, authenticated;
