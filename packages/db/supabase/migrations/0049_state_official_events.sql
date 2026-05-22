-- Sub-slice 5I: events relating to a legislator's tenure or conduct.
-- 7-value event_type enum covers recall/resign/censure/expulsion +
-- campaign-finance violations. Fixed enum in v1; future slices may extend.

create table public.state_official_events (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete restrict,
  event_date  date not null,
  event_type  text not null check (event_type in (
    'recall_attempt','recall_succeeded','recall_failed',
    'resignation','censure','expulsion',
    'campaign_finance_violation'
  )),
  outcome     text,
  summary     text not null,
  state       char(2) not null,
  source_url  text not null,
  source      text not null,
  external_id text,
  ingested_at timestamptz not null default now(),
  unique (source, external_id)
);

create index state_official_events_official_date_idx
  on public.state_official_events(official_id, event_date desc);
create index state_official_events_type_date_idx
  on public.state_official_events(event_type, event_date desc);

comment on column public.state_official_events.event_type is
  '7 fixed values. resignation comes from OpenStates roles[].end_reason. campaign_finance_violation captures FPPC/JCOPE/etc fines.';
