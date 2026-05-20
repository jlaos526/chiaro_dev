-- Sub-slice 5D: state-level bills + sponsors + subjects. Parallel to federal
-- slice-4 0014 (bills + bill_sponsors + bill_subjects).
--
-- FK conventions per slice-5C 0026 audit fix:
--   - bill child tables (sponsors, subjects) → bills: ON DELETE CASCADE
--   - sponsors → officials: ON DELETE RESTRICT (preserves audit trail)

create table public.state_bills (
  id                       uuid primary key default gen_random_uuid(),
  openstates_bill_id       text unique not null,    -- ocd-bill/<uuid>
  state                    text not null,
  session                  text not null,            -- '20252026' for CA, '2025' for NY, etc
  bill_type                text not null,            -- 'AB', 'SB', 'HB' — varies per state
  number                   int  not null,
  title                    text not null,
  status                   text,                      -- OpenStates normalized status
  introduced_date          date,
  latest_action            text,
  latest_action_date       date,
  source_url               text not null,
  openstates_url           text not null,
  -- Augment fields (nullable, populated by per-state enrichment in Task 13-19):
  status_substage          text,
  hearing_date             date,
  fiscal_impact_amount     numeric(15, 2),
  party_vote_split         jsonb,
  augmented_from           text,                      -- 'ca-leginfo' | 'ny-senate-api' | ...
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (state, session, bill_type, number)
);
create index state_bills_state_session_idx
  on public.state_bills(state, session);
create index state_bills_openstates_id_idx
  on public.state_bills(openstates_bill_id);

create table public.state_bill_sponsors (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.state_bills(id) on delete cascade,
  official_id uuid not null references public.officials(id)   on delete restrict,
  role        text not null check (role in ('sponsor', 'cosponsor')),
  added_date  date,
  unique (bill_id, official_id, role)
);
create index state_bill_sponsors_official_idx
  on public.state_bill_sponsors(official_id);

create table public.state_bill_subjects (
  bill_id  uuid not null references public.state_bills(id) on delete cascade,
  subject  text not null,
  primary key (bill_id, subject)
);
