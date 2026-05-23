-- Slice 8: federal stock_transactions source/external_id parity with state pattern (slice 5I 0046).
-- No federal adapter wired in slice 8 — just schema parity. Existing rows get source='legacy' backfill.

alter table public.stock_transactions
  add column source       text,
  add column external_id  text;

update public.stock_transactions
  set source = 'legacy'
  where source is null;

alter table public.stock_transactions
  alter column source set not null;

alter table public.stock_transactions
  add constraint stock_transactions_source_external_id_unique
  unique (source, external_id);

comment on column public.stock_transactions.source is
  'Adapter slug. Federal stock-transactions adapter not yet wired in slice 8; legacy = pre-slice-8 ingest from stock-watcher-ingest.ts.';
