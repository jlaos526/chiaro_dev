alter table public.finance_summaries         enable row level security;
alter table public.finance_industry_top      enable row level security;
alter table public.finance_pac_contributions enable row level security;

create policy finance_summaries_select_all         on public.finance_summaries         for select using (true);
create policy finance_industry_top_select_all      on public.finance_industry_top      for select using (true);
create policy finance_pac_contributions_select_all on public.finance_pac_contributions for select using (true);

revoke insert, update, delete on public.finance_summaries         from anon, authenticated;
revoke insert, update, delete on public.finance_industry_top      from anon, authenticated;
revoke insert, update, delete on public.finance_pac_contributions from anon, authenticated;
