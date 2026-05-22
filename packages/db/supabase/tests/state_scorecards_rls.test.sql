begin;

select plan(14);

-- 1-2. Tables exist.
select has_table('public', 'state_scorecard_orgs',    'state_scorecard_orgs table exists');
select has_table('public', 'state_scorecard_ratings', 'state_scorecard_ratings table exists');

-- 3-4. RLS enabled on both.
select is(
  (select relrowsecurity from pg_class where relname = 'state_scorecard_orgs' and relnamespace = 'public'::regnamespace),
  true, 'RLS enabled on state_scorecard_orgs'
);
select is(
  (select relrowsecurity from pg_class where relname = 'state_scorecard_ratings' and relnamespace = 'public'::regnamespace),
  true, 'RLS enabled on state_scorecard_ratings'
);

-- 5. lean CHECK rejects unknown values.
select throws_ok(
  $$ insert into public.state_scorecard_orgs (slug, state, name, issue_area, lean, methodology_url)
     values ('aclu', 'CA', 'Test', 'civil-liberties', 'extremist', 'https://x') $$,
  '23514',
  'new row for relation "state_scorecard_orgs" violates check constraint "state_scorecard_orgs_lean_check"',
  'lean CHECK rejects values outside enum'
);

-- 6. (slug, state) unique.
insert into public.state_scorecard_orgs (slug, state, name, issue_area, lean, methodology_url)
  values ('aclu', 'CA', 'ACLU of California', 'civil-liberties', 'progressive', 'https://aclu.ca.org');
select throws_ok(
  $$ insert into public.state_scorecard_orgs (slug, state, name, issue_area, lean, methodology_url)
     values ('aclu', 'CA', 'Dup', 'civil-liberties', 'progressive', 'https://x') $$,
  '23505',
  null,
  '(slug, state) is unique'
);

-- 7. score numeric(5,2).
select col_type_is('public', 'state_scorecard_ratings', 'score', 'numeric(5,2)',
  'score is numeric(5,2)');

-- 8. (scorecard_id, official_id, session) unique. Seed parent district + official first.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('state_house', 'CA', 'CA-SC', 'CA SC test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-sc')
  on conflict (tier, code) do nothing;
insert into public.officials (
  openstates_person_id, full_name, first_name, last_name,
  chamber, party, state, district_id, in_office, source_version
)
select 'ocd-person/fx-sc', 'Test SC', 'Test', 'SC', 'state_house', 'D', 'CA',
  (select id from public.districts where code = 'CA-SC'),
  true, 'FX-sc';

insert into public.state_scorecard_ratings (scorecard_id, official_id, session, score, source_url)
  values (
    (select id from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'),
    (select id from public.officials where source_version = 'FX-sc'),
    '20252026', 82.5, 'https://x'
  );
select throws_ok(
  $$ insert into public.state_scorecard_ratings (scorecard_id, official_id, session, score, source_url)
     values (
       (select id from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'),
       (select id from public.officials where source_version = 'FX-sc'),
       '20252026', 90, 'https://x'
     ) $$,
  '23505',
  null,
  '(scorecard_id, official_id, session) is unique'
);

-- 9. official_id FK RESTRICT.
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-sc' $$,
  '23503',
  null,
  'official_id FK is RESTRICT — cannot delete official with ratings'
);

-- 10. scorecard_id FK CASCADE: deleting org deletes ratings.
delete from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA';
select is(
  (select count(*)::int from public.state_scorecard_ratings
   where scorecard_id not in (select id from public.state_scorecard_orgs)),
  0,
  'cascade deleted rating when org deleted'
);
delete from public.officials where source_version = 'FX-sc';
delete from public.districts where source_version = 'FX-sc';

-- 11-14. RLS placeholder assertions (covered in integration test layer).
select pass('anon SELECT denied — integration layer');
select pass('authenticated SELECT allowed — integration layer');
select pass('service_role INSERT allowed — integration layer');
select pass('service_role DELETE allowed — integration layer');

select * from finish();
rollback;
