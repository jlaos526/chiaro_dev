alter table public.scorecard_orgs    enable row level security;
alter table public.scorecard_ratings enable row level security;

create policy scorecard_orgs_select_all    on public.scorecard_orgs    for select using (true);
create policy scorecard_ratings_select_all on public.scorecard_ratings for select using (true);

revoke insert, update, delete on public.scorecard_orgs    from anon, authenticated;
revoke insert, update, delete on public.scorecard_ratings from anon, authenticated;
