begin;

select plan(7);

select has_table('public', 'officials_ingest_runs', 'audit table exists');
select has_column('public', 'officials_ingest_runs', 'status', 'status column present');
select col_has_check('public', 'officials_ingest_runs', 'status',
                     'status has check constraint');
select has_index('public', 'officials_ingest_runs', 'officials_ingest_runs_started_idx',
                  'started_at index exists');
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.officials_ingest_runs'::regclass),
  'officials_ingest_runs has RLS enabled'
);

-- Service role can insert
set local role service_role;
select lives_ok(
  $$ insert into public.officials_ingest_runs (congress, source, status)
     values ('119', 'congress.gov.v3', 'completed') $$,
  'service_role can INSERT into audit table'
);
reset role;

-- anon has no access (SELECT revoked + RLS enabled with no policies)
set local role anon;
select throws_ok(
  $$ select count(*) from public.officials_ingest_runs $$,
  '42501',
  'permission denied for table officials_ingest_runs',
  'anon cannot read (SELECT revoked, no policy)'
);
reset role;

select * from finish();
rollback;
