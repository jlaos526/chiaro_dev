alter table public.districts enable row level security;

create policy "districts_select_all"
  on public.districts
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.districts from anon, authenticated;
