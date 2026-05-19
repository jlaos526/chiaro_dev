-- Migration 0026: assert that all 5 FKs from 0022 child tables to
-- public.officials(id) use on-delete RESTRICT (confdeltype = 'r'),
-- not CASCADE (confdeltype = 'c').
--
-- pg_constraint.confdeltype legend:
--   'a' = no action  'r' = restrict  'c' = cascade  'n' = set null  'd' = set default

begin;
select plan(5);

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'official_metrics_official_id_fkey'
     and conrelid = 'public.official_metrics'::regclass),
  'r',
  'official_metrics.official_id FK to officials uses on-delete restrict'
);

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'district_offices_official_id_fkey'
     and conrelid = 'public.district_offices'::regclass),
  'r',
  'district_offices.official_id FK to officials uses on-delete restrict'
);

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'town_halls_official_id_fkey'
     and conrelid = 'public.town_halls'::regclass),
  'r',
  'town_halls.official_id FK to officials uses on-delete restrict'
);

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'stock_transactions_official_id_fkey'
     and conrelid = 'public.stock_transactions'::regclass),
  'r',
  'stock_transactions.official_id FK to officials uses on-delete restrict'
);

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'officials_leadership_history_official_id_fkey'
     and conrelid = 'public.officials_leadership_history'::regclass),
  'r',
  'officials_leadership_history.official_id FK to officials uses on-delete restrict'
);

select * from finish();
rollback;
