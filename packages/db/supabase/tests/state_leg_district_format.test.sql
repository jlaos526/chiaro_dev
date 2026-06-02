-- Slice 28: assert TIGER state-leg district code format consistency.
-- Pairs with slice 27 audit (docs/superpowers/audits/2026-05-26-state-leg-district-format-audit.md)
-- and the Option A normalize alignment in state-leg-config.ts.
-- Runs against post-seed:tiger data (per Gotcha #6 prerequisite).
-- Trivially passes against db:reset-only state (zero rows).
--
-- The invariant under test is the `<STATE>-<SS|SH>-` PREFIX (the slice 27/28
-- concern: producer + normalize must agree on the SS/SH-prefixed shape). The
-- suffix is a free-form district identifier that is legitimately alphanumeric:
-- numeric (CA-SS-15), at-large (WY-SS-AL), MA senate D-codes (MA-SS-D01), VT
-- county/ward codes (VT-SS-ADD, VT-SH-A-1, VT-SH-C10), MD/MN/ND/SD multi-member
-- subdistricts (MD-SH-1A, MN-SH-10A), and TIGER's "district not defined"
-- pseudo-area (XX-SS-ZZZ). So the suffix assertion is `[A-Z0-9-]+`, NOT a
-- numeric-only pattern — it still rejects genuine malformations (missing
-- prefix `CA-15`, empty suffix, embedded spaces like NH "Rockingham 5", or a
-- non-two-letter state code).

begin;
select plan(4);

-- 1. All state_senate codes match the TIGER prefix format
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_senate' and code !~ '^[A-Z]{2}-SS-[A-Z0-9-]+$' $$,
  ARRAY[0],
  'state_senate codes all match ^[A-Z]{2}-SS-[A-Z0-9-]+$'
);

-- 2. All state_house codes match the TIGER prefix format
select results_eq(
  $$ select count(*)::int from public.districts
     where tier = 'state_house' and code !~ '^[A-Z]{2}-SH-[A-Z0-9-]+$' $$,
  ARRAY[0],
  'state_house codes all match ^[A-Z]{2}-SH-[A-Z0-9-]+$'
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
