-- Slice 75 (audit C19): state_bill_subjects has only its (bill_id, subject)
-- PK, so subject-first lookups (the issue-positions evidence panel; the new
-- nested-embed filter in fetchOfficialStateVotesOnSubject) seq-scan the
-- fastest-growing state table. The federal twin got bill_subjects_subject_idx
-- in 0014; this mirrors it.
create index if not exists state_bill_subjects_subject_idx
  on public.state_bill_subjects (subject);
