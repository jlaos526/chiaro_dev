begin;
select plan(9);

-- district (officials.district_id is NOT NULL, FK -> districts)
insert into public.districts (id, tier, state, code, name, geometry, source_version)
  values ('00000000-0000-0000-0000-0000000000d1', 'federal_house', 'CA', 'CA-issalign-test',
          'CA issalign test',
          st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
          'IA-test');

-- official
insert into public.officials
    (id, first_name, last_name, full_name, chamber, state, party, bioguide_id,
     district_id, source_version)
  values ('00000000-0000-0000-0000-0000000000f1', 'Test', 'Rep', 'Test Rep',
          'federal_house', 'CA', 'D', 'T000001',
          '00000000-0000-0000-0000-0000000000d1', 'IA-test');

-- scorecard org + rating (LCV gives this rep 80)
insert into public.scorecard_orgs (id, slug, name, issue_area, methodology_url)
  values ('00000000-0000-0000-0000-0000000000c1','lcv','LCV','environment','https://x.io/m');
insert into public.scorecard_ratings (scorecard_id, official_id, score, congress, source_url)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1',
          80, '119', 'https://x.io/r');

-- user + catalog: Environment/Conservation stance scored 100% from LCV
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a99','u@x.io');
insert into public.issue_topics (slug, display_name, description) values ('environment','Environment','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type, measurement_sources)
  values ('environment','conservation','Conservation','stance',
          '[{"type":"scorecard","weight":1.0,"config":{"orgs":["lcv"]}}]'::jsonb);
insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
  values ('00000000-0000-0000-0000-000000000a99','environment','conservation', 90, 1);

select has_function('public','rep_stance_score', array['uuid','jsonb'], 'rep_stance_score exists');
select has_function('public','get_rep_issue_alignment', array['uuid'], 'get_rep_issue_alignment exists');

-- rep_pos for the stance = 80 (single scorecard source)
select is(public.rep_stance_score('00000000-0000-0000-0000-0000000000f1',
  '[{"type":"scorecard","weight":1.0,"config":{"orgs":["lcv"]}}]'::jsonb), 80::numeric, 'rep_stance_score = 80');

-- no-data stance -> NULL (org not present)
select is(public.rep_stance_score('00000000-0000-0000-0000-0000000000f1',
  '[{"type":"scorecard","weight":1.0,"config":{"orgs":["nra"]}}]'::jsonb), null, 'no data -> NULL');

-- invert flips the score: 100 - 80 = 20
select is(public.rep_stance_score('00000000-0000-0000-0000-0000000000f1',
  '[{"type":"scorecard","weight":1.0,"config":{"orgs":["lcv"],"invert":true}}]'::jsonb),
  20::numeric, 'invert flips 80 -> 20');

-- alignment as the user: user_pos 90 vs rep_pos 80 -> agreement 90; overall 90
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a99"}';
select is((public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->>'overallPct')::numeric,
          90::numeric, 'overall alignment = 90');
select is(jsonb_array_length(public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'),
          1, 'one axis returned');
reset role;

-- a user with no selections -> overallPct is null (NULL != 0)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a98','none@x.io');
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a98"}';
select is(public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'overallPct',
          'null'::jsonb, 'no selections -> overallPct null');
reset role;

-- multi-stance topic averages its lenses (importance-weighted within the topic).
-- Second user picks two stances under one topic: one aligns 90 (lcv, w=1), one aligns 50
-- (rep_pos 50 from a second org; user_pos 100 -> agreement 50). Equal importance -> (90+50)/2 = 70.
insert into public.scorecard_orgs (id, slug, name, issue_area, methodology_url)
  values ('00000000-0000-0000-0000-0000000000c2','aclu','ACLU','civil-rights','https://x.io/m2');
insert into public.scorecard_ratings (scorecard_id, official_id, score, congress, source_url)
  values ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000f1',
          50, '119', 'https://x.io/r2');
insert into public.issue_lenses (topic_slug, slug, label, lens_type, measurement_sources)
  values ('environment','rights','Rights','stance',
          '[{"type":"scorecard","weight":1.0,"config":{"orgs":["aclu"]}}]'::jsonb);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a97','multi@x.io');
insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
  values ('00000000-0000-0000-0000-000000000a97','environment','conservation', 90, 1),
         ('00000000-0000-0000-0000-000000000a97','environment','rights', 100, 1);
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a97"}';
select is((public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'->0->>'alignmentPct')::numeric,
          70::numeric, 'multi-stance topic averages two lenses -> 70');
reset role;

select * from finish();
rollback;
