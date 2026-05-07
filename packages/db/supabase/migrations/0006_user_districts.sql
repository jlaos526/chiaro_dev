create table public.user_districts (
  user_id      uuid                      not null references auth.users(id)        on delete cascade,
  district_id  uuid                      not null references public.districts(id)  on delete cascade,
  tier         public.district_tier      not null,
  created_at   timestamptz               not null default now(),
  primary key (user_id, district_id)
);

create index user_districts_district on public.user_districts (district_id);
create index user_districts_tier on public.user_districts (tier);

alter table public.user_districts enable row level security;

create policy "user_districts_select_all"
  on public.user_districts
  for select
  to authenticated using (true);

revoke insert, update, delete on public.user_districts from anon, authenticated;
