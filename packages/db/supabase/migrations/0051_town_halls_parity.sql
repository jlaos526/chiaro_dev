-- Slice 8: federal town_halls source/external_id parity with state pattern (slice 5H 0042).
-- Existing rows get source='legacy' backfill; external_id stays NULL (NULLs distinct per PG default).

alter table public.town_halls
  add column source       text,
  add column external_id  text;

update public.town_halls
  set source = 'legacy'
  where source is null;

alter table public.town_halls
  alter column source set not null;

alter table public.town_halls
  add constraint town_halls_source_external_id_unique
  unique (source, external_id);

comment on column public.town_halls.source is
  'Adapter slug. mobilize = production parser (slice 8); legacy = pre-slice-8 ingest from town-halls-ingest.ts.';
comment on column public.town_halls.external_id is
  'Per-source stable id for UPSERT dedup. NULL allowed (NULLs distinct per Postgres default). Legacy rows have NULL.';
