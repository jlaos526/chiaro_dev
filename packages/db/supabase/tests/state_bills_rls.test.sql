begin;
select plan(28);

-- Slice 75 (audit C19, migration 0064): subject-first lookups need an index —
-- the (bill_id, subject) PK can't serve them (mirrors federal 0014).
select has_index(
  'public', 'state_bill_subjects', 'state_bill_subjects_subject_idx',
  'state_bill_subjects has the subject-leading index (0064)'
);

-- ─── state_bills ───
select has_table('public', 'state_bills', 'state_bills table exists');
select has_column('public', 'state_bills', 'openstates_bill_id', 'openstates_bill_id col');
select has_column('public', 'state_bills', 'state',              'state col');
select has_column('public', 'state_bills', 'session',            'session col');
select has_column('public', 'state_bills', 'bill_type',          'bill_type col');
select has_column('public', 'state_bills', 'augmented_from',     'augmented_from augment col');
select has_column('public', 'state_bills', 'status_substage',    'status_substage augment col');
select has_column('public', 'state_bills', 'party_vote_split',   'party_vote_split augment col');
select col_type_is('public', 'state_bills', 'party_vote_split', 'jsonb',
  'party_vote_split is jsonb');

-- UNIQUE (state, session, bill_type, number)
select has_index('public', 'state_bills', 'state_bills_state_session_bill_type_number_key',
  'composite unique constraint exists');

-- Partial unique on openstates_bill_id
select has_index('public', 'state_bills', 'state_bills_openstates_bill_id_key',
  'openstates_bill_id unique index exists');

-- ─── state_bill_sponsors ───
select has_table('public', 'state_bill_sponsors', 'state_bill_sponsors exists');
select has_column('public', 'state_bill_sponsors', 'bill_id',     'bill_id col');
select has_column('public', 'state_bill_sponsors', 'official_id', 'official_id col');
select has_column('public', 'state_bill_sponsors', 'role',        'role col');
select has_check ('public', 'state_bill_sponsors', 'role CHECK exists');

-- FK ON DELETE RESTRICT for sponsors → officials (per slice-5C 0026 audit)
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_bill_sponsors_official_id_fkey'
     and conrelid = 'public.state_bill_sponsors'::regclass),
  'r',
  'state_bill_sponsors.official_id FK uses on-delete RESTRICT'
);

-- FK ON DELETE CASCADE for sponsors → state_bills
select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_bill_sponsors_bill_id_fkey'
     and conrelid = 'public.state_bill_sponsors'::regclass),
  'c',
  'state_bill_sponsors.bill_id FK uses on-delete CASCADE'
);

-- ─── state_bill_subjects ───
select has_table('public', 'state_bill_subjects', 'state_bill_subjects exists');
select has_column('public', 'state_bill_subjects', 'subject', 'subject col');

select is(
  (select confdeltype::text from pg_constraint
   where conname = 'state_bill_subjects_bill_id_fkey'
     and conrelid = 'public.state_bill_subjects'::regclass),
  'c',
  'state_bill_subjects.bill_id FK uses on-delete CASCADE'
);

-- ─── RLS enabled on all 3 ───
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_bills'::regclass),
  true,
  'state_bills RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_bill_sponsors'::regclass),
  true,
  'state_bill_sponsors RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.state_bill_subjects'::regclass),
  true,
  'state_bill_subjects RLS enabled'
);

-- ─── SELECT policy exists for authenticated ───
select policy_roles_are('public', 'state_bills', 'state_bills_select',
  array['authenticated'],
  'state_bills_select policy is for authenticated');
select policy_roles_are('public', 'state_bill_sponsors', 'state_bill_sponsors_select',
  array['authenticated'],
  'state_bill_sponsors_select policy is for authenticated');
select policy_roles_are('public', 'state_bill_subjects', 'state_bill_subjects_select',
  array['authenticated'],
  'state_bill_subjects_select policy is for authenticated');

select * from finish();
rollback;
