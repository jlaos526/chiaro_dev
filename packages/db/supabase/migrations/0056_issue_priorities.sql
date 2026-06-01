-- Slice 52 — issue priorities catalog + user selections.
-- Functions are appended below the tables by later tasks (save + scoring).

create table public.issue_topics (
  slug          text primary key,
  display_name  text not null,
  description   text not null,
  value_tags    text[] not null default '{}',
  display_order int  not null default 0,
  active        boolean not null default true
);

create table public.issue_lenses (
  topic_slug          text not null references public.issue_topics(slug) on delete cascade,
  slug                text not null,
  label               text not null,
  lens_type           text not null check (lens_type in ('stance','watchlist')),
  description         text,
  measurement_sources jsonb not null default '[]'::jsonb,
  evidence_sources    jsonb not null default '[]'::jsonb,
  quiz_questions      jsonb not null default '[]'::jsonb,
  display_order       int  not null default 0,
  active              boolean not null default true,
  primary key (topic_slug, slug)
);

create table public.user_issue_selections (
  user_id       uuid not null references auth.users(id) on delete cascade,
  topic_slug    text not null references public.issue_topics(slug) on delete cascade,
  lens_slug     text not null,
  display_order int  not null default 0,
  position      numeric(5,2),
  importance    smallint not null default 1,
  selected_at   timestamptz not null default now(),
  foreign key (topic_slug, lens_slug)
    references public.issue_lenses(topic_slug, slug) on delete cascade,
  primary key (user_id, topic_slug, lens_slug)
);

create index user_issue_selections_user_idx on public.user_issue_selections (user_id);

-- Atomic replace of the caller's selections (mirrors apply_calibration).
create function public.save_user_issue_selections(p_selections jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from user_issue_selections where user_id = auth.uid();
  insert into user_issue_selections (user_id, topic_slug, lens_slug, display_order, position, importance)
  select auth.uid(), x.topic_slug, x.lens_slug,
         coalesce(x.display_order, 0), x.position, coalesce(x.importance, 1)
  from jsonb_to_recordset(p_selections) as x(
    topic_slug text, lens_slug text, display_order int, position numeric, importance smallint);
end;
$$;

grant execute on function public.save_user_issue_selections(jsonb) to authenticated;
