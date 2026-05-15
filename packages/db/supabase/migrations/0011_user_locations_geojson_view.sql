-- Slice 3: user_locations_geojson view mirrors districts_geojson (migration 0007).
-- security_invoker = true → view inherits caller's RLS on user_locations (self-only).
-- See spec § Schema migrations → 0011_user_locations_geojson_view.sql
create or replace view public.user_locations_geojson
  with (security_invoker = true) as
select
  id,
  home_address_text,
  st_asgeojson(home_location::geometry)::jsonb as home_location_geojson,
  calibrated_at
from public.user_locations;

grant select on public.user_locations_geojson to authenticated;
