begin;

select plan(14);

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

select * from finish();
rollback;
