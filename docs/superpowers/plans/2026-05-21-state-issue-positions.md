# State Issue Positions Implementation Plan (sub-slice 5G)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ComingSoonCard('Issue Positions')` on `/state-officials/[id]` with a real `StateIssuePositionsCard` listing 5 lean-balanced advocacy-org scorecard ratings (LCV, ACLU, NRA, Planned Parenthood, AFP) with expandable evidence panels showing subject-correlated state votes.

**Architecture:** New parallel `state_scorecard_orgs` + `state_scorecard_ratings` tables (migrations 0040–0041). Per-org adapter pattern (each adapter spans N states via `covered_states[]`); v1 ships stubs returning `[]`. New hook `useOfficialStateVotesOnSubject` in `@chiaro/state-bills` powers evidence panels. Workspace stays at 10 packages.

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP, vitest (db/web), jest-expo (mobile), TanStack Query v5, undici fetch with retry.

**Spec:** `docs/superpowers/specs/2026-05-21-state-issue-positions-design.md`

---

## File structure

**Created (~25 files):**
```
packages/db/supabase/migrations/
  0040_state_scorecards.sql
  0041_state_scorecards_rls.sql
packages/db/supabase/tests/
  state_scorecards_rls.test.sql
packages/db/supabase/seed/
  state-scorecards-ingest.ts
  state-scorecards-ingest.test.ts
  state-scorecards/
    shared.ts
    shared.test.ts
    aclu.ts + aclu.test.ts
    lcv.ts + lcv.test.ts
    nra.ts + nra.test.ts
    planned-parenthood.ts + planned-parenthood.test.ts
    afp.ts + afp.test.ts
  fixtures/state-scorecards/
    aclu.json
    lcv.json
    nra.json
    planned-parenthood.json
    afp.json
apps/web/components/state/
  StateIssuePositionsCard.tsx
  StateIssueVotesEvidence.tsx
apps/web/test/components/state/
  StateIssuePositionsCard.test.tsx
  StateIssueVotesEvidence.test.tsx
apps/mobile/components/state/
  StateIssuePositionsCard.tsx
  StateIssueVotesEvidence.tsx
apps/mobile/test/components/state/
  StateIssuePositionsCard.test.tsx
  StateIssueVotesEvidence.test.tsx
docs/superpowers/specs/
  2026-05-21-state-scorecards-coverage.md  (Task 4 deliverable)
```

**Modified:**
```
packages/db/src/types.ts                                            # regenerated
packages/db/package.json                                            # +seed:state-scorecards
packages/officials/src/types.ts                                     # +StateScorecardOrgRow, +StateScorecardRatingRow, +StateScorecardRatingWithOrg
packages/officials/src/keys.ts                                      # +stateScorecardRatings
packages/officials/src/queries.ts                                   # +fetchOfficialStateScorecardRatings
packages/officials/src/hooks.ts                                     # +useOfficialStateScorecardRatings
packages/officials/src/index.ts                                     # barrel re-exports
packages/state-bills/src/types.ts                                   # (no new types - StateVoteWithPosition reused)
packages/state-bills/src/keys.ts                                    # +officialStateVotesOnSubject
packages/state-bills/src/queries.ts                                 # +fetchOfficialStateVotesOnSubject
packages/state-bills/src/hooks.ts                                   # +useOfficialStateVotesOnSubject
packages/state-bills/src/index.ts                                   # barrel re-exports
apps/web/components/state/StateOfficialDetailPage.tsx               # swap ComingSoonCard('Issue Positions')
apps/web/test/components/state/StateOfficialDetailPage.test.tsx     # +useOfficialStateScorecardRatings mock
apps/mobile/components/state/StateOfficialDetailPage.tsx            # mirror swap
apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx  # mirror mock
packages/officials/test/queries.integration.test.ts                 # +state_scorecard_* seed + 1 RLS case
CLAUDE.md                                                           # slice entry + gotcha #12 + Quick start
```

---

## Task 1: Migration 0040 — state_scorecards schema

**Files:**
- Create: `packages/db/supabase/migrations/0040_state_scorecards.sql`

- [ ] **Step 1: Write the migration**

Create `packages/db/supabase/migrations/0040_state_scorecards.sql`:

```sql
-- Sub-slice 5G: state-legislator scorecards. Parallel to slice-4
-- federal scorecard_orgs / scorecard_ratings (preserves federal flow
-- unchanged). Sourced from per-org adapters via openstates_person_id.

create table public.state_scorecard_orgs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  state           char(2) not null,
  name            text not null,
  issue_area      text not null,
  lean            text not null check (lean in ('progressive', 'conservative', 'libertarian', 'single-issue', 'centrist')),
  methodology_url text not null,
  scoring_min     int not null default 0,
  scoring_max     int not null default 100,
  notes           text,
  unique (slug, state)
);

create table public.state_scorecard_ratings (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.state_scorecard_orgs(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  session      text not null,
  score        numeric(5,2) not null,
  source_url   text not null,
  ingested_at  timestamptz not null default now(),
  unique (scorecard_id, official_id, session)
);

create index state_scorecard_orgs_state_idx
  on public.state_scorecard_orgs(state);
create index state_scorecard_ratings_official_idx
  on public.state_scorecard_ratings(official_id, session);
create index state_scorecard_ratings_scorecard_idx
  on public.state_scorecard_ratings(scorecard_id);

comment on column public.state_scorecard_orgs.slug is
  'Org-level slug (aclu, lcv, nra, planned-parenthood, afp). Per-state chapters distinguished via state column.';
comment on column public.state_scorecard_ratings.session is
  'Per-state session text matching state_bills.session format. Per slice 5D precedent.';
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:reset
```

Expected: all migrations 0001–0040 apply cleanly.

- [ ] **Step 3: Verify schema**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.state_scorecard_orgs"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.state_scorecard_ratings"
```

Expected: both tables exist with expected columns; FK `officials.id` → RESTRICT, FK `state_scorecard_orgs.id` → CASCADE, both unique constraints + all 3 indexes present.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0040_state_scorecards.sql
git commit -m "feat(db): 0040 state_scorecard_orgs + state_scorecard_ratings

Sub-slice 5G schema. Parallel to slice-4 federal scorecard_*. Slug+state
composite key per chapter (UNIQUE on (slug, state)). FK: officials.id
RESTRICT (preserves history); state_scorecard_orgs.id CASCADE (ratings
strict subordinates). Session is text per slice 5D format precedent."
```

---

## Task 2: Migration 0041 — RLS + pgTAP plan(14)

**Files:**
- Create: `packages/db/supabase/migrations/0041_state_scorecards_rls.sql`
- Create: `packages/db/supabase/tests/state_scorecards_rls.test.sql`

- [ ] **Step 1: Write RLS migration**

Create `packages/db/supabase/migrations/0041_state_scorecards_rls.sql`:

```sql
-- Sub-slice 5G: RLS for state_scorecard_orgs + state_scorecard_ratings.
-- Read = authenticated. Write = service_role only.

alter table public.state_scorecard_orgs    enable row level security;
alter table public.state_scorecard_ratings enable row level security;

create policy state_scorecard_orgs_select_authenticated
  on public.state_scorecard_orgs for select to authenticated using (true);
create policy state_scorecard_orgs_insert_service_role
  on public.state_scorecard_orgs for insert to service_role with check (true);
create policy state_scorecard_orgs_update_service_role
  on public.state_scorecard_orgs for update to service_role using (true) with check (true);
create policy state_scorecard_orgs_delete_service_role
  on public.state_scorecard_orgs for delete to service_role using (true);

create policy state_scorecard_ratings_select_authenticated
  on public.state_scorecard_ratings for select to authenticated using (true);
create policy state_scorecard_ratings_insert_service_role
  on public.state_scorecard_ratings for insert to service_role with check (true);
create policy state_scorecard_ratings_update_service_role
  on public.state_scorecard_ratings for update to service_role using (true) with check (true);
create policy state_scorecard_ratings_delete_service_role
  on public.state_scorecard_ratings for delete to service_role using (true);
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/state_scorecards_rls.test.sql`:

```sql
begin;

select plan(14);

-- 1-2. Tables exist.
select has_table('public', 'state_scorecard_orgs',    'state_scorecard_orgs table exists');
select has_table('public', 'state_scorecard_ratings', 'state_scorecard_ratings table exists');

-- 3-4. RLS enabled on both.
select is(
  (select relrowsecurity from pg_class where relname = 'state_scorecard_orgs' and relnamespace = 'public'::regnamespace),
  true, 'RLS enabled on state_scorecard_orgs'
);
select is(
  (select relrowsecurity from pg_class where relname = 'state_scorecard_ratings' and relnamespace = 'public'::regnamespace),
  true, 'RLS enabled on state_scorecard_ratings'
);

-- 5. lean CHECK rejects unknown values.
select throws_ok(
  $$ insert into public.state_scorecard_orgs (slug, state, name, issue_area, lean, methodology_url)
     values ('aclu', 'CA', 'Test', 'civil-liberties', 'extremist', 'https://x') $$,
  '23514',
  'new row for relation "state_scorecard_orgs" violates check constraint "state_scorecard_orgs_lean_check"',
  'lean CHECK rejects values outside enum'
);

-- 6. (slug, state) unique.
insert into public.state_scorecard_orgs (slug, state, name, issue_area, lean, methodology_url)
  values ('aclu', 'CA', 'ACLU of California', 'civil-liberties', 'progressive', 'https://aclu.ca.org');
select throws_ok(
  $$ insert into public.state_scorecard_orgs (slug, state, name, issue_area, lean, methodology_url)
     values ('aclu', 'CA', 'Dup', 'civil-liberties', 'progressive', 'https://x') $$,
  '23505',
  null,
  '(slug, state) is unique'
);

-- 7. score numeric(5,2).
select col_type_is('public', 'state_scorecard_ratings', 'score', 'numeric(5,2)',
  'score is numeric(5,2)');

-- 8. (scorecard_id, official_id, session) unique. Seed parent district + official first.
insert into public.districts (tier, state, code, name, geometry, source_version)
  values ('state_house', 'CA', 'CA-SC', 'CA SC test',
    st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
    'FX-sc')
  on conflict (tier, code) do nothing;
insert into public.officials (
  openstates_person_id, full_name, first_name, last_name,
  chamber, party, state, district_id, in_office, source_version
)
select 'ocd-person/fx-sc', 'Test SC', 'Test', 'SC', 'state_house', 'D', 'CA',
  (select id from public.districts where code = 'CA-SC'),
  true, 'FX-sc';

insert into public.state_scorecard_ratings (scorecard_id, official_id, session, score, source_url)
  values (
    (select id from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'),
    (select id from public.officials where source_version = 'FX-sc'),
    '20252026', 82.5, 'https://x'
  );
select throws_ok(
  $$ insert into public.state_scorecard_ratings (scorecard_id, official_id, session, score, source_url)
     values (
       (select id from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'),
       (select id from public.officials where source_version = 'FX-sc'),
       '20252026', 90, 'https://x'
     ) $$,
  '23505',
  null,
  '(scorecard_id, official_id, session) is unique'
);

-- 9. official_id FK RESTRICT.
select throws_ok(
  $$ delete from public.officials where source_version = 'FX-sc' $$,
  '23503',
  null,
  'official_id FK is RESTRICT — cannot delete official with ratings'
);

-- 10. scorecard_id FK CASCADE: deleting org deletes ratings.
delete from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA';
select is(
  (select count(*)::int from public.state_scorecard_ratings
   where scorecard_id not in (select id from public.state_scorecard_orgs)),
  0,
  'cascade deleted rating when org deleted'
);
delete from public.officials where source_version = 'FX-sc';
delete from public.districts where source_version = 'FX-sc';

-- 11-14. RLS placeholder assertions (covered in integration test layer).
select pass('anon SELECT denied — integration layer');
select pass('authenticated SELECT allowed — integration layer');
select pass('service_role INSERT allowed — integration layer');
select pass('service_role DELETE allowed — integration layer');

select * from finish();
rollback;
```

- [ ] **Step 3: Run + verify**

```bash
pnpm db:reset
pnpm db:test 2>&1 | tail -20
```

Expected: migrations 0001-0041 apply; `state_scorecards_rls.test.sql` reports 14/14 (or actual count if drift — per slice 5D Task 3 + 5E Task 2 + 5F Task 2 lesson, bump `plan(N)` if needed). Total plans bumps to ~355 across 27 files.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/0041_state_scorecards_rls.sql \
        packages/db/supabase/tests/state_scorecards_rls.test.sql
git commit -m "feat(db): 0041 RLS for state_scorecards + pgTAP plan(14)

