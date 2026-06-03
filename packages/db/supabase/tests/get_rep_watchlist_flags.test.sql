begin;
select plan(6);

-- district (officials.district_id is NOT NULL, FK -> districts)
insert into public.districts (id, tier, state, code, name, geometry, source_version)
  values ('00000000-0000-0000-0000-0000000000d1', 'federal_house', 'CA', 'CA-watchlist-test',
          'CA watchlist test',
          st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
          'WL-test');

-- official (first_name/last_name/source_version are NOT NULL; district_id NOT NULL)
insert into public.officials
    (id, first_name, last_name, full_name, chamber, state, party, bioguide_id, district_id, source_version)
  values ('00000000-0000-0000-0000-0000000000f1', 'Test', 'Rep', 'Test Rep',
          'federal_house', 'CA', 'D', 'T000001',
          '00000000-0000-0000-0000-0000000000d1', 'WL-test');
-- finance summary + industry rows: one matching ('Oil & Gas'), one not ('Lawyers/Law Firms')
insert into public.finance_summaries (id, official_id, cycle, opensecrets_id, source_url)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '2024', 'N00000001', 'https://x');
insert into public.finance_industry_top (finance_summary_id, rank, industry, amount) values
  ('00000000-0000-0000-0000-0000000000c1', 1, 'Oil & Gas', 42000),
  ('00000000-0000-0000-0000-0000000000c1', 2, 'Lawyers/Law Firms', 5000);
-- user + catalog: Environment / industry-donor-recipients watchlist matching 'Oil & Gas'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a99', 'u@x.io');
insert into public.issue_topics (slug, display_name, description) values ('environment','Environment','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type, evidence_sources)
  values ('environment','industry-donor-recipients','Industry Donor Recipients','watchlist',
          '[{"type":"finance-industry","config":{"category":"fossil-fuel","industries":["Oil & Gas","Coal Mining"]}}]'::jsonb);
insert into public.user_issue_selections (user_id, topic_slug, lens_slug)
  values ('00000000-0000-0000-0000-000000000a99','environment','industry-donor-recipients');

-- second official: no finance rows, so no category-industry match (seeded before role
-- switch — the authenticated role has no INSERT grant on officials).
insert into public.officials
    (id, first_name, last_name, full_name, chamber, state, party, bioguide_id, district_id, source_version)
  values ('00000000-0000-0000-0000-0000000000f2', 'No', 'Match', 'No Match',
          'federal_house', 'TX', 'R', 'T000002',
          '00000000-0000-0000-0000-0000000000d1', 'WL-test');

select has_function('public','get_rep_watchlist_flags', array['uuid'], 'fn exists');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a99"}';

select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          1, 'one flag for matching rep');
select is(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')->0->>'lensSlug',
          'industry-donor-recipients', 'flag carries the lens slug');
select is((public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')->0->'evidence'->0->>'industry'),
          'Oil & Gas', 'evidence lists the matched industry');

select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f2')),
          0, 'no flags when rep has no category industries');

reset role;
-- clear the JWT claims GUC too: reset role alone leaves request.jwt.claims set, so
-- auth.uid() would still resolve to the prior user. Empty claims -> auth.uid() = null.
set local "request.jwt.claims" to '';
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          0, 'unauthenticated → empty');

select * from finish();
rollback;
