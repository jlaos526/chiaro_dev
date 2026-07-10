-- Slice 67 (audit C16/C9): the home district map shipped full-resolution TIGER
-- geometry (~9-digit coords, 10k-100k+ vertices/polygon) to web + mobile on
-- every cold cache. Simplify to display tolerance in the view: topology-
-- preserving simplification (~0.001 deg) + 5-digit coords (~1m) cut the payload
-- ~10-50x. Point-in-polygon happens server-side in the calibrate Edge Function
-- against the raw `geometry` column, which is UNCHANGED — only this display view
-- simplifies. Deferred (revisit at scale): precompute a simplified column at
-- TIGER ingest so the simplify cost isn't paid per request.
create or replace view public.districts_geojson as
  select id, tier, state, code, name, source_version,
         ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry::geometry, 0.001), 5)::jsonb as geometry
  from public.districts;

grant select on public.districts_geojson to anon, authenticated;
