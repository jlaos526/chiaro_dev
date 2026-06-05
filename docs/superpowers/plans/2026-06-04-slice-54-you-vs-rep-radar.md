# Slice 54 — You-vs-Rep Radar Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the rep-page radar overlay from a single "alignment ring" into a true two-polygon you-vs-rep comparison (your per-topic positions vs the rep's).

**Architecture:** Extend `get_rep_issue_alignment` (migration 0059, `create or replace`) to return per-axis `userPos` + `repPos` (additive — `overallPct`/`alignmentPct`/`dot` unchanged). Add those fields to the `AlignmentAxis` type. Rewrite `IssueRadarOverlay` to feed the chart real user + rep position vectors (the chart already draws both polygons) + a You/rep legend.

**Tech Stack:** Postgres 15 + pgTAP, Supabase RPC, TypeScript (strict, ESNext, `.ts` extensions), react-native-web 0.19, react-native-svg, vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-slice-54-you-vs-rep-radar-design.md`.

---

## Conventions (read once)
- **Commit after every task.** Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Relative imports use the `.ts`/`.tsx` extension. No inline hex — colors from `useBrandTokens()` / `useRadarColors()`.
- After each code task run `pnpm -r typecheck` before committing.
- **NULL ≠ 0** — a null `userPos`/`repPos` means "no data on this topic"; the chart draws it at center.
- pgTAP: run the one file with `pnpm --filter @chiaro/db exec psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f packages/db/supabase/tests/get_rep_issue_alignment.test.sql` (needs `pnpm db:start` + the migration applied via `pnpm db:reset`). pgTAP must be loaded (the `supabase test db` harness loads it; or run the full `pnpm db:test`).
- **Ship via PR with all 4 CI jobs green** (Gotcha #30). `seed:tiger` is a recurring CI flake (Census outages) — retry the db job; admin-merge only if the red check is a provable unrelated external outage.

---

## File Structure
- `packages/db/supabase/migrations/0059_rep_alignment_positions.sql` — `create or replace` the fn (no new tables).
- `packages/db/supabase/tests/get_rep_issue_alignment.test.sql` — extend pgTAP (plan 11 → 15).
- `packages/issues/src/types.ts` — `AlignmentAxis` += `userPos`/`repPos`.
- `packages/officials-ui/src/issues/IssueRadarOverlay.tsx` — rewrite to two polygons + legend.
- `packages/officials-ui/test/issues/IssueRadarOverlay.test.tsx` — new test.
- `CLAUDE.md` — slice-54 entry.

---

## Task 1: Migration 0059 — extend `get_rep_issue_alignment` with userPos/repPos

**Files:**
- Create: `packages/db/supabase/migrations/0059_rep_alignment_positions.sql`
- Modify (test): `packages/db/supabase/tests/get_rep_issue_alignment.test.sql`

- [ ] **Step 1: Add the failing pgTAP asserts**

In `packages/db/supabase/tests/get_rep_issue_alignment.test.sql`: bump `select plan(11);` → `select plan(15);`.

In the existing `a99` role block (the one asserting `overall alignment = 90` + `one axis returned`), add two asserts BEFORE its `reset role;`:
```sql
select is((public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'->0->>'userPos')::numeric,
          90::numeric, 'axis userPos = the user position (90)');
select is((public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'->0->>'repPos')::numeric,
          80::numeric, 'axis repPos = the rep stance score (80)');
```
Then, immediately BEFORE the final `select * from finish();`, add a null-rep scenario + 2 asserts:
```sql
-- userPos present + repPos null when the rep has no data on the topic's stance.
insert into public.issue_lenses (topic_slug, slug, label, lens_type, measurement_sources)
  values ('environment','norep','No Rep Data','stance',
          '[{"type":"scorecard","weight":1.0,"config":{"orgs":["nra"]}}]'::jsonb);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a96','norep@x.io');
insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
  values ('00000000-0000-0000-0000-000000000a96','environment','norep', 60, 1);
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a96"}';
select is((public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'->0->>'userPos')::numeric,
          60::numeric, 'userPos present even when the rep has no data');
select is(public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'->0->'repPos',
          'null'::jsonb, 'repPos null when the rep has no data on the topic');
reset role;
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:reset && pnpm db:test` (or the single-file psql command). Expected: FAIL — `userPos`/`repPos` keys are absent from the axes (the 4 new asserts error/return null), while the original 11 still pass.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0059_rep_alignment_positions.sql`:
```sql
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm db:reset && pnpm db:test`. Expected: `get_rep_issue_alignment.test.sql` 15/15. (Ignore the ~4 `tiger_ingest.test.sql` failures — they need `seed:tiger`, Gotcha #6. Confirm NO other file regressed — especially that the original 11 alignment/score asserts still pass, proving behavior parity.)

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0059_rep_alignment_positions.sql packages/db/supabase/tests/get_rep_issue_alignment.test.sql
git commit -m "feat(slice-54): get_rep_issue_alignment returns per-axis userPos/repPos (migration 0059)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: AlignmentAxis type + IssueRadarOverlay two-polygon rewrite

**Files:**
- Modify: `packages/issues/src/types.ts`
- Modify: `packages/officials-ui/src/issues/IssueRadarOverlay.tsx`
- Create (test): `packages/officials-ui/test/issues/IssueRadarOverlay.test.tsx`

- [ ] **Step 1: Add the type fields**

In `packages/issues/src/types.ts`, replace the `AlignmentAxis` interface:
```ts
export interface AlignmentAxis {
  topicSlug: string
  label: string
  alignmentPct: number | null
  dot: AlignmentDot
  userPos: number | null
  repPos: number | null
}
```

- [ ] **Step 2: Write the failing overlay test**

Create `packages/officials-ui/test/issues/IssueRadarOverlay.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { RepAlignment } from '@chiaro/issues'
import { IssueRadarOverlay } from '../../src/issues/IssueRadarOverlay.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const wrap = (ui: ReactElement) =>
  render(ui, { wrapper: ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children) })

const alignment: RepAlignment = {
  overallPct: 70,
  axes: [
    { topicSlug: 'environment', label: 'Environment', alignmentPct: 80, dot: 'aligned', userPos: 90, repPos: 80 },
    { topicSlug: 'gun-policy', label: 'Gun Policy', alignmentPct: null, dot: 'none', userPos: 60, repPos: null },
  ],
}

describe('IssueRadarOverlay', () => {
  it('draws grid + user + rep polygons (two data rings)', () => {
    const { container } = wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)
    // grid + user + rep = 3 polygons
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(3)
  })
  it('renders a You vs rep legend', () => {
    const { getByText } = wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)
    expect(getByText('You')).toBeTruthy()
    expect(getByText(/Jane Doe/)).toBeTruthy()
  })
  it('does not throw when a rep position is null', () => {
    expect(() => wrap(<IssueRadarOverlay alignment={alignment} repName="Jane Doe" />)).not.toThrow()
  })
})
```
> The `react-native-svg` test stub renders real DOM `<svg>`/`<polygon>` (Gotcha #19g), so `querySelectorAll('polygon')` works — same as `IssueRadarChart.test.tsx`.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test IssueRadarOverlay`. Expected: FAIL — currently only grid+user polygons (no rep), and no "You"/legend text (the overlay still shows the old "Fuller shape…" legend).

- [ ] **Step 4: Rewrite the overlay**

Replace `packages/officials-ui/src/issues/IssueRadarOverlay.tsx` with:
```tsx
'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { RepAlignment } from '@chiaro/issues'
import { useBrandTokens, useRadarColors } from '../brand-hooks.ts'
import { IssueRadarChart } from './IssueRadarChart.tsx'

export interface IssueRadarOverlayProps {
  /** Per-issue alignment for this rep (carries per-axis userPos + repPos). */
  alignment: RepAlignment
  /** Rep's display name, for the caption + legend. */
  repName?: string
}

/**
 * Expanded radar view for the rep alignment strip — a true two-polygon
 * you-vs-rep comparison. The filled polygon is the user's per-topic position
 * (`userPos`); the dashed polygon is the rep's (`repPos`). A null position
 * (no data on that topic) is drawn at center. The strip's overall % + dots
 * still come from `alignmentPct`; this overlay is the richer positional view.
 *
 * Presentational only — the parent supplies `alignment` (and opens/closes this
 * via the strip's `onExpand`). Mode-aware via `useBrandTokens()`/`useRadarColors()`.
 */
export function IssueRadarOverlay({
  alignment,
  repName,
}: IssueRadarOverlayProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const radar = useRadarColors()

  const axisLabels = alignment.axes.map((a) => a.label)
  const userValues = alignment.axes.map((a) => (a.userPos ?? 0) / 100)
  const repValues = alignment.axes.map((a) => (a.repPos == null ? null : a.repPos / 100))

  const repLabel = repName ?? 'Rep'
  const caption = repName ? `Your positions vs ${repName}` : 'Your positions vs this rep'

  return (
    <View
      accessibilityLabel="You versus rep issue radar"
      style={[
        styles.overlay,
        { backgroundColor: semantic.bg.card, borderColor: semantic.border.default },
      ]}
    >
      <IssueRadarChart axes={axisLabels} userValues={userValues} repValues={repValues} />
      <Text style={[styles.caption, { color: semantic.text.muted }]}>{caption}</Text>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: radar.userStroke }]} />
          <Text style={[styles.legendText, { color: semantic.text.muted }]}>You</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.swatchDashed, { borderColor: radar.repStroke }]} />
          <Text style={[styles.legendText, { color: semantic.text.muted }]} numberOfLines={1}>
            {repLabel}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 11,
    gap: 4,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatch: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  swatchDashed: {
    width: 14,
    height: 0,
    borderTopWidth: 1.6,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 9.5,
  },
})
```
> Confirm `useRadarColors()` returns `{ grid, userFill, userStroke, repStroke }` (it does — `RADAR` in `@chiaro/ui-tokens/alignment.ts`). The `repValues` prop is now ALWAYS passed (a real `(number|null)[]`), so no conditional spread is needed.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test IssueRadarOverlay && pnpm -r typecheck`. Expected: 3/3 overlay tests pass; typecheck clean across all packages.

- [ ] **Step 6: Commit**

```bash
git add packages/issues/src/types.ts packages/officials-ui/src/issues/IssueRadarOverlay.tsx packages/officials-ui/test/issues/IssueRadarOverlay.test.tsx
git commit -m "feat(slice-54): two-polygon you-vs-rep IssueRadarOverlay + AlignmentAxis positions" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Closeout — verification + docs + PR

**Files:**
- Modify: `CLAUDE.md` (Slices delivered — add Slice 54)

- [ ] **Step 1: Full green sweep (local)**

Run, in order:
```bash
pnpm -r typecheck
pnpm db:reset && pnpm seed:tiger && pnpm db:test   # incl. get_rep_issue_alignment 15/15
pnpm test
pnpm --filter @chiaro/web build
pnpm --filter @chiaro/web test
pnpm --filter @chiaro/mobile test
```
Expected: all PASS. (If `seed:tiger` flakes on a Census outage, retry; the rest is unaffected.) Capture the new pgTAP plan count + the `/officials/[id]` / `/state-officials/[id]` bundle sizes (should be ~flat — overlay is in an already-bundled package).

- [ ] **Step 2: Write the CLAUDE.md "Slices delivered" entry**

Append after the Slice 53 bullet (before "Specs live in …"): a `**Slice 54 — you-vs-rep radar overlay**` bullet noting: extended `get_rep_issue_alignment` (migration 0059, `create or replace`) with per-axis `userPos`/`repPos` (additive, no `types.ts` drift since Returns is Json); `IssueRadarOverlay` rewritten from a single alignment ring to two polygons (filled user + dashed rep) + a You/rep legend; chart/strip/result-screen untouched; closes the slice-52/53-deferred radar item; pgTAP 472→476; no new tables. Reference the spec.

- [ ] **Step 3: Commit + open PR (Gotcha #30)**

```bash
git add CLAUDE.md
git commit -m "docs(slice-54): CLAUDE.md slice 54 entry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin slice-54-you-vs-rep-radar
gh pr create --base master --title "Slice 54 — You-vs-rep radar overlay"
```
(Write the PR body from this plan's Goal + spec scope. End with the Claude Code trailer.) Then watch CI (`gh pr checks <n> --watch`); merge `--squash --delete-branch` ONLY when all 4 jobs are green (retry the db job on a `seed:tiger` Census flake; admin-merge only with explicit approval if it's a provable unrelated external outage). Sync master.

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Update the slice-54 memory note to SHIPPED with the squash hash.

---

## Self-Review notes (for the planner)
- **Spec coverage:** §4.1 fn → Task 1; §4.2 type → Task 2; §5 overlay → Task 2; §6 tests → Task 1 (pgTAP) + Task 2 (overlay vitest); §7 scope (chart/strip/section untouched) → respected; §8 verification → Task 3. ✓
- **Behavior parity:** Task 1's migration keeps the `agree`/`alignmentPct`/`dot`/`overallPct` logic identical (only refactors the double `rep_stance_score` call to one + adds accumulators); the original 11 pgTAP asserts must still pass (Step 4 verifies). ✓
- **Naming consistency:** `userPos`/`repPos` (jsonb keys + TS fields + overlay reads) identical across Tasks 1-2. `useRadarColors().userStroke`/`.repStroke` for the legend.
- **No-placeholder check:** all code blocks complete (migration, pgTAP asserts, type, overlay, test). No `types.ts` (Database) regen needed (Returns is Json).
- **Reconciliation:** the exact 0056 fn body was confirmed against live code while writing this plan (the migration above is the behavior-preserving refactor + additions); `IssueRadarOverlay.test.tsx` confirmed NOT to exist (create); `useRadarColors()` keys confirmed.
