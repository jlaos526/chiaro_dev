# Slice 52 — Issue Priorities + Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user pick ≤6 issue topics + stances, take a Yes/No quiz, see a 6-axis radar of their priorities, and on every rep's detail page see a personalized alignment strip (% + axis dots + you-vs-rep radar) plus ★ priority tags.

**Architecture:** 3 new Postgres tables (`issue_topics`, `issue_lenses`, `user_issue_selections`) hold an admin-extensible catalog + the user's quiz result. Rep alignment is computed on-the-fly by a single SECURITY DEFINER SQL function (`get_rep_issue_alignment`) that interprets each stance's `measurement_sources` jsonb against existing scorecard + vote data. A new `@chiaro/issues` domain package exposes typed queries/hooks. Shared `@chiaro/officials-ui` (RNW) holds the radar, strip, tags, and 5-step flow screens; web + mobile add thin routes. Built and shipped for **both** platforms in this slice.

**Tech Stack:** Postgres 15 + pgTAP, Supabase RPC, TypeScript (strict, ESNext, `.ts` extensions), TanStack Query, zod, React 19, react-native-web 0.19, react-native-svg, Next 15 App Router, Expo Router, vitest, jest-expo.

**Spec:** `docs/superpowers/specs/2026-05-31-slice-52-issue-priorities-design.md` (read §4 data model, §7 formula, §13 scoring before starting).

---

## Conventions (read once)