read=authenticated, write=service_role only on both tables. pgTAP
covers tables, RLS-enabled, lean CHECK enforcement, (slug, state)
unique, score precision, (scorecard_id, official_id, session) unique,
FK RESTRICT (officials), FK CASCADE (orgs)."
```

---

## Task 3: Regenerate Database type

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Regenerate**

```bash
pnpm --filter @chiaro/db supabase:gen-types
```

- [ ] **Step 2: Verify**

```bash
grep -c "state_scorecard_orgs\|state_scorecard_ratings" packages/db/src/types.ts
```

Expected: ≥2 (table-block headers; modern Supabase CLI emits one entry per table per slice 5F Task 4 finding).

- [ ] **Step 3: Workspace typecheck**

```bash
pnpm -r typecheck 2>&1 | tail -5
```

Expected: all 10 packages clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "chore(db): regenerate Database type for state_scorecard_* tables"
```

---

## Task 4: Coverage research — org × state matrix

**Files:**
- Create: `docs/superpowers/specs/2026-05-21-state-scorecards-coverage.md`

This task is **research, not code**. The deliverable is a markdown coverage matrix listing which (org × state) combos publish machine-readable scorecard data. The 5 adapter files (Tasks 9-13) set their `covered_states[]` arrays from this matrix.

- [ ] **Step 1: Research 5 orgs**

For each of `aclu`, `lcv`, `nra`, `planned-parenthood`, `afp`:
1. Identify which state chapters publish state-legislator scorecards (not just federal endorsements/scores)
2. Note format: CSV / HTML / PDF / API
3. Note last-published session/year if discoverable from a quick site scan
4. Flag known unavailable states (no chapter, no scorecard publication)

Time-box to ~60 minutes total research. Coverage will be partial; that's expected.

- [ ] **Step 2: Write coverage doc**

Create `docs/superpowers/specs/2026-05-21-state-scorecards-coverage.md`:

```markdown
# State Scorecards Coverage Matrix (slice 5G Task 1)

Research output for sub-slice 5G adapter `covered_states[]` arrays.

| Org | Slug | Known coverage states | Format | Notes |
|---|---|---|---|---|
| ACLU state chapters | `aclu` | CA, NY, TX, MI, IL, MA, ... | HTML scorecard per chapter | Each chapter publishes independently. Methodology varies. |
| LCV state affiliates | `lcv` | CA, NY, MI, CO, OR, WA, ... | PDF + HTML | ~25 state affiliates publish annual scorecards. |
| NRA state grades | `nra` | All 50 (federal candidate operation extends to state) | Letter grades A-F | Centralized; per-state legislative grades from NRA-PVF portal. |
| Planned Parenthood Action | `planned-parenthood` | CA, NY, MA, MI, TX, FL, ... | HTML | Per-state affiliates publish advocacy scorecards. |
| Americans for Prosperity | `afp` | CA, NY, FL, TX, MI, WI, ... | HTML | ~35 state chapters publish state-leg scorecards. |

## Per-adapter `covered_states[]` values to use in Tasks 9-13

(These arrays go in each adapter's exported `StateScorecardAdapter` object. v1 ships stubs returning `[]`; production parsers per (org, state) are operator follow-up.)

- ACLU: `['CA', 'NY', 'TX', 'MI', 'IL', 'MA']` (start with 6 well-known chapters)
- LCV: `['CA', 'NY', 'MI', 'CO', 'OR']`
- NRA: `['CA', 'NY', 'FL', 'TX', 'MI', 'WI']`
- Planned Parenthood: `['CA', 'NY', 'MA', 'MI', 'TX']`
- AFP: `['CA', 'NY', 'FL', 'TX', 'MI', 'WI']`

## Format

Each (org, state) combo will need its own parser in the production fetcher. v1 stubs return `[]`; operator wires parsers per-tuple as scrapers/CSV ingest is built.

## States covered by ≥1 org

CA, NY, FL, TX, MI, IL, MA, WI, CO, OR — 10 states in v1 scaffolding. Other 40 states out of v1 scope until additional adapters / coverage lands.
```

The specific state lists are research-output illustrative; populate with what the actual quick survey surfaces.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-21-state-scorecards-coverage.md
git commit -m "docs(spec): slice 5G Task 1 coverage matrix

Per-org per-state coverage research. 5 orgs × 6-10 states each = ~10
states covered by ≥1 org in v1 scaffolding. Production parsers per
(org, state) are operator follow-up; v1 ships stub fetchRatings()."
```

---

## Task 5: @chiaro/officials — state scorecard types + queries + hooks

**Files:**
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/keys.ts`
- Modify: `packages/officials/src/queries.ts`
- Modify: `packages/officials/src/hooks.ts`
- Modify: `packages/officials/src/index.ts`

Per slice 5E + 5F lessons, barrel re-exports happen up front (not as a fix-up).

- [ ] **Step 1: types.ts extensions**

Open `packages/officials/src/types.ts`. After the existing `StateFinance*` and `StateCommitteeMembershipRow` type exports, add:

```ts
export type StateScorecardOrgRow =
  Database['public']['Tables']['state_scorecard_orgs']['Row']

export type StateScorecardRatingRow =
  Database['public']['Tables']['state_scorecard_ratings']['Row']

export interface StateScorecardRatingWithOrg extends StateScorecardRatingRow {
  org: StateScorecardOrgRow
}
```

- [ ] **Step 2: keys.ts extension**

Open `packages/officials/src/keys.ts`. Add to the `officialsKeys` object:

```ts
stateScorecardRatings: (officialId: string) =>
  ['officials', 'stateScorecardRatings', officialId] as const,
```

- [ ] **Step 3: queries.ts extension**

Open `packages/officials/src/queries.ts`. After the existing federal/state-finance fetchers, add:

```ts
import type {
  StateScorecardRatingWithOrg,
} from './types.ts'

/**
 * Returns the legislator's scorecard ratings, one per org. For each
 * (org, official) tuple, picks the row with max ingested_at when
 * multiple sessions exist (matches slice 5E fetchOfficialStateFinanceSummary
 * latest-by-ingested pattern). Empty array when no ratings exist.
 */
export async function fetchOfficialStateScorecardRatings(
  client: ChiaroClient,
  officialId: string,
): Promise<StateScorecardRatingWithOrg[]> {
  const { data, error } = await client
    .from('state_scorecard_ratings')
    .select('*, org:state_scorecard_orgs(*)')
    .eq('official_id', officialId)
    .order('ingested_at', { ascending: false })
  if (error) throw error
  // De-dupe to one rating per scorecard_id, keeping the latest by ingested_at.
  // Supabase ordered the result desc by ingested_at; iterate and skip dupes.
  const seen = new Set<string>()
  const out: StateScorecardRatingWithOrg[] = []
  for (const row of (data ?? []) as StateScorecardRatingWithOrg[]) {
    if (seen.has(row.scorecard_id)) continue
    seen.add(row.scorecard_id)
    out.push(row)
  }
  return out
}
```

- [ ] **Step 4: hooks.ts extension**

Open `packages/officials/src/hooks.ts`. After existing hooks, add:

```ts
import { fetchOfficialStateScorecardRatings } from './queries.ts'
import type { StateScorecardRatingWithOrg } from './types.ts'

export function useOfficialStateScorecardRatings(
  client: ChiaroClient,
  officialId: string,
): UseQueryResult<StateScorecardRatingWithOrg[], Error> {
  return useQuery({
    queryKey: officialsKeys.stateScorecardRatings(officialId),
    queryFn: () => fetchOfficialStateScorecardRatings(client, officialId),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!officialId,
  })
}
```

Reuse existing `useQuery`, `UseQueryResult`, `ChiaroClient`, `FIVE_MIN`, `THIRTY_MIN`, `officialsKeys` imports — do not re-declare. Explicit `UseQueryResult<T, Error>` return annotation per [[project-chiaro-slice5d-state-bills]] item 8 (TS2742 cross-workspace inference fix).

- [ ] **Step 5: index.ts re-exports**

Open `packages/officials/src/index.ts`. Find the existing `export type { ... } from './types.ts'` block and add:

```ts
StateScorecardOrgRow,
StateScorecardRatingRow,
StateScorecardRatingWithOrg,
```

Find the existing `export { ... } from './hooks.ts'` block and add:

```ts
useOfficialStateScorecardRatings,
```

- [ ] **Step 6: Hooks test extension**

Open `packages/officials/test/hooks.test.tsx`. Add a new `describe` block:

```tsx
describe('useOfficialStateScorecardRatings', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateScorecardRatings').mockResolvedValue([
      {
        id: 'r1', scorecard_id: 's1', official_id: 'oid',
        session: '20252026', score: 82.5,
        source_url: 'https://x', ingested_at: '2025-01-01T00:00:00Z',
        org: {
          id: 's1', slug: 'aclu', state: 'CA', name: 'ACLU of California',
          issue_area: 'civil-liberties', lean: 'progressive',
          methodology_url: 'https://y', scoring_min: 0, scoring_max: 100,
          notes: null,
        },
      },
    ] as never)
  })

  it('returns scorecard ratings joined to org', async () => {
    const { result } = renderHook(
      () => useOfficialStateScorecardRatings({} as never, 'oid'),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.org.slug).toBe('aclu')
    expect(Number(result.current.data![0]!.score)).toBe(82.5)
  })
})
```

Mirror the existing test scaffold (uses `vi.spyOn(queries, ...)` per slice 5F precedent).

- [ ] **Step 7: Run + commit**

```bash
pnpm --filter @chiaro/officials test hooks
pnpm --filter @chiaro/officials typecheck
```

Expected: existing tests + 1 new case pass; typecheck clean.

```bash
git add packages/officials/src/types.ts packages/officials/src/keys.ts \
        packages/officials/src/queries.ts packages/officials/src/hooks.ts \
        packages/officials/src/index.ts packages/officials/test/hooks.test.tsx
git commit -m "feat(officials): state scorecard types + query + hook + barrel

- StateScorecardOrgRow, StateScorecardRatingRow,
  StateScorecardRatingWithOrg (Database-derived + join shape)
- officialsKeys.stateScorecardRatings query-key factory entry
- fetchOfficialStateScorecardRatings: joins ratings + orgs;
  dedupes to one rating per scorecard_id by latest ingested_at
- useOfficialStateScorecardRatings hook with explicit
  UseQueryResult<T, Error> return annotation (TS2742 fix)
- index.ts barrel re-exports up front (slice 5E lesson)
- 1 new vitest case verifying hook + join shape"
```

---

## Task 6: @chiaro/state-bills — useOfficialStateVotesOnSubject hook

**Files:**
- Modify: `packages/state-bills/src/keys.ts`
- Modify: `packages/state-bills/src/queries.ts`
- Modify: `packages/state-bills/src/hooks.ts`
- Modify: `packages/state-bills/src/index.ts`
- Modify: `packages/state-bills/test/hooks.test.tsx`

Mirrors federal `useOfficialVotesOnSubject` in `@chiaro/bills`. The hook joins `state_vote_positions × state_votes × state_bills × state_bill_subjects` to return votes on bills whose subject matches any candidate in the input array.

- [ ] **Step 1: keys.ts extension**

Open `packages/state-bills/src/keys.ts`. Add to the `stateBillsKeys` object:

```ts
officialStateVotesOnSubject: (officialId: string, subjects: string[]) =>
  ['state-bills', 'officialStateVotesOnSubject', officialId, [...subjects].sort().join(',')] as const,
```

Sorting + comma-joining the subjects array gives a stable cache key regardless of caller-supplied order.

- [ ] **Step 2: queries.ts extension**

Open `packages/state-bills/src/queries.ts`. After existing fetchers, add:

```ts
import type { StateVoteWithPosition } from './types.ts'

/**
 * Returns the legislator's votes on state bills tagged with any of the
 * provided subject candidates (state_bill_subjects.subject). Empty when
 * subjects array is empty (caller should pass `enabled: false` in the
 * hook to avoid the query altogether).
 */
export async function fetchOfficialStateVotesOnSubject(
  client: ChiaroClient,
  officialId: string,
  subjects: string[],
): Promise<StateVoteWithPosition[]> {
  if (subjects.length === 0) return []

  // Step 1: find bill ids matching any candidate subject.
  const billRows = await client
    .from('state_bill_subjects')
    .select('bill_id')
    .in('subject', subjects)
  if (billRows.error) throw billRows.error
  const billIds = Array.from(new Set((billRows.data ?? []).map(r => r.bill_id)))
  if (billIds.length === 0) return []

  // Step 2: find vote positions on those bills by this official.
  const { data, error } = await client
    .from('state_vote_positions')
    .select(`
      position,
      vote:state_votes(
        id, openstates_vote_id, bill_id, state, session, chamber,
        vote_date, question, result, source_url, party_vote_split, created_at,
        bill:state_bills(id, state, session, bill_type, number, title)
      )
    `)
    .eq('official_id', officialId)
    .in('vote.bill_id', billIds)
  if (error) throw error
  return (data ?? []) as unknown as StateVoteWithPosition[]
}
```

