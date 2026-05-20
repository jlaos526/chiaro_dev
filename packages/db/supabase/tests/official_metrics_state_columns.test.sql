begin;
select plan(8);

select has_column('public', 'official_metrics', 'committee_chair_count',
  'committee_chair_count column exists');
select col_type_is('public', 'official_metrics', 'committee_chair_count', 'integer',
  'committee_chair_count is integer');
select col_is_null('public', 'official_metrics', 'committee_chair_count',
  'committee_chair_count is nullable');

select has_column('public', 'official_metrics', 'fiscal_impact_total',
  'fiscal_impact_total column exists');
select col_type_is('public', 'official_metrics', 'fiscal_impact_total', 'numeric(15,2)',
  'fiscal_impact_total is numeric');

select has_column('public', 'official_metrics', 'party_unity_state',
  'party_unity_state column exists');
select col_type_is('public', 'official_metrics', 'party_unity_state', 'numeric(5,2)',
  'party_unity_state is numeric');
select col_is_null('public', 'official_metrics', 'party_unity_state',
  'party_unity_state is nullable');

select * from finish();
rollback;
