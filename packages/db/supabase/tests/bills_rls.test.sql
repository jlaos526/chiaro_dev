begin;

select plan(16);

-- 1. enums
select has_enum('public', 'bill_type', 'bill_type enum exists');
select enum_has_labels(
  'public', 'bill_type',
  array['hr','s','hjres','sjres','hconres','sconres','hres','sres']::text[],
  'bill_type labels correct'
);
select has_enum('public', 'bill_status', 'bill_status enum exists');

-- 2. bills table
select has_table('public', 'bills', 'bills table exists');
select has_column('public', 'bills', 'congress', 'congress col');
select has_column('public', 'bills', 'bill_type', 'bill_type col');
select has_column('public', 'bills', 'source_url', 'source_url col present (drill-down anchor)');
select col_not_null('public', 'bills', 'source_url', 'source_url is not null');

-- 3. bill_subjects junction
select has_table('public', 'bill_subjects', 'bill_subjects table exists');
select col_is_pk('public', 'bill_subjects', array['bill_id','subject'],
                  'bill_subjects composite PK');

-- 4. bill_sponsors junction
select has_table('public', 'bill_sponsors', 'bill_sponsors table exists');
select col_is_pk('public', 'bill_sponsors', array['bill_id','official_id','role'],
                  'bill_sponsors composite PK');
select col_has_check('public', 'bill_sponsors', 'role',
                     'role has check constraint (sponsor/cosponsor)');

-- 5. indexes
select has_index('public', 'bills', 'bills_congress_idx', 'bills_congress_idx exists');
select has_index('public', 'bill_subjects', 'bill_subjects_subject_idx',
                  'bill_subjects_subject_idx exists');
select has_index('public', 'bill_sponsors', 'bill_sponsors_official_idx',
                  'bill_sponsors_official_idx exists');

select * from finish();
rollback;
