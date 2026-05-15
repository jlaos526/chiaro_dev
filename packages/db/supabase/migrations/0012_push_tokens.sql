-- Slice 3: push tokens table for future vote-alert notifications.
-- Self-managed: each user inserts/deletes their own tokens, so we keep the
-- default Supabase INSERT/DELETE grants and rely on the RLS WITH CHECK /
-- USING clauses to enforce auth.uid() = user_id. Compare to 0005/0006 which
-- gate writes to service_role and therefore revoke; here writes are first-class
-- so a blanket revoke would defeat the self-write policies.
-- See spec § Schema migrations → 0012_push_tokens.sql

create type public.push_platform as enum ('ios','android','web');

create table public.push_tokens (
  user_id    uuid                  not null references auth.users(id) on delete cascade,
  token      text                  not null,
  platform   public.push_platform  not null,
  created_at timestamptz           not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_self"
  on public.push_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "push_tokens_insert_self"
  on public.push_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "push_tokens_delete_self"
  on public.push_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);
