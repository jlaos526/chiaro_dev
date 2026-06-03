begin;
select plan(14);

select has_table('public', 'issue_topics', 'issue_topics exists');
select has_table('public', 'issue_lenses', 'issue_lenses exists');
select has_table('public', 'user_issue_selections', 'user_issue_selections exists');

select col_is_pk('public', 'issue_topics', 'slug', 'issue_topics PK is slug');
select has_column('public', 'issue_topics', 'value_tags', 'topics has value_tags');

select col_is_pk('public', 'issue_lenses', array['topic_slug','slug'], 'lenses PK is (topic_slug, slug)');
select has_column('public', 'issue_lenses', 'measurement_sources', 'lenses has measurement_sources');
select has_column('public', 'issue_lenses', 'quiz_questions', 'lenses has quiz_questions');
select col_has_check('public', 'issue_lenses', 'lens_type', 'lens_type is checked');

select col_is_pk('public', 'user_issue_selections', array['user_id','topic_slug','lens_slug'], 'selections PK');
select has_column('public', 'user_issue_selections', 'position', 'selections has position');
select has_column('public', 'user_issue_selections', 'importance', 'selections has importance');

select fk_ok('public','user_issue_selections',array['topic_slug','lens_slug'],
             'public','issue_lenses',array['topic_slug','slug'],
             'selection composite FK to lens');
select col_is_fk('public', 'user_issue_selections', 'user_id', 'user_id is FK');

select * from finish();
rollback;
