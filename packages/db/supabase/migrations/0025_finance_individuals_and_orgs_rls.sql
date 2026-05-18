-- Public-read RLS for the two new finance child tables (mirrors 0021_finance_rls.sql
-- which gates finance_summaries / finance_industry_top / finance_pac_contributions).

alter table public.finance_individual_donors  enable row level security;
alter table public.finance_top_organizations  enable row level security;

create policy finance_individual_donors_select_all on public.finance_individual_donors  for select using (true);
create policy finance_top_organizations_select_all on public.finance_top_organizations  for select using (true);

revoke insert, update, delete on public.finance_individual_donors from anon, authenticated;
revoke insert, update, delete on public.finance_top_organizations from anon, authenticated;
