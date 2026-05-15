begin;

select plan(18);

-- 1. official_chamber enum exists
select has_enum('public', 'official_chamber', 'official_chamber enum exists');
select enum_has_labels(
  'public', 'official_chamber',
  array['house','senate']::text[],
  'official_chamber has correct labels'
);

-- 2. officials table exists with expected columns
select has_table('public', 'officials', 'officials table exists');
select has_column('public', 'officials', 'bioguide_id', 'bioguide_id column present');
select col_is_unique('public', 'officials', 'bioguide_id', 'bioguide_id is unique');
select has_column('public', 'officials', 'chamber', 'chamber column present');
select has_column('public', 'officials', 'district_id', 'district_id column present');
select col_is_fk('public', 'officials', 'district_id', 'district_id is a FK');

-- 3. constraints
select col_has_check('public', 'officials', 'party', 'party has check constraint');
select col_has_check('public', 'officials', 'state', 'state has length check');
select col_has_check('public', 'officials', 'senate_class', 'senate_class has check');

-- 4. indexes
select has_index('public', 'officials', 'officials_district_idx',
                  'officials_district_idx exists');

-- 5. storage bucket provisioned
select ok(
  exists (select 1 from storage.buckets where id = 'officials-portraits' and public = true),
  'officials-portraits bucket exists and is public'
);

-- 6. updated_at trigger wired
select trigger_is(
  'public', 'officials', 'officials_touch_updated_at',
  'public', 'touch_updated_at',
  'officials_touch_updated_at trigger present'
);

-- 7. column inventory + types (locks the schema shape)
select columns_are(
  'public', 'officials',
  array[
    'id','bioguide_id','first_name','last_name','full_name','chamber','party',
    'state','district_id','senate_class','portrait_url','official_url',
    'twitter_handle','next_election','in_office','source_version',
    'created_at','updated_at'
  ]::name[],
  'officials has the expected 18 columns'
);
select col_type_is(
  'public', 'officials', 'chamber', 'official_chamber',
  'chamber column is bound to the official_chamber enum'
);

-- 8. partial index officials_state_chamber_idx exists
select has_index(
  'public', 'officials', 'officials_state_chamber_idx',
  'officials_state_chamber_idx exists'
);

-- 9. named cross-column constraint senate_class_matches_chamber exists
select ok(
  exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'officials'
      and c.conname = 'senate_class_matches_chamber'
      and c.contype = 'c'
  ),
  'senate_class_matches_chamber named constraint present'
);

select * from finish();
rollback;
