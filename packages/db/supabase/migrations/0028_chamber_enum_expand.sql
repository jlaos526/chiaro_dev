-- Sub-slice 5C: expand public.official_chamber enum from 2 values to 5.
-- New values support state-level legislators (state_house, state_senate, plus
-- state_legislature for Nebraska's unicameral). Federal rows backfill via
-- CASE: 'house' → 'federal_house', 'senate' → 'federal_senate'.
--
-- Postgres can't drop enum values, so we swap: create v2, ALTER COLUMN ...
-- USING CASE, drop v1, rename. The whole swap runs inside one transaction;
-- failure rolls back atomically.
--
-- The senate_class_matches_chamber check constraint (added in 0009) references
-- the chamber column, so we drop it before the ALTER COLUMN swap and recreate
-- it afterwards with updated literal values. The state_* values are allowed to
-- have null senate_class (state chambers don't have senate classes).

alter table public.officials drop constraint senate_class_matches_chamber;

create type public.official_chamber_v2 as enum (
  'federal_house',
  'federal_senate',
  'state_house',
  'state_senate',
  'state_legislature'
);

alter table public.officials
  alter column chamber type public.official_chamber_v2
  using (case chamber::text
    when 'house'  then 'federal_house'::public.official_chamber_v2
    when 'senate' then 'federal_senate'::public.official_chamber_v2
  end);

alter table public.officials_leadership_history
  alter column chamber type public.official_chamber_v2
  using (case chamber::text
    when 'house'  then 'federal_house'::public.official_chamber_v2
    when 'senate' then 'federal_senate'::public.official_chamber_v2
  end);

alter table public.votes
  alter column chamber type public.official_chamber_v2
  using (case chamber::text
    when 'house'  then 'federal_house'::public.official_chamber_v2
    when 'senate' then 'federal_senate'::public.official_chamber_v2
  end);

drop type public.official_chamber;
alter type public.official_chamber_v2 rename to official_chamber;

alter table public.officials add constraint senate_class_matches_chamber
  check ((chamber = 'federal_senate' and senate_class is not null)
      or (chamber = 'federal_house'  and senate_class is null)
      or (chamber in ('state_house', 'state_senate', 'state_legislature')
            and senate_class is null));
