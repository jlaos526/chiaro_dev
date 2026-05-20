begin;
select plan(11);

select has_column('public', 'officials', 'openstates_person_id',
  'openstates_person_id column exists');
select col_type_is('public', 'officials', 'openstates_person_id', 'text',
  'openstates_person_id is text');
select col_is_null('public', 'officials', 'openstates_person_id',
  'openstates_person_id is nullable');

select has_column('public', 'officials', 'district_code',
  'district_code column exists');
select col_type_is('public', 'officials', 'district_code', 'text',
  'district_code is text');

select has_column('public', 'officials', 'title',
  'title column exists');

select has_index('public', 'officials', 'officials_openstates_person_idx',
  'partial unique index on openstates_person_id where not null exists');

select has_check('public', 'officials',
  'officials_source_id_xor CHECK exists');

-- Fixture district keyed by a unique source_version so we don't collide with
-- TIGER seed rows. FK target for the inserts below.
insert into public.districts (tier, state, code, name, geometry, source_version)
values ('federal_senate', 'XX', 'XX-FK-test', 'fk test',
  st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
  'FK-XOR-test');

-- Attempt insert with BOTH bioguide_id and openstates_person_id — should fail
-- the XOR CHECK (Postgres SQLSTATE 23514 = check_violation).
select throws_ok(
  $$insert into public.officials
    (bioguide_id, openstates_person_id, first_name, last_name, full_name,
     chamber, party, state, district_id, senate_class, source_version)
    select 'XXBOTH1', 'ocd-person/xxxx', 'X','X','X',
           'federal_senate', 'D', 'XX',
           id, 1, 'FK-XOR-test'
    from public.districts where code = 'XX-FK-test'$$,
  '23514',
  null,
  'insert with both bioguide_id and openstates_person_id violates CHECK'
);

-- Attempt insert with NEITHER bioguide_id nor openstates_person_id — should fail.
-- Federal seed must provide bioguide_id; state seed must provide openstates_person_id.
-- Neither-set is a programmer error.
select throws_ok(
  $$insert into public.officials
    (first_name, last_name, full_name,
     chamber, party, state, district_id, senate_class, source_version)
    select 'X','X','X',
           'federal_senate', 'D', 'XX',
           id, 1, 'FK-XOR-test'
    from public.districts where code = 'XX-FK-test'$$,
  '23514',
  null,
  'insert with neither bioguide_id nor openstates_person_id violates CHECK'
);

-- Verify party CHECK is gone — insert with 'Nonpartisan' should succeed.
-- state_legislature requires senate_class IS NULL per senate_class_matches_chamber.
select lives_ok(
  $$insert into public.officials
    (openstates_person_id, first_name, last_name, full_name,
     chamber, party, state, district_id, senate_class, source_version)
    select 'ocd-person/np-test', 'N','P','N P',
           'state_legislature', 'Nonpartisan', 'XX',
           id, null, 'FK-XOR-test'
    from public.districts where code = 'XX-FK-test'$$,
  'party=Nonpartisan accepted (party CHECK relaxed)'
);

select * from finish();
rollback;
