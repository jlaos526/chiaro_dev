-- Sub-slice 5G: state-legislator scorecards. Parallel to slice-4
-- federal scorecard_orgs / scorecard_ratings (preserves federal flow
-- unchanged). Sourced from per-org adapters via openstates_person_id.

create table public.state_scorecard_orgs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  state           char(2) not null,
  name            text not null,
  issue_area      text not null,
  lean            text not null check (lean in ('progressive', 'conservative', 'libertarian', 'single-issue', 'centrist')),
  methodology_url text not null,
  scoring_min     int not null default 0,
  scoring_max     int not null default 100,
  notes           text,
  unique (slug, state)
);

create table public.state_scorecard_ratings (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.state_scorecard_orgs(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  session      text not null,
  score        numeric(5,2) not null,
  source_url   text not null,
  ingested_at  timestamptz not null default now(),
  unique (scorecard_id, official_id, session)
);

create index state_scorecard_orgs_state_idx
  on public.state_scorecard_orgs(state);
create index state_scorecard_ratings_official_idx
  on public.state_scorecard_ratings(official_id, session);
create index state_scorecard_ratings_scorecard_idx
  on public.state_scorecard_ratings(scorecard_id);

comment on column public.state_scorecard_orgs.slug is
  'Org-level slug (aclu, lcv, nra, planned-parenthood, afp). Per-state chapters distinguished via state column.';
comment on column public.state_scorecard_ratings.session is
  'Per-state session text matching state_bills.session format. Per slice 5D precedent.';
