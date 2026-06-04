# Slice 54 — You-vs-Rep Radar Overlay Design Spec

**Date:** 2026-06-04
**Branch:** `slice-54-you-vs-rep-radar`
**Status:** Approved (brainstorm) — pending spec review → writing-plans
**Tier:** Compressed Slice (~6 files)

## 1. Goal

Replace the rep-page radar overlay's single "alignment ring" with a **true two-polygon you-vs-rep comparison**: one polygon for the user's per-topic positions, one (dashed) for the rep's per-topic positions, so a user can see *where* they and the rep stand on each issue — not just an aggregate agreement magnitude. Deferred from slices 52 + 53.

## 2. Current state / why

- `IssueRadarChart` (`packages/officials-ui/src/issues/IssueRadarChart.tsx`) **already supports two polygons**: when `repValues?: (number|null)[]` is supplied it draws a dashed rep polygon under the filled user polygon (null → drawn as 0). No chart change needed.
- `IssueRadarOverlay` (`.../IssueRadarOverlay.tsx`) currently fakes a single ring: `userValues = axes.map(a => (a.alignmentPct ?? 0)/100)` (agreement magnitude, not the user's actual position) and never passes `repValues`.
- `get_rep_issue_alignment` (migration 0056) computes both raw inputs internally — `user_pos` from `user_issue_selections.position` and `rep_pos` from `rep_stance_score(...)` — but only returns the derived `alignmentPct`/`dot`. The two raw vectors are thrown away.

## 3. Approach (locked)

**Extend `get_rep_issue_alignment`** via a new migration (`create or replace function`) to add per-axis `userPos` + `repPos` (0–100, each nullable, computed independently). Additive + backward-compatible: `overallPct`/`alignmentPct`/`dot` stay byte-identical, so the alignment strip + dots are unaffected. The RPC's `Returns` is `Json` (opaque), so `packages/db/src/types.ts` does **not** drift (no Gotcha #30 regen).

## 4. Data model

### 4.1 Migration `0059_rep_alignment_positions.sql`
`create or replace function public.get_rep_issue_alignment(p_official_id uuid)` — same signature (privileges preserved by `create or replace`; no re-grant needed). The per-topic loop additionally computes two **independent, importance-weighted, null-excluded** means and adds them to each axis:

- **`userPos`** = importance-weighted mean of the topic's selected stance `user_issue_selections.position`, over rows where `position is not null`; `null` if none.
- **`repPos`** = importance-weighted mean of the topic's stance `rep_stance_score(official_id, measurement_sources)`, over lenses where the score is not null; `null` if none.

Independent (not gated on each other) so each polygon reflects that side's positions on the user's selected topics: a topic the user skipped → `userPos` null (user dips to center); a topic the rep has no record on → `repPos` null (rep dips to center).

Full redefinition (the only change vs 0056 is: compute `rep_stance_score` once in the lateral instead of twice, and add the 4 sum-accumulators + 2 output fields):
```sql
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
```
> Behavioral parity for the existing fields: `overallPct`/`alignmentPct`/`dot` are computed identically to 0056 (the `agree` logic is unchanged — just refactored to reuse the single `rep_stance_score` call). The existing `get_rep_issue_alignment.test.sql` asserts must still pass.

### 4.2 Types — `packages/issues/src/types.ts`
`AlignmentAxis` gains two fields:
```ts
export interface AlignmentAxis {
  topicSlug: string; label: string; alignmentPct: number | null; dot: AlignmentDot
  userPos: number | null; repPos: number | null
}
```

## 5. UI — `IssueRadarOverlay` rewrite

- `userValues = alignment.axes.map(a => (a.userPos ?? 0) / 100)` (was `alignmentPct`).
- `repValues = alignment.axes.map(a => a.repPos == null ? null : a.repPos / 100)` (was always `undefined`). Always pass it now (it's a real `(number|null)[]`).
- Chart unchanged — it draws the dashed rep polygon + filled user polygon.
- **Caption** → `Your positions vs ${repName}` (or `Your positions vs this rep` when `repName` absent).
- **Legend** → replace "Fuller shape = more aligned." with a two-row key using the radar colors (from `useRadarColors()`): **▰ You** (filled, `userStroke`/`userFill`) and **▱ `${repName ?? 'Rep'}`** (dashed, `repStroke`). Small swatch + label per row; brand-tokened, no inline hex.
- a11y: keep the `accessibilityLabel="Issue alignment radar"` (or update to "You vs rep issue radar").
- `RepAlignmentSection` needs **no change** — it already passes the `alignment` object through; the overlay reads the new fields.

**NULL handling:** a null `userPos`/`repPos` → `?? 0` / `null` → the chart draws that axis at center ("no record here"). This is the existing chart behavior; documented, no special-casing.

## 6. Tests
- **pgTAP** (`get_rep_issue_alignment.test.sql`, extend): keep the existing asserts; add (a) `axes->0->>'userPos'` equals the seeded user position (e.g. 90), (b) `axes->0->>'repPos'` equals the rep's stance score (e.g. 80), (c) a topic where the rep has no scorecard/vote data → `repPos` is null. Bump `plan(N)`.
- **vitest** (`IssueRadarOverlay.test.tsx`, new or extend): render with axes carrying `userPos`/`repPos` and assert (a) two `<polygon>` shapes for the data rings (grid + user + rep ≥ 3 polygons total), (b) the "You" + rep legend rows render, (c) a null `repPos` axis still renders without throwing.

## 7. Scope
**In:** migration 0059 (`create or replace` the fn) + pgTAP extension + `AlignmentAxis` type + `IssueRadarOverlay` rewrite + overlay test.
**Out:** `IssueRadarChart` (already supports two polygons), the alignment strip + dots (keep `alignmentPct`), the step-5 `IssueRadarResultScreen` (user's own radar, separate), the home `MyIssuesCard` preview, `RepAlignmentSection`. No new tables; no `types.ts` (Database) regen.

## 8. Verification (Gotcha #30 — merge via green PR CI)
`pnpm -r typecheck` · `pnpm db:reset && pnpm seed:tiger && pnpm db:test` (incl. extended pgTAP) · `pnpm test` · `pnpm --filter @chiaro/web build` + `test` · `pnpm --filter @chiaro/mobile test`. Ship via PR with all 4 CI jobs green. (Note: `seed:tiger` is the recurring CI flake point — Census-server outages can block the db job; retry, or admin-merge only if the red check is a provable unrelated external outage.)

## 9. Open items for the plan to reconcile against live code
1. The exact current `get_rep_issue_alignment` body in migration 0056 (confirm the refactor is behavior-preserving for `alignmentPct`/`dot`/`overallPct`).
2. The `IssueRadarOverlay` test file — confirm whether one already exists (extend) or create new; mirror the `IssueRadarChart.test.tsx` / `BrandModeOverrideContext` wrapper pattern.
3. `useRadarColors()` returns `{ grid, userFill, userStroke, repStroke }` — confirm the keys for the legend swatches.
