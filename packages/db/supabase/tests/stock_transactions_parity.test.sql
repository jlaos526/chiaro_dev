begin;

select plan(8);

-- 1-2. Columns exist
select has_column('public', 'stock_transactions', 'source',      'stock_transactions.source column exists');
select has_column('public', 'stock_transactions', 'external_id', 'stock_transactions.external_id column exists');

-- 3. source NOT NULL
select col_not_null('public', 'stock_transactions', 'source', 'stock_transactions.source is NOT NULL');

-- 4. external_id allows NULL
select col_is_null('public', 'stock_transactions', 'external_id', 'stock_transactions.external_id allows NULL');

-- 5. Unique constraint exists
select has_index('public', 'stock_transactions', 'stock_transactions_source_external_id_unique',
  '(source, external_id) UNIQUE constraint present');

-- 6. Allows multiple NULL external_id
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'CA', 'CA-FX-STK', 'CA FX-STK',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-stk')
  on conflict (tier, code) do nothing;
insert into public.officials (bioguide_id, full_name, first_name, last_name,
    chamber, party, state, district_id, in_office, source_version)
  select 'FXSTK1', 'Test Stk1', 'Test', 'Stk1', 'federal_house', 'D', 'CA',
    d.id, true, 'FX-stk'
  from public.districts d where d.code = 'CA-FX-STK';

insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
  select id, '2026-01-01', '2026-01-15', 'https://x', 'house-stock-watcher', null
  from public.officials where source_version = 'FX-stk';
insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
  select id, '2026-01-02', '2026-01-16', 'https://y', 'house-stock-watcher', null
  from public.officials where source_version = 'FX-stk';
select pass('(source, external_id) UNIQUE allows multiple NULL external_id');

-- 7. Rejects duplicate non-NULL pair
insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
  select id, '2026-02-01', '2026-02-15', 'https://z', 'house-stock-watcher', 'hsw-1'
  from public.officials where source_version = 'FX-stk';
select throws_ok(
  $$ insert into public.stock_transactions (official_id, transaction_date, filing_date, source_url, source, external_id)
     select id, '2026-02-02', '2026-02-16', 'https://z2', 'house-stock-watcher', 'hsw-1'
     from public.officials where source_version = 'FX-stk' $$,
  '23505', null,
  '(source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- 8. FK official_id RESTRICT
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-stk' $$,
  '23503', null,
  'stock_transactions.official_id FK is RESTRICT'
);

-- Cleanup
delete from public.stock_transactions where official_id in
  (select id from public.officials where source_version = 'FX-stk');
delete from public.officials where source_version = 'FX-stk';
delete from public.districts where source_version = 'FX-stk';

select * from finish();
rollback;
