-- A read-only view that exposes geometry as GeoJSON (parseable by supabase-js).
-- Inherits RLS from the underlying districts table because it is a security
-- invoker view (default in Postgres 15+). The function ST_AsGeoJSON returns
-- text; we parse it client-side.
create or replace view public.districts_geojson as
  select id, tier, state, code, name, source_version,
         ST_AsGeoJSON(geometry::geometry)::jsonb as geometry
  from public.districts;

grant select on public.districts_geojson to anon, authenticated;
