-- Drop state_stock_transactions table.
--
-- Slice 12 audit (docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md)
-- confirmed all 5 per-state stub adapters are bucket G — state legislatures
-- in CA/FL/MI/NY/TX don't have a STOCK Act analogue. Stock holdings/sales
-- are line items inside annual financial disclosures (Form 700 / Form 6 /
-- FDS / PFD / PFS), not a discrete data product.
--
-- Gotcha #21 documents the over-specification + this decision to drop the
-- table rather than maintain a forever-empty schema.
--
-- This migration is destructive but safe: state_stock_transactions has
-- zero rows in any environment (no production parser ever shipped). The
-- federal stock_transactions table is unaffected.

drop index if exists public.state_stock_transactions_official_date_idx;
drop index if exists public.state_stock_transactions_state_date_idx;
drop table if exists public.state_stock_transactions;
