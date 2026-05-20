-- Sub-slice 5D: extend official_metrics with 3 state-specific scalar columns.
-- All nullable + additive. Federal rows have NULL for these columns;
-- state recompute pipeline (task 21) populates them for state officials.

alter table public.official_metrics
  add column if not exists committee_chair_count int,
  add column if not exists fiscal_impact_total   numeric(15, 2),
  add column if not exists party_unity_state     numeric(5, 2);
