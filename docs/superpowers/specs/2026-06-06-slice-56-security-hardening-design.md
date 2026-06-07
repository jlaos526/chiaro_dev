# Slice 56 — Security & Data-Integrity Hardening Design Spec

**Date:** 2026-06-06
**Branch:** `slice-56-security-hardening`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Compressed Slice (~5 files)
**Source:** Audit track **T1** from `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`

## 1. Goal / problem

The 2026-06-05 comprehensive audit surfaced three hand-verified database security / data-integrity findings plus two small adjuncts. This slice closes all five in one append-only migration + a pgTAP suite. No application code changes, no schema-shape changes, no `types.ts` drift.

## 2. Findings being fixed (all verified against current code)

| ID | Severity | Finding | Verified |
|---|---|---|---|
| **A1** | HIGH · security | `user_districts` SELECT policy is `to authenticated using (true)` (`0006:14-17`) — any logged-in user can read every other user's `(user_id, district_id)` rows (de-anonymizing "who lives in which district"). | `user_locations` (`0005:11-15`) correctly scopes to self; both `user_districts` readers (`location/queries.ts:54` `getMyDistricts`, `officials/queries.ts:28` `fetchMyOfficials`) already `.eq('user_id', user.id)` after `getUser()` — so a self-only policy breaks no consumer. |
| **A2** | MED · security | `rep_stance_score(uuid,jsonb)` granted `to authenticated, anon` (`0056:168`) — a SECURITY DEFINER fn reading authenticated-only state tables; an anon caller can invoke it directly and extract gated aggregate signal. | Only in-app caller is `get_rep_issue_alignment` (`0056:169`, granted authenticated-only). It calls `rep_stance_score` internally; as SECURITY DEFINER that internal call runs regardless of the caller's role, so revoking anon's *direct* execute does not affect the in-app path. |
| **A3** | MED · data-integrity | `user_issue_selections.position numeric(5,2)` + `importance smallint` have no DB CHECK (`0056:32-33`); `save_user_issue_selections` inserts them unvalidated (`0056:54-56`). Bounds live only in app Zod (`packages/issues/src/schemas.ts:24-25`). A direct RPC caller can store out-of-range values that skew `get_rep_issue_alignment`'s `100 - abs(position - rep)` math. | Zod is `position: z.number().min(0).max(100).nullable()` and `importance: z.union([z.literal(1), z.literal(2)])` — exact bounds to mirror. |
| **A4** | LOW · security | `touch_updated_at()` (`0001:29-30`) is SECURITY INVOKER with **no `set search_path`** — the only public fn missing it; trips the Supabase function-search-path linter. | Body is `new.updated_at = now()`; `now()` is in `pg_catalog` (always resolvable), so `set search_path = ''` is safe with no qualification changes. |
| **A5** | LOW · test | `save_user_issue_selections` auth-guard (`auth.uid() IS NULL → raise 'not authenticated'`) is untested, unlike sibling security-critical fns. | `tests/save_user_issue_selections.test.sql` covers happy-path + atomic-replace only. |

## 3. Scope

**In:** one append-only migration `0060_security_hardening.sql` (A1–A4); pgTAP coverage for A1, A3, A4, A5; CLAUDE.md closeout (slice entry + a Gotcha for the RLS-default-permissive class) + mark audit T1 done.
**Out:** the other 5 audit tracks (T2–T6); any application-code change; `types.ts` regeneration (none needed — see §6); the A6 documentation-only finding (federal-public/state-authenticated boundary) — folded into the Gotcha, no code.

## 4. Design — migration `0060_security_hardening.sql`

Append-only; runs after `0059`. Four independent statements:

### 4.1 A1 — scope `user_districts` SELECT to self
```sql
drop policy if exists "user_districts_select_all" on public.user_districts;

create policy "user_districts_select_self"
  on public.user_districts
  for select
  to authenticated
  using (user_id = (select auth.uid()));
```
(The `(select auth.uid())` wrapper matches the `user_locations` pattern — lets the planner cache the uid once per query. INSERT/UPDATE/DELETE remain revoked as established; writes go through `apply_calibration`.)

### 4.2 A2 — revoke anon execute on `rep_stance_score`
```sql
revoke execute on function public.rep_stance_score(uuid, jsonb) from anon;
```

