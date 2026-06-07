# Slice 56 — Security & Data-Integrity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three verified DB security/data-integrity findings (+2 adjuncts) from audit track T1 in one append-only migration plus a pgTAP suite — no application code, no `types.ts` drift.

**Architecture:** A single migration `0060_security_hardening.sql` accumulates four statements across Tasks 1–3 (TDD: each task writes its failing pgTAP test first, then adds the statement that makes it pass). Task 4 backfills an auth-guard test for existing behavior. Task 5 verifies (zero type drift) and closes out docs.

**Tech Stack:** PostgreSQL + Supabase migrations, pgTAP (`supabase test db`), RLS policies, SECURITY DEFINER functions.

**Branch:** `slice-56-security-hardening` (already checked out; carries the audit doc commit `d9c1ef4` + spec `314ef21`).

**Local-execution note (read first):** This repo's local Supabase stack is memory-heavy and has OOM'd at ~4 GB in this environment. Attempt `pnpm db:reset && pnpm db:test` for real red→green TDD. If the stack will not boot, fall back to: careful SQL inspection against the exact patterns cited below + rely on the PR's CI `db` job (fresh Supabase) as the authoritative pgTAP gate. The slice ships via green PR CI regardless (Gotcha #30). Do **not** skip writing the tests — they are the gate even if run only in CI.

**Sequential dispatch:** Implementer subagents that `git add`/`commit` MUST run one at a time (Gotcha #25 — shared `.git/index`).

---

### Task 1: A1 — scope `user_districts` SELECT to the owning user

**Files:**
- Create: `packages/db/supabase/migrations/0060_security_hardening.sql`
- Create: `packages/db/supabase/tests/user_districts_rls.test.sql`

Context: `migrations/0006_user_districts.sql:14-17` defines `create policy "user_districts_select_all" ... for select to authenticated using (true)` — any authenticated user reads every user's `(user_id, district_id)` rows. Both app readers (`packages/location/src/queries.ts:54`, `packages/officials/src/queries.ts:28`) already `.eq('user_id', user.id)`, so a self-only policy breaks nothing. Mirror `tests/user_locations_rls.test.sql`.

- [ ] **Step 1: Write the failing test** — `packages/db/supabase/tests/user_districts_rls.test.sql`:

```sql
begin;

select plan(7);

-- 1. table exists + RLS enabled
select has_table('public', 'user_districts', 'user_districts table exists');
select results_eq(
  $$ select relrowsecurity from pg_class where relname = 'user_districts' $$,
  $$ values (true) $$,
  'RLS is enabled on user_districts'
);

-- 2. seed one district + two users + one user_districts row each (as superuser)
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-0000000d1aa1';
  v_b uuid := '00000000-0000-0000-0000-0000000d1bb2';
  v_dist uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
  values (v_a, 'a-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (v_b, 'b-ud-test@example.com', crypt('p', gen_salt('bf')), now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('federal_house', 'CA', 'CA-12-udtest', 'CA-12 (ud-test)',
          ST_GeomFromText('MULTIPOLYGON(((-122 37, -121 37, -121 38, -122 38, -122 37)))', 4326)::geography,
          'TIGER 2024-test')
  returning id into v_dist;

  insert into public.user_districts (user_id, district_id, tier)
  values (v_a, v_dist, 'federal_house'),
         (v_b, v_dist, 'federal_house');
end $$;

-- 3. act as user A
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000d1aa1","role":"authenticated"}';

-- 4. user A sees own row
select isnt_empty(
  $$ select 1 from public.user_districts
       where user_id = '00000000-0000-0000-0000-0000000d1aa1' $$,
  'user A can SELECT own user_districts row'
);

-- 5. user A CANNOT see user B's row (THE FIX — fails under the old using(true) policy)
select is_empty(
  $$ select 1 from public.user_districts
       where user_id = '00000000-0000-0000-0000-0000000d1bb2' $$,
  'user A cannot SELECT user B''s user_districts row'
);

-- 6. user A cannot INSERT (writes revoked; go through apply_calibration)
select throws_ok(
  $$ insert into public.user_districts (user_id, district_id, tier)
     select '00000000-0000-0000-0000-0000000d1aa1', id, 'federal_house'
       from public.districts where code = 'CA-12-udtest' $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot INSERT into user_districts'
);

-- 7. user A cannot UPDATE
select throws_ok(
  $$ update public.user_districts set tier = 'federal_senate'
       where user_id = '00000000-0000-0000-0000-0000000d1aa1' $$,
  '42501', 'permission denied for table user_districts',
  'authenticated cannot UPDATE user_districts'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `pnpm db:reset && pnpm db:test` (or `supabase test db --workdir packages/db`).
Expected: `user_districts_rls.test.sql` FAILS at test 5 (`user A cannot SELECT user B's row`) — under the current `using (true)` policy, A sees B's row, so `is_empty` fails. (If the local stack can't boot, this red state is logically guaranteed by the `using (true)` policy; proceed and let CI confirm.)

- [ ] **Step 3: Create the migration with the A1 statement** — `packages/db/supabase/migrations/0060_security_hardening.sql`:

```sql
-- Slice 56 — security & data-integrity hardening (audit track T1, 2026-06-05).
-- Append-only. Fixes A1 (user_districts cross-user RLS leak), A2 (rep_stance_score
-- anon grant), A3 (user_issue_selections position/importance bounds), A4
-- (touch_updated_at search_path pin). No app code; no types.ts drift.

-- A1: scope user_districts SELECT to the owning user (was `using (true)`, a
-- cross-user location leak; both app readers already filter by auth.uid()).
drop policy if exists "user_districts_select_all" on public.user_districts;

create policy "user_districts_select_self"
  on public.user_districts
  for select
  to authenticated
  using (user_id = (select auth.uid()));
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `pnpm db:reset && pnpm db:test`
Expected: `user_districts_rls.test.sql` — 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0060_security_hardening.sql packages/db/supabase/tests/user_districts_rls.test.sql
git commit -m "feat(slice-56): scope user_districts SELECT to self (A1, migration 0060)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: A3 — bound `position` + `importance` with CHECK constraints

**Files:**
- Modify: `packages/db/supabase/migrations/0060_security_hardening.sql` (append)
- Create: `packages/db/supabase/tests/user_issue_selections_constraints.test.sql`

Context: `user_issue_selections` (`0056:27-38`) has `position numeric(5,2)` + `importance smallint` with no CHECK; bounds live only in `packages/issues/src/schemas.ts:24-25` (`position: z.number().min(0).max(100).nullable()`, `importance: z.union([z.literal(1), z.literal(2)])`). The table has no existing CHECK constraints, so the names below don't collide. Insert directly as superuser to test the table constraints in isolation (bypassing the SECURITY DEFINER RPC). PK is `(user_id, topic_slug, lens_slug)` — delete between the `lives_ok` inserts to avoid a PK collision masking the test.

- [ ] **Step 1: Write the failing test** — `packages/db/supabase/tests/user_issue_selections_constraints.test.sql`:

```sql
begin;

select plan(7);

-- Seed a user + minimal catalog so the composite FK + PK are satisfiable.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role)
values ('00000000-0000-0000-0000-0000000c0001', 'cons@x.io',
        crypt('p', gen_salt('bf')), now(),
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.issue_topics (slug, display_name, description)
  values ('gun-policy','Gun Policy','x');
insert into public.issue_lenses (topic_slug, slug, label, lens_type)
  values ('gun-policy','gun-rights','Gun Rights','stance');

-- valid rows live
select lives_ok(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 0, 1) $$,
  'position=0, importance=1 accepted');
delete from public.user_issue_selections;
select lives_ok(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 100, 2) $$,
  'position=100, importance=2 accepted');
