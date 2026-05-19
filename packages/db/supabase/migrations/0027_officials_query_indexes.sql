-- Audit follow-up (2026-05-19 full-build sweep): two missing indexes.

-- 1. FK index on official_metrics.home_district_id (added in migration 0022).
--    Without this, a delete or update to a district row triggers a seq-scan
--    of official_metrics to enforce the `on delete set null` FK. App-side
--    joins from official_metrics.home_district_id → districts also fall back
--    to a seq-scan. Partial index — home_district_id is nullable and most
--    rows are null until salary-residency ingest populates them.
create index if not exists official_metrics_home_district_idx
  on public.official_metrics(home_district_id)
  where home_district_id is not null;

-- 2. Partial index matching fetchMyOfficials access pattern in
--    packages/officials/src/queries.ts:21-27:
--      .from('officials').select(...).eq('in_office', true).in('district_id', [...])
--    The existing officials_district_idx (0009) is a full index on
--    district_id. The planner currently picks it, then filters by
--    in_office post-lookup. A partial index that only contains in_office
--    rows is the matching access path and is meaningfully smaller (most
--    rows in officials are in_office today, but soft-deletion across
--    congresses grows the inactive set monotonically).
create index if not exists officials_district_in_office_idx
  on public.officials(district_id)
  where in_office;
