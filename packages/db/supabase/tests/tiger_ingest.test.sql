begin;

select plan(7);

-- 1. federal_house: every state + DC has ≥1 district (51 distinct).
-- DC is included because CD119 adds a non-voting delegate row.
-- Total row count is left floating (CD119 ~439); distinct-state count
-- is the load-bearing assertion against a wholesale ingest failure.
select results_eq(
  $$ select count(distinct state)::int
       from public.districts
       where tier = 'federal_house' $$,
  $$ values (51) $$,
  'federal_house: 51 distinct states (50 + DC) have ≥1 district'
);

-- 2. federal_senate: exactly 100 rows total (50 states × 2 seats).
-- DC is excluded — no senators.
select results_eq(
  $$ select count(*)::int
       from public.districts
       where tier = 'federal_senate' $$,
  $$ values (100) $$,
  'federal_senate: 100 rows total (50 states × 2; DC excluded)'
);

-- 3. state_senate: every state has ≥1 district (50 distinct).
-- DC is excluded — no state legislature.
select results_eq(
  $$ select count(distinct state)::int
       from public.districts
       where tier = 'state_senate' $$,
  $$ values (50) $$,
  'state_senate: 50 distinct states have ≥1 district (DC excluded)'
);

-- 4. state_house: every state except DC and NE has ≥1 district (49 distinct).
-- DC has no state legislature; NE has a unicameral legislature (state_senate only).
select results_eq(
  $$ select count(distinct state)::int
       from public.districts
       where tier = 'state_house' $$,
  $$ values (49) $$,
  'state_house: 49 distinct states have ≥1 district (DC, NE excluded)'
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
