-- RLS for state_votes + state_vote_positions. Read = authenticated;
-- write = service_role only. Mirrors federal slice-4 0017 pattern.

alter table public.state_votes           enable row level security;
alter table public.state_vote_positions  enable row level security;

create policy state_votes_select on public.state_votes
  for select to authenticated using (true);
create policy state_vote_positions_select on public.state_vote_positions
  for select to authenticated using (true);

revoke insert, update, delete on public.state_votes           from anon, authenticated;
revoke insert, update, delete on public.state_vote_positions  from anon, authenticated;
