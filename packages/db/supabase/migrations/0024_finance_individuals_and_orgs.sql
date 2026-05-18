-- Slice 5: top individual donors + top organizations per official per cycle.
-- Both tables cascade off finance_summaries; row count capped at top-10 per
-- (summary, rank) by the ingest pipeline (UI shows max 10 via Show-5-more toggle).

create table public.finance_individual_donors (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank               smallint not null check (rank between 1 and 10),
  donor_name         text not null,
  amount             numeric(15,2) not null,
  employer           text,
  occupation         text,
  primary key (finance_summary_id, rank)
);

create table public.finance_top_organizations (
  finance_summary_id uuid not null references public.finance_summaries(id) on delete cascade,
  rank               smallint not null check (rank between 1 and 10),
  org_name           text not null,
  amount             numeric(15,2) not null,
  primary key (finance_summary_id, rank)
);

create index finance_individual_donors_summary_idx on public.finance_individual_donors(finance_summary_id);
create index finance_top_organizations_summary_idx on public.finance_top_organizations(finance_summary_id);
