-- Slice 4: official_metrics scalar rollup + 4 evidence tables + officials external-ID joins.
-- See spec § Schema migrations → 0022_official_metrics.sql

-- Officials extensions for external-ID joins (unitedstates-legislators-ingest populates).
alter table public.officials
  add column opensecrets_id   text,
  add column fec_candidate_id text;

create index officials_opensecrets_idx
  on public.officials(opensecrets_id)   where opensecrets_id   is not null;
create index officials_fec_candidate_idx
  on public.officials(fec_candidate_id) where fec_candidate_id is not null;

-- Scalar rollup table — one row per official, recomputed by seed/recompute-metrics.ts.
create table public.official_metrics (
  official_id                  uuid primary key references public.officials(id) on delete cascade,
  congress                     text not null,

  -- Show-up + workload
  attendance_pct               numeric(5,2),
  votes_voted_count            int,
  votes_missed_count           int,
  total_roll_calls             int,
  bills_sponsored_count        int,
  bills_cosponsored_count      int,
  career_bills_sponsored_count int,
  committee_assignment_count   int,
  committee_leadership_count   int,
  tenure_years                 numeric(4,1),

  -- Alignment supplements (primary stance via scorecards)
  party_unity_pct              numeric(5,2),
  bipartisan_vote_pct          numeric(5,2),

  -- Position + salary
  salary_usd                   numeric(10,2),
  salary_role                  text,

  -- Constituent connection
  lives_in_district            boolean,
  home_district_id             uuid references public.districts(id) on delete set null,
  in_state_donations_pct       numeric(5,2),
  out_of_state_donations_pct   numeric(5,2),
  district_offices_count       int,
  town_halls_count             int,
  stock_act_disclosures_total  int,
  stock_act_disclosures_late   int,
  stock_act_compliance_pct     numeric(5,2),

  computed_at                  timestamptz not null default now()
);

-- Evidence table: district offices (from legislators-district-offices.yaml)
create table public.district_offices (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete cascade,
  address     text not null,
  city        text not null,
  state       text not null,
  zip         text,
  phone       text,
  source_url  text not null
);
create index district_offices_official_idx on public.district_offices(official_id);

-- Evidence table: town halls (from Town Hall Project)
create table public.town_halls (
  id                  uuid primary key default gen_random_uuid(),
  official_id         uuid not null references public.officials(id) on delete cascade,
  event_date          date not null,
  city                text,
  state               text,
  format              text check (format in ('in_person','virtual','phone','hybrid')),
  attendance_estimate int,
  source_url          text not null,
  ingested_at         timestamptz not null default now()
);
create index town_halls_official_date_idx on public.town_halls(official_id, event_date desc);

-- Evidence table: STOCK Act transactions (from house/senate-stock-watcher).
-- days_late is a generated column: max(0, filing_date - transaction_date - 45)
-- (the legal filing deadline under the STOCK Act of 2012).
create table public.stock_transactions (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete cascade,
  transaction_date  date not null,
  filing_date       date not null,
  days_late         int  generated always as (greatest(filing_date - transaction_date - 45, 0)) stored,
  asset_ticker      text,
  asset_name        text,
  transaction_type  text check (transaction_type in ('purchase','sale','exchange')),
  amount_range_low  numeric(15,2),
  amount_range_high numeric(15,2),
  source_url        text not null,
  ingested_at       timestamptz not null default now()
);
create index stock_transactions_official_idx on public.stock_transactions(official_id, transaction_date desc);

-- Evidence table: leadership history (from unitedstates/congress-legislators leadership_roles[])
create table public.officials_leadership_history (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete cascade,
  role        text not null,
  chamber     public.official_chamber not null,
  party       text,
  start_date  date not null,
  end_date    date,
  source_url  text not null
);
create index officials_leadership_history_official_idx
  on public.officials_leadership_history(official_id, start_date desc);
