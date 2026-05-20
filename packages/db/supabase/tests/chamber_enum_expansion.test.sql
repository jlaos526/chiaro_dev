begin;
select plan(8);

-- Enum type exists with the new name post-rename.
select has_type('public', 'official_chamber', 'official_chamber enum exists');

-- The 5 new enum values are all present (alphabetical via order by 1).
select results_eq(
  $$select unnest(enum_range(null::public.official_chamber))::text order by 1$$,
  $$values ('federal_house'), ('federal_senate'), ('state_house'), ('state_legislature'), ('state_senate')$$,
  'official_chamber has exactly the 5 expected values, alphabetical'
);

-- Old values are gone. (Note: pgTAP's isnt_member_of tests role membership,
-- not enum labels, so we assert against pg_enum directly. Assertion 7 below
-- gives the same guarantee via pg_enum count; this is an explicit existence
-- check kept for symmetry with the named assertion in the spec.)
select is_empty(
  $$select enumlabel from pg_enum
    where enumtypid = 'public.official_chamber'::regtype
      and enumlabel in ('house', 'senate')$$,
  'legacy house/senate values dropped from enum'
);

-- All 3 column references survived the ALTER COLUMN.
select col_type_is('public', 'officials',                       'chamber', 'public.official_chamber',
  'officials.chamber type preserved');
select col_type_is('public', 'officials_leadership_history',    'chamber', 'public.official_chamber',
  'officials_leadership_history.chamber type preserved');
select col_type_is('public', 'votes',                            'chamber', 'public.official_chamber',
  'votes.chamber type preserved');

select is(
  (select count(*) from pg_enum
   where enumtypid = 'public.official_chamber'::regtype
     and enumlabel in ('house', 'senate'))::int,
  0,
  'no legacy enum values remain in pg_enum'
);

select is(
  (select count(*) from pg_enum
   where enumtypid = 'public.official_chamber'::regtype
     and enumlabel in ('federal_house','federal_senate','state_house','state_senate','state_legislature'))::int,
  5,
  'all 5 new enum values present in pg_enum'
);

select * from finish();
rollback;
