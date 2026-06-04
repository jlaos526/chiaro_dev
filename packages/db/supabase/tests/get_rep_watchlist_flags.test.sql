begin;
select plan(9);

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

-- Extra lenses + users for the gating/filtering scenarios. All inserted as the
-- default (superuser) role here — the authenticated role has no INSERT grant on
-- issue_lenses / user_issue_selections / auth.users.
-- (a) min_amount gating: same 'Oil & Gas' match but min_amount ($100000) is above
--     the rep's summed $42000, so the lens must NOT flag.
insert into public.issue_lenses (topic_slug, slug, label, lens_type, evidence_sources)
  values ('environment','high-threshold-watchlist','High Threshold Watchlist','watchlist',
          '[{"type":"finance-industry","config":{"category":"fossil-fuel","industries":["Oil & Gas"],"min_amount":100000}}]'::jsonb);
-- (b) inactive lens: would match 'Oil & Gas' but active=false, so it must NOT flag.
insert into public.issue_lenses (topic_slug, slug, label, lens_type, evidence_sources, active)
  values ('environment','inactive-watchlist','Inactive Watchlist','watchlist',
          '[{"type":"finance-industry","config":{"category":"fossil-fuel","industries":["Oil & Gas"]}}]'::jsonb,
          false);
-- (c) unselected lens: active + would match, but no user selects it.
insert into public.issue_lenses (topic_slug, slug, label, lens_type, evidence_sources)
  values ('environment','unselected-watchlist','Unselected Watchlist','watchlist',
          '[{"type":"finance-industry","config":{"category":"fossil-fuel","industries":["Oil & Gas"]}}]'::jsonb);

-- fresh users, each selecting only the lens its scenario tests (a01/a02);
-- a03 selects nothing, to test the unselected-lens path.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'gate@x.io'),
  ('00000000-0000-0000-0000-000000000a02', 'inactive@x.io'),
  ('00000000-0000-0000-0000-000000000a03', 'unselected@x.io');
insert into public.user_issue_selections (user_id, topic_slug, lens_slug) values
  ('00000000-0000-0000-0000-000000000a01','environment','high-threshold-watchlist'),
  ('00000000-0000-0000-0000-000000000a02','environment','inactive-watchlist');

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

-- (a) min_amount gating: a01 selects only the high-threshold lens; the rep's $42000
--     is below its $100000 min_amount, so no flag is produced.
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a01"}';
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          0, 'no flag when matched amount is below the lens min_amount');

-- (b) inactive lens: a02 selects only the inactive lens; the function filters on
--     l.active, so no flag even though the config would match.
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a02"}';
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          0, 'no flag from an inactive (active=false) watchlist lens');

-- (c) unselected lens: a03 has zero selections; an active, would-match lens exists
--     but the user never selected it, so no flag.
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a03"}';
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          0, 'no flag from a watchlist lens the user has not selected');

reset role;
-- clear the JWT claims GUC too: reset role alone leaves request.jwt.claims set, so
-- auth.uid() would still resolve to the prior user. Empty claims -> auth.uid() = null.
set local "request.jwt.claims" to '';
select is(jsonb_array_length(public.get_rep_watchlist_flags('00000000-0000-0000-0000-0000000000f1')),
          0, 'unauthenticated → empty');

select * from finish();
rollback;
