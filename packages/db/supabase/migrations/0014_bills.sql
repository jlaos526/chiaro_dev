-- Slice 4: bills + bill_subjects + bill_sponsors junctions.
-- See spec § Schema migrations → 0014_bills.sql

create type public.bill_type as enum (
  'hr','s','hjres','sjres','hconres','sconres','hres','sres'
);

create type public.bill_status as enum (
  'introduced','in_committee','reported','passed_chamber',
  'passed_both','enrolled','signed','vetoed','became_law','died'
);

create table public.bills (
  id               uuid primary key default gen_random_uuid(),
  congress         text not null,
  bill_type        public.bill_type not null,
  number           int  not null,
  title            text not null,
  short_title      text,
  policy_area      text,
  status           public.bill_status not null,
  introduced_date  date not null,
  latest_action    text,
  source_url       text not null,
  congress_gov_url text,
  ingested_at      timestamptz not null default now(),
  unique (congress, bill_type, number)
);

create table public.bill_subjects (
  bill_id uuid not null references public.bills(id) on delete cascade,
  subject text not null,
  primary key (bill_id, subject)
);

create table public.bill_sponsors (
  bill_id     uuid not null references public.bills(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete restrict,
  role        text not null check (role in ('sponsor','cosponsor')),
  added_date  date,
  primary key (bill_id, official_id, role)
);

create index bills_congress_idx         on public.bills(congress);
create index bills_policy_area_idx      on public.bills(policy_area);
create index bill_subjects_subject_idx  on public.bill_subjects(subject);
create index bill_sponsors_official_idx on public.bill_sponsors(official_id, role);
