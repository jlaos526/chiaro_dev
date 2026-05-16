begin;

select plan(22);

-- officials extensions
select has_column('public', 'officials', 'opensecrets_id',
                  'officials.opensecrets_id added');
select has_column('public', 'officials', 'fec_candidate_id',
                  'officials.fec_candidate_id added');

-- rollup table
select has_table('public', 'official_metrics', 'official_metrics table exists');
select col_is_pk('public', 'official_metrics', 'official_id',
                  'official_metrics PK is official_id');
select has_column('public', 'official_metrics', 'attendance_pct',
                  'attendance_pct col');
select has_column('public', 'official_metrics', 'salary_usd', 'salary_usd col');
select has_column('public', 'official_metrics', 'lives_in_district',
                  'lives_in_district col');
select has_column('public', 'official_metrics', 'stock_act_compliance_pct',
                  'stock_act_compliance_pct col');

-- evidence: district_offices
select has_table('public', 'district_offices', 'district_offices table exists');
select has_column('public', 'district_offices', 'source_url',
                  'district_offices.source_url col');

-- evidence: town_halls
select has_table('public', 'town_halls', 'town_halls table exists');
select col_has_check('public', 'town_halls', 'format',
                     'town_halls.format has check constraint');
select has_index('public', 'town_halls', 'town_halls_official_date_idx',
                  'town_halls_official_date_idx exists');

-- evidence: stock_transactions
select has_table('public', 'stock_transactions', 'stock_transactions table exists');
select has_column('public', 'stock_transactions', 'days_late',
                  'days_late generated column');
select col_has_check('public', 'stock_transactions', 'transaction_type',
                     'transaction_type has check constraint');

-- evidence: officials_leadership_history
select has_table('public', 'officials_leadership_history',
                  'officials_leadership_history table exists');
select has_column('public', 'officials_leadership_history', 'source_url',
                  'leadership_history.source_url col');

-- indexes
select has_index('public', 'officials', 'officials_opensecrets_idx',
                  'officials_opensecrets_idx exists');
select has_index('public', 'district_offices', 'district_offices_official_idx',
                  'district_offices_official_idx exists');
select has_index('public', 'stock_transactions', 'stock_transactions_official_idx',
                  'stock_transactions_official_idx exists');
select has_index('public', 'officials_leadership_history',
                  'officials_leadership_history_official_idx',
                  'leadership_history official_idx exists');

select * from finish();
rollback;
