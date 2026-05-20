-- Sub-slice 5D: state-level votes + vote positions. Parallel to federal
-- slice-4 0016 (votes + vote_positions).
--
-- FK conventions per slice-5C 0026 audit fix:
--   - state_votes → state_bills: ON DELETE RESTRICT (vote history preserved)
--   - state_vote_positions → state_votes: ON DELETE CASCADE
--   - state_vote_positions → officials: ON DELETE RESTRICT

create table public.state_votes (
  id                  uuid primary key default gen_random_uuid(),
  openstates_vote_id  text unique not null,
  bill_id             uuid not null references public.state_bills(id) on delete restrict,
  state               text not null,
  session             text not null,
  chamber             public.official_chamber not null
    check (chamber in ('state_house','state_senate','state_legislature')),
  vote_date           date not null,
  question            text not null,
  result              text not null,
  source_url          text not null,
  party_vote_split    jsonb,                         -- augment field
  created_at          timestamptz not null default now()
);
create index state_votes_state_session_chamber_date_idx
  on public.state_votes(state, session, chamber, vote_date desc);
create index state_votes_bill_idx
  on public.state_votes(bill_id);

create table public.state_vote_positions (
  id          uuid primary key default gen_random_uuid(),
  vote_id     uuid not null references public.state_votes(id) on delete cascade,
  official_id uuid not null references public.officials(id)   on delete restrict,
  position    text not null
    check (position in ('yes','no','abstain','not_voting','present')),
  unique (vote_id, official_id)
);
create index state_vote_positions_official_idx
  on public.state_vote_positions(official_id);