### 4.3 A3 — bound `position` + `importance`
```sql
alter table public.user_issue_selections
  add constraint user_issue_selections_position_check
  check (position is null or position between 0 and 100);

alter table public.user_issue_selections
  add constraint user_issue_selections_importance_check
  check (importance in (1, 2));
```
(`in (1, 2)` mirrors the Zod literal union exactly. Existing rows are app-written 1/2 or default 1, so the constraint validates clean.)

### 4.4 A4 — pin `touch_updated_at` search_path
```sql
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```
(Existing triggers reference the function by name and keep working; `create or replace` preserves the signature. The implementer must replicate the **exact current body** — confirm against `0001` at build time.)

## 5. Tests (pgTAP, currently 428 plans)

The implementer confirms exact plan deltas; targets below.

- **NEW `tests/user_districts_rls.test.sql`** (mirror `user_locations_rls.test.sql`): seed two users each with a `user_districts` row; as user A (`set local role authenticated` + a stubbed `request.jwt.claims` sub = A's id, per the existing RLS-test harness), assert A sees only A's row, not B's. ~4–6 plans.
- **NEW `tests/user_issue_selections_constraints.test.sql`**: `lives_ok` for `position=0/100/null` + `importance=1/2`; `throws_ok` (or `throws_like` on the check-constraint name) for `position=101`, `position=-1`, `importance=3`, `importance=0`. ~6–8 plans.
- **EXTEND `tests/save_user_issue_selections.test.sql`** (A5): with no authenticated role / null `auth.uid()`, assert the RPC raises `not authenticated` (`throws_like(..., '%not authenticated%')`). +1–2 plans.
- **A4 assertion**: assert `touch_updated_at`'s `proconfig` contains a `search_path=` entry — add to the constraints test file or a tiny `function_search_path.test.sql`. Query: `select proconfig from pg_proc where proname = 'touch_updated_at'` → array containing `search_path=`. +1 plan.

Match the seeding + role-switch conventions in the existing `user_locations_rls.test.sql` and `save_user_issue_selections.test.sql` (PostGIS literals, `storageKey`/role harness). Run order: these need only `db:reset` (no TIGER seed).

## 6. `types.ts` drift (Gotcha #30)

None expected: RLS policies, function grants, CHECK constraints, and a function-body change do **not** alter the generated `Database` type (no new tables/columns/functions; CHECK + policy + grant metadata aren't in the type). The plan still includes a `pnpm db:gen-types` + `git diff --exit-code packages/db/src/types.ts` step to prove zero drift before commit, since the CI `db:check-types-drift` gate runs it anyway.

## 7. Verification (Gotcha #30 — merge via green PR CI)

`pnpm db:reset` → `pnpm db:test` (new + extended pgTAP green) · `pnpm -r typecheck` · `pnpm db:gen-types` zero-drift · `pnpm test`. Ship via PR with all 4 CI jobs green. The audit doc commit (`d9c1ef4`) rides on this branch — the PR is "Slice 56 — security & data-integrity hardening (+ comprehensive audit doc)", landing the audit on master alongside its first remediation so tracks T2–T6 branch off a master that contains it.

## 8. Closeout

- CLAUDE.md: slice-56 "Slices delivered" entry; new **Gotcha #32** — "RLS default-permissive class: a `for select ... using (true)` policy on user-scoped data is a cross-user leak even when every app query self-filters; the policy must enforce `user_id = (select auth.uid())` independently. Audit each user-data table's SELECT policy, not just its query callers." Fold the A6 federal-public/state-authenticated read-boundary note in.
- Mark audit T1 done (note in the audit doc's track table or the slice entry).

## 9. Open items for the plan to reconcile against live code

1. Confirm the exact current `touch_updated_at` body in `0001` (assumed `begin new.updated_at = now(); return new; end;`).
2. Confirm the RLS-test harness pattern for impersonating a user (how `user_locations_rls.test.sql` sets `auth.uid()` — `set local request.jwt.claims` vs a `set local role` + helper). Reuse it verbatim.
3. Confirm `user_issue_selections` has no existing CHECK with the chosen constraint names (avoid collision).
4. Confirm pgTAP `--runtests` discovers new files by directory glob (no manifest to update) — match how the suite currently enumerates test files.
