-- Sub-slice 5I: annual Statement of Economic Interests (SOEI) filings.
-- Captures non-stock income; stock holdings tracked separately in
-- state_stock_transactions.

create table public.state_financial_disclosures (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete restrict,
  filing_year       int not null,
  filing_date       date,
  income_source     text,
  income_kind       text check (income_kind in ('salary','consulting','royalty','rental','dividend','other')),
  amount_range_low  numeric(15,2),
  amount_range_high numeric(15,2),
  state             char(2) not null,
  source_url        text not null,
  source            text not null,
  external_id       text,
  ingested_at       timestamptz not null default now(),
  unique (source, external_id)
);

create index state_financial_disclosures_official_year_idx
  on public.state_financial_disclosures(official_id, filing_year desc);
create index state_financial_disclosures_state_year_idx
  on public.state_financial_disclosures(state, filing_year desc);

comment on column public.state_financial_disclosures.income_kind is
  'salary | consulting | royalty | rental | dividend | other.';
comment on column public.state_financial_disclosures.amount_range_low is
  'SOEI filings publish IRS-style range brackets; schema captures bounds only.';
