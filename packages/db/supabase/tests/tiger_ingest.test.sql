begin;

select plan(7);

-- TIGER source completeness assertions (#1, #3, #4) tolerate up to 2 missing
-- states per tier to match slice-5A's partial-success philosophy. Census.gov
-- occasionally serves hung connections on individual state shapefiles
-- (observed: SC CD/tl_2024_45_cd119.zip, 2026-05-20). The retry layer
-- classifies sustained timeouts as gaps (logged + skipped) so `seed:tiger`
-- exits 0. The assertions below match that tolerance: ≥(expected − 2) passes;
-- 3+ missing states is evidence of a real ingest bug and still fires.

-- 1. federal_house: every state + DC has ≥1 district (51 expected; tolerate ≥49).
-- DC is included because CD119 adds a non-voting delegate row.
-- Total row count is left floating (CD119 ~439); distinct-state count
-- is the load-bearing assertion against a wholesale ingest failure.
select cmp_ok(
  (select count(distinct state)::int from public.districts where tier = 'federal_house'),
  '>=', 49,
  'federal_house: ≥49 of 51 expected distinct states (50 + DC) have ≥1 district'
);

-- 2. federal_senate: exactly 100 rows total (50 states × 2 seats).
-- DC is excluded — no senators. Synthesized in-script from a hardcoded state
-- list; not subject to Census flakes, so the equality is preserved.
select results_eq(
  $$ select count(*)::int
       from public.districts
       where tier = 'federal_senate' $$,
  $$ values (100) $$,
  'federal_senate: 100 rows total (50 states × 2; DC excluded)'
);

-- 3. state_senate: every state has ≥1 district (50 expected; tolerate ≥48).
-- DC is excluded — no state legislature.
select cmp_ok(
  (select count(distinct state)::int from public.districts where tier = 'state_senate'),
  '>=', 48,
  'state_senate: ≥48 of 50 expected distinct states have ≥1 district (DC excluded)'
);

-- 4. state_house: every state except DC and NE has ≥1 district (49 expected; tolerate ≥47).
-- DC has no state legislature; NE has a unicameral legislature (state_senate only).
select cmp_ok(
  (select count(distinct state)::int from public.districts where tier = 'state_house'),
  '>=', 47,
  'state_house: ≥47 of 49 expected distinct states have ≥1 district (DC, NE excluded)'
);

-- 5. NE state_house: explicitly zero rows (Nebraska is unicameral).
select results_eq(
  $$ select count(*)::int
       from public.districts
       where tier = 'state_house' and state = 'NE' $$,
  $$ values (0) $$,
  'state_house: Nebraska (unicameral) has zero rows'
);

-- 6. all districts have non-null geometry.
select is_empty(
  $$ select tier, code from public.districts where geometry is null $$,
  'all districts have non-null geometry'
);

-- 7. all district geometries pass ST_IsValid.
select is_empty(
  $$ select tier, code
       from public.districts
       where not ST_IsValid(geometry::geometry) $$,
  'all districts pass ST_IsValid'
);

select * from finish();
rollback;
