begin;
select plan(11);

select has_table('public', 'federal_disclosure_other', 'federal_disclosure_other table exists');

-- Required NOT NULL columns
select col_not_null('public', 'federal_disclosure_other', 'official_id', 'federal_disclosure_other.official_id is NOT NULL');
select col_not_null('public', 'federal_disclosure_other', 'filing_year', 'federal_disclosure_other.filing_year is NOT NULL');
select col_not_null('public', 'federal_disclosure_other', 'source',      'federal_disclosure_other.source is NOT NULL');
select col_not_null('public', 'federal_disclosure_other', 'source_url',  'federal_disclosure_other.source_url is NOT NULL');
select col_not_null('public', 'federal_disclosure_other', 'category',    'federal_disclosure_other.category is NOT NULL');

-- ON DELETE RESTRICT FK
select fk_ok(
  'public', 'federal_disclosure_other', 'official_id',
  'public', 'officials',                'id',
  'federal_disclosure_other.official_id FK to officials with ON DELETE RESTRICT'
);

-- CHECK enum (category)
select col_has_check('public', 'federal_disclosure_other', 'category', 'federal_disclosure_other.category has CHECK');

-- Indexes
select has_index('public', 'federal_disclosure_other', 'federal_disclosure_other_source_external_id_uniq',
  '(source, external_id) UNIQUE partial index present');
select has_index('public', 'federal_disclosure_other', 'federal_disclosure_other_official_idx',
  '(official_id, filing_year desc) btree index present');

-- RLS enabled (handled in 0055; this asserts state after db:reset which applies all migrations)
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'federal_disclosure_other' $$,
  ARRAY[true],
  'RLS enabled on federal_disclosure_other'
);

select * from finish();
rollback;
