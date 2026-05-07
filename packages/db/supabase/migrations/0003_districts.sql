create extension if not exists postgis;

create type public.district_tier as enum (
  'federal_house',
  'federal_senate',
  'state_senate',
  'state_house',
  'county',
  'place'
);

create table public.districts (
  id              uuid                          primary key default gen_random_uuid(),
  tier            public.district_tier          not null,
  state           text                          not null check (state ~ '^[A-Z]{2}$'),
  code            text                          not null,
  name            text                          not null,
  geometry        geography(MultiPolygon, 4326) not null,
  source_version  text                          not null,
  unique (tier, code)
);

create index districts_geometry_gix on public.districts using gist (geometry);
create index districts_tier_state on public.districts (tier, state);
