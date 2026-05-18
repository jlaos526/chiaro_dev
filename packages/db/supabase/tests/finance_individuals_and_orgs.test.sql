begin;

select plan(17);

-- Schema (migration 0024)
select has_table('public', 'finance_individual_donors', 'finance_individual_donors table exists');
select has_table('public', 'finance_top_organizations', 'finance_top_organizations table exists');

select has_column('public', 'finance_individual_donors', 'donor_name',  'donor_name col present');
select has_column('public', 'finance_individual_donors', 'employer',    'employer col present');
select has_column('public', 'finance_individual_donors', 'occupation',  'occupation col present');
select has_column('public', 'finance_top_organizations', 'org_name',    'org_name col present');

select col_is_pk('public', 'finance_individual_donors',
                 array['finance_summary_id','rank'],
                 'finance_individual_donors composite PK');
select col_is_pk('public', 'finance_top_organizations',
                 array['finance_summary_id','rank'],
                 'finance_top_organizations composite PK');

select col_has_check('public', 'finance_individual_donors', 'rank',
                     'finance_individual_donors rank has range check');
select col_has_check('public', 'finance_top_organizations', 'rank',
                     'finance_top_organizations rank has range check');

select has_index('public', 'finance_individual_donors', 'finance_individual_donors_summary_idx',
                 'finance_individual_donors index exists');
select has_index('public', 'finance_top_organizations', 'finance_top_organizations_summary_idx',
                 'finance_top_organizations index exists');

-- RLS (migration 0025)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_individual_donors'::regclass),
  'finance_individual_donors has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_top_organizations'::regclass),
  'finance_top_organizations has RLS enabled'
);

-- Seed prerequisite: one official + one finance_summary so we can verify
-- cascade-delete and anon INSERT denial.
set local role service_role;
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house','CA','CA-fin-iao-test','CA fin iao test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-iao')
  on conflict (tier,code) do nothing;
insert into public.officials (bioguide_id, first_name, last_name, full_name,
  chamber, party, state, district_id, senate_class, source_version)
  select 'IAOTST1','F','T','IAO Test','house','D','CA', id, null, '119'
  from public.districts where code = 'CA-fin-iao-test'
  on conflict (bioguide_id) do nothing;
insert into public.finance_summaries (official_id, cycle, opensecrets_id, source_url)
  select id, '2024', 'N99IAO', 'https://x' from public.officials where bioguide_id = 'IAOTST1';
insert into public.finance_individual_donors (finance_summary_id, rank, donor_name, amount)
  select id, 1, 'Test Donor', 1000 from public.finance_summaries where opensecrets_id = 'N99IAO';
insert into public.finance_top_organizations (finance_summary_id, rank, org_name, amount)
  select id, 1, 'Test Org', 5000 from public.finance_summaries where opensecrets_id = 'N99IAO';
reset role;

set local role anon;
select throws_ok(
  $$ insert into public.finance_individual_donors (finance_summary_id, rank, donor_name, amount)
     select id, 2, 'Bad Donor', 999 from public.finance_summaries where opensecrets_id = 'N99IAO' $$,
  '42501', null,
  'anon cannot INSERT into finance_individual_donors'
);
reset role;

-- Cascade-delete verification: deleting the parent summary clears both child tables.
set local role service_role;
delete from public.finance_summaries where opensecrets_id = 'N99IAO';
select is(
  (select count(*)::int from public.finance_individual_donors),
  0,
  'cascade-delete removes finance_individual_donors rows'
);
select is(
  (select count(*)::int from public.finance_top_organizations),
  0,
  'cascade-delete removes finance_top_organizations rows'
);
reset role;

select * from finish();
rollback;
