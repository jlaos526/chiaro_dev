-- Slice 4: campaign finance summaries + top industries + named PAC contributions
-- sourced from OpenSecrets API per officials per cycle.

create table public.finance_summaries (
  id               uuid primary key default gen_random_uuid(),
  official_id      uuid not null references public.officials(id) on delete restrict,
  cycle            text not null,
  total_raised     numeric(15,2),
  total_disbursed  numeric(15,2),
  small_donor_pct  numeric(5,2),
  in_state_pct     numeric(5,2),
  out_of_state_pct numeric(5,2),
  opensecrets_id   text not null,
  source_url       text not null,
  ingested_at      timestamptz not null default now(),
  unique (official_id, cycle)
);

create table public.finance_industry_top (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank               int  not null check (rank between 1 and 25),
  industry           text not null,
  amount             numeric(15,2) not null,
  primary key (finance_summary_id, rank)
);

create table public.finance_pac_contributions (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  pac_name           text not null,
  pac_fec_id         text,
  amount             numeric(15,2) not null,
  primary key (finance_summary_id, pac_name)
);

create index finance_summaries_official_idx on public.finance_summaries(official_id, cycle);
