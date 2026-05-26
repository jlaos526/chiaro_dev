-- Slice 26: federal annual financial disclosure tables. Annual FDs don't fit
-- the transaction-oriented stock_transactions schema. State side uses a single
-- state_financial_disclosures table with a category discriminator (slice 5I
-- 0047); federal side splits into holdings + other for clearer query semantics.
-- PTRs (Periodic Transaction Reports) continue to write to existing
-- public.stock_transactions; annual FD content lands here.

create table public.federal_holdings (
  id              uuid primary key default gen_random_uuid(),
  official_id     uuid not null references public.officials(id) on delete restrict,
  filing_year     int  not null,
  source          text not null,
  external_id     text,
  source_url      text not null,
  asset_name      text,
  asset_ticker    text,
  asset_type      text check (asset_type in
    ('stock','bond','mutual_fund','etf','trust','partnership','real_estate','cash','other')),
  value_min       numeric(15,2),
  value_max       numeric(15,2),
  income_type     text check (income_type in
    ('dividends','interest','capital_gains','rent','royalties','none','other')),
  income_min      numeric(15,2),
  income_max      numeric(15,2),
  ingested_at     timestamptz not null default now()
);

create unique index federal_holdings_source_external_id_uniq
  on public.federal_holdings(source, external_id)
  where external_id is not null;

create index federal_holdings_official_idx
  on public.federal_holdings(official_id, filing_year desc);

create table public.federal_disclosure_other (
  id              uuid primary key default gen_random_uuid(),
  official_id     uuid not null references public.officials(id) on delete restrict,
  filing_year     int  not null,
  source          text not null,
  external_id     text,
  source_url      text not null,
  category        text not null check (category in
    ('gift','travel','position','agreement','liability','compensation','honoraria')),
  description     text,
  source_party    text,
  value_min       numeric(15,2),
  value_max       numeric(15,2),
  value_text      text,
  ingested_at     timestamptz not null default now()
);

create unique index federal_disclosure_other_source_external_id_uniq
  on public.federal_disclosure_other(source, external_id)
  where external_id is not null;

create index federal_disclosure_other_official_idx
  on public.federal_disclosure_other(official_id, filing_year desc);

comment on table public.federal_holdings is
  'Federal annual FD holdings (assets owned + income). PTRs in stock_transactions; annual FD holdings here. Slice 26.';
comment on table public.federal_disclosure_other is
  'Federal annual FD non-stock content (gifts, travel, positions, agreements, liabilities, compensation, honoraria). Slice 26.';
