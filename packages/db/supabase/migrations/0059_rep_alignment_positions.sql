-- Slice 54 — you-vs-rep radar. Extend get_rep_issue_alignment to return per-axis
-- userPos + repPos (0-100, each nullable, independent importance-weighted means)
-- for the two-polygon overlay. overallPct / alignmentPct / dot are unchanged.
-- Privileges are preserved by create-or-replace; no re-grant needed.

create or replace function public.get_rep_issue_alignment(p_official_id uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  axes jsonb := '[]'::jsonb;
  overall_num numeric := 0; overall_den numeric := 0;
  rec record; topic_align numeric; dot text; user_pos numeric; rep_pos numeric;
begin
  if uid is null then return null; end if;
  for rec in
    select t.slug as topic_slug, t.display_name as label,
           sum(case when contrib.agree is not null then contrib.agree * s.importance else 0 end) as num,
           sum(case when contrib.agree is not null then s.importance else 0 end) as den,
           sum(case when s.position is not null then s.position * s.importance else 0 end) as user_num,
           sum(case when s.position is not null then s.importance else 0 end) as user_den,
           sum(case when contrib.rep_pos is not null then contrib.rep_pos * s.importance else 0 end) as rep_num,
           sum(case when contrib.rep_pos is not null then s.importance else 0 end) as rep_den
    from user_issue_selections s
      join issue_lenses l on l.topic_slug = s.topic_slug and l.slug = s.lens_slug
      join issue_topics  t on t.slug = s.topic_slug
      cross join lateral (
        select rs.rep_pos,
          case
            when s.position is null then null
            when rs.rep_pos is null then null
            else 100 - abs(s.position - rs.rep_pos)
          end as agree
        from (select public.rep_stance_score(p_official_id, l.measurement_sources) as rep_pos) rs
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
    user_pos := case when rec.user_den > 0 then round(rec.user_num / rec.user_den, 2) else null end;
    rep_pos  := case when rec.rep_den  > 0 then round(rec.rep_num  / rec.rep_den, 2)  else null end;
    axes := axes || jsonb_build_object(
      'topicSlug', rec.topic_slug, 'label', rec.label,
      'alignmentPct', topic_align, 'dot', dot,
      'userPos', user_pos, 'repPos', rep_pos);
  end loop;
  return jsonb_build_object(
    'overallPct', case when overall_den > 0 then round(overall_num / overall_den, 2) else null end,
    'axes', axes);
end;
$$;
