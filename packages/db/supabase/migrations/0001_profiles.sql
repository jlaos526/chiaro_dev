-- citext for case-insensitive unique usernames
create extension if not exists citext;

create table public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  display_name  text                 check (display_name is null or char_length(display_name) between 1 and 50),
  username      citext      unique   check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  completed     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();
