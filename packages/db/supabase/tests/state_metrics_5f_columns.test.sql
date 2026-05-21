begin;

select plan(8);

-- 1-5. Each new column exists with the expected precision.
select col_type_is('public', 'official_metrics', 'bills_passed_count', 'integer',
  'bills_passed_count is integer');
select col_type_is('public', 'official_metrics', 'hearings_held_count', 'integer',
  'hearings_held_count is integer');
select col_type_is('public', 'official_metrics', 'subject_breadth', 'integer',
  'subject_breadth is integer');
select col_type_is('public', 'official_metrics', 'bill_passage_rate', 'numeric(5,2)',
  'bill_passage_rate is numeric(5,2)');
select col_type_is('public', 'official_metrics', 'fiscal_impact_per_dollar_raised', 'numeric(10,4)',
  'fiscal_impact_per_dollar_raised is numeric(10,4)');

-- 6-8. Anchor: pre-slice-5F columns still exist (regression guard).
select has_column('public', 'official_metrics', 'committee_chair_count',
  'committee_chair_count from slice 5D still exists');
select has_column('public', 'official_metrics', 'party_unity_state',
  'party_unity_state from slice 5D still exists');
select has_column('public', 'official_metrics', 'fiscal_impact_total',
  'fiscal_impact_total from slice 5D still exists');

select * from finish();
rollback;