delete from public.user_issue_selections;
select lives_ok(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', NULL, 1) $$,
  'position=NULL accepted');
delete from public.user_issue_selections;

-- out-of-range rejected by the CHECK constraints
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 101, 1) $$,
  '%user_issue_selections_position_check%', 'position=101 rejected');
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', -1, 1) $$,
  '%user_issue_selections_position_check%', 'position=-1 rejected');
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 50, 3) $$,
  '%user_issue_selections_importance_check%', 'importance=3 rejected');
select throws_like(
  $$ insert into public.user_issue_selections (user_id, topic_slug, lens_slug, position, importance)
     values ('00000000-0000-0000-0000-0000000c0001','gun-policy','gun-rights', 50, 0) $$,
  '%user_issue_selections_importance_check%', 'importance=0 rejected');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `pnpm db:reset && pnpm db:test`
Expected: `user_issue_selections_constraints.test.sql` FAILS at the four `throws_like` tests — with no CHECK constraints, the out-of-range inserts SUCCEED instead of raising. (Logically guaranteed by the absence of CHECKs if local can't boot.)

- [ ] **Step 3: Append the A3 statements** to `packages/db/supabase/migrations/0060_security_hardening.sql`:

```sql

-- A3: enforce the app-layer (Zod) bounds at the DB so a direct RPC caller can't
-- store out-of-range values that skew get_rep_issue_alignment's agreement math.
alter table public.user_issue_selections
  add constraint user_issue_selections_position_check
  check (position is null or position between 0 and 100);

alter table public.user_issue_selections
  add constraint user_issue_selections_importance_check
  check (importance in (1, 2));
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `pnpm db:reset && pnpm db:test`
Expected: `user_issue_selections_constraints.test.sql` — 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0060_security_hardening.sql packages/db/supabase/tests/user_issue_selections_constraints.test.sql
git commit -m "feat(slice-56): bound user_issue_selections position/importance (A3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: A2 + A4 — revoke anon execute + pin `touch_updated_at` search_path

**Files:**
- Modify: `packages/db/supabase/migrations/0060_security_hardening.sql` (append)
- Create: `packages/db/supabase/tests/function_security.test.sql`

Context: A2 — `rep_stance_score(uuid,jsonb)` is granted `to authenticated, anon` (`0056:168`) but is SECURITY DEFINER over authenticated-only state tables; its only in-app caller (`get_rep_issue_alignment`, `0056:169`) is authenticated-only. A4 — `touch_updated_at()` (`0001:29-32`) has body `begin new.updated_at := now(); return new; end;` and **no** `set search_path` (contrast `handle_new_user` which has `security definer` + `set search_path = public`). Preserve the body exactly; add only the search_path pin.

- [ ] **Step 1: Write the failing test** — `packages/db/supabase/tests/function_security.test.sql`:

```sql
begin;

select plan(2);

-- A2: anon must NOT be able to execute rep_stance_score (revoked in 0060).
select is(
  has_function_privilege('anon', 'public.rep_stance_score(uuid, jsonb)', 'execute'),
  false,
  'anon cannot execute rep_stance_score'
);

-- A4: touch_updated_at must pin search_path (proconfig carries a search_path entry).
select is(
  (select exists (
     select 1 from pg_proc
     where proname = 'touch_updated_at'
       and pronamespace = 'public'::regnamespace
       and proconfig is not null
       and exists (select 1 from unnest(proconfig) c where c like 'search_path=%')
  )),
  true,
  'touch_updated_at pins search_path'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `pnpm db:reset && pnpm db:test`
Expected: `function_security.test.sql` FAILS both — anon currently HAS execute on `rep_stance_score` (granted in 0056), and `touch_updated_at` has no `proconfig`. (Logically guaranteed by 0056:168 + 0001 if local can't boot.)

- [ ] **Step 3: Append the A2 + A4 statements** to `packages/db/supabase/migrations/0060_security_hardening.sql`:

```sql

-- A2: rep_stance_score is SECURITY DEFINER over authenticated-only state tables;
-- its only in-app caller (get_rep_issue_alignment) is authenticated. Drop the
-- anon direct-execute grant (the internal definer call is unaffected).
revoke execute on function public.rep_stance_score(uuid, jsonb) from anon;

-- A4: pin search_path on touch_updated_at (the only public fn missing it).
-- Body unchanged from 0001; now hardened against search_path manipulation.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `pnpm db:reset && pnpm db:test`
Expected: `function_security.test.sql` — 2/2 PASS. Re-confirm the `profiles_touch_updated_at` trigger still fires (an UPDATE on `public.profiles` bumps `updated_at`) — the `create or replace` keeps the existing triggers wired.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0060_security_hardening.sql packages/db/supabase/tests/function_security.test.sql
git commit -m "feat(slice-56): revoke anon rep_stance_score + pin touch_updated_at search_path (A2,A4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A5 — auth-guard coverage for `save_user_issue_selections`

**Files:**
- Modify: `packages/db/supabase/tests/save_user_issue_selections.test.sql`

Context: the RPC already guards `if auth.uid() is null then raise exception 'not authenticated'` (`0056:50-52`), but `tests/save_user_issue_selections.test.sql` (plan 4) only covers happy-path + atomic-replace. This task backfills the guard test — it **passes against current behavior** (no migration change); it locks the guard against regression. Bump `plan(4)` → `plan(5)` and insert the block before `select * from finish();`.

- [ ] **Step 1: Edit the plan count** — change line `select plan(4);` to `select plan(5);`.

- [ ] **Step 2: Add the A5 assertion** immediately before the closing `select * from finish();`:

```sql

-- A5: auth guard — RPC raises when there is no authenticated user (null auth.uid()).
set local role authenticated;
set local "request.jwt.claims" to '{}';
select throws_like(
  $$ select public.save_user_issue_selections('[]'::jsonb) $$,
  '%not authenticated%',
  'save_user_issue_selections raises when unauthenticated');
reset role;
```

- [ ] **Step 3: Run the test to verify it PASSES**

Run: `pnpm db:reset && pnpm db:test`
Expected: `save_user_issue_selections.test.sql` — 5/5 PASS (the guard already exists; this is a coverage lock).

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/tests/save_user_issue_selections.test.sql
git commit -m "test(slice-56): assert save_user_issue_selections auth guard (A5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verify (zero type drift) + closeout

**Files:**
- Modify: `CLAUDE.md` (slice-56 "Slices delivered" entry + new Gotcha #32)
- Modify: `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` (mark T1 done)

- [ ] **Step 1: Confirm zero `types.ts` drift** (Gotcha #30 — RLS/grant/CHECK/body changes must not alter generated types):

Run: `pnpm db:gen-types && git diff --exit-code packages/db/src/types.ts`
Expected: exit 0, no diff. If a diff appears, STOP and investigate (the migration unexpectedly changed a generated shape).

- [ ] **Step 2: Full verification sweep**

Run: `pnpm -r typecheck` (expect clean — no TS changed) · `pnpm db:reset && pnpm db:test` (expect all green; the 3 new files + 1 extended add ~17 plans → ~445 total — record the exact number printed) · `pnpm test` (expect green — nothing app-side changed).
If the local Supabase stack can't boot for `db:test`, note it and rely on CI; still run `typecheck` + `test`.

- [ ] **Step 3: CLAUDE.md — add the slice-56 entry** to the "Slices delivered" list (after the slice-55 entry):

```markdown
- **Slice 56 — Security & data-integrity hardening (audit T1)** (2026-06-06): Compressed Slice (~5 files). First remediation from the 2026-06-05 comprehensive app audit. One append-only migration 0060 closes 3 verified DB findings + 2 adjuncts: **A1** scopes `user_districts` SELECT from `using (true)` (a cross-user "who lives in which district" leak) to `using (user_id = (select auth.uid()))` mirroring `user_locations` (both app readers already self-filter, so no consumer breaks); **A2** revokes the `anon` execute grant on the SECURITY DEFINER `rep_stance_score` (it reads authenticated-only state tables; its only in-app caller `get_rep_issue_alignment` is authenticated, and the internal definer call is unaffected); **A3** adds CHECK constraints `position is null or position between 0 and 100` + `importance in (1, 2)` to `user_issue_selections` (bounds previously lived only in app Zod, so a direct RPC caller could skew `get_rep_issue_alignment`'s agreement math); **A4** pins `set search_path = ''` on `touch_updated_at` (the only public fn missing it). No app code; **no `types.ts` drift** (RLS/grant/CHECK/body changes don't alter generated types — verified via `db:gen-types` zero-diff). pgTAP +~17 plans (428 → ~445): new `user_districts_rls.test.sql` (cross-user denial) + `user_issue_selections_constraints.test.sql` (bounds) + `function_security.test.sql` (A2 anon-revoke + A4 search_path) + extended `save_user_issue_selections.test.sql` (A5 auth-guard). The audit doc (`docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`) rides on this branch — lands on master with T1 so tracks T2–T6 branch off a master that contains it. See Gotcha #32.
```

- [ ] **Step 4: CLAUDE.md — add Gotcha #32** to the Gotchas list:

```markdown
32. **RLS default-permissive SELECT is a cross-user leak even when every app query self-filters.** `user_districts` shipped (0006) with `for select to authenticated using (true)` — readable by ANY logged-in user — while both app readers (`location/queries.ts`, `officials/queries.ts`) already `.eq('user_id', auth.uid())`. The app *looked* correct, but the DB policy didn't enforce it: a hand-crafted PostgREST query (or any other authenticated session) could read every user's `(user_id, district_id)` rows — a de-anonymizing location signal. Slice 56 (migration 0060) scoped it to `using (user_id = (select auth.uid()))`, mirroring `user_locations` (0005). **Rule:** audit each user-scoped table's SELECT policy independently of its query callers — `using (true)` on user data is a leak, not a convenience. Related boundary: federal catalog tables are intentionally `using (true)` (public marketing surface) while state tables are `to authenticated`; SECURITY DEFINER function grants must match that boundary — `rep_stance_score` was over-granted to `anon` (revoked in 0060) despite reading authenticated-only state tables.
```

- [ ] **Step 5: Mark audit T1 done** — in `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`, edit the T1 row of the "Proposed remediation tracks" table to prepend `✅ SHIPPED (slice 56) — ` to its Note cell.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md
git commit -m "docs(slice-56): CLAUDE.md slice entry + Gotcha #32 + mark audit T1 done

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (controller, after all tasks)

- [ ] All 4 CI jobs green on the PR (db / build / functions / test). The `db` job is the authoritative pgTAP gate (boots a fresh Supabase) — confirm the new/extended test files all pass there.
- [ ] `git log --oneline master..HEAD` shows: audit doc (`d9c1ef4`) + spec + plan + Tasks 1–5 commits.
- [ ] PR title: "Slice 56 — Security & data-integrity hardening (+ comprehensive audit doc)". Body summarizes A1–A5 + notes the audit doc rides along.
- [ ] Squash-merge + delete branch; sync master. Tracks T2–T6 then branch off the updated master.

## Notes
- **DRY/YAGNI:** only the five audited findings; no speculative constraints or policy changes.
- **No `types.ts` hand-edit** (Gotcha #30) — Step 1 proves zero drift via `db:gen-types`.
- **Append-only migrations** — never edit 0001/0006/0056; all changes land in 0060.