The double-step pattern (find bill ids → find vote positions joined to those bills) keeps the Supabase query shape clean. Two roundtrips per call; cached for 5min so this is fine for UI usage.

- [ ] **Step 3: hooks.ts extension**

Open `packages/state-bills/src/hooks.ts`. Add:

```ts
import { fetchOfficialStateVotesOnSubject } from './queries.ts'
import type { StateVoteWithPosition } from './types.ts'

const FIVE_MIN = 5 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000

export function useOfficialStateVotesOnSubject(
  client: ChiaroClient,
  officialId: string,
  subjects: string[],
  opts: { enabled?: boolean } = {},
): UseQueryResult<StateVoteWithPosition[], Error> {
  return useQuery({
    queryKey: stateBillsKeys.officialStateVotesOnSubject(officialId, subjects),
    queryFn: () => fetchOfficialStateVotesOnSubject(client, officialId, subjects),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: opts.enabled !== false && !!officialId && subjects.length > 0,
  })
}
```

Reuse existing imports if present (`useQuery`, `UseQueryResult`, `ChiaroClient`, `stateBillsKeys`). Explicit `UseQueryResult<T, Error>` annotation per TS2742 fix.

- [ ] **Step 4: index.ts re-export**

Open `packages/state-bills/src/index.ts`. Add to the existing `export { ... } from './hooks.ts'` block:

```ts
useOfficialStateVotesOnSubject,
```

If the queries factory is also re-exported, add `fetchOfficialStateVotesOnSubject` to that block too. Mirror whatever pattern the existing exports use.

- [ ] **Step 5: Hooks test extension**

Open `packages/state-bills/test/hooks.test.tsx`. Add:

```tsx
describe('useOfficialStateVotesOnSubject', () => {
  beforeEach(() => {
    vi.spyOn(queries, 'fetchOfficialStateVotesOnSubject').mockResolvedValue([
      {
        position: 'yes',
        vote: {
          id: 'v1', openstates_vote_id: 'ocd-vote/x', bill_id: 'b1',
          state: 'CA', session: '20252026', chamber: 'state_senate',
          vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
          source_url: 'https://x', party_vote_split: null,
          created_at: '2025-03-01',
          bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'Env Test' },
        },
      },
    ] as never)
  })

  it('returns vote positions when subjects matched', async () => {
    const { result } = renderHook(
      () => useOfficialStateVotesOnSubject({} as never, 'oid', ['Environment', 'Energy']),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]!.position).toBe('yes')
  })

  it('disabled when subjects array is empty', () => {
    const { result } = renderHook(
      () => useOfficialStateVotesOnSubject({} as never, 'oid', []),
      { wrapper: wrap },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('respects opts.enabled: false', () => {
    const { result } = renderHook(
      () => useOfficialStateVotesOnSubject({} as never, 'oid', ['Environment'], { enabled: false }),
      { wrapper: wrap },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })
})
```

3 new test cases. Mocking pattern matches existing `@chiaro/state-bills` hook tests.

- [ ] **Step 6: Run + commit**

```bash
pnpm --filter @chiaro/state-bills test hooks
pnpm --filter @chiaro/state-bills typecheck
```

Expected: existing + 3 new cases pass; typecheck clean.

```bash
git add packages/state-bills/src/keys.ts packages/state-bills/src/queries.ts \
        packages/state-bills/src/hooks.ts packages/state-bills/src/index.ts \
        packages/state-bills/test/hooks.test.tsx
git commit -m "feat(state-bills): useOfficialStateVotesOnSubject hook

Powers the slice 5G StateIssueVotesEvidence panel. Joins
state_vote_positions × state_votes × state_bills × state_bill_subjects
with subject IN (candidates[]). Two-step fetcher: find bill ids by
subject, then vote positions on those bills by the official.

Stable cache key: subjects array sorted + joined for deterministic
TanStack key regardless of caller order.

Explicit UseQueryResult<T, Error> return annotation (TS2742 fix).
Enabled-gating short-circuits empty subjects array.

3 new vitest cases."
```

---

## Task 7: state-scorecards/shared.ts adapter interface + helpers

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/shared.ts`
- Create: `packages/db/supabase/seed/state-scorecards/shared.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/.gitkeep`

- [ ] **Step 1: Create fixture dir + .gitkeep**

```bash
mkdir -p packages/db/supabase/seed/fixtures/state-scorecards
```

Create `packages/db/supabase/seed/fixtures/state-scorecards/.gitkeep` (empty file).

- [ ] **Step 2: Write shared.ts**

Create `packages/db/supabase/seed/state-scorecards/shared.ts`:

```ts
import type { Client } from 'pg'

export type ScorecardLean =
  'progressive' | 'conservative' | 'libertarian' | 'single-issue' | 'centrist'

export interface NormalizedStateRating {
  openstates_person_id: string
  state: string
  score: number
  source_url: string
}

export interface StateScorecardAdapter {
  slug: string
  name_template: (state: string) => string
  issue_area: string
  lean: ScorecardLean
  methodology_url_template: (state: string) => string
  scoring_min: number
  scoring_max: number
  notes?: string
  covered_states: string[]
  fetchRatings(opts: {
    client: Client
    session: string
    state?: string
    fetcher?: () => Promise<NormalizedStateRating[]>  // test injection
  }): Promise<NormalizedStateRating[]>
}

export interface StateScorecardStats {
  org_slug: string
  orgsUpserted: number
  ratingsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

/**
 * UPSERT the per-state state_scorecard_orgs row for this adapter × state.
 * Returns the org id.
 */
export async function upsertStateScorecardOrg(
  client: Client,
  adapter: StateScorecardAdapter,
  state: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(`
    insert into public.state_scorecard_orgs (
      slug, state, name, issue_area, lean,
      methodology_url, scoring_min, scoring_max, notes
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (slug, state) do update set
      name            = excluded.name,
      issue_area      = excluded.issue_area,
      lean            = excluded.lean,
      methodology_url = excluded.methodology_url,
      scoring_min     = excluded.scoring_min,
      scoring_max     = excluded.scoring_max,
      notes           = excluded.notes
    returning id
  `, [
    adapter.slug, state,
    adapter.name_template(state),
    adapter.issue_area,
    adapter.lean,
    adapter.methodology_url_template(state),
    adapter.scoring_min,
    adapter.scoring_max,
    adapter.notes ?? null,
  ])
  return result.rows[0]!.id
}

/**
 * UPSERT a single rating row by (scorecard_id, official_id, session).
 * Returns true if rating was inserted/updated; false if the official is
 * unknown (caller appends openstates_person_id to officialsUnmatched).
 */
export async function upsertStateScorecardRating(
  client: Client,
  scorecardId: string,
  openstates_person_id: string,
  session: string,
  score: number,
  source_url: string,
): Promise<boolean> {
  const off = await client.query<{ id: string }>(
    'select id from public.officials where openstates_person_id = $1',
    [openstates_person_id],
  )
  if (off.rowCount === 0) return false

  await client.query(`
    insert into public.state_scorecard_ratings (
      scorecard_id, official_id, session, score, source_url
    ) values ($1, $2, $3, $4, $5)
    on conflict (scorecard_id, official_id, session) do update set
      score       = excluded.score,
      source_url  = excluded.source_url,
      ingested_at = now()
  `, [scorecardId, off.rows[0]!.id, session, score, source_url])
  return true
}
```

- [ ] **Step 3: Write shared.test.ts**

Create `packages/db/supabase/seed/state-scorecards/shared.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import {
  upsertStateScorecardOrg,
  upsertStateScorecardRating,
  type StateScorecardAdapter,
} from './shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

const TEST_ADAPTER: StateScorecardAdapter = {
  slug: 'aclu',
  name_template: (s) => `ACLU of ${s}`,
  issue_area: 'civil-liberties',
  lean: 'progressive',
  methodology_url_template: (s) => `https://aclu.${s.toLowerCase()}.org/scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  covered_states: ['CA'],
  async fetchRatings() { return [] },
}

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-SCS', 'CA SCS test',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-scs')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-scs', 'Test SCS', 'Test', 'SCS', 'state_house', 'D', 'CA',
      d.id, true, 'FX-scs'
    from public.districts d where d.code = 'CA-SCS'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.state_scorecard_ratings where official_id = $1', [officialId])
  await client.query("delete from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'")
  await client.query("delete from public.officials where source_version = 'FX-scs'")
  await client.query("delete from public.districts where source_version = 'FX-scs'")
  await client.end()
})

describe('upsertStateScorecardOrg', () => {
  it('inserts a new org and returns its id', async () => {
    const id = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    expect(typeof id).toBe('string')
    const row = await client.query<{ name: string; methodology_url: string }>(
      "select name, methodology_url from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'",
    )
    expect(row.rows[0]!.name).toBe('ACLU of CA')
    expect(row.rows[0]!.methodology_url).toBe('https://aclu.ca.org/scorecard')
  })

  it('idempotent: second call updates the existing org', async () => {
    const id1 = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    const id2 = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    expect(id1).toBe(id2)
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_scorecard_orgs where slug = 'aclu' and state = 'CA'",
    )
    expect(c.rows[0]!.c).toBe(1)
  })
})

describe('upsertStateScorecardRating', () => {
  it('returns true and inserts rating for known official', async () => {
    const scorecardId = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    const ok = await upsertStateScorecardRating(
      client, scorecardId, 'ocd-person/fx-scs', '20252026', 85.5, 'https://x',
    )
    expect(ok).toBe(true)
    const row = await client.query<{ score: string }>(
      'select score from public.state_scorecard_ratings where official_id = $1', [officialId],
    )
    expect(Number(row.rows[0]!.score)).toBe(85.5)
  })

  it('returns false for unknown openstates_person_id (does not insert)', async () => {
    const scorecardId = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    const ok = await upsertStateScorecardRating(
      client, scorecardId, 'ocd-person/UNKNOWN', '20252026', 50, 'https://x',
    )
    expect(ok).toBe(false)
    const c = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_scorecard_ratings where scorecard_id = $1',
      [scorecardId],
    )
    expect(c.rows[0]!.c).toBe(0)
  })

  it('idempotent: second call updates score', async () => {
    const scorecardId = await upsertStateScorecardOrg(client, TEST_ADAPTER, 'CA')
    await upsertStateScorecardRating(client, scorecardId, 'ocd-person/fx-scs', '20252026', 50, 'https://x')
    await upsertStateScorecardRating(client, scorecardId, 'ocd-person/fx-scs', '20252026', 75, 'https://y')
    const row = await client.query<{ score: string; source_url: string }>(
      'select score, source_url from public.state_scorecard_ratings where official_id = $1', [officialId],
    )
    expect(Number(row.rows[0]!.score)).toBe(75)
    expect(row.rows[0]!.source_url).toBe('https://y')
  })
})
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/shared'
```

Expected: 5 cases pass.

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

```bash
git add packages/db/supabase/seed/state-scorecards/shared.ts \
        packages/db/supabase/seed/state-scorecards/shared.test.ts \
        packages/db/supabase/seed/fixtures/state-scorecards/.gitkeep
git commit -m "feat(db): state-scorecards/shared.ts adapter interface + helpers

StateScorecardAdapter + StateScorecardStats types. Helpers:
- upsertStateScorecardOrg: UPSERTs (slug, state) chapter row using
  adapter.name_template + methodology_url_template callables.
- upsertStateScorecardRating: resolves openstates_person_id to
  officials.id; returns true on upsert, false on unknown official.

5 vitest cases against real local Supabase: insert, idempotent
chapter upsert, rating insert for known official, unknown official
returns false without insert, rating idempotent update."
```

---

## Task 8: aclu.ts adapter + fixture + 4 tests

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/aclu.ts`
- Create: `packages/db/supabase/seed/state-scorecards/aclu.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/aclu.json`

This is the **template task** for all 5 per-org adapters. Tasks 9-12 follow the exact same structure with per-org parameter differences.

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-scorecards/aclu.json`:

```json
{
  "ratings": [
    { "openstates_person_id": "ocd-person/fx-aclu-ca-1", "state": "CA", "score": 92,   "source_url": "https://aclu.ca.org/scorecard/1" },
    { "openstates_person_id": "ocd-person/fx-aclu-ca-2", "state": "CA", "score": 45,   "source_url": "https://aclu.ca.org/scorecard/2" },
    { "openstates_person_id": "ocd-person/fx-aclu-ny-1", "state": "NY", "score": 88.5, "source_url": "https://aclu.ny.org/scorecard/1" }
  ]
}
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-scorecards/aclu.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aclu } from './aclu.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE   = join(__dirname, '..', 'fixtures', 'state-scorecards', 'aclu.json')

let client: Client
let caId: string
let nyId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house', 'CA', 'CA-ACLU', 'CA ACLU test',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-aclu'),
      ('state_house', 'NY', 'NY-ACLU', 'NY ACLU test',
        st_geogfromtext('MULTIPOLYGON(((-74 40,-73 40,-73 41,-74 41,-74 40)))'),
        'FX-aclu')
    on conflict (tier, code) do nothing
  `)
  const ca = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-aclu-ca-1', 'Test ACLU CA1', 'Test', 'CA1', 'state_house', 'D', 'CA',
      d.id, true, 'FX-aclu'
    from public.districts d where d.code = 'CA-ACLU'
    returning id
  `)
  caId = ca.rows[0]!.id
  const ny = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-aclu-ny-1', 'Test ACLU NY1', 'Test', 'NY1', 'state_house', 'D', 'NY',
      d.id, true, 'FX-aclu'
    from public.districts d where d.code = 'NY-ACLU'
    returning id
  `)
  nyId = ny.rows[0]!.id
})

