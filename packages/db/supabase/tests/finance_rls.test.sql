begin;

select plan(18);

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

select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_summaries'::regclass),
  'finance_summaries has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_industry_top'::regclass),
  'finance_industry_top has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.finance_pac_contributions'::regclass),
  'finance_pac_contributions has RLS enabled'
);

-- Seed prerequisite: need an official row for the FK
set local role service_role;
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_senate','CA','CA-S1-fintest','CA fintest',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-fin')
  on conflict (tier,code) do nothing;
insert into public.officials (bioguide_id, first_name, last_name, full_name,
  chamber, party, state, district_id, senate_class, source_version)
  select 'FINTEST1','F','T','Fin Test','federal_senate','D','CA', id, 1, '119'
  from public.districts where code = 'CA-S1-fintest'
  on conflict (bioguide_id) do nothing;

set local role anon;
select throws_ok(
  $$ insert into public.finance_summaries (official_id, cycle, opensecrets_id, source_url)
     select id, '2024', 'N99999', 'https://x' from public.officials where bioguide_id = 'FINTEST1' $$,
  '42501', null,
  'anon cannot INSERT into finance_summaries'
);
reset role;

set local role service_role;
select lives_ok(
  $$ insert into public.finance_summaries (official_id, cycle, opensecrets_id, source_url)
     select id, '2024', 'N99999', 'https://x' from public.officials where bioguide_id = 'FINTEST1' $$,
  'service_role can INSERT into finance_summaries'
);
reset role;

select * from finish();
rollback;
