-- Sub-slice 5H: state-legislator district offices. Net-new (no federal
-- analogue). 5 per-state adapters scrape state-leg profile pages.

create table public.state_district_offices (
  id            uuid primary key default gen_random_uuid(),
  official_id   uuid not null references public.officials(id) on delete restrict,
  kind          text not null check (kind in ('district','satellite','capitol')),
  street_1      text not null,
  street_2      text,
  city          text not null,
  state         char(2) not null,
  postal_code   text,
  phone         text,
  email         text,
  hours_text    text,
  source_url    text not null,
  ingested_at   timestamptz not null default now()
);

create index state_district_offices_official_idx
  on public.state_district_offices(official_id);

comment on column public.state_district_offices.kind is
  'district | satellite | capitol. State-specific types (regional, constituent service) map to satellite.';
comment on column public.state_district_offices.hours_text is
  'Free-form per state convention. No structured-hours normalization in v1.';