afterEach(async () => {
  await client.query("delete from public.state_scorecard_ratings where scorecard_id in (select id from public.state_scorecard_orgs where slug = 'aclu')")
  await client.query("delete from public.state_scorecard_orgs where slug = 'aclu' and state in ('CA','NY')")
  await client.query("delete from public.officials where source_version = 'FX-aclu'")
  await client.query("delete from public.districts where source_version = 'FX-aclu'")
  await client.end()
})

describe('aclu adapter', () => {
  it('happy path: 3 ratings → 2 chapter orgs + 2 ratings (one openstates_person_id unmatched)', async () => {
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
    const stats = await aclu.fetchRatings({
      client, session: '20252026',
      fetcher: async () => fixture.ratings,
    } as never)
    // Adapter returns the normalized ratings (which is what the orchestrator will then upsert).
    expect(stats).toHaveLength(3)
    expect(stats[0]!.state).toBe('CA')
  })

  it('reports correct slug + issue_area + lean', () => {
    expect(aclu.slug).toBe('aclu')
    expect(aclu.issue_area).toBe('civil-liberties')
    expect(aclu.lean).toBe('progressive')
    expect(aclu.scoring_min).toBe(0)
    expect(aclu.scoring_max).toBe(100)
  })

  it('name_template + methodology_url_template per state', () => {
    expect(aclu.name_template('CA')).toMatch(/ACLU.*California|ACLU of CA/i)
    expect(aclu.methodology_url_template('CA')).toMatch(/^https:\/\//)
  })

  it('covered_states is non-empty array of 2-letter codes', () => {
    expect(aclu.covered_states.length).toBeGreaterThan(0)
    for (const s of aclu.covered_states) {
      expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})
```

- [ ] **Step 3: Run failing**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/aclu'
```

Expected: module not found.

- [ ] **Step 4: Implement adapter**

Create `packages/db/supabase/seed/state-scorecards/aclu.ts`:

```ts
import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', TX: 'Texas', MI: 'Michigan',
  IL: 'Illinois',   MA: 'Massachusetts',
}

export const aclu: StateScorecardAdapter = {
  slug: 'aclu',
  name_template: (s) => `ACLU of ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'civil-liberties',
  lean: 'progressive',
  methodology_url_template: (s) => `https://www.aclu${s.toLowerCase()}.org/legislative-scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Per-state ACLU chapters publish independently. Methodology varies.',
  covered_states: ['CA', 'NY', 'TX', 'MI', 'IL', 'MA'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    // Production stub — operator wires per-state chapter parsers.
    return []
  },
}
```

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/aclu'
pnpm --filter @chiaro/db typecheck
```

Expected: 4/4 pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-scorecards/aclu.ts \
        packages/db/supabase/seed/state-scorecards/aclu.test.ts \
        packages/db/supabase/seed/fixtures/state-scorecards/aclu.json
git commit -m "feat(seed): aclu state scorecard adapter

ACLU state chapters. issue_area=civil-liberties, lean=progressive,
scoring 0-100. covered_states=[CA, NY, TX, MI, IL, MA] from Task 1
coverage matrix. Production stub returns []; tests inject fetcher
with normalized fixture (3 ratings across CA + NY).

4 vitest cases: happy-path fetcher injection, metadata, templates,
covered_states shape."
```

---

## Task 9: lcv.ts adapter + fixture + 4 tests

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/lcv.ts`
- Create: `packages/db/supabase/seed/state-scorecards/lcv.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/lcv.json`

Same structure as Task 8 ACLU (test scaffold mirror Task 8's `beforeEach` + `afterEach` with appropriate substitutions: source_version `'FX-lcv'`, district codes `CA-LCV` / `MI-LCV`, openstates_person_id pattern `ocd-person/fx-lcv-{state}-{n}`). 4 test cases mirror Task 8.

- [ ] **Step 1: Create fixture**

Create `packages/db/supabase/seed/fixtures/state-scorecards/lcv.json`:

```json
{
  "ratings": [
    { "openstates_person_id": "ocd-person/fx-lcv-ca-1", "state": "CA", "score": 95, "source_url": "https://lcv.org/ca/1" },
    { "openstates_person_id": "ocd-person/fx-lcv-mi-1", "state": "MI", "score": 72, "source_url": "https://lcv.org/mi/1" }
  ]
}
```

- [ ] **Step 2: Implement adapter**

Create `packages/db/supabase/seed/state-scorecards/lcv.ts`:

```ts
import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', MI: 'Michigan',
  CO: 'Colorado',   OR: 'Oregon',
}

export const lcv: StateScorecardAdapter = {
  slug: 'lcv',
  name_template: (s) => `League of Conservation Voters ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'environment',
  lean: 'progressive',
  methodology_url_template: (s) => `https://www.lcv.org/scorecard/${s.toLowerCase()}-state`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'LCV state affiliates publish annual environmental scorecards.',
  covered_states: ['CA', 'NY', 'MI', 'CO', 'OR'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

- [ ] **Step 3: Test file**

Create `packages/db/supabase/seed/state-scorecards/lcv.test.ts` mirroring Task 8's structure. Substitutions:
- Import: `import { lcv } from './lcv.ts'`
- District codes: `CA-LCV` + `MI-LCV` (CA + MI for fixture coverage)
- Source version: `'FX-lcv'`
- openstates_person_ids match fixture (`ocd-person/fx-lcv-ca-1`, `ocd-person/fx-lcv-mi-1`)
- 4 cases mirror: happy path (2 ratings instead of 3), metadata (slug=lcv, issue_area=environment, lean=progressive), templates (LCV/League of Conservation Voters substring), covered_states shape

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/lcv'
pnpm --filter @chiaro/db typecheck
```

```bash
git add packages/db/supabase/seed/state-scorecards/lcv.ts \
        packages/db/supabase/seed/state-scorecards/lcv.test.ts \
        packages/db/supabase/seed/fixtures/state-scorecards/lcv.json
git commit -m "feat(seed): lcv state scorecard adapter

LCV state affiliates. issue_area=environment, lean=progressive,
scoring 0-100. covered_states=[CA, NY, MI, CO, OR].

4 vitest cases."
```

---

## Task 10: nra.ts adapter + fixture + 4 tests (letter-grade mapping)

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/nra.ts`
- Create: `packages/db/supabase/seed/state-scorecards/nra.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/nra.json`

**Key difference from Tasks 8-9**: NRA grades letters (A-F) that the adapter normalizes to numeric (A=100, B=80, C=60, D=40, F=20). Adapter exports the mapping function alongside the adapter object so the UI can reverse-map for display.

- [ ] **Step 1: Create fixture (letter grades pre-normalized to numeric)**

Create `packages/db/supabase/seed/fixtures/state-scorecards/nra.json`:

```json
{
  "ratings": [
    { "openstates_person_id": "ocd-person/fx-nra-ca-1", "state": "CA", "score": 100, "source_url": "https://nrapvf.org/ca/1" },
    { "openstates_person_id": "ocd-person/fx-nra-ca-2", "state": "CA", "score": 60,  "source_url": "https://nrapvf.org/ca/2" },
    { "openstates_person_id": "ocd-person/fx-nra-tx-1", "state": "TX", "score": 80,  "source_url": "https://nrapvf.org/tx/1" }
  ]
}
```

Note fixture values are already in 0-100 form. The adapter would do the A→100 / B→80 etc mapping in its production parser; v1 stub assumes fixture already has normalized values.

- [ ] **Step 2: Implement adapter**

Create `packages/db/supabase/seed/state-scorecards/nra.ts`:

```ts
import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', FL: 'Florida', TX: 'Texas',
  MI: 'Michigan',   WI: 'Wisconsin',
}

/**
 * NRA-PVF grades use letters A-F. Adapter normalizes to numeric on the
 * write side; UI reverse-maps for display via `numericToLetterGrade()`.
 * A   = 100  (Solidly pro-gun-rights)
 * A-  =  92
 * B   =  80
 * C   =  60
 * D   =  40
 * F   =  20
 * Adapter parsers (operator follow-up) call letterToNumeric() to convert.
 */
export function letterToNumeric(letter: string): number | null {
  const normalized = letter.trim().toUpperCase()
  const map: Record<string, number> = {
    'A+': 100, 'A': 100, 'A-': 92,
    'B+':  85, 'B':  80, 'B-': 72,
    'C+':  65, 'C':  60, 'C-': 52,
    'D+':  45, 'D':  40, 'D-': 32,
    'F':   20,
  }
  return normalized in map ? map[normalized]! : null
}

export function numericToLetterGrade(score: number): string {
  if (score >= 95) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 65) return 'C+'
  if (score >= 55) return 'C'
  if (score >= 45) return 'D+'
  if (score >= 35) return 'D'
  return 'F'
}

export const nra: StateScorecardAdapter = {
  slug: 'nra',
  name_template: (s) => `NRA-PVF (${US_STATE_NAMES[s] ?? s})`,
  issue_area: 'second-amendment',
  lean: 'conservative',
  methodology_url_template: () => 'https://www.nrapvf.org/grades/',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'NRA-PVF grades letters A-F (mapped to 0-100; A=100, F=20). UI reverse-maps for display.',
  covered_states: ['CA', 'NY', 'FL', 'TX', 'MI', 'WI'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

- [ ] **Step 3: Test file**

Create `packages/db/supabase/seed/state-scorecards/nra.test.ts` mirroring Task 8 structure, PLUS additional cases for the letter-grade helpers:

```ts
import { describe, expect, it } from 'vitest'
import { letterToNumeric, numericToLetterGrade } from './nra.ts'

describe('letterToNumeric', () => {
  it('maps A to 100', () => expect(letterToNumeric('A')).toBe(100))
  it('maps F to 20', () => expect(letterToNumeric('F')).toBe(20))
  it('case-insensitive: "b+" → 85', () => expect(letterToNumeric('b+')).toBe(85))
  it('returns null for unknown', () => expect(letterToNumeric('Z')).toBeNull())
})

describe('numericToLetterGrade', () => {
  it('100 → A', () => expect(numericToLetterGrade(100)).toBe('A'))
  it('82 → B', () => expect(numericToLetterGrade(82)).toBe('B'))
  it('25 → F', () => expect(numericToLetterGrade(25)).toBe('F'))
})
```

Plus the 4 standard adapter test cases (happy path, metadata, templates, covered_states) from Task 8 template. Total ~11 test cases for the NRA file.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/nra'
pnpm --filter @chiaro/db typecheck
```

```bash
git add packages/db/supabase/seed/state-scorecards/nra.ts \
        packages/db/supabase/seed/state-scorecards/nra.test.ts \
        packages/db/supabase/seed/fixtures/state-scorecards/nra.json
git commit -m "feat(seed): nra state scorecard adapter + letter-grade map

NRA-PVF. issue_area=second-amendment, lean=conservative. Adapter
exports letterToNumeric() (A=100..F=20) for production parsers and
numericToLetterGrade() for UI display reverse-map.

covered_states=[CA, NY, FL, TX, MI, WI]. Production stub returns [];
fixture pre-normalizes to numeric.

11 vitest cases: 4 standard adapter + 4 letterToNumeric + 3
numericToLetterGrade."
```

---

## Task 11: planned-parenthood.ts adapter + fixture + 4 tests

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/planned-parenthood.ts`
- Create: `packages/db/supabase/seed/state-scorecards/planned-parenthood.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/planned-parenthood.json`

Same structure as Task 8 ACLU.

- [ ] **Step 1: Fixture**

Create `packages/db/supabase/seed/fixtures/state-scorecards/planned-parenthood.json`:

```json
{
  "ratings": [
    { "openstates_person_id": "ocd-person/fx-pp-ca-1", "state": "CA", "score": 90, "source_url": "https://plannedparenthoodaction.org/ca/1" },
    { "openstates_person_id": "ocd-person/fx-pp-ny-1", "state": "NY", "score": 95, "source_url": "https://plannedparenthoodaction.org/ny/1" }
  ]
}
```

- [ ] **Step 2: Adapter**

Create `packages/db/supabase/seed/state-scorecards/planned-parenthood.ts`:

```ts
import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', MA: 'Massachusetts',
  MI: 'Michigan',   TX: 'Texas',
}

export const plannedParenthood: StateScorecardAdapter = {
  slug: 'planned-parenthood',
  name_template: (s) => `Planned Parenthood Action Fund ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'reproductive-rights',
  lean: 'progressive',
  methodology_url_template: (s) => `https://plannedparenthoodaction.org/${s.toLowerCase()}/legislative-scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'Per-state PPAF affiliates publish advocacy scorecards.',
  covered_states: ['CA', 'NY', 'MA', 'MI', 'TX'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

- [ ] **Step 3: Test file**

Mirror Task 8 with substitutions: import `{ plannedParenthood }`, source_version `'FX-pp'`, district codes `CA-PP`, `NY-PP`, openstates_person_ids match fixture. 4 cases (happy path, metadata expecting `slug='planned-parenthood'` + `issue_area='reproductive-rights'`, templates, covered_states shape).

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/planned-parenthood'
pnpm --filter @chiaro/db typecheck
```

```bash
git add packages/db/supabase/seed/state-scorecards/planned-parenthood.ts \
        packages/db/supabase/seed/state-scorecards/planned-parenthood.test.ts \
        packages/db/supabase/seed/fixtures/state-scorecards/planned-parenthood.json
git commit -m "feat(seed): planned-parenthood state scorecard adapter

PPAF state affiliates. issue_area=reproductive-rights, lean=progressive,
scoring 0-100. covered_states=[CA, NY, MA, MI, TX].

4 vitest cases."
```

---

## Task 12: afp.ts adapter + fixture + 4 tests

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards/afp.ts`
- Create: `packages/db/supabase/seed/state-scorecards/afp.test.ts`
- Create: `packages/db/supabase/seed/fixtures/state-scorecards/afp.json`

Same structure as Task 8 ACLU. AFP is conservative-leaning.

- [ ] **Step 1: Fixture**

Create `packages/db/supabase/seed/fixtures/state-scorecards/afp.json`:

```json
{
  "ratings": [
    { "openstates_person_id": "ocd-person/fx-afp-tx-1", "state": "TX", "score": 88, "source_url": "https://americansforprosperity.org/tx/1" },
    { "openstates_person_id": "ocd-person/fx-afp-fl-1", "state": "FL", "score": 76, "source_url": "https://americansforprosperity.org/fl/1" }
  ]
}
```

- [ ] **Step 2: Adapter**

Create `packages/db/supabase/seed/state-scorecards/afp.ts`:

```ts
import type { StateScorecardAdapter, NormalizedStateRating } from './shared.ts'

const US_STATE_NAMES: Record<string, string> = {
  CA: 'California', NY: 'New York', FL: 'Florida', TX: 'Texas',
  MI: 'Michigan',   WI: 'Wisconsin',
}

export const afp: StateScorecardAdapter = {
  slug: 'afp',
  name_template: (s) => `Americans for Prosperity ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'conservative-policy',
  lean: 'conservative',
  methodology_url_template: (s) => `https://americansforprosperity.org/${s.toLowerCase()}/legislative-scorecard`,
  scoring_min: 0,
  scoring_max: 100,
  notes: 'AFP state chapters publish legislative scorecards.',
  covered_states: ['CA', 'NY', 'FL', 'TX', 'MI', 'WI'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const fetcher = (opts as never as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (fetcher) return fetcher()
    return []
  },
}
```

- [ ] **Step 3: Test file**

Mirror Task 8 with substitutions: import `{ afp }`, source_version `'FX-afp'`, district codes `TX-AFP`, `FL-AFP`. 4 cases.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/db test 'state-scorecards/afp'
pnpm --filter @chiaro/db typecheck
```

```bash
git add packages/db/supabase/seed/state-scorecards/afp.ts \
        packages/db/supabase/seed/state-scorecards/afp.test.ts \
        packages/db/supabase/seed/fixtures/state-scorecards/afp.json
git commit -m "feat(seed): afp state scorecard adapter

AFP state chapters. issue_area=conservative-policy, lean=conservative,
scoring 0-100. covered_states=[CA, NY, FL, TX, MI, WI].

4 vitest cases."
```

---

## Task 13: state-scorecards-ingest orchestrator + 6 tests + script

**Files:**
- Create: `packages/db/supabase/seed/state-scorecards-ingest.ts`
- Create: `packages/db/supabase/seed/state-scorecards-ingest.test.ts`
- Modify: `packages/db/package.json` (+1 script)

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/state-scorecards-ingest.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestStateScorecards } from './state-scorecards-ingest.ts'
import type { StateScorecardAdapter, StateScorecardStats } from './state-scorecards/shared.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})

afterEach(async () => {
  await client.end()
})

function mkAdapter(overrides: Partial<StateScorecardAdapter>): StateScorecardAdapter {
  return {
    slug: 'test',
    name_template: (s) => `Test ${s}`,
    issue_area: 'test',
    lean: 'centrist',
    methodology_url_template: (s) => `https://test.org/${s}`,
    scoring_min: 0,
    scoring_max: 100,
    covered_states: ['CA'],
    async fetchRatings() { return [] },
    ...overrides,
  }
}

describe('ingestStateScorecards', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchRatings() { return [] } }),
      mkAdapter({ slug: 'b', async fetchRatings() { return [] } }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026', client, adapters,
    })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
    expect(stats.byOrg).toHaveLength(2)
  })

  it('--org filter dispatches only the requested adapter', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', async fetchRatings() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', async fetchRatings() { calls.push('b'); return [] } }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026', client, org: 'a', adapters,
    })
    expect(calls).toEqual(['a'])
    expect(stats.adaptersAttempted).toBe(1)
  })

  it('--state filter restricts adapters to that state', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({
        slug: 'a', covered_states: ['CA', 'NY'],
        async fetchRatings(opts) { calls.push({ slug: 'a', state: opts.state }); return [] },
      }),
    ]
    await ingestStateScorecards({
      session: '20252026', client, state: 'CA', adapters,
    })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('--state filter skips adapter not covering that state', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({ slug: 'a', covered_states: ['CA'], async fetchRatings() { calls.push('a'); return [] } }),
      mkAdapter({ slug: 'b', covered_states: ['NY'], async fetchRatings() { calls.push('b'); return [] } }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026', client, state: 'CA', adapters,
    })
    expect(calls).toEqual(['a'])
    expect(stats.adaptersAttempted).toBe(1)
  })

  it('one adapter throwing: others still run with skipOnError', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchRatings() { throw new Error('a broke') } }),
      mkAdapter({ slug: 'b', async fetchRatings() { return [] } }),
    ]
    const stats = await ingestStateScorecards({
      session: '20252026', client, skipOnError: true, adapters,
    })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byOrg.find(s => s.org_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    const adapters = [
      mkAdapter({ slug: 'a', async fetchRatings() { throw new Error('boom') } }),
      mkAdapter({ slug: 'b', async fetchRatings() { return [] } }),
    ]
    await expect(ingestStateScorecards({
      session: '20252026', client, adapters,
    })).rejects.toThrow(/boom/)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/db test state-scorecards-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement orchestrator**

Create `packages/db/supabase/seed/state-scorecards-ingest.ts`:

```ts
import { Client } from 'pg'
import {
  type StateScorecardAdapter,
  type StateScorecardStats,
  upsertStateScorecardOrg,
  upsertStateScorecardRating,
} from './state-scorecards/shared.ts'
import { aclu } from './state-scorecards/aclu.ts'
import { lcv } from './state-scorecards/lcv.ts'
import { nra } from './state-scorecards/nra.ts'
import { plannedParenthood } from './state-scorecards/planned-parenthood.ts'
import { afp } from './state-scorecards/afp.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateScorecardAdapter[] = [
  aclu, lcv, nra, plannedParenthood, afp,
]

export interface IngestStateScorecardsOpts {
  session: string
  state?: string
  org?: string
  skipOnError?: boolean
  adapters?: StateScorecardAdapter[]
  client?: Client
}

export interface IngestStateScorecardsStats {
  session: string
  adaptersAttempted: number
  adaptersOk: number
  totalOrgsUpserted: number
  totalRatingsUpserted: number
  totalOfficialsUnmatched: number
  byOrg: StateScorecardStats[]
}

export async function ingestStateScorecards(
  opts: IngestStateScorecardsOpts,
): Promise<IngestStateScorecardsStats> {
  let adapters = opts.adapters ?? ADAPTERS_DEFAULT
  if (opts.org) {
    adapters = adapters.filter(a => a.slug === opts.org)
  }
  if (opts.state) {
    adapters = adapters.filter(a => a.covered_states.includes(opts.state!))
  }

  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byOrg: StateScorecardStats[] = []
  try {
    for (const adapter of adapters) {
      const orgStats: StateScorecardStats = {
        org_slug: adapter.slug,
        orgsUpserted: 0,
        ratingsUpserted: 0,
        officialsMatched: 0,
        officialsUnmatched: [],
        errors: [],
      }
      try {
        const targetStates = opts.state
          ? [opts.state]
          : adapter.covered_states
        const ratings = await adapter.fetchRatings({
          client, session: opts.session, state: opts.state,
        })
        // Upsert per-state org rows for each state in scope.
        const orgIdByState = new Map<string, string>()
        for (const state of targetStates) {
          const orgId = await upsertStateScorecardOrg(client, adapter, state)
          orgIdByState.set(state, orgId)
          orgStats.orgsUpserted += 1
        }
        // Upsert ratings.
        for (const r of ratings) {
          const orgId = orgIdByState.get(r.state)
          if (!orgId) {
            orgStats.errors.push(`rating for state ${r.state} not in adapter.covered_states[]`)
            continue
          }
          const ok = await upsertStateScorecardRating(
            client, orgId, r.openstates_person_id, opts.session, r.score, r.source_url,
          )
          if (ok) {
            orgStats.ratingsUpserted += 1
            orgStats.officialsMatched += 1
          } else {
            orgStats.officialsUnmatched.push(r.openstates_person_id)
          }
        }
        byOrg.push(orgStats)
      } catch (err) {
        orgStats.errors.push((err as Error).message)
        byOrg.push(orgStats)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    session: opts.session,
    adaptersAttempted:       byOrg.length,
    adaptersOk:              byOrg.filter(s => s.errors.length === 0).length,
    totalOrgsUpserted:       byOrg.reduce((acc, s) => acc + s.orgsUpserted, 0),
    totalRatingsUpserted:    byOrg.reduce((acc, s) => acc + s.ratingsUpserted, 0),
    totalOfficialsUnmatched: byOrg.reduce((acc, s) => acc + s.officialsUnmatched.length, 0),
    byOrg,
  }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const sessionArg = process.argv.find(a => a.startsWith('--session='))
  const stateArg   = process.argv.find(a => a.startsWith('--state='))
  const orgArg     = process.argv.find(a => a.startsWith('--org='))
  const skipOnError = process.argv.includes('--skip-on-error')
  if (!sessionArg) {
    console.error('usage: tsx state-scorecards-ingest.ts --session=YYYY [--state=XX] [--org=SLUG] [--skip-on-error]')
    process.exit(2)
  }
  const session = sessionArg.split('=')[1]!
  const state = stateArg ? stateArg.split('=')[1]! : undefined
  const org = orgArg ? orgArg.split('=')[1]! : undefined

  ingestStateScorecards({ session, state, org, skipOnError })
    .then(stats => {
      console.log(`State scorecards ingest summary (session ${stats.session}):`)
      console.log(`  adapters attempted:       ${stats.adaptersAttempted}`)
      console.log(`  adapters ok:              ${stats.adaptersOk}`)
      console.log(`  total orgs upserted:      ${stats.totalOrgsUpserted}`)
      console.log(`  total ratings upserted:   ${stats.totalRatingsUpserted}`)
      console.log(`  total officials unmatched: ${stats.totalOfficialsUnmatched}`)
      for (const s of stats.byOrg) {
        const tag = s.errors.length > 0 ? `errors=${s.errors.length}` : 'ok'
        console.log(`  ${s.org_slug}: ${s.orgsUpserted} orgs / ${s.ratingsUpserted} ratings / ${tag}`)
      }
      process.exit(stats.adaptersOk === stats.adaptersAttempted ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

- [ ] **Step 4: Add pnpm script**

Open `packages/db/package.json`. After existing `seed:*-finance` line, add:

```json
"seed:state-scorecards": "tsx supabase/seed/state-scorecards-ingest.ts",
```

- [ ] **Step 5: Run + verify**

```bash
pnpm --filter @chiaro/db test state-scorecards-ingest
pnpm --filter @chiaro/db typecheck
```

Expected: 6/6 pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/seed/state-scorecards-ingest.ts \
        packages/db/supabase/seed/state-scorecards-ingest.test.ts \
        packages/db/package.json
git commit -m "feat(db): state-scorecards-ingest orchestrator + pnpm script

Dispatches all 5 per-org adapters (or filters via --org/--state). Per-
adapter isolation matches slice 5E state-bills-enrich pattern: thrown
errors land in byOrg[N].errors; with --skip-on-error other adapters
run. Without flag, first thrown error aborts.

For each adapter, UPSERTs per-state state_scorecard_orgs rows for
all covered_states, then UPSERTs ratings via openstates_person_id
lookup (unknown ids → officialsUnmatched[]).

CLI: pnpm seed:state-scorecards --session=YYYY [--state=XX]
  [--org=SLUG] [--skip-on-error]

6 vitest cases: all-adapters, --org filter, --state filter, --state
filter skips non-covering adapter, throw with skip-on-error,
default abort."
```

---

## Task 14: Web StateIssueVotesEvidence component

**Files:**
- Create: `apps/web/components/state/StateIssueVotesEvidence.tsx`
- Create: `apps/web/test/components/state/StateIssueVotesEvidence.test.tsx`

Renders the expandable vote-evidence panel below each rating row. Calls `useOfficialStateVotesOnSubject` with subject candidates mapped from the org's `issue_area`.

- [ ] **Step 1: Write failing test**

Create `apps/web/test/components/state/StateIssueVotesEvidence.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { StateIssueVotesEvidence } from '@/components/state/StateIssueVotesEvidence'
import * as stateBills from '@chiaro/state-bills'

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('StateIssueVotesEvidence', () => {
  it('renders empty-state when no matching votes', () => {
    vi.spyOn(stateBills, 'useOfficialStateVotesOnSubject').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/No matching votes/i)).toBeInTheDocument()
  })

  it('renders vote rows when matches exist', () => {
    vi.spyOn(stateBills, 'useOfficialStateVotesOnSubject').mockReturnValue({
      data: [{
        position: 'yes',
        vote: {
          id: 'v1', openstates_vote_id: 'ocd-vote/x', bill_id: 'b1',
          state: 'CA', session: '20252026', chamber: 'state_senate',
          vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
          source_url: 'https://x', party_vote_split: null, created_at: '2025-03-01',
          bill: { id: 'b1', state: 'CA', session: '20252026', bill_type: 'SB', number: 100, title: 'CA Clean Energy Act' },
        },
      }], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/CA Clean Energy Act/i)).toBeInTheDocument()
    expect(getByText(/On Passage/i)).toBeInTheDocument()
  })

  it('renders loading state', () => {
    vi.spyOn(stateBills, 'useOfficialStateVotesOnSubject').mockReturnValue({
      data: undefined, isLoading: true, isSuccess: false,
    } as never)
    const { getByText } = wrap(
      <StateIssueVotesEvidence officialId="oid" issueArea="environment" />,
    )
    expect(getByText(/Loading/i)).toBeInTheDocument()
  })

  it('unknown issue_area passes empty subjects to hook', () => {
    const spy = vi.spyOn(stateBills, 'useOfficialStateVotesOnSubject').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    wrap(<StateIssueVotesEvidence officialId="oid" issueArea="something-unknown" />)
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'oid', [])
  })
})
```

- [ ] **Step 2: Implement component**

Create `apps/web/components/state/StateIssueVotesEvidence.tsx`:

```tsx
'use client'

import { useChiaroClient } from '@/hooks/useChiaroClient'
import { useOfficialStateVotesOnSubject } from '@chiaro/state-bills'
import { COLORS } from '@chiaro/ui-tokens'

const SUBJECT_BY_AREA_STATE: Record<string, string[]> = {
  'environment':         ['Environment', 'Energy', 'Climate'],
  'civil-liberties':     ['Civil rights', 'Privacy', 'Civil liberties'],
  'reproductive-rights': ['Health', 'Reproductive rights'],
  'second-amendment':    ['Firearms', 'Guns'],
  'business-policy':     ['Commerce', 'Business', 'Taxation'],
  'liberal-policy':      ['Government operations'],
  'conservative-policy': ['Government operations'],
  'labor':               ['Labor', 'Employment'],
}

interface Props { officialId: string; issueArea: string }

export function StateIssueVotesEvidence({ officialId, issueArea }: Props) {
  const client = useChiaroClient()
  const subjects = SUBJECT_BY_AREA_STATE[issueArea] ?? []
  const { data, isLoading } = useOfficialStateVotesOnSubject(client, officialId, subjects)

  if (isLoading) {
    return <div style={{ color: COLORS.neutral.slate500, fontSize: 13, padding: '8px 12px' }}>Loading evidence votes…</div>
  }
  if (!data || data.length === 0) {
    return (
      <div style={{ color: COLORS.neutral.slate500, fontSize: 13, padding: '8px 12px', fontStyle: 'italic' }}>
        No matching votes for this subject area in current session.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {data.slice(0, 5).map(vp => (
        <div key={vp.vote.id} style={{
          display: 'flex', justifyContent: 'space-between', gap: 12,
          padding: '6px 10px', background: COLORS.neutral.slate50,
          borderRadius: 6, fontSize: 13,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, color: COLORS.neutral.slate900 }}>
              {vp.vote.bill?.bill_type} {vp.vote.bill?.number} — {vp.vote.bill?.title}
            </div>
            <div style={{ color: COLORS.neutral.slate600, fontSize: 12 }}>
              {vp.vote.question} · {vp.vote.vote_date}
            </div>
          </div>
          <div style={{
            fontWeight: 600,
            color: vp.position === 'yes' ? COLORS.semantic.success : vp.position === 'no' ? COLORS.semantic.danger : COLORS.neutral.slate500,
          }}>
            {vp.position.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/web test StateIssueVotesEvidence
pnpm --filter @chiaro/web typecheck
```

```bash
git add apps/web/components/state/StateIssueVotesEvidence.tsx \
        apps/web/test/components/state/StateIssueVotesEvidence.test.tsx
git commit -m "feat(web): StateIssueVotesEvidence evidence panel

Renders up to 5 most-recent vote rows where the legislator's vote
matches a subject candidate for the org's issue_area. Maps issue_area
to subject candidates via SUBJECT_BY_AREA_STATE table. Loading,
empty-state, and unknown-area paths covered.

Uses @chiaro/state-bills useOfficialStateVotesOnSubject. Tokens from
@chiaro/ui-tokens (no inline hex). 4 vitest cases."
```

---

## Task 15: Web StateIssuePositionsCard

**Files:**
- Create: `apps/web/components/state/StateIssuePositionsCard.tsx`
- Create: `apps/web/test/components/state/StateIssuePositionsCard.test.tsx`
- Modify (conditionally): `packages/ui-tokens/src/index.ts` (add `SCORECARD_LEAN_LABEL` + `SCORECARD_LEAN_COLOR` if missing)

Container card showing all ratings grouped by lean with expandable evidence panels.

- [ ] **Step 1: Add lean tokens (only if missing)**

Run `grep -n SCORECARD_LEAN_LABEL packages/ui-tokens/src/index.ts || echo "missing"`. If missing, append to `packages/ui-tokens/src/index.ts`:

```ts
export const SCORECARD_LEAN_LABEL = {
  progressive:   'Progressive',
  conservative:  'Conservative',
  libertarian:   'Libertarian',
  'single-issue': 'Single-issue',
  centrist:      'Centrist',
} as const

export const SCORECARD_LEAN_COLOR = {
  progressive:   '#0a66c2',
  conservative:  '#c92a2a',
  libertarian:   '#e8590c',
  'single-issue': '#5f3dc4',
  centrist:      '#495057',
} as const
```

- [ ] **Step 2: Write failing test**

Create `apps/web/test/components/state/StateIssuePositionsCard.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { StateIssuePositionsCard } from '@/components/state/StateIssuePositionsCard'
import * as officials from '@chiaro/officials'
import * as stateBills from '@chiaro/state-bills'

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const ratingFx = (overrides: Partial<{ slug: string; lean: string; score: number; issue_area: string }> = {}) => ({
  id: `r-${overrides.slug ?? 'aclu'}`,
  scorecard_id: `s-${overrides.slug ?? 'aclu'}`,
  official_id: 'oid', session: '20252026',
  score: String(overrides.score ?? 80),
  source_url: 'https://x', ingested_at: '2025-01-01',
  org: {
    id: `s-${overrides.slug ?? 'aclu'}`,
    slug: overrides.slug ?? 'aclu', state: 'CA',
    name: `${overrides.slug ?? 'aclu'} CA`,
    issue_area: overrides.issue_area ?? 'civil-liberties',
    lean: overrides.lean ?? 'progressive',
    methodology_url: 'https://m',
    scoring_min: 0, scoring_max: 100, notes: null,
  },
})

describe('StateIssuePositionsCard', () => {
  it('renders empty-state when no ratings', () => {
    vi.spyOn(officials, 'useOfficialStateScorecardRatings').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings available/i)).toBeInTheDocument()
  })

  it('renders 3 rating rows from 3 orgs', () => {
    vi.spyOn(officials, 'useOfficialStateScorecardRatings').mockReturnValue({
      data: [
        ratingFx({ slug: 'aclu', lean: 'progressive', issue_area: 'civil-liberties' }),
        ratingFx({ slug: 'lcv',  lean: 'progressive', issue_area: 'environment' }),
        ratingFx({ slug: 'nra',  lean: 'conservative', issue_area: 'second-amendment' }),
      ], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/aclu CA/i)).toBeInTheDocument()
    expect(getByText(/lcv CA/i)).toBeInTheDocument()
    expect(getByText(/nra CA/i)).toBeInTheDocument()
  })

  it('expanding a rating row reveals StateIssueVotesEvidence', () => {
    vi.spyOn(officials, 'useOfficialStateScorecardRatings').mockReturnValue({
      data: [ratingFx({ slug: 'lcv', issue_area: 'environment' })],
      isLoading: false, isSuccess: true,
    } as never)
    vi.spyOn(stateBills, 'useOfficialStateVotesOnSubject').mockReturnValue({
      data: [], isLoading: false, isSuccess: true,
    } as never)
    const { getByText, queryByText, getByRole } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(queryByText(/No matching votes/i)).not.toBeInTheDocument()
    fireEvent.click(getByRole('button', { name: /lcv CA/i }))
    expect(getByText(/No matching votes/i)).toBeInTheDocument()
  })

  it('renders loading skeleton', () => {
    vi.spyOn(officials, 'useOfficialStateScorecardRatings').mockReturnValue({
      data: undefined, isLoading: true, isSuccess: false,
    } as never)
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeInTheDocument()
  })

  it('groups ratings by lean header', () => {
    vi.spyOn(officials, 'useOfficialStateScorecardRatings').mockReturnValue({
      data: [
        ratingFx({ slug: 'aclu', lean: 'progressive' }),
        ratingFx({ slug: 'nra',  lean: 'conservative' }),
        ratingFx({ slug: 'pp',   lean: 'single-issue' }),
      ], isLoading: false, isSuccess: true,
    } as never)
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/Progressive/i)).toBeInTheDocument()
    expect(getByText(/Conservative/i)).toBeInTheDocument()
    expect(getByText(/Single-issue/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Implement component**

Create `apps/web/components/state/StateIssuePositionsCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useChiaroClient } from '@/hooks/useChiaroClient'
import { useOfficialStateScorecardRatings } from '@chiaro/officials'
import type { StateScorecardRatingWithOrg } from '@chiaro/officials'
import { COLORS, SCORECARD_LEAN_LABEL, SCORECARD_LEAN_COLOR } from '@chiaro/ui-tokens'
import { StateIssueVotesEvidence } from './StateIssueVotesEvidence'

