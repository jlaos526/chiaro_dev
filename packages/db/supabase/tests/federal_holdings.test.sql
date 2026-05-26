begin;
select plan(11);

select has_table('public', 'federal_holdings', 'federal_holdings table exists');

-- Required NOT NULL columns
select col_not_null('public', 'federal_holdings', 'official_id', 'federal_holdings.official_id is NOT NULL');
select col_not_null('public', 'federal_holdings', 'filing_year', 'federal_holdings.filing_year is NOT NULL');
select col_not_null('public', 'federal_holdings', 'source',      'federal_holdings.source is NOT NULL');
select col_not_null('public', 'federal_holdings', 'source_url',  'federal_holdings.source_url is NOT NULL');

-- ON DELETE RESTRICT FK
select fk_ok(
  'public', 'federal_holdings', 'official_id',
  'public', 'officials',         'id',
  'federal_holdings.official_id FK to officials with ON DELETE RESTRICT'
);

-- CHECK enums
select col_has_check('public', 'federal_holdings', 'asset_type',  'federal_holdings.asset_type has CHECK');
select col_has_check('public', 'federal_holdings', 'income_type', 'federal_holdings.income_type has CHECK');

-- Indexes
select has_index('public', 'federal_holdings', 'federal_holdings_source_external_id_uniq',
  '(source, external_id) UNIQUE partial index present');
select has_index('public', 'federal_holdings', 'federal_holdings_official_idx',
  '(official_id, filing_year desc) btree index present');

-- RLS enabled (handled in 0055; this asserts state after db:reset which applies all migrations)
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'federal_holdings' $$,
  ARRAY[true],
  'RLS enabled on federal_holdings'
);

select * from finish();
rollback;
