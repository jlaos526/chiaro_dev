begin;

select plan(13);

-- 1-3. has_table (stock_transactions removed)
select has_table('public', 'state_financial_disclosures',  'state_financial_disclosures exists');
select has_table('public', 'state_ethics_complaints',      'state_ethics_complaints exists');
select has_table('public', 'state_official_events',        'state_official_events exists');

-- 4-6. RLS enabled (stock_transactions removed)
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

-- 7. income_kind CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_financial_disclosures
     (official_id, filing_year, income_kind, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             2025, 'bribery', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'income_kind CHECK rejects bad value'
);

-- 8. status CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_ethics_complaints
     (official_id, complaint_date, status, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'pending_appeal', 'test', 'CA', 'https://x', 'ca-fppc') $$,
  '23514', null, 'status CHECK rejects bad value'
);

-- 9. event_type CHECK rejects bad value
select throws_ok(
  $$ insert into public.state_official_events
     (official_id, event_date, event_type, summary, state, source_url, source)
     values ((select id from public.officials where source_version = 'FX-si'),
             '2026-01-01', 'abducted_by_aliens', 'test', 'CA', 'https://x', 'openstates') $$,
  '23514', null, 'event_type CHECK rejects bad value'
);

-- 10. financial_disclosures (source, external_id) UNIQUE
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

-- 11. ethics_complaints external_id column type
select col_type_is('public', 'state_ethics_complaints', 'external_id', 'text',
  'state_ethics_complaints external_id is text (UNIQUE constraint per migration)');

-- 12. FK column type on financial_disclosures
select col_type_is('public', 'state_financial_disclosures', 'official_id', 'uuid',
  'state_financial_disclosures.official_id is uuid (FK is RESTRICT per migration)');

-- 13. Cleanup assertion
delete from public.state_financial_disclosures
  where official_id = (select id from public.officials where source_version = 'FX-si');
delete from public.officials where source_version = 'FX-si';
delete from public.districts where source_version = 'FX-si';
select pass('cleanup applied');

select * from finish();
rollback;
