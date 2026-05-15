-- Slice 3: federal officials table + storage bucket provisioning.
-- See docs/superpowers/specs/2026-05-15-slice-3-officials-design.md
-- § Schema migrations → 0009_officials.sql

create type public.official_chamber as enum ('house','senate');

create table public.officials (
  id              uuid        primary key default gen_random_uuid(),
  bioguide_id     text        not null unique,
  first_name      text        not null,
  last_name       text        not null,
  full_name       text        not null,
  chamber         public.official_chamber not null,
  party           text        not null check (party in ('D','R','I','L','G','ID')),  -- 'I'=Independent (Sanders/King); 'ID'=Independent-Democrat caucus alias; 'L'=Libertarian; 'G'=Green
  state           text        not null check (state ~ '^[A-Z]{2}$'),
  district_id     uuid        not null references public.districts(id) on delete restrict,
  senate_class    smallint    check (senate_class is null or senate_class in (1,2,3)),
  portrait_url    text,
  official_url    text,
  twitter_handle  text,
  next_election   date,
  in_office       boolean     not null default true,
  source_version  text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.officials add constraint senate_class_matches_chamber
  check ((chamber = 'senate' and senate_class is not null)
      or (chamber = 'house'  and senate_class is null));

create index officials_district_idx       on public.officials(district_id);
create index officials_state_chamber_idx  on public.officials(state, chamber) where in_office;

create trigger officials_touch_updated_at
  before update on public.officials
  for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('officials-portraits', 'officials-portraits', true, 1048576,
          '{image/jpeg,image/png,image/webp}')
  on conflict (id) do nothing;
