-- Slice 26: RLS for federal_holdings + federal_disclosure_other. Public read
-- (`using (true)`) + DML revoked from anon/authenticated. Service-role bypasses
-- RLS by default for ingest writes.
--
-- Federal/state RLS convention differs intentionally. Federal civic-engagement
-- tables (officials, bills, stock_transactions, federal_holdings,
-- federal_disclosure_other) are publicly readable. State-side ethics tables
-- (slice 5I 0050) use `to authenticated` for stricter access. The split
-- reflects federal disclosure being public-record by statute; state-side
-- policy mirrors the calibrated-user gating that already protects state
-- legislative data flows.

alter table public.federal_holdings           enable row level security;
alter table public.federal_disclosure_other   enable row level security;

create policy federal_holdings_select_all
  on public.federal_holdings           for select using (true);
create policy federal_disclosure_other_select_all
  on public.federal_disclosure_other   for select using (true);

revoke insert, update, delete on public.federal_holdings           from anon, authenticated;
revoke insert, update, delete on public.federal_disclosure_other   from anon, authenticated;
