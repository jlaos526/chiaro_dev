begin;

select plan(5);

-- Slice 67 (audit C16/C9): districts_geojson now simplifies geometry inline
-- (ST_SimplifyPreserveTopology + 5-digit coords). Assert the view still exposes
-- the same shape (jsonb GeoJSON, same GeoJSON type) — NOT exact coordinates,
-- which change with simplification.

-- 1. View exists
select has_view('public', 'districts_geojson', 'view exists');

-- 2. View still exposes a jsonb geometry column
select has_column('public', 'districts_geojson', 'geometry', 'geometry column present');
select col_type_is('public', 'districts_geojson', 'geometry', 'jsonb', 'geometry is jsonb');

-- 3. Seed a district with a multipolygon and confirm the view still emits valid
--    GeoJSON of the expected type (simplify preserves the MultiPolygon type).
do $$
begin
  insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('county', 'CA', 'CA-GEOJSON-TEST', 'GeoJSON test county',
          st_geogfromtext('SRID=4326;MULTIPOLYGON(((-120.123456 35.123456,-119.987654 35.111111,-119.5 36.5,-120.123456 35.123456)))'),
          'FX-geojson-test');
end $$;

-- ST_SimplifyPreserveTopology may normalize a single-element MultiPolygon to a
-- Polygon, so accept either polygon-family GeoJSON type.
select ok(
  (select geometry ->> 'type' from public.districts_geojson where code = 'CA-GEOJSON-TEST')
    in ('Polygon', 'MultiPolygon'),
  'simplified geometry is still a polygon-family GeoJSON object'
);

-- 4. The emitted coordinates are valid GeoJSON (parseable back into geometry).
select isnt(
  (select ST_GeomFromGeoJSON((geometry)::text) from public.districts_geojson where code = 'CA-GEOJSON-TEST'),
  null,
  'simplified geometry round-trips through ST_GeomFromGeoJSON'
);

select * from finish();
rollback;
