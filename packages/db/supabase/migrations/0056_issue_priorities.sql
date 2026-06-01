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

-- Composite rep position (0-100) for one stance's measurement_sources. NULL if no source has data.
create function public.rep_stance_score(p_official_id uuid, p_sources jsonb)
  returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  src jsonb; s_type text; s_weight numeric; cfg jsonb; s_val numeric;
  acc numeric := 0; tot_w numeric := 0;
begin
  for src in select * from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb)) loop
    s_type := src->>'type';
    s_weight := coalesce((src->>'weight')::numeric, 0);
    cfg := src->'config';
    s_val := null;
    if s_type = 'scorecard' then
      select avg(case when coalesce((cfg->>'invert')::boolean, false) then 100 - sc.score else sc.score end)
        into s_val
      from (
        select r.score from scorecard_ratings r
          join scorecard_orgs o on o.id = r.scorecard_id
         where r.official_id = p_official_id
           and o.slug in (select jsonb_array_elements_text(cfg->'orgs'))
        union all
        select sr.score from state_scorecard_ratings sr
          join state_scorecard_orgs so on so.id = sr.scorecard_id
         where sr.official_id = p_official_id
           and so.slug in (select jsonb_array_elements_text(cfg->'orgs'))
      ) sc;
    elsif s_type = 'bill-vote' then
      select case when count(*) = 0 then null
                  else 100.0 * sum(case when v.position = (cfg->>'agree_position') then 1 else 0 end) / count(*)
             end
        into s_val
      from (
        select vp.position::text from vote_positions vp
          join votes vt on vt.id = vp.vote_id
          join bill_subjects bs on bs.bill_id = vt.bill_id
         where vp.official_id = p_official_id
           and lower(bs.subject) in (select lower(x) from jsonb_array_elements_text(cfg->'subjects') x)
        union all
        select svp.position::text from state_vote_positions svp
          join state_votes sv on sv.id = svp.vote_id
          join state_bill_subjects sbs on sbs.bill_id = sv.bill_id
         where svp.official_id = p_official_id
           and lower(sbs.subject) in (select lower(x) from jsonb_array_elements_text(cfg->'subjects') x)
      ) v;
    end if;
    if s_val is not null then
      acc := acc + s_val * s_weight;
      tot_w := tot_w + s_weight;
    end if;
  end loop;
  if tot_w = 0 then return null; end if;
  return round(acc / tot_w, 2);
end;
$$;

-- Per-rep alignment for the calling user. Returns {overallPct, axes:[{topicSlug,label,alignmentPct,dot}]}.
create function public.get_rep_issue_alignment(p_official_id uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  axes jsonb := '[]'::jsonb;
  overall_num numeric := 0; overall_den numeric := 0;
  rec record; topic_align numeric; dot text;
begin
  if uid is null then return null; end if;
  for rec in
    select t.slug as topic_slug, t.display_name as label,
           sum(case when contrib.agree is not null then contrib.agree * s.importance else 0 end) as num,
           sum(case when contrib.agree is not null then s.importance else 0 end) as den
    from user_issue_selections s
      join issue_lenses l on l.topic_slug = s.topic_slug and l.slug = s.lens_slug
      join issue_topics  t on t.slug = s.topic_slug
      cross join lateral (
        select case
          when s.position is null then null
          when public.rep_stance_score(p_official_id, l.measurement_sources) is null then null
          else 100 - abs(s.position - public.rep_stance_score(p_official_id, l.measurement_sources))
        end as agree
      ) contrib
    where s.user_id = uid and l.lens_type = 'stance'
    group by t.slug, t.display_name, t.display_order
    order by t.display_order
  loop
    if rec.den > 0 then
      topic_align := round(rec.num / rec.den, 2);
      overall_num := overall_num + rec.num;
      overall_den := overall_den + rec.den;
    else
      topic_align := null;
    end if;
    dot := case
      when topic_align is null then 'none'
      when topic_align >= 67 then 'aligned'
      when topic_align >= 34 then 'partial'
      else 'differs' end;
    axes := axes || jsonb_build_object(
      'topicSlug', rec.topic_slug, 'label', rec.label, 'alignmentPct', topic_align, 'dot', dot);
  end loop;
  return jsonb_build_object(
    'overallPct', case when overall_den > 0 then round(overall_num / overall_den, 2) else null end,
    'axes', axes);
end;
$$;

grant execute on function public.rep_stance_score(uuid, jsonb) to authenticated, anon;
grant execute on function public.get_rep_issue_alignment(uuid) to authenticated;
