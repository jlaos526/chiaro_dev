-- Slice 4: advocacy organization scorecards rating each official per Congress.

create table public.scorecard_orgs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  issue_area      text not null,
  lean            text check (lean in ('progressive','conservative','libertarian','single-issue','centrist')),
  methodology_url text not null,
  scoring_min     int  not null default 0,
  scoring_max     int  not null default 100,
  notes           text
);

create table public.scorecard_ratings (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.scorecard_orgs(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  congress     text not null,
  score        numeric(5,2) not null,
  source_url   text not null,
  ingested_at  timestamptz not null default now(),
  unique (scorecard_id, official_id, congress)
);

create index scorecard_ratings_official_idx on public.scorecard_ratings(official_id, congress);
