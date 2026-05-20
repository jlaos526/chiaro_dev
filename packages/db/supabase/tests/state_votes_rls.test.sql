begin;
select plan(20);

-- ─── state_votes ───
select has_table('public', 'state_votes', 'state_votes table exists');
select has_column('public', 'state_votes', 'openstates_vote_id', 'openstates_vote_id col');
select has_column('public', 'state_votes', 'bill_id',            'bill_id col');
select has_column('public', 'state_votes', 'chamber',            'chamber col');
select has_column('public', 'state_votes', 'party_vote_split',   'party_vote_split jsonb');
select col_type_is('public', 'state_votes', 'party_vote_split', 'jsonb',
  'party_vote_split is jsonb');

-- FK ON DELETE RESTRICT for bill_id
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_votes_bill_id_fkey'
     and conrelid = 'public.state_votes'::regclass),
  'r',
  'state_votes.bill_id FK uses on-delete RESTRICT'
);

-- chamber CHECK constraint
select has_check('public', 'state_votes', 'chamber CHECK exists');

-- ─── state_vote_positions ───
select has_table('public', 'state_vote_positions', 'state_vote_positions exists');
select has_column('public', 'state_vote_positions', 'vote_id',     'vote_id col');
select has_column('public', 'state_vote_positions', 'official_id', 'official_id col');
select has_column('public', 'state_vote_positions', 'position',    'position col');
select has_check ('public', 'state_vote_positions', 'position CHECK exists');

-- FK ON DELETE CASCADE for vote_id
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_vote_positions_vote_id_fkey'
     and conrelid = 'public.state_vote_positions'::regclass),
  'c',
  'state_vote_positions.vote_id FK uses on-delete CASCADE'
);

-- FK ON DELETE RESTRICT for official_id (per slice-5C 0026 audit)
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_vote_positions_official_id_fkey'
     and conrelid = 'public.state_vote_positions'::regclass),
  'r',
  'state_vote_positions.official_id FK uses on-delete RESTRICT'
);

-- UNIQUE (vote_id, official_id)
select has_index('public', 'state_vote_positions',
  'state_vote_positions_vote_id_official_id_key',
  'unique (vote_id, official_id) index exists');

-- ─── RLS ───
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_votes'::regclass),
  true,
  'state_votes RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_vote_positions'::regclass),
  true,
  'state_vote_positions RLS enabled'
);

select policy_roles_are('public', 'state_votes', 'state_votes_select',
  array['authenticated'],
  'state_votes_select policy is for authenticated');
select policy_roles_are('public', 'state_vote_positions', 'state_vote_positions_select',
  array['authenticated'],
  'state_vote_positions_select policy is for authenticated');

select * from finish();
rollback;
