-- Slice 4: votes + vote_positions. References bills (slice-4) and officials (slice-3).

create type public.vote_position as enum ('yes','no','present','not_voting');

create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  congress    text not null,
  chamber     public.official_chamber not null,
  session     int  not null,
  roll_call   int  not null,
  vote_date   date not null,
  question    text not null,
  result      text not null,
  bill_id     uuid references public.bills(id) on delete set null,
  source_url  text not null,
  ingested_at timestamptz not null default now(),
  unique (congress, chamber, session, roll_call)
);

create table public.vote_positions (
  vote_id     uuid not null references public.votes(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete restrict,
  position    public.vote_position not null,
  primary key (vote_id, official_id)
);

create index votes_bill_idx              on public.votes(bill_id) where bill_id is not null;
create index vote_positions_official_idx on public.vote_positions(official_id);
