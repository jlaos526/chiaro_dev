begin;

select plan(10);

select has_table('public', 'scorecard_orgs',    'scorecard_orgs table exists');
select has_column('public', 'scorecard_orgs', 'methodology_url',
                  'methodology_url col (drill-down anchor)');
select col_is_unique('public', 'scorecard_orgs', 'slug', 'slug is unique');
select col_has_check('public', 'scorecard_orgs', 'lean',
                     'lean has check constraint');

select has_table('public', 'scorecard_ratings', 'scorecard_ratings table exists');
select has_column('public', 'scorecard_ratings', 'source_url',
                  'source_url col (drill-down anchor)');
select col_is_unique('public', 'scorecard_ratings',
                     array['scorecard_id','official_id','congress'],
                     'unique on (scorecard_id, official_id, congress)');

select col_is_fk('public', 'scorecard_ratings', 'scorecard_id',
                  'scorecard_id is FK');
select col_is_fk('public', 'scorecard_ratings', 'official_id',
                  'official_id is FK');

select has_index('public', 'scorecard_ratings', 'scorecard_ratings_official_idx',
                  'scorecard_ratings_official_idx exists');

select * from finish();
rollback;
