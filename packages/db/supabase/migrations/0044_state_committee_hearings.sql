-- Sub-slice 5H: state committee hearings + attendance M:N.
-- Composes with slice 5F state_committee_memberships. OpenStates v3
-- /committees endpoint with ?include=meetings is the primary source.

create table public.state_committee_hearings (
  id                       uuid primary key default gen_random_uuid(),
  openstates_committee_id  text,
  state                    char(2) not null,
  session                  text not null,
  hearing_date             date not null,
  location                 text,
  agenda_topic             text,
  source_url               text not null,
  ingested_at              timestamptz not null default now()
);

create index state_committee_hearings_committee_idx
  on public.state_committee_hearings(openstates_committee_id, hearing_date desc);
create index state_committee_hearings_state_session_idx
  on public.state_committee_hearings(state, session, hearing_date desc);

create table public.state_committee_hearing_attendance (
  hearing_id   uuid not null references public.state_committee_hearings(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  primary key (hearing_id, official_id)
);

create index state_committee_hearing_attendance_official_idx
  on public.state_committee_hearing_attendance(official_id);

comment on column public.state_committee_hearings.openstates_committee_id is
  'Nullable for per-state scrape sources that lack OpenStates ocd-org/... ids.';
comment on column public.state_committee_hearings.session is
  'Per-state session text matching state_bills.session format. Per slice 5D precedent.';
