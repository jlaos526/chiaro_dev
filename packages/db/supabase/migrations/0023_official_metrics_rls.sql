alter table public.official_metrics             enable row level security;
alter table public.district_offices             enable row level security;
alter table public.town_halls                   enable row level security;
alter table public.stock_transactions           enable row level security;
alter table public.officials_leadership_history enable row level security;

create policy official_metrics_select_all              on public.official_metrics             for select using (true);
create policy district_offices_select_all              on public.district_offices             for select using (true);
create policy town_halls_select_all                    on public.town_halls                   for select using (true);
create policy stock_transactions_select_all            on public.stock_transactions           for select using (true);
create policy officials_leadership_history_select_all  on public.officials_leadership_history for select using (true);

revoke insert, update, delete on public.official_metrics             from anon, authenticated;
revoke insert, update, delete on public.district_offices             from anon, authenticated;
revoke insert, update, delete on public.town_halls                   from anon, authenticated;
revoke insert, update, delete on public.stock_transactions           from anon, authenticated;
revoke insert, update, delete on public.officials_leadership_history from anon, authenticated;
