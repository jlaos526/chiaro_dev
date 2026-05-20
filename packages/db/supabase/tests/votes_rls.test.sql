begin;

select plan(14);

select has_enum('public', 'vote_position', 'vote_position enum exists');
select enum_has_labels(
  'public', 'vote_position',
  array['yes','no','present','not_voting']::text[],
  'vote_position labels correct'
);

select has_table('public', 'votes', 'votes table exists');
select has_column('public', 'votes', 'source_url', 'source_url col');
select col_is_unique('public', 'votes', array['congress','chamber','session','roll_call'],
                     'votes unique on (congress, chamber, session, roll_call)');

select has_table('public', 'vote_positions', 'vote_positions table exists');
select col_is_pk('public', 'vote_positions', array['vote_id','official_id'],
                  'vote_positions composite PK');
select has_column('public', 'vote_positions', 'position', 'position col');

select has_index('public', 'votes', 'votes_bill_idx', 'votes_bill_idx exists');
select has_index('public', 'vote_positions', 'vote_positions_official_idx',
                  'vote_positions_official_idx exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.votes'::regclass),
  'votes has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.vote_positions'::regclass),
  'vote_positions has RLS enabled'
);

set local role anon;
select throws_ok(
  $$ insert into public.votes (congress, chamber, session, roll_call, vote_date, question, result, source_url)
     values ('119','federal_house',1,1,'2026-01-01','test','Failed','https://example.gov/v1') $$,
  '42501', null,
  'anon cannot INSERT into votes'
);
reset role;

set local role service_role;
select lives_ok(
  $$ insert into public.votes (congress, chamber, session, roll_call, vote_date, question, result, source_url)
     values ('119','federal_house',1,1,'2026-01-01','test','Failed','https://example.gov/v1') $$,
  'service_role can INSERT into votes'
);
reset role;

select * from finish();
rollback;
