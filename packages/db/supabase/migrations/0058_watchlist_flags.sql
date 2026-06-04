-- Slice 53 — watchlist evidence. On-the-fly per-rep flags for the caller's
-- selected watchlist lenses (mirrors slice 52 get_rep_issue_alignment).
-- No new tables: reads issue_lenses.evidence_sources (0056) + finance data (0020).

create function public.get_rep_watchlist_flags(p_official_id uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  flags jsonb := '[]'::jsonb;
  rec record; src jsonb; cfg jsonb; ev jsonb; total numeric;
begin
  if uid is null then return '[]'::jsonb; end if;
  for rec in
    select t.slug as topic_slug, l.slug as lens_slug, l.label as label, l.evidence_sources as sources
    from user_issue_selections s
      join issue_lenses l on l.topic_slug = s.topic_slug and l.slug = s.lens_slug
      join issue_topics  t on t.slug = s.topic_slug
    where s.user_id = uid and l.lens_type = 'watchlist' and l.active
    order by t.display_order, l.display_order
  loop
    for src in select * from jsonb_array_elements(coalesce(rec.sources, '[]'::jsonb)) loop
      if src->>'type' = 'finance-industry' then
        cfg := src->'config';
        -- v1 cycle selection: max(cycle) is lexical text order — fine for 4-digit
        -- cycles ('2024' > '2022'); known limitation for non-4-digit cycle formats.
        select coalesce(jsonb_agg(jsonb_build_object('industry', m.industry, 'amount', m.amount) order by m.amount desc), '[]'::jsonb),
               coalesce(sum(m.amount), 0)
          into ev, total
        from (
          select fit.industry, fit.amount
          from finance_industry_top fit
            join finance_summaries fs on fs.id = fit.finance_summary_id
          where fs.official_id = p_official_id
            and fs.cycle = (select max(cycle) from finance_summaries where official_id = p_official_id)
            and fit.industry in (select jsonb_array_elements_text(cfg->'industries'))
        ) m;
        if jsonb_array_length(ev) > 0 and total >= coalesce((cfg->>'min_amount')::numeric, 0) then
          flags := flags || jsonb_build_object(
            'topicSlug', rec.topic_slug, 'lensSlug', rec.lens_slug, 'label', rec.label,
            'category', cfg->>'category', 'totalAmount', total, 'evidence', ev);
        end if;
      end if;
    end loop;
  end loop;
  return flags;
end;
$$;

grant execute on function public.get_rep_watchlist_flags(uuid) to authenticated;
