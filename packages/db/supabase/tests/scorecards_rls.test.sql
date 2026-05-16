begin;

select plan(14);

select has_table('public', 'scorecard_orgs',    'scorecard_orgs table exists');
select has_column('public', 'scorecard_orgs', 'methodology_url',
                  'methodology_url col (drill-down anchor)');
select col_is_unique('public', 'scorecard_orgs', 'slug', 'slug is unique');
select col_has_check('public', 'scorecard_orgs', 'lean',
                     'lean has check constraint');

select has_table('public', 'scorecard_ratings', 'scorecard_ratings table exists');
select has_column('public', 'scorecard_ratings', 'source_url',
                  'source_url col (drill-down anchor)');
select col_is_unique('public', 'scorecard_ratings',
                     array['scorecard_id','official_id','congress'],
                     'unique on (scorecard_id, official_id, congress)');

select col_is_fk('public', 'scorecard_ratings', 'scorecard_id',
                  'scorecard_id is FK');
select col_is_fk('public', 'scorecard_ratings', 'official_id',
                  'official_id is FK');

select has_index('public', 'scorecard_ratings', 'scorecard_ratings_official_idx',
                  'scorecard_ratings_official_idx exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.scorecard_orgs'::regclass),
  'scorecard_orgs has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.scorecard_ratings'::regclass),
  'scorecard_ratings has RLS enabled'
);

-- Seed an org so the rating-FK insert below has something to reference
set local role service_role;
insert into public.scorecard_orgs (slug, name, issue_area, lean, methodology_url)
  values ('test-lean-org', 'Test Org', 'environment', 'progressive', 'https://example.org/methodology');
reset role;

set local role anon;
select throws_ok(
  $$ insert into public.scorecard_orgs (slug, name, issue_area, lean, methodology_url)
     values ('anon-test', 'Anon Test', 'environment', 'progressive', 'https://x') $$,
  '42501', null,
  'anon cannot INSERT into scorecard_orgs'
);
reset role;

set local role service_role;
select lives_ok(
  $$ insert into public.scorecard_orgs (slug, name, issue_area, lean, methodology_url)
     values ('svc-test', 'Svc Test', 'environment', 'progressive', 'https://y') $$,
  'service_role can INSERT into scorecard_orgs'
);
reset role;

select * from finish();
rollback;
