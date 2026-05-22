-- Sub-slice 5I: state-legislator stock transactions. Mirrors federal
-- stock_transactions (0022) but uses RESTRICT FK (audit precedent) +
-- 30-day default filing deadline (most strict state STOCK-Act-analogues
-- are 30d vs federal 45d). source/external_id for multi-adapter dedup.

create table public.state_stock_transactions (
  id                uuid primary key default gen_random_uuid(),
  official_id       uuid not null references public.officials(id) on delete restrict,
  transaction_date  date not null,
  filing_date       date not null,
  days_late         int generated always as (greatest(filing_date - transaction_date - 30, 0)) stored,
  asset_ticker      text,
  asset_name        text,
  transaction_type  text check (transaction_type in ('purchase','sale','exchange')),
  amount_range_low  numeric(15,2),
  amount_range_high numeric(15,2),
  state             char(2) not null,
  source_url        text not null,
  source            text not null,
  external_id       text,
  ingested_at       timestamptz not null default now(),
  unique (source, external_id)
);

create index state_stock_transactions_official_date_idx
  on public.state_stock_transactions(official_id, transaction_date desc);
create index state_stock_transactions_state_date_idx
  on public.state_stock_transactions(state, transaction_date desc);

comment on column public.state_stock_transactions.days_late is
  'Generated stored column using 30-day deadline. Federal stock_transactions (0022) uses 45d.';
comment on column public.state_stock_transactions.source is
  'Adapter slug: ca-fppc | ny-jcope | fl-coe | tx-tec | mi-board.';
