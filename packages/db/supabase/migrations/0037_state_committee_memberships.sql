-- Sub-slice 5F: state committee memberships for state legislators.
-- Sourced from OpenStates v3 /committees endpoint; populated by
-- openstates-committees-ingest.ts. Used by recompute-state-metrics.ts
-- to compute real committee_chair_count (replaces slice-5D stub = 0).

create table public.state_committee_memberships (
  id                       uuid primary key default gen_random_uuid(),
  official_id              uuid not null references public.officials(id) on delete restrict,
  openstates_committee_id  text not null,
  committee_name           text not null,
  state                    char(2) not null,
  chamber                  public.official_chamber not null,
  session                  text,
  role                     text not null check (role in ('chair', 'vice_chair', 'member')),
  source_url               text not null,
  ingested_at              timestamptz not null default now(),
  unique (official_id, openstates_committee_id, session, role)
);

create index state_committee_memberships_official_idx
  on public.state_committee_memberships(official_id);
create index state_committee_memberships_committee_idx
  on public.state_committee_memberships(openstates_committee_id);

comment on column public.state_committee_memberships.session is
  'OpenStates session string when reported, else NULL (treat as "currently held").';
comment on column public.state_committee_memberships.role is
  'chair / vice_chair / member. Other roles (ranking minority, ex-officio) fold into member for v1.';
