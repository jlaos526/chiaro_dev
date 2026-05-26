-- Slice 28: assert TIGER state-leg district code format consistency.
-- Pairs with slice 27 audit (docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md)
-- and the Option A normalize alignment in state-leg-config.ts.
-- Runs against post-seed:tiger data (per Gotcha #6 prerequisite).
-- Trivially passes against db:reset-only state (zero rows).

begin;
select plan(4);

-- 1. All state_senate codes match the TIGER format
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_senate' and code !~ '^[A-Z]{2}-SS-([0-9]+|AL|[A-Z])$' $$,
  ARRAY[0],
  'state_senate codes all match ^[A-Z]{2}-SS-(num|AL|letter)$'
);

-- 2. All state_house codes match the TIGER format
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_house' and code !~ '^[A-Z]{2}-SH-([0-9]+|AL|[A-Z])$' $$,
  ARRAY[0],
  'state_house codes all match ^[A-Z]{2}-SH-(num|AL|letter)$'
);

-- 3. No state_senate codes without the SS prefix
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_senate' and code not like '%-SS-%' $$,
  ARRAY[0],
  'state_senate: zero rows lack -SS- prefix'
);

-- 4. No state_house codes without the SH prefix
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_house' and code not like '%-SH-%' $$,
  ARRAY[0],
  'state_house: zero rows lack -SH- prefix'
);

select * from finish();
rollback;
