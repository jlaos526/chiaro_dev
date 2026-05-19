-- Migration 0027: assert both audit-flagged indexes exist after migrate.

begin;
select plan(4);

select has_index(
  'public', 'official_metrics', 'official_metrics_home_district_idx',
  'partial FK index on official_metrics.home_district_id exists'
);

-- Verify partial-index predicate (WHERE home_district_id IS NOT NULL).
select is(
  (select pg_get_indexdef(c.oid) like '%WHERE (home_district_id IS NOT NULL)%'
   from pg_class c
   where c.relname = 'official_metrics_home_district_idx'),
  true,
  'official_metrics_home_district_idx is partial on home_district_id IS NOT NULL'
);

select has_index(
  'public', 'officials', 'officials_district_in_office_idx',
  'partial index on officials(district_id) where in_office exists'
);

-- Verify partial-index predicate (WHERE in_office).
select is(
  (select pg_get_indexdef(c.oid) like '%WHERE in_office%'
   from pg_class c
   where c.relname = 'officials_district_in_office_idx'),
  true,
  'officials_district_in_office_idx is partial on WHERE in_office'
);

select * from finish();
rollback;
