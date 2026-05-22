-- Sub-slice 5I: per-state ethics commission complaints. 5-value status
-- enum captures intake → final disposition lifecycle.

create table public.state_ethics_complaints (
  id              uuid primary key default gen_random_uuid(),
  official_id     uuid not null references public.officials(id) on delete restrict,
  complaint_date  date not null,
  status          text not null check (status in ('open','dismissed','settled','sanctioned','closed_no_action')),
  disposition     text,
  summary         text not null,
  state           char(2) not null,
  source_url      text not null,
  source          text not null,
  external_id     text,
  ingested_at     timestamptz not null default now(),
  unique (source, external_id)
);

create index state_ethics_complaints_official_date_idx
  on public.state_ethics_complaints(official_id, complaint_date desc);
create index state_ethics_complaints_status_idx
  on public.state_ethics_complaints(status) where status = 'open';

comment on column public.state_ethics_complaints.summary is
  'Free-form per source. UI renders verbatim with whitespace: pre-wrap.';
