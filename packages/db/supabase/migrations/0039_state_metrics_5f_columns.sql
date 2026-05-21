-- Sub-slice 5F: add 5 new performance-KPI columns to official_metrics.
-- All nullable — per-state data availability varies.
-- Populated by recompute-state-metrics.ts (extended in slice 5F).

alter table public.official_metrics
  add column bills_passed_count               int,
  add column hearings_held_count              int,
  add column subject_breadth                  int,
  add column bill_passage_rate                numeric(5,2),
  add column fiscal_impact_per_dollar_raised  numeric(10,4);

comment on column public.official_metrics.bills_passed_count is
  'Bills the official primary-sponsored that reached enactment. Heuristic substring match on state_bills.status.';
comment on column public.official_metrics.hearings_held_count is
  'Bills the official primary-sponsored that have state_bills.hearing_date populated. Per-state augment coverage varies.';
comment on column public.official_metrics.subject_breadth is
  'Distinct state_bill_subjects.subject across own primary-sponsored bills for the session.';
comment on column public.official_metrics.bill_passage_rate is
  'bills_passed_count / bills_sponsored_count * 100. NULL when sponsored zero bills.';
comment on column public.official_metrics.fiscal_impact_per_dollar_raised is
  'fiscal_impact_total / total_raised. Descriptive ratio (not normative). NULL when finance not ingested or total_raised = 0.';
