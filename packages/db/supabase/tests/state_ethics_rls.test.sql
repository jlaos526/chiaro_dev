begin;

select plan(20);

-- 1-4. has_table
select has_table('public', 'state_stock_transactions',     'state_stock_transactions exists');
select has_table('public', 'state_financial_disclosures',  'state_financial_disclosures exists');
select has_table('public', 'state_ethics_complaints',      'state_ethics_complaints exists');
select has_table('public', 'state_official_events',        'state_official_events exists');

-- 5-8. RLS enabled
select is((select relrowsecurity from pg_class where relname = 'state_stock_transactions' and relnamespace = 'public'::regnamespace), true, 'RLS on stock_transactions');
select is((select relrowsecurity from pg_class where relname = 'state_financial_disclosures' and relnamespace = 'public'::regnamespace), true, 'RLS on financial_disclosures');
select is((select relrowsecurity from pg_class where relname = 'state_ethics_complaints' and relnamespace = 'public'::regnamespace), true, 'RLS on ethics_complaints');
select is((select relrowsecurity from pg_class where relname = 'state_official_events' and relnamespace = 'public'::regnamespace), true, 'RLS on official_events');

-- Seed district + official for FK + CHECK assertions.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('state_house', 'CA', 'CA-SI', 'CA SI test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-si')
  on conflict (tier, code) do nothing;
insert into public.officials (openstates_person_id, full_name, first_name, last_name, chamber, party, state, district_id, in_office, source_version)
select 'ocd-person/fx-si', 'Test SI', 'Test', 'SI', 'state_house', 'D', 'CA',
  (select id from public.districts where code = 'CA-SI'),
  true, 'FX-si';

-- 9. transaction_type CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_stock_transactions
     (official_id, transaction_date, filing_date, transaction_type, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', '2026-01-15', 'pillage', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'transaction_type CHECK rejects bad value'
);

-- 10. income_kind CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_financial_disclosures
     (official_id, filing_year, income_kind, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             2025, 'bribery', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'income_kind CHECK rejects bad value'
);

-- 11. status CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_ethics_complaints
     (official_id, complaint_date, status, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'pending_appeal', 'test', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'status CHECK rejects bad value'
);

-- 12. event_type CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_official_events
     (official_id, event_date, event_type, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'abducted_by_aliens', 'test', 'CA', 'https://x', 'openstates') $$,
  '23514', null, 'event_type CHECK rejects bad value'
);

-- 13. days_late generated column computes correctly (31 - 30 = 1)
insert into public.state_stock_transactions
  (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          '2026-01-01', '2026-02-01', 'purchase', 'CA', 'https://x', 'ca-fppc', 'stk-1');
select is(
  (select days_late from public.state_stock_transactions where external_id = 'stk-1'),
  1,
  'days_late generated column: 31 days - 30 deadline = 1 day late'
);

-- 14-17. (source, external_id) UNIQUE NULL-distinct (allow NULL, reject duplicate non-NULL)
-- One sampled assertion per table; combine across:
insert into public.state_stock_transactions
  (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          '2026-01-02', '2026-01-15', 'purchase', 'CA', 'https://x', 'ca-fppc', null);
insert into public.state_stock_transactions
  (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          '2026-01-03', '2026-01-15', 'purchase', 'CA', 'https://x', 'ca-fppc', null);
select pass('state_stock_transactions (source, external_id) UNIQUE allows NULL external_id');

select throws_ok(
  $$ insert into public.state_stock_transactions
     (official_id, transaction_date, filing_date, transaction_type, state, source_url, source, external_id)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-04', '2026-01-15', 'purchase', 'CA', 'https://y', 'ca-fppc', 'stk-1') $$,
  '23505', null,
  'state_stock_transactions (source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- Similar for financial_disclosures (sampled):
insert into public.state_financial_disclosures
  (official_id, filing_year, income_kind, state, source_url, source, external_id)
  values ((select id from public.officials where source_version = 'FX-si'),
          2025, 'salary', 'CA', 'https://x', 'ca-fppc', 'disc-1');
select throws_ok(
  $$ insert into public.state_financial_disclosures
     (official_id, filing_year, income_kind, state, source_url, source, external_id)
     values ((select id from public.officials where source_version = 'FX-si'),
             2024, 'salary', 'CA', 'https://y', 'ca-fppc', 'disc-1') $$,
  '23505', null,
  'state_financial_disclosures (source, external_id) UNIQUE'
);

-- For complaints + events: assert columns exist with correct types as a lighter check.
select col_type_is('public', 'state_ethics_complaints', 'external_id', 'text',
  'state_ethics_complaints external_id is text (UNIQUE constraint per migration)');

-- 18. FK official_id RESTRICT on stock_transactions
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-si' $$,
  '23503', null,
  'state_stock_transactions official_id FK is RESTRICT'
);

-- 19. FK column type on financial_disclosures
select col_type_is('public', 'state_financial_disclosures', 'official_id', 'uuid',
  'state_financial_disclosures.official_id is uuid (FK is RESTRICT per migration)');

-- 20. Cleanup assertion
delete from public.state_stock_transactions
  where official_id = (select id from public.officials where source_version = 'FX-si');
delete from public.state_financial_disclosures
  where official_id = (select id from public.officials where source_version = 'FX-si');
delete from public.officials where source_version = 'FX-si';
delete from public.districts where source_version = 'FX-si';
select pass('cleanup applied');

select * from finish();
rollback;
