-- Slice 3: per-run audit trail for officials ingest (Decisions #13).
-- Service-role-only — no client read/write access.
-- See spec § Schema migrations → 0013_officials_ingest_runs.sql

create table public.officials_ingest_runs (
  id                 uuid        primary key default gen_random_uuid(),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  congress           text        not null,
  source             text        not null,
  fetched_count      int,
  ingested_count     int,
  deactivated_count  int,
  status             text        not null
                       check (status in ('in_progress','completed','failed','aborted')),
  error              text,
  flags              text[],
  notes              text
);

create index officials_ingest_runs_started_idx
  on public.officials_ingest_runs(started_at desc);

alter table public.officials_ingest_runs enable row level security;
-- No policies → only service_role bypasses RLS.
-- Defense in depth: revoke default grants since this table has no policies
-- and we don't want stray access leaking via the default Supabase grants.
revoke insert, update, delete, select on public.officials_ingest_runs from anon, authenticated;
