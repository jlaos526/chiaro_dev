-- Sub-slice 5H: state-legislator town halls + public meetings.
-- Parallels federal town_halls (migration 0022) but uses RESTRICT FK
-- per audit-closure precedent + adds source/external_id for multi-
-- adapter dedup (TownHallProject nationwide overlay + per-state augment).

create table public.state_town_halls (
  id                  uuid primary key default gen_random_uuid(),
  official_id         uuid not null references public.officials(id) on delete restrict,
  event_date          date not null,
  city                text,
  state               char(2) not null,
  format              text check (format in ('in_person','virtual','phone','hybrid')),
  attendance_estimate int,
  source_url          text not null,
  source              text not null,
  external_id         text,
  ingested_at         timestamptz not null default now(),
  unique (source, external_id)
);

create index state_town_halls_official_date_idx
  on public.state_town_halls(official_id, event_date desc);
create index state_town_halls_state_date_idx
  on public.state_town_halls(state, event_date desc);

comment on column public.state_town_halls.source is
  'Which adapter populated this row: townhallproject | ca-leginfo | ny-senate | fl-doe | tx-capitol | mi-legislature.';
comment on column public.state_town_halls.external_id is
  'Per-source stable id used for UPSERT dedup. NULL allowed (NULLs distinct per Postgres default).';