- **Migrations are append-only files but not yet deployed** — Tasks 1/3/4 all write into `0056_issue_priorities.sql`; later tasks append functions below the tables. This is fine pre-merge.
- **pgTAP**: each test file lives in `packages/db/supabase/tests/<name>.test.sql`, starts with `begin; select plan(N);`, ends with `select * from finish(); rollback;`. Run the whole suite with `pnpm db:test` (needs `pnpm db:start` + `pnpm db:reset` first). Run one file: `pnpm --filter @chiaro/db exec psql "$SUPABASE_DB_URL" -f supabase/tests/<name>.test.sql` (or just run the full suite — it's fast).
- **Relative imports use the `.ts` extension** (e.g. `./types.ts`).
- **No inline hex** — pull from `@chiaro/ui-tokens`; UI consumes `useBrandTokens()`.
- **Commit after every task.** Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **NULL ≠ 0** — a stance/topic with no rep data is excluded from means and rendered grey, never 0/red.
- After each code task run `pnpm -r typecheck` before committing (catches cross-package drift).

---

## File Structure

**Database (`packages/db/`)**
- `supabase/migrations/0056_issue_priorities.sql` — 3 tables + `save_user_issue_selections` + `rep_stance_score` + `get_rep_issue_alignment`.
- `supabase/migrations/0057_issue_priorities_rls.sql` — RLS enable + policies + grants.
- `supabase/seed/issue-catalog/{catalog-data.ts,ingest.ts}` — the 13-topic catalog content + ingester.
- `supabase/seed/issue-catalog-ingest.ts` — CLI entry (uses `isCliEntry`).
- `supabase/seed/fixtures/issue-catalog.fixture.ts` — small fixture catalog for CI.
- `supabase/tests/issue_tables.test.sql`, `issue_rls.test.sql`, `save_user_issue_selections.test.sql`, `get_rep_issue_alignment.test.sql` — pgTAP.

**New package (`packages/issues/`)** — `src/{types,schemas,keys,queries,mutations,hooks,derive,index}.ts` + `package.json` + `tsconfig.json` + `vitest.config.ts` + `test/*.test.ts`.

**Tokens (`packages/ui-tokens/`)** — `src/alignment.ts` (new) + export from `src/index.ts` + `test/alignment.test.ts`.

**Shared UI (`packages/officials-ui/`)** — `src/issues/{IssueRadarChart,RepAlignmentStrip,IssueRadarOverlay,IssuePriorityTag,IssueFlowProvider,IssueWelcomeScreen,TopicPickerScreen,LensPickerScreen,IssueQuizScreen,IssueRadarResultScreen,MyIssuesCard}.tsx` + `src/brand-hooks.ts` (extend) + barrel `src/index.ts` + `test/issues/*.test.tsx`. Edits to `FederalIssuePositionsCard`, `StateIssuePositionsCard`, `StateOfficialDetailPage`.

**Web (`apps/web/`)** — `app/issues/{layout,page,topics/page,lenses/page,quiz/page,radar/page}.tsx` + entry CTA on home + settings row + insertion in `app/officials/[id]/page.tsx`.

**Mobile (`apps/mobile/`)** — `app/(app)/issues/{_layout,index,topics,lenses,quiz,radar}.tsx` + entry + insertion in `app/(app)/officials/[id].tsx`.

---

## PHASE 1 — Database & scoring (testable via pgTAP)

### Task 1: Migration 0056 — catalog + user tables

**Files:**
- Create: `packages/db/supabase/migrations/0056_issue_priorities.sql`
- Create (test): `packages/db/supabase/tests/issue_tables.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/issue_tables.test.sql`:
```sql
begin;
select plan(14);

select has_table('public', 'issue_topics', 'issue_topics exists');
select has_table('public', 'issue_lenses', 'issue_lenses exists');
select has_table('public', 'user_issue_selections', 'user_issue_selections exists');

select col_is_pk('public', 'issue_topics', 'slug', 'issue_topics PK is slug');
select has_column('public', 'issue_topics', 'value_tags', 'topics has value_tags');

select col_is_pk('public', 'issue_lenses', array['topic_slug','slug'], 'lenses PK is (topic_slug, slug)');
select has_column('public', 'issue_lenses', 'measurement_sources', 'lenses has measurement_sources');
select has_column('public', 'issue_lenses', 'quiz_questions', 'lenses has quiz_questions');
select col_has_check('public', 'issue_lenses', 'lens_type', 'lens_type is checked');

select col_is_pk('public', 'user_issue_selections', array['user_id','topic_slug','lens_slug'], 'selections PK');
select has_column('public', 'user_issue_selections', 'position', 'selections has position');
select has_column('public', 'user_issue_selections', 'importance', 'selections has importance');

-- FK: selection.(topic_slug,lens_slug) -> issue_lenses
select fk_ok('public','user_issue_selections',array['topic_slug','lens_slug'],
             'public','issue_lenses',array['topic_slug','slug'],
             'selection composite FK to lens');
-- cascade on user delete
select col_is_fk('public', 'user_issue_selections', 'user_id', 'user_id is FK');

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:start && pnpm db:reset && pnpm db:test`
Expected: FAIL — `issue_tables.test.sql` errors (`relation "public.issue_topics" does not exist`).

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0056_issue_priorities.sql`:
```sql
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `issue_tables.test.sql` 14/14. (Other files unaffected.)

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0056_issue_priorities.sql packages/db/supabase/tests/issue_tables.test.sql
git commit -m "feat(slice-52): issue priorities tables (migration 0056)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration 0057 — RLS + grants

**Files:**
- Create: `packages/db/supabase/migrations/0057_issue_priorities_rls.sql`
- Create (test): `packages/db/supabase/tests/issue_rls.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/issue_rls.test.sql` (mirrors `districts_rls.test.sql` structure):
```sql
begin;
select plan(6);

select row_security_is_on('public', 'issue_topics', 'RLS on issue_topics');
select row_security_is_on('public', 'issue_lenses', 'RLS on issue_lenses');
select row_security_is_on('public', 'user_issue_selections', 'RLS on user_issue_selections');

select policies_are('public','issue_topics', array['issue_topics_read'], 'topics read policy present');
select policies_are('public','user_issue_selections',
  array['user_issue_selections_select_self'], 'selections select-self policy present');

-- authenticated has no direct insert grant on selections (writes go through the SECURITY DEFINER fn)
select ok(
  not has_table_privilege('authenticated', 'public.user_issue_selections', 'INSERT'),
  'authenticated cannot directly INSERT selections');

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:reset && pnpm db:test`
Expected: FAIL — `row_security_is_on` false; policies absent.

- [ ] **Step 3: Write the migration**

Create `packages/db/supabase/migrations/0057_issue_priorities_rls.sql`:
```sql
-- Catalog tables: public read (anon + authenticated); writes service-role only.
alter table public.issue_topics enable row level security;
alter table public.issue_lenses enable row level security;
create policy "issue_topics_read" on public.issue_topics
  for select to anon, authenticated using (true);
create policy "issue_lenses_read" on public.issue_lenses
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.issue_topics from anon, authenticated;
revoke insert, update, delete on public.issue_lenses from anon, authenticated;

-- User selections: select-self only; writes via save_user_issue_selections (SECURITY DEFINER).
alter table public.user_issue_selections enable row level security;
create policy "user_issue_selections_select_self" on public.user_issue_selections
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_issue_selections from anon, authenticated;
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `issue_rls.test.sql` 6/6.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0057_issue_priorities_rls.sql packages/db/supabase/tests/issue_rls.test.sql
git commit -m "feat(slice-52): issue priorities RLS (migration 0057)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `save_user_issue_selections` RPC

**Files:**
- Modify: `packages/db/supabase/migrations/0056_issue_priorities.sql` (append function)
- Create (test): `packages/db/supabase/tests/save_user_issue_selections.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/save_user_issue_selections.test.sql`. It seeds a fake user + catalog, sets the auth context, calls the fn, and asserts the rows. Mirror `apply_calibration.test.sql` for the `request.jwt.claims` / `set local role` pattern.
```sql
begin;
select plan(4);

-- seed a user + minimal catalog
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a52', 'q@x.io');
insert into public.issue_topics (slug, display_name, description) values ('gun-policy','Gun Policy','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type)
  values ('gun-policy','gun-rights','Gun Rights','stance');

select has_function('public', 'save_user_issue_selections', array['jsonb'], 'fn exists');

-- act as the user
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a52"}';

select public.save_user_issue_selections(
  '[{"topic_slug":"gun-policy","lens_slug":"gun-rights","display_order":0,"position":67,"importance":2}]'::jsonb);

reset role;
select is((select count(*)::int from public.user_issue_selections), 1, 'one selection saved');
select is((select importance from public.user_issue_selections), 2::smallint, 'importance saved');

-- second call replaces (atomic), not appends
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a52"}';
select public.save_user_issue_selections('[]'::jsonb);
reset role;
select is((select count(*)::int from public.user_issue_selections), 0, 'empty payload clears selections');

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:reset && pnpm db:test`
Expected: FAIL — `has_function` false (`save_user_issue_selections` undefined).

- [ ] **Step 3: Append the function to migration 0056**

Append to `packages/db/supabase/migrations/0056_issue_priorities.sql`:
```sql
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `save_user_issue_selections.test.sql` 4/4.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0056_issue_priorities.sql packages/db/supabase/tests/save_user_issue_selections.test.sql
git commit -m "feat(slice-52): save_user_issue_selections atomic RPC" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Scoring functions — `rep_stance_score` + `get_rep_issue_alignment`

This is the core of the feature. `rep_stance_score(official_id, measurement_sources)` returns a rep's 0–100 position for one stance (composite of scorecard + bill-vote, renormalized over sources with data, NULL if none). `get_rep_issue_alignment(official_id)` reads the caller's selections, calls the helper per stance, applies the weighted-agreement formula (spec §7), returns `{ overallPct, axes }` jsonb.

**Files:**
- Modify: `packages/db/supabase/migrations/0056_issue_priorities.sql` (append 2 functions)
- Create (test): `packages/db/supabase/tests/get_rep_issue_alignment.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `packages/db/supabase/tests/get_rep_issue_alignment.test.sql`. Seed an official, one federal scorecard org + rating, a user with one stance whose `measurement_sources` is a single scorecard source, and assert the math.
```sql
begin;
select plan(6);

-- official
insert into public.officials (id, full_name, chamber, state, party, bioguide_id)
  values ('00000000-0000-0000-0000-0000000000f1', 'Test Rep', 'federal_house', 'CA', 'D', 'T000001');
-- scorecard org + rating (LCV gives this rep 80)
insert into public.scorecard_orgs (id, slug, name) values ('00000000-0000-0000-0000-0000000000c1','lcv','LCV');
insert into public.scorecard_ratings (scorecard_id, official_id, score, congress)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1', 80, '119');
-- user + catalog: Environment/Conservation stance scored 100% from LCV
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000a99','u@x.io');
insert into public.issue_topics (slug, display_name, description) values ('environment','Environment','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type, measurement_sources)
  values ('environment','conservation','Conservation','stance',
          '[{"type":"scorecard","weight":1.0,"config":{"orgs":["lcv"]}}]'::jsonb);
insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
  values ('00000000-0000-0000-0000-000000000a99','environment','conservation', 90, 1);

select has_function('public','rep_stance_score', array['uuid','jsonb'], 'rep_stance_score exists');
select has_function('public','get_rep_issue_alignment', array['uuid'], 'get_rep_issue_alignment exists');

-- rep_pos for the stance = 80 (single scorecard source)
select is(public.rep_stance_score('00000000-0000-0000-0000-0000000000f1',
  '[{"type":"scorecard","weight":1.0,"config":{"orgs":["lcv"]}}]'::jsonb), 80::numeric, 'rep_stance_score = 80');

-- no-data stance -> NULL (org not present)
select is(public.rep_stance_score('00000000-0000-0000-0000-0000000000f1',
  '[{"type":"scorecard","weight":1.0,"config":{"orgs":["nra"]}}]'::jsonb), null, 'no data -> NULL');

-- alignment as the user: user_pos 90 vs rep_pos 80 -> agreement 90; overall 90
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000a99"}';
select is((public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->>'overallPct')::numeric,
          90::numeric, 'overall alignment = 90');
select is(jsonb_array_length(public.get_rep_issue_alignment('00000000-0000-0000-0000-0000000000f1')->'axes'),
          1, 'one axis returned');
reset role;

select * from finish();
rollback;
```
> Note: confirm `officials` insert columns against the live schema (`\d public.officials`); adjust the seed insert if a NOT NULL column is missing. The behavioral asserts are the contract.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm db:reset && pnpm db:test`
Expected: FAIL — both functions undefined.

- [ ] **Step 3: Append `rep_stance_score` to migration 0056**

```sql
-- Composite rep position (0-100) for one stance's measurement_sources. NULL if no source has data.
create function public.rep_stance_score(p_official_id uuid, p_sources jsonb)
  returns numeric
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
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
        select vp.position from vote_positions vp
          join votes vt on vt.id = vp.vote_id
          join bill_subjects bs on bs.bill_id = vt.bill_id
         where vp.official_id = p_official_id
           and lower(bs.subject) in (select lower(x) from jsonb_array_elements_text(cfg->'subjects') x)
        union all
        select svp.position from state_vote_positions svp
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
```

- [ ] **Step 4: Append `get_rep_issue_alignment` to migration 0056**

```sql
-- Per-rep alignment for the calling user. Returns {overallPct, axes:[{topicSlug,label,alignmentPct,dot}]}.
create function public.get_rep_issue_alignment(p_official_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  axes jsonb := '[]'::jsonb;
  overall_num numeric := 0; overall_den numeric := 0;
  rec record; topic_align numeric; dot text;
begin
  if uid is null then return null; end if;

  -- One row per selected topic: importance-weighted agreement sum (num) + weight sum (den),
  -- counting only stances whose user_pos AND rep_pos are non-null (NULL-excluded).
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
      'topicSlug', rec.topic_slug, 'label', rec.label,
      'alignmentPct', topic_align, 'dot', dot);
  end loop;

  return jsonb_build_object(
    'overallPct', case when overall_den > 0 then round(overall_num / overall_den, 2) else null end,
    'axes', axes);
end;
$$;

grant execute on function public.rep_stance_score(uuid, jsonb) to authenticated, anon;
grant execute on function public.get_rep_issue_alignment(uuid) to authenticated;
```
> `rep_stance_score` is called twice in the lateral (once in the NULL-check, once in the agreement). That's fine functionally (the function is `stable`); if the implementer wants to avoid the double call, compute it once into a CTE/subquery first. Behavior is identical either way — the pgTAP asserts are the contract.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `get_rep_issue_alignment.test.sql` 6/6. If a seed column is wrong, fix the INSERT (not the asserts).

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/migrations/0056_issue_priorities.sql packages/db/supabase/tests/get_rep_issue_alignment.test.sql
git commit -m "feat(slice-52): rep alignment scoring functions" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Issue catalog seed (13 topics)

Ships the real catalog. Stances wire `measurement_sources` to existing scorecard orgs + bill subjects; watchlists ship with `evidence_sources: []`. Authoring the ~36 quiz statements is part of this task.

**Files:**
- Create: `packages/db/supabase/seed/issue-catalog/catalog-data.ts` (the content)
- Create: `packages/db/supabase/seed/issue-catalog/ingest.ts` (UPSERT logic)
- Create: `packages/db/supabase/seed/issue-catalog-ingest.ts` (CLI; uses `isCliEntry`)
- Modify: `packages/db/package.json` + root `package.json` (add `seed:issue-catalog`)
- Create (test): `packages/db/supabase/seed/issue-catalog/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/supabase/seed/issue-catalog/ingest.test.ts` (vitest, mirrors `openstates-committees-ingest.test.ts` client-injection pattern):
```ts
import { describe, it, expect, vi } from 'vitest'
import { ingestIssueCatalog } from './ingest.ts'
import { ISSUE_CATALOG } from './catalog-data.ts'

describe('ingestIssueCatalog', () => {
  it('upserts every topic and its lenses', async () => {
    const upserts: Record<string, unknown[]> = {}
    const client = {
      from: (table: string) => ({
        upsert: async (rows: unknown[]) => { upserts[table] = [...(upserts[table] ?? []), ...rows]; return { error: null } },
      }),
    } as never
    await ingestIssueCatalog(client)
    expect(upserts['issue_topics']).toHaveLength(ISSUE_CATALOG.length)
    expect(upserts['issue_lenses'].length).toBeGreaterThanOrEqual(ISSUE_CATALOG.length) // ≥1 lens per topic
  })

  it('every stance lens has measurement_sources weights summing to ~1.0', () => {
    for (const topic of ISSUE_CATALOG)
      for (const lens of topic.lenses.filter((l) => l.lens_type === 'stance')) {
        const sum = (lens.measurement_sources ?? []).reduce((a, s) => a + s.weight, 0)
        if (lens.measurement_sources.length > 0) expect(sum).toBeCloseTo(1.0, 2)
      }
  })

  it('ships all 13 locked topic slugs', () => {
    const slugs = ISSUE_CATALOG.map((t) => t.slug)
    for (const s of ['immigration','environment','law-and-order','civil-liberties','civil-rights','labor',
      'abortion-policy','gun-policy','economy','healthcare','education','housing','foreign-policy'])
      expect(slugs).toContain(s)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/db test issue-catalog`
Expected: FAIL — `./catalog-data.ts` / `./ingest.ts` not found.

- [ ] **Step 3: Write `catalog-data.ts`**

Create `packages/db/supabase/seed/issue-catalog/catalog-data.ts`. Define types + all 13 topics. Wire stances to real orgs/subjects (spec §5). Full exemplars below; author the rest following the same shape (≥1 stance/topic, ~3 `quiz_questions` per stance, watchlists with `evidence_sources: []`).
```ts
export interface MeasurementSource {
  type: 'scorecard' | 'bill-vote'
  weight: number
  config: { orgs?: string[]; invert?: boolean; subjects?: string[]; agree_position?: 'yes' | 'no' }
}
export interface QuizQuestion { slug: string; prompt: string; agree_direction: 1 | -1; display_order: number }
export interface LensSeed {
  slug: string; label: string; lens_type: 'stance' | 'watchlist'; description?: string
  measurement_sources: MeasurementSource[]; evidence_sources: unknown[]; quiz_questions: QuizQuestion[]; display_order: number
}
export interface TopicSeed {
  slug: string; display_name: string; description: string; value_tags: string[]; display_order: number; lenses: LensSeed[]
}

export const ISSUE_CATALOG: TopicSeed[] = [
  {
    slug: 'environment', display_name: 'Environment', description: 'Conservation, climate, energy, and pollution policy.',
    value_tags: ['progressive'], display_order: 1,
    lenses: [
      { slug: 'conservation', label: 'Conservation', lens_type: 'stance', display_order: 0,
        measurement_sources: [
          { type: 'scorecard', weight: 0.6, config: { orgs: ['lcv', 'sierra-club'] } },
          { type: 'bill-vote', weight: 0.4, config: { subjects: ['Environmental protection', 'Public lands and natural resources'], agree_position: 'yes' } },
        ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'public-lands-expand', prompt: 'Public lands should be expanded and protected from new development.', agree_direction: 1, display_order: 0 },
          { slug: 'drilling-protected', prompt: 'Oil and gas drilling should be allowed in currently protected areas.', agree_direction: -1, display_order: 1 },
          { slug: 'epa-stronger', prompt: 'The EPA should have stronger authority to enforce conservation rules.', agree_direction: 1, display_order: 2 },
        ] },
      { slug: 'climate-action', label: 'Climate Action', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Climate change and greenhouse gases'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'carbon-limits', prompt: 'The government should set binding limits on carbon emissions.', agree_direction: 1, display_order: 0 },
          { slug: 'renewables-subsidy', prompt: 'Renewable energy should receive major public investment.', agree_direction: 1, display_order: 1 },
          { slug: 'climate-overstated', prompt: 'The risks of climate change are overstated.', agree_direction: -1, display_order: 2 },
        ] },
      { slug: 'industry-donor-recipients', label: 'Industry Donor Recipients', lens_type: 'watchlist', display_order: 2,
        description: 'Reps receiving major fossil-fuel industry contributions.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] },
    ],
  },
  {
    slug: 'gun-policy', display_name: 'Gun Policy', description: 'Firearm rights and regulation.',
    value_tags: [], display_order: 8,
    lenses: [
      { slug: 'gun-rights', label: 'Gun Rights', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['nra'] } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'concealed-carry', prompt: 'Law-abiding citizens should be able to carry concealed firearms with minimal restriction.', agree_direction: 1, display_order: 0 },
          { slug: 'assault-ban', prompt: 'Civilian ownership of semi-automatic "assault-style" rifles should be banned.', agree_direction: -1, display_order: 1 },
          { slug: 'background-checks', prompt: 'All gun sales should require a universal background check.', agree_direction: -1, display_order: 2 },
        ] },
      // gun-control stance: invert NRA or use firearm-subject bill votes
      { slug: 'gun-control', label: 'Gun Control', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['nra'], invert: true } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'red-flag', prompt: 'Courts should be able to temporarily remove guns from people deemed a danger (red-flag laws).', agree_direction: 1, display_order: 0 },
          { slug: 'waiting-period', prompt: 'There should be a mandatory waiting period for gun purchases.', agree_direction: 1, display_order: 1 },
          { slug: 'no-new-laws', prompt: 'No new gun laws are needed.', agree_direction: -1, display_order: 2 },
        ] },
    ],
  },
  // … author the remaining 11 topics (immigration, law-and-order, civil-liberties→Personal Freedoms,
  // civil-rights→Equality, labor, abortion-policy, economy, healthcare, education, housing, foreign-policy)
  // following the exact LensSeed/TopicSeed shape. Law & Order = 2 stances + 4 watchlists (spec §5/#12).
  // A stance with no available data source ships measurement_sources: [] (doesn't score; logged at ingest).
]
```
> Org slugs must exist in `scorecard_orgs`/`state_scorecard_orgs` (`lcv`,`sierra-club`,`nra`,`aclu`,`ada`,`afl-cio`,`heritage-action`,`naacp`,`planned-parenthood`,`us-chamber`). Subject strings should match real `bill_subjects.subject` values — verify a few with `select distinct subject from bill_subjects limit 50;` and adjust.

- [ ] **Step 4: Write `ingest.ts`**

Create `packages/db/supabase/seed/issue-catalog/ingest.ts`:
```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import { ISSUE_CATALOG, type TopicSeed } from './catalog-data.ts'

export async function ingestIssueCatalog(client: ChiaroClient, catalog: TopicSeed[] = ISSUE_CATALOG): Promise<void> {
  const topicRows = catalog.map((t) => ({
    slug: t.slug, display_name: t.display_name, description: t.description,
    value_tags: t.value_tags, display_order: t.display_order, active: true,
  }))
  const { error: te } = await client.from('issue_topics').upsert(topicRows)
  if (te) throw new Error(`issue_topics upsert: ${te.message}`)

  const lensRows = catalog.flatMap((t) =>
    t.lenses.map((l) => ({
      topic_slug: t.slug, slug: l.slug, label: l.label, lens_type: l.lens_type,
      description: l.description ?? null, measurement_sources: l.measurement_sources,
      evidence_sources: l.evidence_sources, quiz_questions: l.quiz_questions,
      display_order: l.display_order, active: true,
    })))
  const { error: le } = await client.from('issue_lenses').upsert(lensRows)
  if (le) throw new Error(`issue_lenses upsert: ${le.message}`)
}
```

- [ ] **Step 5: Write the CLI + package scripts**

Create `packages/db/supabase/seed/issue-catalog-ingest.ts`:
```ts
import { createServiceClient } from './shared/service-client.ts' // mirror an existing seed's service-client import
import { ingestIssueCatalog } from './issue-catalog/ingest.ts'
import { isCliEntry } from './shared/cli.ts'

export async function main(): Promise<void> {
  const client = createServiceClient()
  await ingestIssueCatalog(client)
  console.log('issue catalog ingested')
}
if (isCliEntry(import.meta.url)) { await main() }
```
> Open `packages/db/supabase/seed/state-scorecards-ingest.ts` and copy its exact service-client construction + `isCliEntry` import path; substitute those lines.

Add to `packages/db/package.json` scripts: `"seed:issue-catalog": "tsx supabase/seed/issue-catalog-ingest.ts"`.
Add to root `package.json` scripts: `"seed:issue-catalog": "pnpm --filter @chiaro/db seed:issue-catalog"`.

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @chiaro/db test issue-catalog && pnpm -r typecheck`
Expected: PASS — 3/3 ingest tests; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/db/supabase/seed/issue-catalog packages/db/supabase/seed/issue-catalog-ingest.ts packages/db/package.json package.json
git commit -m "feat(slice-52): issue catalog seed (13 topics)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: CI fixture-ingest suite

Wire a tiny fixture catalog into CI's `db` job (mirrors the 9 existing fixture suites) so catalog regressions are caught.

**Files:**
- Create: `packages/db/supabase/seed/fixtures/issue-catalog.fixture.ts`
- Create (test): `packages/db/supabase/seed/issue-catalog/ingest.integration.test.ts`
- Modify: `.github/workflows/ci.yml` (add a step after `db:reset`)

- [ ] **Step 1: Write the integration test**

Create `packages/db/supabase/seed/issue-catalog/ingest.integration.test.ts` — uses a real local-Supabase service client (mirror `openstates-committees-ingest` integration test env setup: distinct `storageKey`, Gotcha #1), ingests the fixture, asserts row counts via `select`.
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ingestIssueCatalog } from './ingest.ts'
import { ISSUE_CATALOG_FIXTURE } from '../fixtures/issue-catalog.fixture.ts'

const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, storageKey: 'issue-catalog-it' } })

describe('issue catalog integration', () => {
  beforeAll(async () => {
    await svc.from('user_issue_selections').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    await svc.from('issue_lenses').delete().neq('topic_slug', '')
    await svc.from('issue_topics').delete().neq('slug', '')
  })
  it('ingests the fixture catalog', async () => {
    await ingestIssueCatalog(svc as never, ISSUE_CATALOG_FIXTURE)
    const { count } = await svc.from('issue_topics').select('*', { count: 'exact', head: true })
    expect(count).toBe(ISSUE_CATALOG_FIXTURE.length)
  })
})
```

Create `packages/db/supabase/seed/fixtures/issue-catalog.fixture.ts` — 2 topics (one stance with a scorecard source, one watchlist) reusing the `TopicSeed` type.

- [ ] **Step 2: Run to verify it fails**

Run (with local Supabase env exported): `pnpm --filter @chiaro/db test ingest.integration`
Expected: FAIL — fixture file missing / tables empty.

- [ ] **Step 3: Create the fixture + add the CI step**

Write the fixture (above). In `.github/workflows/ci.yml`, in the `db` job after the `seed:tiger` / `db:reset` steps and alongside the other fixture-ingest suites, add:
```yaml
      - name: Issue catalog fixture ingest
        run: pnpm --filter @chiaro/db test ingest.integration
        env:
          SUPABASE_URL: ${{ steps.supabase.outputs.url }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ steps.supabase.outputs.service_role_key }}
```
> Copy the exact env-var wiring from an adjacent fixture-ingest step in the same job.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @chiaro/db test ingest.integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/seed/fixtures/issue-catalog.fixture.ts packages/db/supabase/seed/issue-catalog/ingest.integration.test.ts .github/workflows/ci.yml
git commit -m "test(slice-52): issue catalog CI fixture suite" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 2 — `@chiaro/issues` domain package (testable via vitest)

> Mirror `@chiaro/location` for every file shape, `package.json`, `tsconfig.json`, and `vitest.config.ts`. Open those files and copy their structure; only the domain content differs.

### Task 7: Scaffold the package + types

**Files:**
- Create: `packages/issues/package.json`, `packages/issues/tsconfig.json`, `packages/issues/vitest.config.ts`
- Create: `packages/issues/src/types.ts`, `packages/issues/src/index.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@chiaro/issues",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "@chiaro/db": "workspace:*", "@chiaro/supabase-client": "workspace:*", "zod": "^3.23.0" },
  "peerDependencies": { "@tanstack/react-query": "^5.0.0", "react": "^19.0.0" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.0.0" }
}
```
> Match the exact versions in `packages/location/package.json` (copy them verbatim). Copy `tsconfig.json` from `packages/location/tsconfig.json` and `vitest.config.ts` likewise.

- [ ] **Step 2: Write `types.ts`**

```ts
import type { Database } from '@chiaro/db'

export type IssueTopicRow = Database['public']['Tables']['issue_topics']['Row']
export type IssueLensRow = Database['public']['Tables']['issue_lenses']['Row']
export type UserIssueSelectionRow = Database['public']['Tables']['user_issue_selections']['Row']

export interface MeasurementSource {
  type: 'scorecard' | 'bill-vote'
  weight: number
  config: { orgs?: string[]; invert?: boolean; subjects?: string[]; agree_position?: 'yes' | 'no' }
}
export interface QuizQuestion { slug: string; prompt: string; agree_direction: 1 | -1; display_order: number }
export type LensType = 'stance' | 'watchlist'

export interface IssueLens extends Omit<IssueLensRow, 'measurement_sources' | 'quiz_questions' | 'lens_type'> {
  lens_type: LensType
  measurement_sources: MeasurementSource[]
  quiz_questions: QuizQuestion[]
}
export interface IssueTopic extends IssueTopicRow { lenses: IssueLens[] }

export type QuizAnswer = { topicSlug: string; lensSlug: string; questionSlug: string; answer: 'agree' | 'disagree' | 'skip'; starred: boolean }
export type StancePosition = { topicSlug: string; lensSlug: string; position: number | null; importance: 1 | 2 }

export type AlignmentDot = 'aligned' | 'partial' | 'differs' | 'none'
export interface AlignmentAxis { topicSlug: string; label: string; alignmentPct: number | null; dot: AlignmentDot }
export interface RepAlignment { overallPct: number | null; axes: AlignmentAxis[] }
```
> Confirm the generated `Database` type already includes the new tables. If `packages/db/src/types.ts` is hand-maintained (not auto-generated), add the 3 table definitions there in this step (open the file; mirror an existing table entry).

- [ ] **Step 3: Write `index.ts`** (barrel; will grow)

```ts
export * from './types.ts'
```

- [ ] **Step 4: Verify typecheck + register the workspace dep**

Run: `pnpm install && pnpm --filter @chiaro/issues typecheck`
Expected: PASS (no errors). `pnpm install` picks up the new workspace package (count 11 → 12).

- [ ] **Step 5: Commit**

```bash
git add packages/issues package.json pnpm-lock.yaml
git commit -m "feat(slice-52): scaffold @chiaro/issues package + types" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `derive.ts` — quiz answers → stance positions (spec §6)

Pure function; the most logic-dense client code. Orient each answer by `agree_direction`, mean over non-skipped → 0–100, importance = 2 if any starred.

**Files:**
- Create: `packages/issues/src/derive.ts`
- Create (test): `packages/issues/test/derive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { derivePositions } from '../src/derive.ts'
import type { QuizAnswer } from '../src/types.ts'

const q = (questionSlug: string, answer: QuizAnswer['answer'], starred = false): QuizAnswer =>
  ({ topicSlug: 'environment', lensSlug: 'conservation', questionSlug, answer, starred })

// catalog directions: q1 agree_direction +1, q2 -1, q3 +1
const directions = { q1: 1, q2: -1, q3: 1 } as const
const lookup = (a: QuizAnswer) => directions[a.questionSlug as keyof typeof directions]

describe('derivePositions', () => {
  it('orients by agree_direction and averages to 0-100', () => {
    // agree q1(+1)=1, agree q2(-1)=0, agree q3(+1)=1  -> mean 0.667 -> 67
    const out = derivePositions([q('q1','agree'), q('q2','agree'), q('q3','agree')], lookup)
    expect(out[0].position).toBe(67)
    expect(out[0].importance).toBe(1)
  })
  it('excludes skips from the mean', () => {
    const out = derivePositions([q('q1','agree'), q('q2','skip'), q('q3','disagree')], lookup)
    // q1(+1,agree)=1, q3(+1,disagree)=0 -> mean 0.5 -> 50
    expect(out[0].position).toBe(50)
  })
  it('all-skipped -> null position', () => {
    expect(derivePositions([q('q1','skip')], lookup)[0].position).toBeNull()
  })
  it('any starred -> importance 2', () => {
    expect(derivePositions([q('q1','agree', true)], lookup)[0].importance).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/issues test derive`
Expected: FAIL — `derivePositions` not exported.

- [ ] **Step 3: Implement `derive.ts`**

```ts
import type { QuizAnswer, StancePosition } from './types.ts'

/** Group answers by (topic,lens) and compute a 0-100 position + importance per stance. */
export function derivePositions(
  answers: QuizAnswer[],
  agreeDirection: (a: QuizAnswer) => 1 | -1,
): StancePosition[] {
  const groups = new Map<string, QuizAnswer[]>()
  for (const a of answers) {
    const key = `${a.topicSlug}::${a.lensSlug}`
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  const out: StancePosition[] = []
  for (const [key, group] of groups) {
    const [topicSlug, lensSlug] = key.split('::')
    const scored = group
      .filter((a) => a.answer !== 'skip')
      .map((a) => {
        const agree = a.answer === 'agree'
        const dir = agreeDirection(a)
        return (agree && dir === 1) || (!agree && dir === -1) ? 1 : 0
      })
    const position = scored.length === 0 ? null : Math.round((scored.reduce((s, v) => s + v, 0) / scored.length) * 100)
    const importance: 1 | 2 = group.some((a) => a.starred) ? 2 : 1
    out.push({ topicSlug, lensSlug, position, importance })
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @chiaro/issues test derive`
Expected: PASS — 4/4.

- [ ] **Step 5: Export + commit**

Add `export * from './derive.ts'` to `src/index.ts`. Run `pnpm --filter @chiaro/issues typecheck`.
```bash
git add packages/issues/src/derive.ts packages/issues/test/derive.test.ts packages/issues/src/index.ts
git commit -m "feat(slice-52): quiz answer -> stance position derivation" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `schemas.ts` — zod validation

**Files:**
- Create: `packages/issues/src/schemas.ts`
- Create (test): `packages/issues/test/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { measurementSourceSchema, saveSelectionsSchema } from '../src/schemas.ts'

describe('schemas', () => {
  it('accepts a valid scorecard source', () => {
    expect(measurementSourceSchema.safeParse({ type: 'scorecard', weight: 1, config: { orgs: ['lcv'] } }).success).toBe(true)
  })
  it('rejects an unknown source type', () => {
    expect(measurementSourceSchema.safeParse({ type: 'astrology', weight: 1, config: {} }).success).toBe(false)
  })
  it('validates a save payload', () => {
    const ok = saveSelectionsSchema.safeParse([{ topic_slug: 'gun-policy', lens_slug: 'gun-rights', display_order: 0, position: 67, importance: 2 }])
    expect(ok.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/issues test schemas`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `schemas.ts`**

```ts
import { z } from 'zod'

export const measurementSourceSchema = z.object({
  type: z.enum(['scorecard', 'bill-vote']),
  weight: z.number().min(0).max(1),
  config: z.object({
    orgs: z.array(z.string()).optional(),
    invert: z.boolean().optional(),
    subjects: z.array(z.string()).optional(),
    agree_position: z.enum(['yes', 'no']).optional(),
  }),
})
export const quizQuestionSchema = z.object({
  slug: z.string(), prompt: z.string(),
  agree_direction: z.union([z.literal(1), z.literal(-1)]), display_order: z.number().int(),
})
export const saveSelectionsSchema = z.array(z.object({
  topic_slug: z.string(), lens_slug: z.string(), display_order: z.number().int(),
  position: z.number().min(0).max(100).nullable(), importance: z.union([z.literal(1), z.literal(2)]),
}))
export type SaveSelectionsPayload = z.infer<typeof saveSelectionsSchema>
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @chiaro/issues test schemas`
Expected: PASS — 3/3.

- [ ] **Step 5: Export + commit**

Add `export * from './schemas.ts'` to `src/index.ts`.
```bash
git add packages/issues/src/schemas.ts packages/issues/test/schemas.test.ts packages/issues/src/index.ts
git commit -m "feat(slice-52): zod schemas for issue catalog + save payload" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `queries.ts` + `keys.ts` + `mutations.ts`

**Files:**
- Create: `packages/issues/src/keys.ts`, `packages/issues/src/queries.ts`, `packages/issues/src/mutations.ts`
- Create (test): `packages/issues/test/queries.test.ts`

- [ ] **Step 1: Write the failing test** (mock `ChiaroClient`)

```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchRepAlignment, fetchCatalog } from '../src/queries.ts'
import { saveSelections } from '../src/mutations.ts'

const clientWith = (impl: Record<string, unknown>) => impl as never

describe('queries', () => {
  it('fetchRepAlignment calls the RPC and returns its payload', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { overallPct: 72, axes: [] }, error: null })
    const out = await fetchRepAlignment(clientWith({ rpc }), 'off-1')
    expect(rpc).toHaveBeenCalledWith('get_rep_issue_alignment', { p_official_id: 'off-1' })
    expect(out?.overallPct).toBe(72)
  })
  it('saveSelections calls save_user_issue_selections', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    await saveSelections(clientWith({ rpc }), [{ topic_slug: 't', lens_slug: 'l', display_order: 0, position: 50, importance: 1 }])
    expect(rpc).toHaveBeenCalledWith('save_user_issue_selections', { p_selections: expect.any(Array) })
  })
  it('fetchCatalog groups lenses under topics', async () => {
    const from = vi.fn((table: string) => ({
      select: () => ({ order: () => Promise.resolve({
        data: table === 'issue_topics'
          ? [{ slug: 'environment', display_name: 'Environment', lenses: undefined }]
          : [{ topic_slug: 'environment', slug: 'conservation', lens_type: 'stance', measurement_sources: [], quiz_questions: [] }],
        error: null }) }) }))
    const out = await fetchCatalog(clientWith({ from }))
    expect(out[0].lenses).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/issues test queries`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `keys.ts`, `queries.ts`, `mutations.ts`**

`keys.ts`:
```ts
export const issuesKeys = {
  all: ['issues'] as const,
  catalog: () => [...issuesKeys.all, 'catalog'] as const,
  mySelections: () => [...issuesKeys.all, 'mySelections'] as const,
  repAlignment: (officialId: string) => [...issuesKeys.all, 'repAlignment', officialId] as const,
}
```
`queries.ts`:
```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { IssueTopic, IssueLens, RepAlignment, UserIssueSelectionRow } from './types.ts'

export async function fetchCatalog(client: ChiaroClient): Promise<IssueTopic[]> {
  const { data: topics, error: te } = await client.from('issue_topics').select('*').order('display_order')
  if (te) throw te
  const { data: lenses, error: le } = await client.from('issue_lenses').select('*').order('display_order')
  if (le) throw le
  return (topics ?? []).map((t) => ({
    ...t, lenses: ((lenses ?? []) as IssueLens[]).filter((l) => l.topic_slug === t.slug),
  })) as IssueTopic[]
}

export async function fetchMySelections(client: ChiaroClient): Promise<UserIssueSelectionRow[]> {
  const { data, error } = await client.from('user_issue_selections').select('*').order('display_order')
  if (error) throw error
  return data ?? []
}

export async function fetchRepAlignment(client: ChiaroClient, officialId: string): Promise<RepAlignment | null> {
  const { data, error } = await client.rpc('get_rep_issue_alignment', { p_official_id: officialId })
  if (error) throw error
  return (data as RepAlignment | null) ?? null
}
```
`mutations.ts`:
```ts
import type { ChiaroClient } from '@chiaro/supabase-client'
import type { SaveSelectionsPayload } from './schemas.ts'

export async function saveSelections(client: ChiaroClient, selections: SaveSelectionsPayload): Promise<void> {
  const { error } = await client.rpc('save_user_issue_selections', { p_selections: selections })
  if (error) throw error
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @chiaro/issues test queries`
Expected: PASS — 3/3.

- [ ] **Step 5: Export + commit**

Add `export * from './keys.ts'`, `./queries.ts`, `./mutations.ts` to `src/index.ts`. Run `pnpm -r typecheck`.
```bash
git add packages/issues/src/keys.ts packages/issues/src/queries.ts packages/issues/src/mutations.ts packages/issues/test/queries.test.ts packages/issues/src/index.ts
git commit -m "feat(slice-52): issues queries/keys/mutations" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `hooks.ts` — TanStack wrappers

**Files:**
- Create: `packages/issues/src/hooks.ts`
- Create (test): `packages/issues/test/hooks.test.tsx`

- [ ] **Step 1: Write the failing test** (mirror `packages/location/test` hook test: `QueryClientProvider` + `renderHook` from `@testing-library/react`; provide the client via the existing `ChiaroClientProvider`/context pattern used in `@chiaro/location` hooks)

```ts
import { describe, it, expect } from 'vitest'
import { issuesKeys } from '../src/keys.ts'

describe('hooks wiring', () => {
  it('repAlignment key is officialId-scoped', () => {
    expect(issuesKeys.repAlignment('x')).toEqual(['issues', 'repAlignment', 'x'])
  })
})
```
> Full hook render tests are optional here; the queries are already unit-tested in Task 10. Keep this light — the hooks are thin `useQuery`/`useMutation` wrappers. If `@chiaro/location/hooks.ts` shows a render-test pattern, mirror one happy-path test for `useRepAlignment`.

- [ ] **Step 2: Run to verify it fails / passes**

Run: `pnpm --filter @chiaro/issues test hooks`
Expected: PASS after Step 3 (this key test passes immediately; ensure hooks.ts compiles).

- [ ] **Step 3: Implement `hooks.ts`** (mirror `@chiaro/location/src/hooks.ts` for how it reads the client — likely `useChiaroClient()` from `@chiaro/supabase-client`)

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useChiaroClient } from '@chiaro/supabase-client' // confirm the exact hook name in @chiaro/location/hooks.ts
import { issuesKeys } from './keys.ts'
import { fetchCatalog, fetchMySelections, fetchRepAlignment } from './queries.ts'
import { saveSelections } from './mutations.ts'
import type { SaveSelectionsPayload } from './schemas.ts'

const STALE = 5 * 60_000, GC = 30 * 60_000

export function useIssueCatalog() {
  const client = useChiaroClient()
  return useQuery({ queryKey: issuesKeys.catalog(), queryFn: () => fetchCatalog(client), staleTime: STALE, gcTime: GC })
}
export function useMySelections() {
  const client = useChiaroClient()
  return useQuery({ queryKey: issuesKeys.mySelections(), queryFn: () => fetchMySelections(client), staleTime: STALE, gcTime: GC })
}
export function useRepAlignment(officialId: string) {
  const client = useChiaroClient()
  return useQuery({ queryKey: issuesKeys.repAlignment(officialId), queryFn: () => fetchRepAlignment(client, officialId), staleTime: STALE, gcTime: GC })
}
export function useSaveSelections() {
  const client = useChiaroClient(); const qc = useQueryClient()
  return useMutation({
    mutationFn: (sel: SaveSelectionsPayload) => saveSelections(client, sel),
    onSuccess: () => { qc.invalidateQueries({ queryKey: issuesKeys.mySelections() }) },
  })
}
```

- [ ] **Step 4: Verify + Step 5: Commit**

Run: `pnpm --filter @chiaro/issues test && pnpm -r typecheck`. Add `export * from './hooks.ts'` to `src/index.ts`.
```bash
git add packages/issues/src/hooks.ts packages/issues/test/hooks.test.tsx packages/issues/src/index.ts
git commit -m "feat(slice-52): issues TanStack hooks" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 3 — Shared UI (`@chiaro/ui-tokens` + `@chiaro/officials-ui`, testable via vitest)

> All components: RNW shared, consume `useBrandTokens()`, no inline hex, `accessibilityRole`/`aria-*` parity per Gotchas #19/#22. Mirror an existing card/screen for structure. After any token hex change, run the Gotcha #29 grep + each consumer's tests.

### Task 12: Alignment + radar tokens

**Files:**
- Create: `packages/ui-tokens/src/alignment.ts`
- Modify: `packages/ui-tokens/src/index.ts` (export)
- Modify: `packages/officials-ui/src/brand-hooks.ts` (add 2 hooks)
- Create (test): `packages/ui-tokens/test/alignment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { ALIGNMENT_DOT, ALIGNMENT_DOT_DARK, RADAR, RADAR_DARK } from '../src/alignment.ts'

describe('alignment tokens', () => {
  it('has all 4 dot levels in light + dark', () => {
    for (const k of ['aligned','partial','differs','none'] as const) {
      expect(ALIGNMENT_DOT[k]).toMatch(/^#|^rgb/)
      expect(ALIGNMENT_DOT_DARK[k]).toMatch(/^#|^rgb/)
    }
  })
  it('radar has the 4 stops in both modes', () => {
    for (const k of ['grid','userFill','userStroke','repStroke'] as const) {
      expect(RADAR[k]).toBeTruthy(); expect(RADAR_DARK[k]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/ui-tokens test alignment`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `alignment.ts`** (values may be retuned in a later visual pass)

```ts
export type AlignmentDotLevel = 'aligned' | 'partial' | 'differs' | 'none'

export const ALIGNMENT_DOT: Record<AlignmentDotLevel, string> = {
  aligned: '#1a8f5a', partial: '#c89a4e', differs: '#b0413e', none: '#9a948a',
}
export const ALIGNMENT_DOT_DARK: Record<AlignmentDotLevel, string> = {
  aligned: '#4fb98a', partial: '#dcc079', differs: '#d98a86', none: '#7c776e',
}
export const RADAR = { grid: '#e2ddd3', userFill: 'rgba(91,108,255,0.28)', userStroke: '#5b6cff', repStroke: '#c46a2a' }
export const RADAR_DARK = { grid: '#2a2d33', userFill: 'rgba(124,138,255,0.30)', userStroke: '#7c8aff', repStroke: '#e8a060' }
```
Add to `packages/ui-tokens/src/index.ts`: `export * from './alignment.ts'`.

- [ ] **Step 4: Add brand-hooks** in `packages/officials-ui/src/brand-hooks.ts` (mirror the existing `useMapColors`/`useScorecardLeanColor` pattern there):

```ts
import { ALIGNMENT_DOT, ALIGNMENT_DOT_DARK, RADAR, RADAR_DARK, type AlignmentDotLevel } from '@chiaro/ui-tokens'
// inside the file, alongside the other hooks:
export function useAlignmentDotColor(level: AlignmentDotLevel): string {
  const { isDark } = useBrandTokens() // use whatever this file already destructures to detect mode
  return (isDark ? ALIGNMENT_DOT_DARK : ALIGNMENT_DOT)[level]
}
export function useRadarColors() {
  const { isDark } = useBrandTokens()
  return isDark ? RADAR_DARK : RADAR
}
```
> Open `brand-hooks.ts` first; match its exact mode-detection (it may use `useBrandMode()` or a `mode` field, not `isDark`). Use the same idiom the file already uses.

- [ ] **Step 5: Run to verify it passes + Step 6: Commit**

Run: `pnpm --filter @chiaro/ui-tokens test alignment && pnpm -r typecheck`
```bash
git add packages/ui-tokens/src/alignment.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/alignment.test.ts packages/officials-ui/src/brand-hooks.ts
git commit -m "feat(slice-52): alignment + radar tokens and hooks" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: `IssueRadarChart` (react-native-svg, N-axis)

**Files:**
- Create: `packages/officials-ui/src/issues/radar-geometry.ts` (pure)
- Create: `packages/officials-ui/src/issues/IssueRadarChart.tsx`
- Create (test): `packages/officials-ui/test/issues/radar-geometry.test.ts`, `.../IssueRadarChart.test.tsx`

- [ ] **Step 1: Write the failing geometry test** (the math is the risk; test it pure)

```ts
import { describe, it, expect } from 'vitest'
import { radarPoint, radarPolygon } from '../../src/issues/radar-geometry.ts'

describe('radar geometry', () => {
  it('axis 0 at value 1 is straight up from center', () => {
    const { x, y } = radarPoint(0, 6, 1, 50, 60, 60) // axisIndex,count,value,radius,cx,cy
    expect(Math.round(x)).toBe(60)
    expect(Math.round(y)).toBe(10) // cy - radius
  })
  it('polygon returns one "x,y" pair per axis', () => {
    const pts = radarPolygon([1, 0.5, 0.5, 0.5, 0.5, 0.5], 50, 60, 60)
    expect(pts.split(' ')).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test radar-geometry`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `radar-geometry.ts`**

```ts
/** Point on axis `i` of `count`, at `value` 0-1, radius `r`, center (cx,cy). Axis 0 points up. */
export function radarPoint(i: number, count: number, value: number, r: number, cx: number, cy: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
  return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) }
}
/** SVG points attr ("x,y x,y …") for a closed polygon over `values` (each 0-1). */
export function radarPolygon(values: number[], r: number, cx: number, cy: number): string {
  return values
    .map((v, i) => { const p = radarPoint(i, values.length, Math.max(0, Math.min(1, v)), r, cx, cy); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` })
    .join(' ')
}
```

- [ ] **Step 4: Implement `IssueRadarChart.tsx`** (mirror `DistrictBadge.tsx` for the `Svg` import + RNW-safe usage)

```tsx
import { View } from 'react-native'
import Svg, { Polygon, Line } from 'react-native-svg'
import { useRadarColors } from '../brand-hooks.ts'
import { radarPoint, radarPolygon } from './radar-geometry.ts'

export interface IssueRadarChartProps {
  axes: string[]                 // axis labels (length = axis count)
  userValues: number[]           // 0-1 per axis
  repValues?: (number | null)[]  // 0-1 per axis; null = no data (skipped in the polygon)
  size?: number
}
export function IssueRadarChart({ axes, userValues, repValues, size = 220 }: IssueRadarChartProps) {
  const c = useRadarColors()
  const r = size / 2 - 18, cx = size / 2, cy = size / 2, n = axes.length
  const grid = radarPolygon(axes.map(() => 1), r, cx, cy)
  const userPoly = radarPolygon(userValues, r, cx, cy)
  const repPoly = repValues ? radarPolygon(repValues.map((v) => v ?? 0), r, cx, cy) : null
  return (
    <View accessibilityLabel="Issue priorities radar chart">
      <Svg width={size} height={size}>
        <Polygon points={grid} fill="none" stroke={c.grid} strokeWidth={1} />
        {axes.map((_, i) => { const p = radarPoint(i, n, 1, r, cx, cy)
          return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={c.grid} strokeWidth={1} /> })}
        {repPoly && <Polygon points={repPoly} fill="none" stroke={c.repStroke} strokeWidth={1.6} strokeDasharray="4 2" />}
        <Polygon points={userPoly} fill={c.userFill} stroke={c.userStroke} strokeWidth={1.8} />
      </Svg>
    </View>
  )
}
```

- [ ] **Step 5: Write the component test**

`packages/officials-ui/test/issues/IssueRadarChart.test.tsx` — render with 6 axes, assert one `<polygon>` for user + grid renders. Reuse the `react-native-svg` test stub (Gotcha #19g) — confirm it exports `Polygon` + `Line`; if not, extend the stub at `packages/officials-ui/test/stubs/react-native-svg.tsx` (as slice 46 added `Path`, slice 51 added `Polyline`).
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { IssueRadarChart } from '../../src/issues/IssueRadarChart.tsx'
import { TestBrandProvider } from '../helpers/TestBrandProvider.tsx' // use whatever wrapper existing tests use

describe('IssueRadarChart', () => {
  it('renders a user polygon over 6 axes', () => {
    const { container } = render(
      <TestBrandProvider><IssueRadarChart axes={['a','b','c','d','e','f']} userValues={[1,.5,.5,.5,.5,.5]} /></TestBrandProvider>)
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(2) // grid + user
  })
})
```

- [ ] **Step 6: Run + Commit**

Run: `pnpm --filter @chiaro/officials-ui test radar && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/radar-geometry.ts packages/officials-ui/src/issues/IssueRadarChart.tsx packages/officials-ui/test/issues/ packages/officials-ui/test/stubs/react-native-svg.tsx
git commit -m "feat(slice-52): IssueRadarChart + radar geometry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: `RepAlignmentStrip` + `IssueRadarOverlay`

The strip (Option C): `72% aligned` + 6 dots + tap-to-expand the overlay. Renders only when the user has selections and the rep has ≥1 scored axis; else a "Set your issue priorities" CTA.

**Files:**
- Create: `packages/officials-ui/src/issues/RepAlignmentStrip.tsx`, `.../IssueRadarOverlay.tsx`
- Create (test): `packages/officials-ui/test/issues/RepAlignmentStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RepAlignmentStrip } from '../../src/issues/RepAlignmentStrip.tsx'
import { TestBrandProvider } from '../helpers/TestBrandProvider.tsx'

const wrap = (ui: React.ReactNode) => render(<TestBrandProvider>{ui}</TestBrandProvider>)

describe('RepAlignmentStrip', () => {
  it('shows the CTA when the user has no selections', () => {
    const onSetup = vi.fn()
    const { getByText } = wrap(<RepAlignmentStrip alignment={null} hasSelections={false} onSetup={onSetup} onExpand={vi.fn()} />)
    fireEvent.click(getByText(/set your issue priorities/i))
    expect(onSetup).toHaveBeenCalled()
  })
  it('shows the percent + dots when aligned', () => {
    const { getByText } = wrap(<RepAlignmentStrip hasSelections onExpand={vi.fn()} onSetup={vi.fn()}
      alignment={{ overallPct: 72, axes: [{ topicSlug:'environment', label:'Environment', alignmentPct:80, dot:'aligned' }] }} />)
    expect(getByText('72%')).toBeTruthy()
  })
  it('shows grey "no data" state when overallPct is null', () => {
    const { getByText } = wrap(<RepAlignmentStrip hasSelections onExpand={vi.fn()} onSetup={vi.fn()}
      alignment={{ overallPct: null, axes: [{ topicSlug:'x', label:'X', alignmentPct:null, dot:'none' }] }} />)
    expect(getByText(/no comparable record/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test RepAlignmentStrip`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement both components**

`IssueRadarOverlay.tsx` — wraps `IssueRadarChart` with a legend (`▰ You` / `▱ <repName>`); props `{ alignment, repName }`, converts `alignmentPct`/positions to 0-1 (use `alignmentPct/100` for the rep ring; user ring from `useMySelections` positions passed in, or just show the rep ring vs a flat user ring — keep v1 to the rep alignment ring + the user's own positions if supplied). `RepAlignmentStrip.tsx` — a `Pressable` row: left `overallPct`%, middle the dots via `useAlignmentDotColor(axis.dot)`, right "tap to compare ▾"; on press calls `onExpand`. CTA branch when `!hasSelections`. Grey copy "No comparable record yet" when `overallPct === null`. Consume `useBrandTokens()`; `aria-expanded` on the Pressable per Gotcha #22.
> Use the mockup `.superpowers/brainstorm/*/content/rep-tag-binding-v2.html` (Option C phone) as the visual reference for layout/spacing.

- [ ] **Step 4: Run + Step 5: Commit**

Run: `pnpm --filter @chiaro/officials-ui test RepAlignmentStrip && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/RepAlignmentStrip.tsx packages/officials-ui/src/issues/IssueRadarOverlay.tsx packages/officials-ui/test/issues/RepAlignmentStrip.test.tsx
git commit -m "feat(slice-52): RepAlignmentStrip + radar overlay" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: `IssuePriorityTag` + Issue Positions card integration

**Files:**
- Create: `packages/officials-ui/src/issues/IssuePriorityTag.tsx`
- Modify: `packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx`, `.../state/StateIssuePositionsCard.tsx`
- Create (test): `packages/officials-ui/test/issues/IssuePriorityTag.test.tsx`; extend the two card tests

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { IssuePriorityTag } from '../../src/issues/IssuePriorityTag.tsx'
import { TestBrandProvider } from '../helpers/TestBrandProvider.tsx'

describe('IssuePriorityTag', () => {
  it('renders the star label with an a11y label', () => {
    const { getByLabelText } = render(<TestBrandProvider><IssuePriorityTag label="Your priority" /></TestBrandProvider>)
    expect(getByLabelText(/your priority/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test IssuePriorityTag`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `IssuePriorityTag.tsx`** — small `<View>`/`<Text>` pill, `★` + label, brand-tokened, `accessibilityLabel={label}`.

- [ ] **Step 4: Integrate into the Issue Positions cards** — in `FederalIssuePositionsCard` + `StateIssuePositionsCard`: call `useMySelections()`, build a set of org slugs the user cares about (cross-reference the user's selected topics' `measurement_sources[].config.orgs` from `useIssueCatalog()`), render `<IssuePriorityTag>` on matching scorecard rows and sort those rows first. Keep behavior unchanged when `useMySelections()` is empty (no tags, original order).
> Read both card files first; they use `useOfficialScorecardRatings`/`useOfficialStateScorecardRatings`. Add the tag + sort without altering the existing data flow.

- [ ] **Step 5: Run + Step 6: Commit**

Run: `pnpm --filter @chiaro/officials-ui test && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/IssuePriorityTag.tsx packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx packages/officials-ui/src/state/StateIssuePositionsCard.tsx packages/officials-ui/test/issues/IssuePriorityTag.test.tsx
git commit -m "feat(slice-52): IssuePriorityTag + issue-positions integration" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: `IssueFlowProvider` + Welcome + Topic picker screens

The 5 flow screens are shared; web/mobile routes (Phase 4/5) mount them and pass nav callbacks. `IssueFlowProvider` holds wizard state (selected topics, lenses, quiz answers) in React context.

**Files:**
- Create: `packages/officials-ui/src/issues/IssueFlowProvider.tsx`, `.../IssueWelcomeScreen.tsx`, `.../TopicPickerScreen.tsx`
- Create (test): `packages/officials-ui/test/issues/TopicPickerScreen.test.tsx`, `.../IssueFlowProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TopicPickerScreen } from '../../src/issues/TopicPickerScreen.tsx'
import { IssueFlowProvider } from '../../src/issues/IssueFlowProvider.tsx'
import { TestBrandProvider } from '../helpers/TestBrandProvider.tsx'

const TOPICS = Array.from({ length: 8 }, (_, i) => ({ slug: `t${i}`, display_name: `Topic ${i}`, description: '', value_tags: [], display_order: i, active: true, lenses: [] }))

describe('TopicPickerScreen', () => {
  it('caps selection at 6', () => {
    const { getAllByRole, getByText } = render(
      <TestBrandProvider><IssueFlowProvider><TopicPickerScreen topics={TOPICS as never} onNext={() => {}} /></IssueFlowProvider></TestBrandProvider>)
    // select 7 → 7th rejected; continue enabled at ≥1
    const cards = getAllByRole('button')
    for (let i = 0; i < 7; i++) fireEvent.click(cards[i])
    expect(getByText(/6 \/ 6|6 of 6|max/i)).toBeTruthy()
  })
})
```
> Adjust the assertion to the exact "N/6" copy you implement.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test TopicPickerScreen`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the provider + screens**

`IssueFlowProvider.tsx` — context with `{ selectedTopics: string[], toggleTopic, selectedLenses: Record<topic,string[]>, toggleLens, answers: QuizAnswer[], setAnswer, reset, hydrate(selections) }`. `IssueWelcomeScreen.tsx` — wraps the existing screen-shell pattern (mirror `CalibrateScreen`/`SettingsScreen`); shows non-locking quick-start chips (hardcoded preset map → pre-checks topics/lenses via `hydrate`), a "Start" CTA. `TopicPickerScreen.tsx` — grid of topic cards (multi-select, cap 6, disable further when at 6), `N/6` counter, "Continue" enabled at ≥1 → `onNext`. Brand-tokened; cards are `Pressable` with `accessibilityRole="button"`.

- [ ] **Step 4: Run + Step 5: Commit**

Run: `pnpm --filter @chiaro/officials-ui test && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/IssueFlowProvider.tsx packages/officials-ui/src/issues/IssueWelcomeScreen.tsx packages/officials-ui/src/issues/TopicPickerScreen.tsx packages/officials-ui/test/issues/
git commit -m "feat(slice-52): issue flow provider + welcome + topic picker" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Lens picker + Quiz screens

**Files:**
- Create: `packages/officials-ui/src/issues/LensPickerScreen.tsx`, `.../IssueQuizScreen.tsx`
- Create (test): `.../LensPickerScreen.test.tsx`, `.../IssueQuizScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

`IssueQuizScreen.test.tsx` — assert Agree/Disagree/Skip + star toggle record into flow state, and "Finish" is enabled once every question is answered-or-skipped:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { IssueQuizScreen } from '../../src/issues/IssueQuizScreen.tsx'
import { IssueFlowProvider } from '../../src/issues/IssueFlowProvider.tsx'
import { TestBrandProvider } from '../helpers/TestBrandProvider.tsx'

const QUESTIONS = [{ topicSlug:'environment', lensSlug:'conservation', slug:'q1', prompt:'P1', agree_direction:1 as const, display_order:0 }]

describe('IssueQuizScreen', () => {
  it('records an answer and enables finish', () => {
    const onFinish = vi.fn()
    const { getByText } = render(<TestBrandProvider><IssueFlowProvider>
      <IssueQuizScreen questions={QUESTIONS} onFinish={onFinish} /></IssueFlowProvider></TestBrandProvider>)
    fireEvent.click(getByText('Agree'))
    fireEvent.click(getByText(/finish|see my radar/i))
    expect(onFinish).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test IssueQuizScreen`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both screens**

`LensPickerScreen.tsx` — per selected topic, list its `lenses` (stances + watchlists) with multi-select (≥1 required to proceed), labeled by `lens_type` (stance vs watchlist badge); "Continue" → `onNext`. `IssueQuizScreen.tsx` — builds the question set from the selected stance lenses' `quiz_questions`, renders one card per question (prompt + Disagree/Agree/Skip `Pressable`s + a `★ extra weight` toggle), writes to flow state via `setAnswer`; progress indicator; "See my radar" enabled when all answered/skipped → `onFinish`.

- [ ] **Step 4: Run + Step 5: Commit**

Run: `pnpm --filter @chiaro/officials-ui test && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/LensPickerScreen.tsx packages/officials-ui/src/issues/IssueQuizScreen.tsx packages/officials-ui/test/issues/LensPickerScreen.test.tsx packages/officials-ui/test/issues/IssueQuizScreen.test.tsx
git commit -m "feat(slice-52): lens picker + quiz screens" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Radar result screen + `MyIssuesCard`

**Files:**
- Create: `packages/officials-ui/src/issues/IssueRadarResultScreen.tsx`, `.../MyIssuesCard.tsx`
- Modify: `packages/officials-ui/src/index.ts` (barrel-export all `issues/*` public components)
- Create (test): `.../IssueRadarResultScreen.test.tsx`

- [ ] **Step 1: Write the failing test** — assert the result screen derives positions (via `@chiaro/issues` `derivePositions`) and that "Save" calls `onSave` with the built payload:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { IssueRadarResultScreen } from '../../src/issues/IssueRadarResultScreen.tsx'
import { IssueFlowProvider } from '../../src/issues/IssueFlowProvider.tsx'
import { TestBrandProvider } from '../helpers/TestBrandProvider.tsx'

describe('IssueRadarResultScreen', () => {
  it('saves the derived selections', () => {
    const onSave = vi.fn()
    const { getByText } = render(<TestBrandProvider><IssueFlowProvider>
      <IssueRadarResultScreen catalog={[] as never} onSave={onSave} /></IssueFlowProvider></TestBrandProvider>)
    fireEvent.click(getByText(/save/i))
    expect(onSave).toHaveBeenCalledWith(expect.any(Array))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test IssueRadarResultScreen`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both**

`IssueRadarResultScreen.tsx` — reads flow state, calls `derivePositions(answers, lookupFromCatalog)` to get per-stance positions, renders `IssueRadarChart` with the user's own values (axis per selected topic; topic value = mean of its stance positions/100), and a "Save" button → builds the `SaveSelectionsPayload` (one row per selected topic+lens, with `position`+`importance` for stances) → `onSave(payload)`. `MyIssuesCard.tsx` — home/settings preview: small `IssueRadarChart` from `useMySelections()` + "Edit priorities" CTA; "Set your issue priorities" empty-state when none.

- [ ] **Step 4: Barrel-export** all public `issues/*` components from `packages/officials-ui/src/index.ts`.

- [ ] **Step 5: Run + Step 6: Commit**

Run: `pnpm --filter @chiaro/officials-ui test && pnpm -r typecheck`
```bash
git add packages/officials-ui/src/issues/IssueRadarResultScreen.tsx packages/officials-ui/src/issues/MyIssuesCard.tsx packages/officials-ui/src/index.ts packages/officials-ui/test/issues/IssueRadarResultScreen.test.tsx
git commit -m "feat(slice-52): radar result screen + MyIssuesCard" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 4 — Web (testable via `pnpm --filter @chiaro/web build`)

> **Refinement of spec §9:** each platform mounts the 5 screens in a **single stepper route** (`IssueFlowProvider` holds step + wizard state) rather than 5 separate routes — this keeps wizard state intact across steps without cross-route plumbing. Entry points still link to `/issues`.

### Task 19: Web `/issues` flow route

**Files:**
- Create: `apps/web/app/issues/page.tsx`
- Modify: `apps/web/package.json` (add `@chiaro/issues` dep if not present)

- [ ] **Step 1: Add the dep + write the route**

Add `"@chiaro/issues": "workspace:*"` to `apps/web/package.json` dependencies; `pnpm install`.

Create `apps/web/app/issues/page.tsx` (`'use client'`):
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IssueFlowProvider, IssueWelcomeScreen, TopicPickerScreen, LensPickerScreen,
  IssueQuizScreen, IssueRadarResultScreen,
} from '@chiaro/officials-ui'
import { useIssueCatalog, useMySelections, useSaveSelections } from '@chiaro/issues'

type Step = 'welcome' | 'topics' | 'lenses' | 'quiz' | 'radar'

export default function IssuesPage() {
  const router = useRouter()
  const { data: catalog = [] } = useIssueCatalog()
  const { data: existing } = useMySelections()
  const save = useSaveSelections()
  const [step, setStep] = useState<Step>('welcome')

  return (
    <IssueFlowProvider initialSelections={existing}>
      {step === 'welcome' && <IssueWelcomeScreen catalog={catalog} onStart={() => setStep('topics')} />}
      {step === 'topics' && <TopicPickerScreen topics={catalog} onNext={() => setStep('lenses')} />}
      {step === 'lenses' && <LensPickerScreen catalog={catalog} onNext={() => setStep('quiz')} />}
      {step === 'quiz' && <IssueQuizScreen catalog={catalog} onFinish={() => setStep('radar')} />}
      {step === 'radar' && (
        <IssueRadarResultScreen catalog={catalog}
          onSave={async (payload) => { await save.mutateAsync(payload); router.push('/') }} />
      )}
    </IssueFlowProvider>
  )
}
```
> The exact prop names (`catalog`/`topics`/`onStart`/`onNext`/`onFinish`/`onSave`, `initialSelections`) must match what Phase 3 implemented. Reconcile if they drifted.

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS — `/issues` route compiles. Note its First-Load size for the CLAUDE.md entry.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/issues/page.tsx apps/web/package.json package.json pnpm-lock.yaml
git commit -m "feat(slice-52): web /issues flow route" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Web rep-page integration + entry points (+ shared state page)

The federal insertion is web-local; the **state insertion edits the shared `StateOfficialDetailPage`** (covers state on *both* platforms — mobile gets it for free).

**Files:**
- Modify: `apps/web/app/officials/[id]/page.tsx` (insert strip after `<BioHeaderClient/>`)
- Modify: `packages/officials-ui/src/state/StateOfficialDetailPage.tsx` (insert strip after the bio block — shared)
- Modify: web home page (CTA card) + web settings page (a Settings row → `/issues`)
- Modify (test): `packages/officials-ui/test/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Write/extend the failing test** — assert `StateOfficialDetailPage` renders a `RepAlignmentStrip` slot (mock `useRepAlignment`/`useMySelections` to return null/empty → CTA branch renders). Mirror the existing test's mocking.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test StateOfficialDetailPage`
Expected: FAIL — strip not present.

- [ ] **Step 3: Insert the strip**

In both compositions, between the bio header and the first card, render a small client wrapper that calls `useRepAlignment(officialId)` + `useMySelections()` and renders `<RepAlignmentStrip ... onSetup={() => navigate('/issues')} onExpand={toggle} />` (+ the expandable `IssueRadarOverlay`). For the **federal web** server page, wrap the strip in a `'use client'` component (e.g. `RepAlignmentStripClient`) like `BioHeaderClient`. For **state** (shared `StateOfficialDetailPage`), it's already a client component — insert directly; nav via the existing callback-prop convention (don't import a router into the shared package — pass `onSetup`/`onNavigate` down from each app, mirroring how `StateOfficialDetailPage` already receives nav callbacks).

- [ ] **Step 4: Add entry points**

Web home: a `MyIssuesCard`-or-CTA card linking to `/issues`. Web settings: add an "Issue Priorities" `SettingsNavRow` → `/issues` (mirror existing settings rows).

- [ ] **Step 5: Run + Step 6: Commit**

Run: `pnpm --filter @chiaro/officials-ui test && pnpm --filter @chiaro/web build && pnpm -r typecheck`
```bash
git add apps/web/app/officials/[id]/page.tsx packages/officials-ui/src/state/StateOfficialDetailPage.tsx apps/web/app/page.tsx apps/web/app/settings/page.tsx packages/officials-ui/test/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(slice-52): rep alignment strip + web entry points" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
> Confirm exact home/settings page paths first (`apps/web/app/page.tsx` vs a `(app)` group).

---

## PHASE 5 — Mobile (testable via jest-expo)

### Task 21: Mobile `/issues` flow route

**Files:**
- Create: `apps/mobile/app/(app)/issues.tsx`
- Modify: `apps/mobile/package.json` (add `@chiaro/issues`)
- Create (test): `apps/mobile/test/issues-flow.test.tsx`

- [ ] **Step 1: Write the failing test** (jest-expo; mutable-mock pattern per Gotcha #11 — never `resetModules`)

```tsx
import { render, fireEvent } from '@testing-library/react-native'
import IssuesScreen from '../app/(app)/issues'
// mock @chiaro/issues hooks via a mutable let reset in beforeEach (see StateServiceRecordCard.test.tsx)
it('advances from welcome to topics', () => {
  const { getByText } = render(<IssuesScreen />)
  fireEvent.press(getByText(/start|get started/i))
  expect(getByText(/choose|topics|pick/i)).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/mobile test issues-flow`
Expected: FAIL — screen missing.

- [ ] **Step 3: Write the route** — same stepper as web Task 19 but with Expo Router `useRouter().replace('/')` on save. Add `"@chiaro/issues": "workspace:*"` to `apps/mobile/package.json`; `pnpm install`.

- [ ] **Step 4: Run + Step 5: Commit**

Run: `pnpm --filter @chiaro/mobile test issues-flow && pnpm -r typecheck`
```bash
git add "apps/mobile/app/(app)/issues.tsx" apps/mobile/package.json apps/mobile/test/issues-flow.test.tsx package.json pnpm-lock.yaml
git commit -m "feat(slice-52): mobile /issues flow route" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Mobile rep-page integration + entry points

State mobile is already covered by the Task-20 shared `StateOfficialDetailPage` edit — this task does **federal mobile** + mobile entry points + passing the nav callbacks the shared state page needs.

**Files:**
- Modify: `apps/mobile/app/(app)/officials/[id].tsx` (federal — insert strip)
- Modify: `apps/mobile/app/(app)/state-officials/[id].tsx` (pass `onSetup`/`onNavigate` nav callbacks into `StateOfficialDetailPage`)
- Modify: mobile home + settings/drawer (entry → `/issues`)
- Create (test): `apps/mobile/test/officials-detail-alignment.test.tsx`

- [ ] **Step 1: Write the failing test** — render federal `[id]` with mocked empty selections → assert the "Set your issue priorities" CTA appears under the bio header.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @chiaro/mobile test officials-detail-alignment`
Expected: FAIL.

- [ ] **Step 3: Insert + wire** — federal `[id].tsx`: render `<RepAlignmentStrip>` (+ overlay) under the bio header, `onSetup={() => router.push('/issues')}`. state `[id].tsx`: pass `onNavigate`/`onSetup` props into `StateOfficialDetailPage`. Add a mobile home `MyIssuesCard`/CTA + a drawer/settings "Issue Priorities" row → `/issues`.

- [ ] **Step 4: Run + Step 5: Commit**

Run: `pnpm --filter @chiaro/mobile test && pnpm -r typecheck`
```bash
git add "apps/mobile/app/(app)/officials/[id].tsx" "apps/mobile/app/(app)/state-officials/[id].tsx" apps/mobile/test/officials-detail-alignment.test.tsx
git commit -m "feat(slice-52): mobile rep alignment strip + entry points" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 6 — Closeout

### Task 23: Full verification + docs

**Files:**
- Modify: `CLAUDE.md` ("Slices delivered" — add the Slice 52 entry; bump workspace count 11 → 12)

- [ ] **Step 1: Full green sweep**

Run, in order:
```bash
pnpm -r typecheck                       # 12 packages now
pnpm db:reset && pnpm seed:tiger && pnpm db:test   # pgTAP incl. the 4 new issue test files (~428 → ~458)
pnpm test                               # full workspace (turbo) — NOT pnpm -r test (Gotcha #7)
pnpm --filter @chiaro/web build         # web bundle
pnpm --filter @chiaro/mobile test       # jest-expo
```
Expected: all PASS. Capture pgTAP plan count + `/officials/[id]`, `/state-officials/[id]`, `/issues` bundle sizes.

- [ ] **Step 2: Seed the real catalog locally + smoke**

Run: `pnpm seed:issue-catalog` then manually confirm `select count(*) from issue_topics;` = 13 and a `get_rep_issue_alignment` call returns sane JSON for a seeded official.

- [ ] **Step 3: Write the CLAUDE.md "Slices delivered" entry**

Append a `**Slice 52 — issue priorities + radar**` bullet summarizing: 3 tables (0056/0057) + 2 scoring RPCs, `@chiaro/issues` package (11→12), shared radar/strip/tag/5-step flow, full web+mobile parity, weighted-agreement alignment, ~50 files, pgTAP ~428→~458. Note watchlist data → slice 53.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(slice-52): CLAUDE.md slice 52 entry + workspace count" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` to choose merge/PR. Update the slice-52 memory note to "SHIPPED" with the squash hash.

---

## Self-Review notes (for the planner)

- **Spec coverage:** §4 data model → Tasks 1–4; §5 catalog → Task 5; §6 derivation → Task 8; §7 formula → Task 4 (SQL) + Task 8/18 (client radar); §8 rep page → Tasks 14/15/20/22; §9 flow+routes → Tasks 16–19/21; §10 package → Tasks 7–11; §11 components → Tasks 13–18; §12 tokens → Task 12; §13 scoring → Task 4; §14 testing → throughout + Task 23; §16 deferrals → respected (no watchlist data, no list-level alignment). ✓
- **Naming consistency:** `get_rep_issue_alignment`, `rep_stance_score`, `save_user_issue_selections`, `derivePositions`, `RepAlignmentStrip`, `IssueRadarChart`, `useRepAlignment`, `useMySelections`, `useIssueCatalog`, `useSaveSelections` used identically across tasks.
- **Open verification items the implementer must reconcile against live code (flagged inline):** exact `officials` insert columns (Task 4 seed); `Database` type includes new tables (Task 7); `useChiaroClient` hook name (Task 11); `brand-hooks` mode-detection idiom (Task 12); screen prop names web/mobile (Tasks 19/21); home/settings page paths (Tasks 20/22).