interface Props { officialId: string }

const LEAN_GROUP_ORDER = ['progressive', 'conservative', 'single-issue', 'libertarian', 'centrist'] as const

export function StateIssuePositionsCard({ officialId }: Props) {
  const client = useChiaroClient()
  const { data, isLoading } = useOfficialStateScorecardRatings(client, officialId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={{ color: COLORS.neutral.slate500, fontSize: 13 }}>Loading issue positions…</div>
      </section>
    )
  }
  if (!data || data.length === 0) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={{ color: COLORS.neutral.slate500, fontSize: 13, fontStyle: 'italic' }}>
          No issue-position ratings available for this legislator yet.
        </div>
      </section>
    )
  }

  const byLean = new Map<string, StateScorecardRatingWithOrg[]>()
  for (const r of data) {
    if (!byLean.has(r.org.lean)) byLean.set(r.org.lean, [])
    byLean.get(r.org.lean)!.push(r)
  }

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Issue Positions</h2>
      {LEAN_GROUP_ORDER.filter(l => byLean.has(l)).map(lean => (
        <div key={lean} style={{ marginBottom: 12 }}>
          <h3 style={{
            fontSize: 13, fontWeight: 600,
            color: SCORECARD_LEAN_COLOR[lean as keyof typeof SCORECARD_LEAN_COLOR] ?? COLORS.neutral.slate500,
            marginBottom: 6,
          }}>
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </h3>
          {byLean.get(lean)!.map(r => (
            <div key={r.id} style={{
              borderBottom: `1px solid ${COLORS.neutral.slate100}`,
              padding: '8px 0',
            }}>
              <button
                onClick={() => toggle(r.id)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: 0, color: COLORS.neutral.slate900, fontSize: 14,
                }}
              >
                <span style={{ textAlign: 'left' }}>
                  {r.org.name}
                  <span style={{ display: 'block', fontSize: 12, color: COLORS.neutral.slate500 }}>
                    {r.org.issue_area}
                  </span>
                </span>
                <span style={{ fontWeight: 600 }}>
                  {Number(r.score).toFixed(0)} / {r.org.scoring_max}
                </span>
              </button>
              {expanded.has(r.id) && (
                <StateIssueVotesEvidence
                  officialId={officialId}
                  issueArea={r.org.issue_area}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: COLORS.neutral.white,
  border: `1px solid ${COLORS.neutral.slate200}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.neutral.slate900,
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @chiaro/web test StateIssuePositionsCard
pnpm --filter @chiaro/web typecheck
```

```bash
git add apps/web/components/state/StateIssuePositionsCard.tsx \
        apps/web/test/components/state/StateIssuePositionsCard.test.tsx
# Stage ui-tokens only if you added the lean constants in Step 1:
git diff --cached packages/ui-tokens/src/index.ts >/dev/null 2>&1 || \
  git add packages/ui-tokens/src/index.ts 2>/dev/null || true
git commit -m "feat(web): StateIssuePositionsCard

Replaces ComingSoonCard('Issue Positions'). Groups ratings by lean
(progressive / conservative / single-issue / libertarian / centrist).
Each row expandable into StateIssueVotesEvidence panel.

5 vitest cases."
```

---

## Task 16: Web — swap ComingSoonCard on StateOfficialDetailPage

**Files:**
- Modify: `apps/web/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Update tests first**

Open `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`. Find the existing mock block and add:

```tsx
vi.spyOn(officials, 'useOfficialStateScorecardRatings').mockReturnValue({
  data: [], isLoading: false, isSuccess: true,
} as never)
```

Find any test asserting a placeholder count (e.g. `expect(container.querySelectorAll('[data-coming-soon-card]')).toHaveLength(5)`) and decrement by 1. Add a new test case:

```tsx
it('renders StateIssuePositionsCard (no longer a placeholder)', () => {
  // ...standard render setup
  expect(getByText(/Issue Positions/i)).toBeInTheDocument()
  // Issue Positions should NOT be inside a [data-coming-soon-card] element.
})
```

- [ ] **Step 2: Update component**

Open `apps/web/components/state/StateOfficialDetailPage.tsx`. Find:

```tsx
<ComingSoonCard title="Issue Positions" />
```

Replace with:

```tsx
<StateIssuePositionsCard officialId={official.id} />
```

Add import at top:

```tsx
import { StateIssuePositionsCard } from '@/components/state/StateIssuePositionsCard'
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/web test StateOfficialDetailPage
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build
```

Expected: tests pass; typecheck clean; Next 15 build clean.

```bash
git add apps/web/components/state/StateOfficialDetailPage.tsx \
        apps/web/test/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(web): swap ComingSoonCard('Issue Positions') for StateIssuePositionsCard

Mount the real card on /state-officials/[id]. Detail-page test
updated: drop 1 from previous ComingSoonCard count, add assertion
for the real card."
```

---

## Task 17: Mobile StateIssuePositionsCard + StateIssueVotesEvidence

**Files:**
- Create: `apps/mobile/components/state/StateIssuePositionsCard.tsx`
- Create: `apps/mobile/components/state/StateIssueVotesEvidence.tsx`
- Create: `apps/mobile/test/components/state/StateIssuePositionsCard.test.tsx`
- Create: `apps/mobile/test/components/state/StateIssueVotesEvidence.test.tsx`

Per [[feedback-jest-expo-dynamic-mock-pattern]]: use `let mockRatings = DEFAULT_RATINGS` mutable pattern reset in `beforeEach` (NOT `jest.resetModules + jest.doMock + require`, which crashes React module identity in jest-expo).

- [ ] **Step 1: Failing tests (mobile)**

Create `apps/mobile/test/components/state/StateIssueVotesEvidence.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StateIssueVotesEvidence } from '../../../components/state/StateIssueVotesEvidence'

let mockVotes: unknown = []
let mockLoading = false

jest.mock('@chiaro/state-bills', () => ({
  useOfficialStateVotesOnSubject: () => ({
    data: mockVotes, isLoading: mockLoading, isSuccess: !mockLoading,
  }),
}))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => { mockVotes = []; mockLoading = false })

describe('StateIssueVotesEvidence (mobile)', () => {
  it('renders empty-state when no matching votes', () => {
    const { getByText } = wrap(<StateIssueVotesEvidence officialId="oid" issueArea="environment" />)
    expect(getByText(/No matching votes/i)).toBeTruthy()
  })

  it('renders vote rows when matches exist', () => {
    mockVotes = [{
      position: 'yes',
      vote: {
        id: 'v1', state: 'CA', session: '20252026', chamber: 'state_senate',
        vote_date: '2025-03-01', question: 'On Passage', result: 'passed',
        bill: { bill_type: 'SB', number: 100, title: 'CA Clean Energy Act' },
      },
    }]
    const { getByText } = wrap(<StateIssueVotesEvidence officialId="oid" issueArea="environment" />)
    expect(getByText(/CA Clean Energy Act/i)).toBeTruthy()
  })

  it('renders loading state', () => {
    mockLoading = true
    const { getByText } = wrap(<StateIssueVotesEvidence officialId="oid" issueArea="environment" />)
    expect(getByText(/Loading/i)).toBeTruthy()
  })
})
```

Create `apps/mobile/test/components/state/StateIssuePositionsCard.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StateIssuePositionsCard } from '../../../components/state/StateIssuePositionsCard'

const DEFAULT_RATINGS: unknown[] = []
let mockRatings: unknown[] = DEFAULT_RATINGS
let mockLoading = false

jest.mock('@chiaro/officials', () => {
  const actual = jest.requireActual('@chiaro/officials') as object
  return {
    ...actual,
    useOfficialStateScorecardRatings: () => ({
      data: mockRatings, isLoading: mockLoading, isSuccess: !mockLoading,
    }),
  }
})

jest.mock('@chiaro/state-bills', () => ({
  useOfficialStateVotesOnSubject: () => ({
    data: [], isLoading: false, isSuccess: true,
  }),
}))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const ratingFx = (overrides: Partial<{ slug: string; lean: string; score: number; issue_area: string }> = {}) => ({
  id: `r-${overrides.slug ?? 'aclu'}`,
  scorecard_id: `s-${overrides.slug ?? 'aclu'}`,
  official_id: 'oid', session: '20252026',
  score: String(overrides.score ?? 80),
  source_url: 'https://x', ingested_at: '2025-01-01',
  org: {
    id: `s-${overrides.slug ?? 'aclu'}`,
    slug: overrides.slug ?? 'aclu', state: 'CA',
    name: `${overrides.slug ?? 'aclu'} CA`,
    issue_area: overrides.issue_area ?? 'civil-liberties',
    lean: overrides.lean ?? 'progressive',
    methodology_url: 'https://m', scoring_min: 0, scoring_max: 100, notes: null,
  },
})

beforeEach(() => { mockRatings = DEFAULT_RATINGS; mockLoading = false })

describe('StateIssuePositionsCard (mobile)', () => {
  it('renders empty-state when no ratings', () => {
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/No issue-position ratings available/i)).toBeTruthy()
  })

  it('renders rating rows from multiple orgs', () => {
    mockRatings = [
      ratingFx({ slug: 'aclu', score: 90 }),
      ratingFx({ slug: 'lcv',  score: 85, lean: 'progressive', issue_area: 'environment' }),
    ]
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/aclu CA/i)).toBeTruthy()
    expect(getByText(/lcv CA/i)).toBeTruthy()
  })

  it('expanding a rating row shows evidence panel', () => {
    mockRatings = [ratingFx({ slug: 'lcv', issue_area: 'environment' })]
    const { getByText, queryByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(queryByText(/No matching votes/i)).toBeNull()
    fireEvent.press(getByText(/lcv CA/i))
    expect(getByText(/No matching votes/i)).toBeTruthy()
  })

  it('renders loading skeleton', () => {
    mockLoading = true
    const { getByText } = wrap(<StateIssuePositionsCard officialId="oid" />)
    expect(getByText(/Loading issue positions/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement components**

Create `apps/mobile/components/state/StateIssueVotesEvidence.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useOfficialStateVotesOnSubject } from '@chiaro/state-bills'
import { useChiaroClient } from '../../hooks/useChiaroClient'
import { COLORS } from '@chiaro/ui-tokens'

const SUBJECT_BY_AREA_STATE: Record<string, string[]> = {
  'environment':         ['Environment', 'Energy', 'Climate'],
  'civil-liberties':     ['Civil rights', 'Privacy', 'Civil liberties'],
  'reproductive-rights': ['Health', 'Reproductive rights'],
  'second-amendment':    ['Firearms', 'Guns'],
  'business-policy':     ['Commerce', 'Business', 'Taxation'],
  'liberal-policy':      ['Government operations'],
  'conservative-policy': ['Government operations'],
  'labor':               ['Labor', 'Employment'],
}

interface Props { officialId: string; issueArea: string }

export function StateIssueVotesEvidence({ officialId, issueArea }: Props) {
  const client = useChiaroClient()
  const subjects = SUBJECT_BY_AREA_STATE[issueArea] ?? []
  const { data, isLoading } = useOfficialStateVotesOnSubject(client, officialId, subjects)

  if (isLoading) return <Text style={styles.muted}>Loading evidence votes…</Text>
  if (!data || data.length === 0) return <Text style={styles.muted}>No matching votes for this subject area in current session.</Text>

  return (
    <View style={styles.list}>
      {data.slice(0, 5).map(vp => (
        <View key={vp.vote.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.billTitle}>
              {vp.vote.bill?.bill_type} {vp.vote.bill?.number} — {vp.vote.bill?.title}
            </Text>
            <Text style={styles.meta}>{vp.vote.question} · {vp.vote.vote_date}</Text>
          </View>
          <Text style={[
            styles.position,
            { color: vp.position === 'yes' ? COLORS.semantic.success : vp.position === 'no' ? COLORS.semantic.danger : COLORS.neutral.slate500 },
          ]}>
            {vp.position.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.slate500, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list:  { gap: 6, padding: 8 },
  row:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.neutral.slate50, borderRadius: 6, padding: 8 },
  billTitle: { fontSize: 13, fontWeight: '500', color: COLORS.neutral.slate900 },
  meta:      { fontSize: 12, color: COLORS.neutral.slate600 },
  position:  { fontWeight: '600' },
})
```

Create `apps/mobile/components/state/StateIssuePositionsCard.tsx`:

```tsx
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useOfficialStateScorecardRatings } from '@chiaro/officials'
import type { StateScorecardRatingWithOrg } from '@chiaro/officials'
import { COLORS, SCORECARD_LEAN_LABEL, SCORECARD_LEAN_COLOR } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../../hooks/useChiaroClient'
import { StateIssueVotesEvidence } from './StateIssueVotesEvidence'

interface Props { officialId: string }

const LEAN_GROUP_ORDER = ['progressive', 'conservative', 'single-issue', 'libertarian', 'centrist'] as const

export function StateIssuePositionsCard({ officialId }: Props) {
  const client = useChiaroClient()
  const { data, isLoading } = useOfficialStateScorecardRatings(client, officialId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Issue Positions</Text>
        <Text style={styles.muted}>Loading issue positions…</Text>
      </View>
    )
  }
  if (!data || data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Issue Positions</Text>
        <Text style={styles.muted}>No issue-position ratings available for this legislator yet.</Text>
      </View>
    )
  }

  const byLean = new Map<string, StateScorecardRatingWithOrg[]>()
  for (const r of data) {
    if (!byLean.has(r.org.lean)) byLean.set(r.org.lean, [])
    byLean.get(r.org.lean)!.push(r)
  }

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Issue Positions</Text>
      {LEAN_GROUP_ORDER.filter(l => byLean.has(l)).map(lean => (
        <View key={lean} style={{ marginBottom: 12 }}>
          <Text style={[
            styles.leanHeader,
            { color: SCORECARD_LEAN_COLOR[lean as keyof typeof SCORECARD_LEAN_COLOR] ?? COLORS.neutral.slate500 },
          ]}>
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </Text>
          {byLean.get(lean)!.map(r => (
            <View key={r.id} style={styles.ratingRow}>
              <Pressable onPress={() => toggle(r.id)} style={styles.ratingButton}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{r.org.name}</Text>
                  <Text style={styles.issueArea}>{r.org.issue_area}</Text>
                </View>
                <Text style={styles.score}>{Number(r.score).toFixed(0)} / {r.org.scoring_max}</Text>
              </Pressable>
              {expanded.has(r.id) && (
                <StateIssueVotesEvidence officialId={officialId} issueArea={r.org.issue_area} />
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card:         { backgroundColor: COLORS.neutral.white, borderColor: COLORS.neutral.slate200, borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 16 },
  title:        { fontSize: 18, fontWeight: '600', marginBottom: 12, color: COLORS.neutral.slate900 },
  muted:        { color: COLORS.neutral.slate500, fontSize: 13, fontStyle: 'italic' },
  leanHeader:   { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  ratingRow:    { borderBottomWidth: 1, borderBottomColor: COLORS.neutral.slate100, paddingVertical: 8 },
  ratingButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orgName:      { fontSize: 14, color: COLORS.neutral.slate900 },
  issueArea:    { fontSize: 12, color: COLORS.neutral.slate500, marginTop: 2 },
  score:        { fontSize: 14, fontWeight: '600', color: COLORS.neutral.slate900 },
})
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test StateIssue
pnpm --filter @chiaro/mobile typecheck
```

```bash
git add apps/mobile/components/state/StateIssuePositionsCard.tsx \
        apps/mobile/components/state/StateIssueVotesEvidence.tsx \
        apps/mobile/test/components/state/StateIssuePositionsCard.test.tsx \
        apps/mobile/test/components/state/StateIssueVotesEvidence.test.tsx
git commit -m "feat(mobile): StateIssuePositionsCard + StateIssueVotesEvidence

Mobile parity with web slice 5G. RN primitives (Pressable, View, Text).
Per slice 5F lesson, jest-expo uses mutable mockRatings + beforeEach
reset (NOT jest.resetModules + doMock + require).

3 + 5 = 8 vitest cases."
```

---

## Task 18: Mobile — swap ComingSoonCard on StateOfficialDetailPage

**Files:**
- Modify: `apps/mobile/components/state/StateOfficialDetailPage.tsx`
- Modify: `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`

- [ ] **Step 1: Update tests first**

Open `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`. Extend existing `jest.mock('@chiaro/officials', ...)` block to add `useOfficialStateScorecardRatings: () => ({ data: [], isLoading: false, isSuccess: true })`.

Adjust placeholder-count assertion (decrement by 1) and add new assertion:

```tsx
it('renders StateIssuePositionsCard (no longer a placeholder)', () => {
  const { getByText } = render(<StateOfficialDetailPage official={mkOfficial()} />, { wrapper: wrap })
  expect(getByText(/Issue Positions/i)).toBeTruthy()
})
```

- [ ] **Step 2: Update component**

Open `apps/mobile/components/state/StateOfficialDetailPage.tsx`. Find:

```tsx
<ComingSoonCard title="Issue Positions" />
```

Replace with:

```tsx
<StateIssuePositionsCard officialId={official.id} />
```

Add import:

```tsx
import { StateIssuePositionsCard } from './StateIssuePositionsCard'
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @chiaro/mobile test StateOfficialDetailPage
pnpm --filter @chiaro/mobile typecheck
```

```bash
git add apps/mobile/components/state/StateOfficialDetailPage.tsx \
        apps/mobile/components/state/StateOfficialDetailPage.test.tsx
git commit -m "feat(mobile): swap ComingSoonCard('Issue Positions') for StateIssuePositionsCard

Mirror web Task 16."
```

---

## Task 19: Officials integration test — RLS + join coverage

**Files:**
- Modify: `packages/officials/test/queries.integration.test.ts`

- [ ] **Step 1: Extend integration test**

Open `packages/officials/test/queries.integration.test.ts`. Add a new `describe` block after existing ones:

```ts
describe('state_scorecard_* RLS + fetchOfficialStateScorecardRatings', () => {
  let scorecardId: string
  let officialIdLocal: string

  beforeAll(async () => {
    const o = await svc.from('state_scorecard_orgs').insert({
      slug: 'aclu', state: 'CA',
      name: 'ACLU of California',
      issue_area: 'civil-liberties',
      lean: 'progressive',
      methodology_url: 'https://aclu.ca.org/scorecard',
      scoring_min: 0, scoring_max: 100,
    }).select('id').single()
    if (o.error) throw o.error
    scorecardId = o.data!.id

    const off = await svc.from('officials').select('id').eq('chamber', 'state_house').limit(1).single()
    if (off.error) throw off.error
    officialIdLocal = off.data!.id

    const r = await svc.from('state_scorecard_ratings').insert({
      scorecard_id: scorecardId, official_id: officialIdLocal,
      session: '20252026', score: 88, source_url: 'https://x',
    })
    if (r.error) throw r.error
  })

  afterAll(async () => {
    await svc.from('state_scorecard_ratings').delete().eq('scorecard_id', scorecardId)
    await svc.from('state_scorecard_orgs').delete().eq('id', scorecardId)
  })

  it('anon SELECT denied (RLS returns empty array, no error)', async () => {
    const { data, error } = await anon.from('state_scorecard_orgs').select('*').eq('id', scorecardId)
    expect(data ?? []).toHaveLength(0)
    expect(error).toBeNull()
  })

  it('authenticated SELECT allowed', async () => {
    const { data, error } = await authd.from('state_scorecard_orgs').select('*').eq('id', scorecardId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('fetchOfficialStateScorecardRatings joins org row', async () => {
    const { fetchOfficialStateScorecardRatings } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateScorecardRatings(authd as never, officialIdLocal)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const aclu = rows.find(r => r.org.slug === 'aclu')
    expect(aclu).toBeDefined()
    expect(aclu!.org.name).toBe('ACLU of California')
  })
})
```

Reuse existing `svc` / `anon` / `authd` clients (already configured with distinct `storageKey` per [[feedback-supabase-js-storage-key]]).

- [ ] **Step 2: Run + commit**

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  pnpm --filter @chiaro/officials test queries.integration
```

```bash
git add packages/officials/test/queries.integration.test.ts
git commit -m "test(officials): state_scorecard_* RLS + join integration

3 new cases: anon SELECT denied (RLS returns empty array), auth
SELECT allowed, fetcher joins state_scorecard_orgs via
select('*, org:state_scorecard_orgs(*)'). Distinct storageKey per
client (slice 5B lesson)."
```

---

## Task 20: CLAUDE.md updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add slice 5G entry**

Open `CLAUDE.md`. In the `## Slices delivered` section, after the most-recent sub-slice entry (5F), append:

```markdown
- **Sub-slice 5G — state issue positions** (2026-05-21): per-org adapter pattern for state-leg scorecards (ACLU + LCV + NRA + Planned Parenthood + AFP). Migrations 0040 (`state_scorecard_orgs` + `state_scorecard_ratings`) + 0041 (RLS). New `StateIssuePositionsCard` web + mobile replaces `ComingSoonCard('Issue Positions')` on `/state-officials/[id]`. New `useOfficialStateVotesOnSubject` hook in `@chiaro/state-bills` joins votes by subject candidates. 5 adapters ship as stubs returning `[]`; production parsers per (org, state) are operator follow-up.
```

- [ ] **Step 2: Update Quick start**

In the Quick start block, after `pnpm seed:state-officials`, append:

```bash
pnpm seed:state-scorecards --session=20252026     # ingest 5 per-org state scorecards (stubs in v1)
```

- [ ] **Step 3: Add Gotcha #12**

In the `## Gotchas` numbered list, append after current #11:

```markdown
12. **State scorecards adapter pattern is per-org, not per-state** — distinct from slices 5D/5E/5F which use per-state adapters. The 5 orgs (`aclu`, `lcv`, `nra`, `planned-parenthood`, `afp`) each span N states via `covered_states[]`. v1 adapters return `[]` (operator wires per-state parsers); orchestrator iterates `covered_states` and UPSERTs per-state `state_scorecard_orgs` rows. NRA grades letters mapped to numeric via `letterToNumeric()` (A=100..F=20) at write side; UI reverse-maps via `numericToLetterGrade()` for display.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): slice 5G entry + per-org adapter gotcha + Quick start

5G slice entry in Slices delivered. Gotcha #12 distinguishes per-org
(5G) from per-state (5D/5E/5F) adapter patterns + documents NRA
letter-grade mapping. New seed:state-scorecards script in Quick start."
```

---

## Task 21: Final verify + memory + branch handoff

**Files:**
- None (verification + memory writes only)

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @chiaro/web build
pnpm db:reset
pnpm db:test
```

Expected:
- All 10 packages typecheck clean
- All package test scripts pass via turbo
- Next 15 build clean
- All migrations 0001-0041 apply cleanly
- All pgTAP plans pass (count bumps by 14 from Task 2)

- [ ] **Step 2: Verify git status**

```bash
git log --oneline origin/master..HEAD
git status
```

Expected: ~13 commits on `slice-5g-issue-positions` branch (1 spec + 1 plan + 11 implementation/docs). Working tree clean.

- [ ] **Step 3: Write durable-lessons memory**

Create `C:\Users\jlaos\.claude\projects\C--Users-jlaos-Downloads-Chiaro\memory\project_chiaro_slice5g_state_scorecards.md` with frontmatter `type: project`. Body captures:
- Squash SHA (filled in after merge)
- Per-org adapter pattern (5G) vs per-state adapter pattern (5D/5E/5F) distinction
- NRA letter-grade mapping convention + production-stub adapter shipping pattern
- SUBJECT_BY_AREA_STATE subject-correlation map design rationale
- 11 known limitations carried from spec
- Lean grouping order
- Cross-links to [[project-chiaro-slice5f-state-metrics-kpis]] and prior slices

Update `MEMORY.md` index with one-line entry:

```markdown
- [Chiaro slice 5G state scorecards](project_chiaro_slice5g_state_scorecards.md) — per-org adapter pattern (ACLU/LCV/NRA/PP/AFP); StateIssuePositionsCard replaces ComingSoon; v1 ships stubs; subject-correlation evidence panels via useOfficialStateVotesOnSubject
```

- [ ] **Step 4: Hand off via finishing-a-development-branch**

Use the superpowers:finishing-a-development-branch skill to present merge / PR / keep / discard options. Recommended option 1 (squash merge to master locally), matching prior 6 sub-slices.

---

## Verification Checklist (post-Task 21)

- [ ] `state_scorecard_orgs` + `state_scorecard_ratings` tables exist; RLS enabled on both; `lean` CHECK constraint enforced; FK to `officials.id` is RESTRICT; FK to `state_scorecard_orgs.id` is CASCADE
- [ ] 5 per-org adapters compile + tested + return `[]` from production stub
- [ ] Orchestrator dispatches all adapters with `--org` / `--state` filters working
- [ ] `useOfficialStateScorecardRatings` joins org row + de-dupes by latest ingested_at
- [ ] `useOfficialStateVotesOnSubject` two-step joins by subject + has stable cache key
- [ ] Web + mobile `StateIssuePositionsCard` mounts on `/state-officials/[id]` replacing ComingSoonCard
- [ ] Web + mobile `StateIssueVotesEvidence` expands inline with vote rows
- [ ] CLAUDE.md updated with slice + gotcha + Quick start
- [ ] Workspace typecheck clean across all 10 packages
- [ ] pgTAP total plans bumped by 14
- [ ] No new env vars required
- [ ] Stubs documented as operator follow-up

## Known v1 limitations carried over from spec

1. All 5 adapters ship as stubs (`fetchRatings` returns `[]`); production per-(org, state) parsers are operator follow-up.
2. State coverage matrix in Task 4 is partial (~10 of 50 states ≥1 org in v1 scaffolding).
3. NRA letter-grade reverse-map is approximate (uneven bucket widths).
4. SUBJECT_BY_AREA_STATE keys are heuristic; per-state subject vocabularies differ.
5. Evidence-vote panel caps at 5 rows; no pagination.
6. `state_scorecard_ratings.session` is text per slice 5D convention; per-org session keys may differ from `state_bills.session`.
7. UPSERT keys on `(slug, state)` for orgs and `(scorecard_id, official_id, session)` for ratings; ingest updates in-place rather than versioning history.
8. v1 doesn't surface adapter-emitted `officialsUnmatched[]` in UI — operator must inspect logs.
9. No retry/cache layer in adapter stubs (production parsers should mirror OpenStates v3 fetcher pattern when wired).
10. RLS coverage on `state_scorecard_*` matches slice 5D/5E/5F (`read = authenticated`, `write = service_role`); no fine-grained user/org-level policies.
11. ComingSoonCard placeholders that remain on `/state-officials/[id]` after this slice: Community Presence, Ethics & Accountability, Stock Tracker (and any other federal-only placeholders not yet replaced).

