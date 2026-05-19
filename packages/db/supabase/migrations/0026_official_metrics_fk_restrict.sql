-- Audit follow-up (PR #6 telemetry slice → full-build audit):
--
-- Migration 0022 introduced 5 FK constraints to public.officials(id) using
-- `on delete cascade`. The repo convention (slice 3 + slice 4 earlier FKs)
-- is `on delete restrict` — a bad delete of an official should fail loudly,
-- not silently wipe audit-trail history (stock disclosures, town halls,
-- leadership records, district offices, scalar metrics).
--
-- This migration flips all 5 to `on delete restrict`. Safe in production:
-- no application code hard-deletes from public.officials; the
-- officials-ingest soft-deletes via `set in_office = false`. Test code
-- already deletes FK children before officials (verified across 8 seed
-- tests during the 2026-05-19 audit).

-- 1. official_metrics.official_id (PK + FK)
alter table public.official_metrics
  drop constraint official_metrics_official_id_fkey,
  add  constraint official_metrics_official_id_fkey
    foreign key (official_id) references public.officials(id) on delete restrict;

-- 2. district_offices.official_id
alter table public.district_offices
  drop constraint district_offices_official_id_fkey,
  add  constraint district_offices_official_id_fkey
    foreign key (official_id) references public.officials(id) on delete restrict;

-- 3. town_halls.official_id
alter table public.town_halls
  drop constraint town_halls_official_id_fkey,
  add  constraint town_halls_official_id_fkey
    foreign key (official_id) references public.officials(id) on delete restrict;

-- 4. stock_transactions.official_id
alter table public.stock_transactions
  drop constraint stock_transactions_official_id_fkey,
  add  constraint stock_transactions_official_id_fkey
    foreign key (official_id) references public.officials(id) on delete restrict;

-- 5. officials_leadership_history.official_id
alter table public.officials_leadership_history
  drop constraint officials_leadership_history_official_id_fkey,
  add  constraint officials_leadership_history_official_id_fkey
    foreign key (official_id) references public.officials(id) on delete restrict;
