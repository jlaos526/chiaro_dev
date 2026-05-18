alter table public.votes          enable row level security;
alter table public.vote_positions enable row level security;

create policy votes_select_all          on public.votes          for select using (true);
create policy vote_positions_select_all on public.vote_positions for select using (true);

revoke insert, update, delete on public.votes          from anon, authenticated;
revoke insert, update, delete on public.vote_positions from anon, authenticated;
