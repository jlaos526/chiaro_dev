begin;

select plan(8);

-- 1-2. Columns exist
select has_column('public', 'town_halls', 'source',      'town_halls.source column exists');
select has_column('public', 'town_halls', 'external_id', 'town_halls.external_id column exists');

-- 3. source is NOT NULL
select col_not_null('public', 'town_halls', 'source', 'town_halls.source is NOT NULL');

-- 4. external_id allows NULL
select col_is_null('public', 'town_halls', 'external_id', 'town_halls.external_id allows NULL');

-- 5. Unique constraint exists
select has_index('public', 'town_halls', 'town_halls_source_external_id_unique',
  '(source, external_id) UNIQUE constraint present');

-- 6. (source, external_id) allows multiple NULL external_id (NULLs distinct)
-- Seed district + official + insert rows.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'CA', 'CA-FX-PAR', 'CA FX-PAR',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-par')
  on conflict (tier, code) do nothing;
insert into public.officials (bioguide_id, full_name, first_name, last_name,
    chamber, party, state, district_id, in_office, source_version)
  select 'FXPAR1', 'Test Par1', 'Test', 'Par1', 'federal_house', 'D', 'CA',
    d.id, true, 'FX-par'
  from public.districts d where d.code = 'CA-FX-PAR';
insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
  select id, '2026-01-01', 'in_person', 'CA', 'https://x', 'mobilize', null
  from public.officials where source_version = 'FX-par';
insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
  select id, '2026-01-02', 'in_person', 'CA', 'https://y', 'mobilize', null
  from public.officials where source_version = 'FX-par';
select pass('(source, external_id) UNIQUE allows multiple NULL external_id');

-- 7. (source, external_id) UNIQUE rejects duplicate non-NULL pair
insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
  select id, '2026-02-01', 'in_person', 'CA', 'https://z', 'mobilize', 'thp-1'
  from public.officials where source_version = 'FX-par';
select throws_ok(
  $$ insert into public.town_halls (official_id, event_date, format, state, source_url, source, external_id)
     select id, '2026-02-02', 'in_person', 'CA', 'https://z2', 'mobilize', 'thp-1'
     from public.officials where source_version = 'FX-par' $$,
  '23505', null,
  '(source, external_id) UNIQUE rejects duplicate non-NULL'
);

-- 8. FK official_id RESTRICT (post-0026 + post-0051)
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-par' $$,
  '23503', null,
  'town_halls.official_id FK is RESTRICT'
);

-- Cleanup
delete from public.town_halls where official_id in
  (select id from public.officials where source_version = 'FX-par');
delete from public.officials where source_version = 'FX-par';
delete from public.districts where source_version = 'FX-par';

select * from finish();
rollback;
