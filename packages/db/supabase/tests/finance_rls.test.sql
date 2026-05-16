begin;

select plan(13);

select has_table('public', 'finance_summaries',         'finance_summaries table exists');
select has_table('public', 'finance_industry_top',      'finance_industry_top table exists');
select has_table('public', 'finance_pac_contributions', 'finance_pac_contributions table exists');

select has_column('public', 'finance_summaries', 'opensecrets_id',
                  'opensecrets_id col present (join key)');
select has_column('public', 'finance_summaries', 'source_url',
                  'source_url col (drill-down anchor)');
select has_column('public', 'finance_summaries', 'in_state_pct',
                  'in_state_pct col');
select has_column('public', 'finance_summaries', 'out_of_state_pct',
                  'out_of_state_pct col');

select col_is_unique('public', 'finance_summaries',
                     array['official_id','cycle'],
                     'finance_summaries unique on (official_id, cycle)');

select col_is_pk('public', 'finance_industry_top',
                  array['finance_summary_id','rank'],
                  'finance_industry_top composite PK');
select col_has_check('public', 'finance_industry_top', 'rank',
                     'rank has range check');

select col_is_pk('public', 'finance_pac_contributions',
                  array['finance_summary_id','pac_name'],
                  'finance_pac_contributions composite PK');

select has_index('public', 'finance_summaries', 'finance_summaries_official_idx',
                  'finance_summaries_official_idx exists');

select col_is_fk('public', 'finance_summaries', 'official_id', 'official_id is FK');

select * from finish();
rollback;
