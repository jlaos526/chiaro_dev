-- Sub-slice 5E: state campaign finance for state legislators.
-- Two parallel tables to federal finance_summaries / finance_individual_donors,
-- with state-specific quirks: cycle is text (per-state format varies),
-- source records which adapter populated the row.

create table public.state_finance_summaries (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete restrict,
  cycle             text not null,
  total_raised      numeric(15,2),
  total_disbursed   numeric(15,2),
  small_donor_pct   numeric(5,2),
  in_state_pct      numeric(5,2),
  source            text not null,
  source_url        text not null,
  ingested_at       timestamptz not null default now(),
  unique (official_id, cycle)
);

create table public.state_finance_individual_donors (
  state_finance_summary_id uuid not null
    references public.state_finance_summaries(id) on delete cascade,
  rank                     smallint not null check (rank between 1 and 10),
  donor_name               text not null,
  amount                   numeric(15,2) not null,
  employer                 text,
  occupation               text,
  city                     text,
  donor_state              text,
  primary key (state_finance_summary_id, rank)
);

create index state_finance_summaries_official_idx
  on public.state_finance_summaries(official_id, cycle);
create index state_finance_individual_donors_summary_idx
  on public.state_finance_individual_donors(state_finance_summary_id);

comment on column public.state_finance_summaries.cycle is
  'Per-state cycle text — CA "2023-2024" (biennial), NY "2024" (annual), TX "2024", MI "2023-2024". Do not normalize.';
comment on column public.state_finance_summaries.source is
  'Adapter slug: ca-cal-access | ny-nysboe | fl-doe | tx-ethics | mi-boe.';
comment on column public.state_finance_individual_donors.donor_state is
  'Donor reported residency state (2-letter). NOT the parent legislator state. Used to derive in_state_pct.';
