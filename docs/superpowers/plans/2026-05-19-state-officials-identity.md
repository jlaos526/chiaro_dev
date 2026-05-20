# State Officials Identity Implementation Plan (sub-slice 5C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest US state legislators (state house + state senate + NE unicameral) via the `openstates/people` GitHub YAML repo and show calibrated users their state reps alongside federal on home + a new `/state-officials/[id]` route with federal-only categories rendered as `ComingSoonCard` placeholders.

**Architecture:** Identity-only MVP. Two new DB migrations (chamber enum expansion via swap; openstates fields). New seed pipeline (YAML loader + per-state config + orchestrator). Split routes for federal vs state officials with cross-route ID guards. Reuses existing `fetchMyOfficials`/`useMyOfficials` (no query/hook changes needed — chamber-level partition happens client-side via a new derivation). Web + mobile parity.

**Tech Stack:** Postgres 15 + PostGIS (Supabase), pgTAP for migrations, vitest for ingest + derivations + components, jest-expo for mobile, Next 15 App Router, Expo Router, `yaml@^2` for YAML parsing.

**Spec:** `docs/superpowers/specs/2026-05-19-state-officials-identity-design.md`

---

## File structure

**Created** (24 files):
```
packages/db/supabase/migrations/0028_chamber_enum_expand.sql
packages/db/supabase/migrations/0029_officials_openstates_fields.sql
packages/db/supabase/tests/chamber_enum_expansion.test.sql
packages/db/supabase/tests/officials_openstates_fields.test.sql
packages/db/supabase/seed/state-officials-ingest.ts
packages/db/supabase/seed/state-officials-ingest.test.ts
packages/db/supabase/seed/state-leg-config.ts
packages/db/supabase/seed/state-leg-config.test.ts
packages/db/supabase/seed/openstates-yaml-loader.ts
packages/db/supabase/seed/openstates-yaml-loader.test.ts
packages/db/supabase/seed/fixtures/openstates-people/ca-sample-assemblymember.yml
packages/db/supabase/seed/fixtures/openstates-people/ca-sample-senator.yml
packages/db/supabase/seed/fixtures/openstates-people/ne-sample-unicameral-senator.yml
packages/db/supabase/seed/fixtures/openstates-people/md-sample-delegate-1A.yml
packages/db/supabase/seed/fixtures/openstates-people/md-sample-delegate-1B.yml
packages/db/supabase/seed/fixtures/openstates-people/md-sample-delegate-1C.yml
apps/web/lib/derivations/officials-by-level.ts
apps/web/test/derivations/officials-by-level.test.ts
apps/web/app/state-officials/[id]/page.tsx
apps/web/components/cards/ComingSoonCard.tsx
apps/web/components/state/StateOfficialDetailPage.tsx
apps/web/components/state/StateOfficialsCardSection.tsx
apps/web/test/components/state/StateOfficialDetailPage.test.tsx
apps/web/test/components/state/StateOfficialsCardSection.test.tsx
apps/web/test/components/cards/ComingSoonCard.test.tsx
apps/web/test/app/officials-route-guards.test.tsx
apps/mobile/app/state-officials/[id].tsx
apps/mobile/components/cards/ComingSoonCard.tsx
apps/mobile/components/state/StateOfficialDetailPage.tsx
apps/mobile/components/state/StateOfficialsCardSection.tsx
apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx
apps/mobile/test/components/state/StateOfficialsCardSection.test.tsx
apps/mobile/test/components/cards/ComingSoonCard.test.tsx
```

**Modified** (workspace-wide; key ones):
```
packages/db/src/types.ts                                # regenerated after each migration
packages/db/package.json                                # +yaml@^2; +seed:state-officials script
packages/officials/src/types.ts                        # OfficialChamber 5-value union + helpers
packages/officials/src/schemas.ts                      # zod chamber updated
packages/officials/test/types.test.ts                  # NEW — tests for isStateLevel/levelOf/isSenateChamber/isHouseChamber
packages/officials/test/queries.integration.test.ts    # +3 cases — federal + state coexistence
packages/db/supabase/seed/normalize.ts                 # Congress.gov chamber → federal_house/federal_senate
packages/db/supabase/seed/officials-ingest.ts          # uses new chamber values via normalize
packages/db/supabase/seed/unitedstates-legislators-ingest.ts
packages/db/supabase/seed/audit-fixture-attach.ts
packages/db/supabase/seed/{officials-ingest,recompute-metrics,finance-ingest,scorecards/index,town-halls-ingest,stock-watcher-ingest,salary-residency-ingest,bills-votes-ingest}.test.ts  # 'house'/'senate' literals → federal_house/federal_senate
apps/web/components/OfficialsCard.tsx                  # render Federal + State sections
apps/web/components/cards/DistrictBadge.tsx            # handle state district codes + multi-member
apps/web/app/officials/[id]/page.tsx                   # cross-route chamber guard
apps/mobile/components/OfficialsCard.tsx
apps/mobile/components/cards/DistrictBadge.tsx
apps/mobile/app/officials/[id].tsx
CLAUDE.md                                              # slice 5C entry, migration range, pgTAP count, gotcha #8
```

---

## Task 1 — Migration 0028: chamber enum expansion

**Files:**
- Create: `packages/db/supabase/migrations/0028_chamber_enum_expand.sql`
- Create: `packages/db/supabase/tests/chamber_enum_expansion.test.sql`

This migration converts `public.official_chamber` from `('house','senate')` to `('federal_house','federal_senate','state_house','state_senate','state_legislature')`. Postgres doesn't support dropping enum values, so we use the swap pattern: create v2, ALTER COLUMN ... USING CASE, drop v1, rename. Three columns reference the type: `officials.chamber`, `officials_leadership_history.chamber`, `votes.chamber`.

- [ ] **Step 1: Write migration SQL**

Create `packages/db/supabase/migrations/0028_chamber_enum_expand.sql`:

```sql
-- Sub-slice 5C: expand public.official_chamber enum from 2 values to 5.
-- New values support state-level legislators (state_house, state_senate, plus
-- state_legislature for Nebraska's unicameral). Federal rows backfill via
-- CASE: 'house' → 'federal_house', 'senate' → 'federal_senate'.
--
-- Postgres can't drop enum values, so we swap: create v2, ALTER COLUMN ...
-- USING CASE, drop v1, rename. The whole swap runs inside one transaction;
-- failure rolls back atomically.

create type public.official_chamber_v2 as enum (
  'federal_house',
  'federal_senate',
  'state_house',
  'state_senate',
  'state_legislature'
);

alter table public.officials
  alter column chamber type public.official_chamber_v2
  using (case chamber::text
    when 'house'  then 'federal_house'::public.official_chamber_v2
    when 'senate' then 'federal_senate'::public.official_chamber_v2
  end);

alter table public.officials_leadership_history
  alter column chamber type public.official_chamber_v2
  using (case chamber::text
    when 'house'  then 'federal_house'::public.official_chamber_v2
    when 'senate' then 'federal_senate'::public.official_chamber_v2
  end);

alter table public.votes
  alter column chamber type public.official_chamber_v2
  using (case chamber::text
    when 'house'  then 'federal_house'::public.official_chamber_v2
    when 'senate' then 'federal_senate'::public.official_chamber_v2
  end);

drop type public.official_chamber;
alter type public.official_chamber_v2 rename to official_chamber;
```

- [ ] **Step 2: Write pgTAP test**

Create `packages/db/supabase/tests/chamber_enum_expansion.test.sql`:

```sql
begin;
select plan(8);

-- Enum type exists with the new name post-rename.
select has_type('public', 'official_chamber', 'official_chamber enum exists');

-- The 5 new enum values are all present.
select results_eq(
  $$select unnest(enum_range(null::public.official_chamber))::text order by 1$$,
  $$values ('federal_house'), ('federal_senate'), ('state_house'), ('state_legislature'), ('state_senate')$$,
  'official_chamber has exactly the 5 expected values, alphabetical'
);

-- Old values are gone.
select isnt_member_of(
  'public.official_chamber',
  array['house', 'senate'],
  'legacy house/senate values dropped from enum'
);

-- All 3 column references survived the ALTER COLUMN.
select col_type_is('public', 'officials',                       'chamber', 'public.official_chamber',
  'officials.chamber type preserved');
select col_type_is('public', 'officials_leadership_history',    'chamber', 'public.official_chamber',
  'officials_leadership_history.chamber type preserved');
select col_type_is('public', 'votes',                            'chamber', 'public.official_chamber',
  'votes.chamber type preserved');

-- Backfill correctness: pgTAP runs after db:reset which applies all migrations
-- but doesn't seed. With no officials rows, this test is structural only —
-- the CASE mapping is verified by the seed:officials fixture suite in CI's
-- `db` job (which exercises the path: seed federal data, confirm chamber
-- values land as federal_house/federal_senate).
select is(
  (select count(*) from pg_enum
   where enumtypid = 'public.official_chamber'::regtype
     and enumlabel in ('house', 'senate'))::int,
  0,
  'no legacy enum values remain in pg_enum'
);

select is(
  (select count(*) from pg_enum
   where enumtypid = 'public.official_chamber'::regtype
     and enumlabel in ('federal_house','federal_senate','state_house','state_senate','state_legislature'))::int,
  5,
  'all 5 new enum values present in pg_enum'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Apply migration locally and verify it runs**

```bash
pnpm db:reset
```

Expected: migration 0028 applies without error. If you see "cannot alter type because column 'chamber' is used", confirm the USING CASE clause is exactly as in Step 1.

- [ ] **Step 4: Run pgTAP**

```bash
pnpm db:test
```

Expected: `chamber_enum_expansion.test.sql` passes 8/8. All existing pgTAP files (16 of them) should still pass — the enum-type-name preservation guarantees this.

If the existing `tiger_ingest.test.sql` 7 tests fail, that's the existing CLAUDE.md gotcha #6: TIGER seed must be run for them to pass. Skip locally; CI handles it.

- [ ] **Step 5: Commit**

```bash
git add packages/db/supabase/migrations/0028_chamber_enum_expand.sql \
        packages/db/supabase/tests/chamber_enum_expansion.test.sql
git commit -m "feat(db): 0028 expand official_chamber enum to 5 values

Federal house/senate values renamed to federal_house/federal_senate via
swap pattern (Postgres can't drop enum values directly). Three columns
covered: officials, officials_leadership_history, votes.

Backfill of existing federal data is automatic via the ALTER COLUMN
USING CASE clause. State values (state_house, state_senate,
state_legislature) ready for use by upcoming state-officials ingest.

pgTAP plan: 8 assertions covering type rename, 5-value membership,
absence of legacy values, column type preservation across 3 tables."
```

---

## Task 2 — Regenerate Database type + update @chiaro/officials

**Files:**
- Modify: `packages/db/src/types.ts` (auto-regenerated)
- Modify: `packages/officials/src/types.ts`
- Modify: `packages/officials/src/schemas.ts`
- Create: `packages/officials/test/types.test.ts`

After migration 0028, the Database type generated by `supabase gen types` will reflect the 5-value chamber union. We update `@chiaro/officials` to mirror it + add chamber-level helpers used everywhere downstream.

- [ ] **Step 1: Regenerate Database type**

```bash
pnpm --filter @chiaro/db gen:types
```

This writes `packages/db/src/types.ts`. Verify the change:

```bash
grep -A3 "official_chamber:" packages/db/src/types.ts | head -10
```

Expected output should now list all 5 chamber values.

- [ ] **Step 2: Update `packages/officials/src/types.ts`**

The file currently exports an `OfficialChamber` union. Find the current definition and replace it:

```ts
import type { Database } from '@chiaro/db'

// Mirror the Database enum exactly — single source of truth via gen:types.
export type OfficialChamber = Database['public']['Enums']['official_chamber']

export function isStateLevel(chamber: OfficialChamber): boolean {
  return chamber === 'state_house'
      || chamber === 'state_senate'
      || chamber === 'state_legislature'
}

export function isFederalLevel(chamber: OfficialChamber): boolean {
  return chamber === 'federal_house' || chamber === 'federal_senate'
}

export function levelOf(chamber: OfficialChamber): 'federal' | 'state' {
  return isStateLevel(chamber) ? 'state' : 'federal'
}

// Senate-shape chambers — covers federal senate, state senate, AND Nebraska's
// state_legislature (unicameral, but functionally senate-equivalent in UI).
export function isSenateChamber(chamber: OfficialChamber): boolean {
  return chamber === 'federal_senate'
      || chamber === 'state_senate'
      || chamber === 'state_legislature'
}

// House-shape chambers — federal house + state house.
export function isHouseChamber(chamber: OfficialChamber): boolean {
  return chamber === 'federal_house' || chamber === 'state_house'
}
```

Keep all other existing exports in the file (`OfficialRow`, `OfficialWithDistrict`, etc.) unchanged.

- [ ] **Step 3: Update `packages/officials/src/schemas.ts`**

Find the zod chamber schema (likely `z.enum(['house', 'senate'])`). Replace with:

```ts
export const ChamberSchema = z.enum([
  'federal_house',
  'federal_senate',
  'state_house',
  'state_senate',
  'state_legislature',
])
```

If `ChamberSchema` is referenced inline by `z.enum([...])` calls rather than exported, update each site.

- [ ] **Step 4: Write tests for helpers**

Create `packages/officials/test/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  isStateLevel,
  isFederalLevel,
  levelOf,
  isSenateChamber,
  isHouseChamber,
} from '../src/types.ts'

describe('OfficialChamber helpers', () => {
  it('isStateLevel returns true only for state_*', () => {
    expect(isStateLevel('federal_house')).toBe(false)
    expect(isStateLevel('federal_senate')).toBe(false)
    expect(isStateLevel('state_house')).toBe(true)
    expect(isStateLevel('state_senate')).toBe(true)
    expect(isStateLevel('state_legislature')).toBe(true)
  })

  it('isFederalLevel returns true only for federal_*', () => {
    expect(isFederalLevel('federal_house')).toBe(true)
    expect(isFederalLevel('federal_senate')).toBe(true)
    expect(isFederalLevel('state_house')).toBe(false)
    expect(isFederalLevel('state_senate')).toBe(false)
    expect(isFederalLevel('state_legislature')).toBe(false)
  })

  it('levelOf returns federal or state', () => {
    expect(levelOf('federal_house')).toBe('federal')
    expect(levelOf('federal_senate')).toBe('federal')
    expect(levelOf('state_house')).toBe('state')
    expect(levelOf('state_senate')).toBe('state')
    expect(levelOf('state_legislature')).toBe('state')
  })

  it('isSenateChamber covers federal_senate + state_senate + state_legislature (NE)', () => {
    expect(isSenateChamber('federal_senate')).toBe(true)
    expect(isSenateChamber('state_senate')).toBe(true)
    expect(isSenateChamber('state_legislature')).toBe(true)
    expect(isSenateChamber('federal_house')).toBe(false)
    expect(isSenateChamber('state_house')).toBe(false)
  })

  it('isHouseChamber covers federal_house + state_house only', () => {
    expect(isHouseChamber('federal_house')).toBe(true)
    expect(isHouseChamber('state_house')).toBe(true)
    expect(isHouseChamber('federal_senate')).toBe(false)
    expect(isHouseChamber('state_senate')).toBe(false)
    expect(isHouseChamber('state_legislature')).toBe(false)
  })
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @chiaro/officials test types
```

Expected: 5/5 pass.

- [ ] **Step 6: Run typecheck (will surface ripple errors — those are Task 3)**

```bash
pnpm -r typecheck 2>&1 | head -50
```

Expected: many TypeScript errors across the codebase where `'house'` / `'senate'` literals are used. These are intentional — Task 3 fixes them. Do NOT fix them yet; this commit is type-update-only.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/types.ts \
        packages/officials/src/types.ts \
        packages/officials/src/schemas.ts \
        packages/officials/test/types.test.ts
git commit -m "feat(officials): expand OfficialChamber to 5-value union + add helpers

Mirrors migration 0028. New helpers used by upcoming state-officials UI:
- isStateLevel(chamber): state_*
- isFederalLevel(chamber): federal_*
- levelOf(chamber): 'federal' | 'state'
- isSenateChamber(chamber): senate-shape — includes NE state_legislature
- isHouseChamber(chamber): house-shape

zod schema in schemas.ts updated to match.

Note: workspace typecheck is NOT yet clean — Task 3 ripple-fixes all
chamber literal call sites ('house'→'federal_house', etc)."
```

---

## Task 3 — Ripple-fix chamber literals across the codebase

**Files (representative; engineer should grep to find all):**
- Modify: `packages/db/supabase/seed/normalize.ts`
- Modify: `packages/db/supabase/seed/officials-ingest.ts`
- Modify: `packages/db/supabase/seed/unitedstates-legislators-ingest.ts`
- Modify: `packages/db/supabase/seed/audit-fixture-attach.ts`
- Modify: every `packages/db/supabase/seed/*.test.ts` that inserts `chamber: 'house'` or `chamber: 'senate'`
- Modify: every `apps/web/components/**` and `apps/mobile/components/**` that compares `chamber === 'house'` or `chamber === 'senate'`
- Modify: `packages/officials/test/queries.integration.test.ts` (chamber literals in test seed)

After Task 2, `pnpm -r typecheck` surfaces every site needing the 5-value-aware update. This task is the mechanical ripple.

- [ ] **Step 1: Inventory the impact**

```bash
pnpm -r typecheck 2>&1 | grep "error TS" | head -50
```

Note the file paths + line numbers. There will be ~20-40 errors. Categorize as you go:
- **Seed code** writing 'house'/'senate' literals → replace with 'federal_house'/'federal_senate'
- **Frontend code** reading chamber === 'house'/'senate' → use `isHouseChamber(chamber)` / `isSenateChamber(chamber)` or a more specific predicate from `@chiaro/officials/src/types.ts`

Also grep for any literal that the typechecker won't catch (since the column type changed, the typechecker catches MOST sites, but string concatenations like `\`chamber:\${"house"}\`` may slip through):

```bash
grep -rn "'house'\|'senate'\|\"house\"\|\"senate\"" \
  packages/db/supabase/seed/ \
  packages/officials/ \
  apps/web/ \
  apps/mobile/ \
  --include="*.ts" --include="*.tsx" --include="*.sql" 2>&1 | head -60
```

Manually filter — many of those are unrelated strings (party labels, chamber names in display copy, etc.). Focus on chamber-typed values.

- [ ] **Step 2: Fix `packages/db/supabase/seed/normalize.ts`**

This module normalizes Congress.gov data into officials rows. Find the chamber assignment (probably maps `member.chamber` like `"House of Representatives"` / `"Senate"` to `'house'` / `'senate'`). Update the target values to the new federal_* names.

Open the file. Find the chamber mapping. Replace as shown — verify the function name matches what's actually in the file:

```ts
// BEFORE
function normalizeChamber(raw: string): 'house' | 'senate' {
  return raw === 'House of Representatives' ? 'house' : 'senate'
}

// AFTER
function normalizeChamber(raw: string): 'federal_house' | 'federal_senate' {
  return raw === 'House of Representatives' ? 'federal_house' : 'federal_senate'
}
```

Update the return type AND all callers if the type is inferred elsewhere.

- [ ] **Step 3: Fix seed test fixture literals**

For each of the 8 seed test files that insert officials directly, replace `chamber: 'house'` → `chamber: 'federal_house'` and `chamber: 'senate'` → `chamber: 'federal_senate'`. List of files (verify each via grep):

```
packages/db/supabase/seed/unitedstates-legislators-ingest.ts
packages/db/supabase/seed/audit-fixture-attach.ts
packages/db/supabase/seed/officials-ingest.test.ts
packages/db/supabase/seed/recompute-metrics.test.ts
packages/db/supabase/seed/finance-ingest.test.ts
packages/db/supabase/seed/scorecards/index.test.ts
packages/db/supabase/seed/town-halls-ingest.test.ts
packages/db/supabase/seed/stock-watcher-ingest.test.ts
packages/db/supabase/seed/salary-residency-ingest.test.ts
packages/db/supabase/seed/bills-votes-ingest.test.ts
```

For each: edit the INSERT statement's chamber field. Example pattern:

```ts
// BEFORE
'P000197','N','P','Nancy P.','house','D','CA',...

// AFTER
'P000197','N','P','Nancy P.','federal_house','D','CA',...
```

(That literal is positional in a parameterized query — find the exact format in each file.)

- [ ] **Step 4: Fix integration test in @chiaro/officials**

`packages/officials/test/queries.integration.test.ts` has chamber literals in `beforeAll` seed (federal_house for Pelosi, federal_senate for Feinstein + Padilla). Update each.

- [ ] **Step 5: Fix frontend chamber checks**

Find every `chamber === 'house'` and `chamber === 'senate'` in `apps/web/` and `apps/mobile/`. Decide per-site:

- If the check is "is this a senator?" (for "Senator" label, N/A handling, etc.) → use `isSenateChamber(chamber)`
- If "is this a house rep?" → `isHouseChamber(chamber)`
- If specifically "is this a FEDERAL senator?" (some legacy slice-4 code) → keep as `chamber === 'federal_senate'`

Example: the slice-4 redesign's "Lives in District (N/A — Senate)" logic should ONLY apply to federal_senate (state senators get the ComingSoonCard treatment anyway, but federal logic is unchanged). Use the explicit literal:

```ts
// BEFORE
if (official.chamber === 'senate') {
  return <NotApplicable label="Lives in District (N/A — Senate)" />
}

// AFTER
if (official.chamber === 'federal_senate') {
  return <NotApplicable label="Lives in District (N/A — Senate)" />
}
```

For "Senator" / "Representative" labels, use the helper:

```ts
// BEFORE
const chamberLabel = chamber === 'senate' ? 'Senator' : 'Representative'

// AFTER (federal-only context)
const chamberLabel = chamber === 'federal_senate' ? 'Senator' : 'Representative'

// AFTER (chamber-agnostic context — handles state too)
const chamberLabel = isSenateChamber(chamber) ? 'Senator' : 'Representative'
```

Pick the right one based on which file you're in. Federal route files: use explicit federal_* literals. Shared components (BioHeader, DistrictBadge): use the helpers.

- [ ] **Step 6: Update any pgTAP tests asserting chamber values**

Grep for chamber assertions in pgTAP:

```bash
grep -rn "chamber" packages/db/supabase/tests/*.test.sql | grep -E "house|senate"
```

For any test that uses `'house'` or `'senate'` as a chamber value in an INSERT or assertion, update to `'federal_house'` / `'federal_senate'` (these are federal-only pgTAP tests; no state coverage yet).

- [ ] **Step 7: Re-run typecheck + tests**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm test 2>&1 | tail -30
pnpm db:reset && pnpm db:test 2>&1 | tail -20
```

Expected: typecheck clean (0 errors), `pnpm test` green, pgTAP clean. If anything fails, the failing site is one Step 1's grep didn't catch — fix and re-run.

- [ ] **Step 8: Commit**

```bash
git add packages/ apps/
git commit -m "chore: ripple-fix chamber literals to new 5-value enum

After 0028 + officials types update, every existing 'house'/'senate'
literal becomes a type error. This commit threads the new values
through:

- packages/db/supabase/seed/normalize.ts: Congress.gov chamber mapping
  now produces federal_house/federal_senate
- 10 seed test files: chamber:'house' → chamber:'federal_house', same
  for senate
- @chiaro/officials integration test: federal_house/federal_senate
- apps/web + apps/mobile: explicit federal_* literals where federal-only
  logic applies (e.g. slice-4 'Lives in District N/A Senate' is
  federal_senate-specific); isSenateChamber/isHouseChamber helpers in
  shared components

Workspace typecheck clean, all federal tests + pgTAP suite green."
```

---

## Task 4 — Migration 0029: officials openstates fields

**Files:**
- Create: `packages/db/supabase/migrations/0029_officials_openstates_fields.sql`
- Create: `packages/db/supabase/tests/officials_openstates_fields.test.sql`
- Modify: `packages/db/src/types.ts` (regenerated)

Adds the new columns + CHECK + relaxes party. Pure additive on existing data — federal rows aren't touched.

- [ ] **Step 1: Write migration SQL**

Create `packages/db/supabase/migrations/0029_officials_openstates_fields.sql`:

```sql
-- Sub-slice 5C: openstates_person_id + district_code + title for state legislators.
-- CHECK enforces exclusivity: federal rows have bioguide_id, state rows have
-- openstates_person_id, never both.
-- Party CHECK constraint relaxed: state legislators include NE Nonpartisan,
-- MN DFL, Working Families, Progressive (VT). Display normalization moves to
-- @chiaro/ui-tokens.

alter table public.officials
  add column if not exists openstates_person_id text,
  add column if not exists district_code        text,
  add column if not exists title                text;

create unique index if not exists officials_openstates_person_idx
  on public.officials(openstates_person_id)
  where openstates_person_id is not null;

alter table public.officials
  add constraint officials_source_id_xor check (
    (bioguide_id is not null and openstates_person_id is null) or
    (bioguide_id is null     and openstates_person_id is not null)
  );

-- Find + drop the party CHECK constraint by its conkey signature.
-- Note: constraint name in 0009 may be officials_party_check OR auto-generated.
-- Use `\d public.officials` to confirm the name in your local Supabase before
-- this migration first runs; the IF EXISTS handles either case.
alter table public.officials drop constraint if exists officials_party_check;
```

Verify constraint name first:

```bash
pnpm db:reset  # Ensure schema is current
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "\d public.officials" 2>&1 | grep -i party
```

If the constraint name is something other than `officials_party_check`, update the DROP CONSTRAINT line. The constraint may also be a column-level CHECK (visible as `"officials_party_check" CHECK (party = ANY (ARRAY['D'::text, 'R'::text, 'I'::text]))`).

- [ ] **Step 2: Write pgTAP**

Create `packages/db/supabase/tests/officials_openstates_fields.test.sql`:

```sql
begin;
select plan(10);

select has_column('public', 'officials', 'openstates_person_id',
  'openstates_person_id column exists');
select col_type_is('public', 'officials', 'openstates_person_id', 'text',
  'openstates_person_id is text');
select col_is_null('public', 'officials', 'openstates_person_id',
  'openstates_person_id is nullable');

select has_column('public', 'officials', 'district_code',
  'district_code column exists');
select col_type_is('public', 'officials', 'district_code', 'text',
  'district_code is text');

select has_column('public', 'officials', 'title',
  'title column exists');

select has_index('public', 'officials', 'officials_openstates_person_idx',
  'partial unique index on openstates_person_id where not null exists');

-- CHECK constraint exists and bans both-set / neither-set.
select has_check('public', 'officials',
  'officials_source_id_xor CHECK exists');

-- Verify the CHECK enforces XOR. We need a district to insert (FK).
-- Insert one fixture district under a unique source_version to avoid
-- colliding with TIGER seed rows.
insert into public.districts (tier, state, code, name, geometry, source_version)
values ('federal_senate', 'XX', 'XX-FK-test', 'fk test',
  st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
  'FK-XOR-test');

-- Attempt insert with BOTH bioguide_id and openstates_person_id — should fail.
select throws_ok(
  $$insert into public.officials
    (bioguide_id, openstates_person_id, first_name, last_name, full_name,
     chamber, party, state, district_id, senate_class, source_version)
    select 'XXBOTH1', 'ocd-person/xxxx', 'X','X','X',
           'federal_senate', 'D', 'XX',
           id, 1, 'FK-XOR-test'
    from public.districts where code = 'XX-FK-test'$$,
  '23514',  -- check_violation
  null,
  'insert with both bioguide_id and openstates_person_id violates CHECK'
);

-- Attempt insert with NEITHER — should fail.
select throws_ok(
  $$insert into public.officials
    (first_name, last_name, full_name, chamber, party, state, district_id,
     senate_class, source_version)
    select 'X','X','X','federal_senate', 'D', 'XX', id, 1, 'FK-XOR-test'
    from public.districts where code = 'XX-FK-test'$$,
  '23514',
  null,
  'insert with neither bioguide_id nor openstates_person_id violates CHECK'
);

-- Verify party CHECK is gone — insert with 'Nonpartisan' should succeed.
-- Use a state senator chamber + new openstates_person_id so the source_id_xor
-- check passes.
select lives_ok(
  $$insert into public.officials
    (openstates_person_id, first_name, last_name, full_name,
     chamber, party, state, district_id, senate_class, source_version)
    select 'ocd-person/np-test', 'N','P','N P',
           'state_legislature', 'Nonpartisan', 'XX',
           id, 1, 'FK-XOR-test'
    from public.districts where code = 'XX-FK-test'$$,
  'party=Nonpartisan accepted (party CHECK relaxed)'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Apply + verify**

```bash
pnpm db:reset
pnpm db:test
```

Expected: 0029 applies cleanly; pgTAP plan(10) passes. If the `officials_party_check` drop fails because the constraint name differs locally, fix per Step 1's note and re-run.

- [ ] **Step 4: Regenerate types**

```bash
pnpm --filter @chiaro/db gen:types
```

Verify the new columns appear in `packages/db/src/types.ts`:

```bash
grep -A2 "openstates_person_id\|district_code\|title" packages/db/src/types.ts | head -15
```

Should show each as `text | null`.

- [ ] **Step 5: Verify workspace typecheck still clean**

```bash
pnpm -r typecheck 2>&1 | tail -5
```

Expected: clean. The new columns are nullable and additive, so no existing code breaks. Federal seed inserts continue to work because the CHECK accepts `bioguide_id IS NOT NULL AND openstates_person_id IS NULL`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/migrations/0029_officials_openstates_fields.sql \
        packages/db/supabase/tests/officials_openstates_fields.test.sql \
        packages/db/src/types.ts
git commit -m "feat(db): 0029 officials.openstates_person_id + district_code + title

Adds 3 nullable columns to public.officials for state legislator ingest.
CHECK enforces XOR — federal rows have bioguide_id, state rows have
openstates_person_id, never both.

Drops the legacy party CHECK constraint (D/R/I only) — needed for NE
Nonpartisan, MN DFL, Working Families, Progressive (VT). Display
normalization moves to @chiaro/ui-tokens.

pgTAP plan: 10 assertions covering column existence, types, nullable,
unique partial index, CHECK XOR enforcement (both-set + neither-set
both rejected via 23514), party CHECK absence (Nonpartisan accepted)."
```

---

## Task 5 — Per-state district config + tests

**Files:**
- Create: `packages/db/supabase/seed/state-leg-config.ts`
- Create: `packages/db/supabase/seed/state-leg-config.test.ts`
- Modify: `packages/db/package.json` (add `yaml@^2` dep)

Per-state rules mapping OpenStates `current_role.district` strings to TIGER `districts.code` values. Mirrors `tiger-config.ts` shape.

- [ ] **Step 1: Add yaml dep**

```bash
pnpm --filter @chiaro/db add yaml
```

Confirm `packages/db/package.json` lists `yaml: ^2.x.x` in dependencies.

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/state-leg-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizeStateLegDistrictCode,
  isStateChamberSupported,
  STATES_WITH_UNICAMERAL,
} from './state-leg-config.ts'

describe('state-leg-config', () => {
  it('numeric district codes zero-pad for most states', () => {
    expect(normalizeStateLegDistrictCode('CA', 'lower', '15')).toBe('CA-15')
    expect(normalizeStateLegDistrictCode('CA', 'upper', '8')).toBe('CA-08')
    expect(normalizeStateLegDistrictCode('TX', 'lower', '142')).toBe('TX-142')
  })

  it('Maryland multi-member: 1A/1B/1C all map to single district CD MD-01', () => {
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1A')).toBe('MD-01')
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1B')).toBe('MD-01')
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1C')).toBe('MD-01')
  })

  it('Nebraska unicameral: legislature chamber, codes match state_senate tier', () => {
    expect(normalizeStateLegDistrictCode('NE', 'legislature', '23')).toBe('NE-23')
    expect(isStateChamberSupported('NE', 'lower')).toBe(false)
    expect(isStateChamberSupported('NE', 'upper')).toBe(false)
    expect(isStateChamberSupported('NE', 'legislature')).toBe(true)
  })

  it('NH multi-word district codes return null (known limitation)', () => {
    expect(normalizeStateLegDistrictCode('NH', 'lower', 'Rockingham 5')).toBe(null)
    expect(normalizeStateLegDistrictCode('NH', 'lower', 'Hillsborough 23')).toBe(null)
  })

  it('Alaska letter districts pad as-is', () => {
    expect(normalizeStateLegDistrictCode('AK', 'lower', 'A')).toBe('AK-A')
    expect(normalizeStateLegDistrictCode('AK', 'upper', 'B')).toBe('AK-B')
  })

  it('at-large districts (WY house) map to STATE-AL', () => {
    expect(normalizeStateLegDistrictCode('WY', 'lower', 'At-Large')).toBe('WY-AL')
  })

  it('unsupported state/chamber combos return null', () => {
    expect(normalizeStateLegDistrictCode('DC', 'lower', '1')).toBe(null)
    expect(normalizeStateLegDistrictCode('GU', 'upper', '1')).toBe(null)
  })

  it('STATES_WITH_UNICAMERAL is exactly { NE }', () => {
    expect(STATES_WITH_UNICAMERAL).toEqual(new Set(['NE']))
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
pnpm --filter @chiaro/db test state-leg-config
```

Expected: module-not-found error or all 8 cases fail.

- [ ] **Step 4: Implement state-leg-config**

Create `packages/db/supabase/seed/state-leg-config.ts`:

```ts
// Per-state OpenStates district-code normalization rules.
// Mirrors tiger-config.ts shape but for state_house + state_senate tiers.
//
// OpenStates returns `current_role.district` as raw strings. TIGER 2024 has
// state legislature districts keyed by simpler codes (e.g. CA-15, CA-08).
// This module bridges the two.
//
// Known limitation: NH uses multi-word district codes ("Rockingham 5",
// "Hillsborough 23") that don't fit any short scheme. We return null and
// the ingest orchestrator logs + skips those legislators.

export type OpenStatesOrgClassification = 'upper' | 'lower' | 'legislature'

export const STATES_WITH_UNICAMERAL = new Set(['NE'] as const)

// 50 US states + DC. We only ingest the 50 states; DC and territories return null.
const SUPPORTED_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
])

// States that use letter suffixes for multi-member districts. Strip suffix.
const STATES_MULTIMEMBER_LETTER_SUFFIX = new Set(['MD'])

// States where OpenStates emits multi-word district names we can't normalize.
const STATES_KNOWN_UNNORMALIZABLE = new Set(['NH'])

// States where the district code is itself a letter (no number).
const STATES_LETTER_ONLY_DISTRICTS = new Set(['AK'])

export function isStateChamberSupported(
  state: string,
  chamber: OpenStatesOrgClassification,
): boolean {
  if (!SUPPORTED_STATES.has(state)) return false
  if (chamber === 'legislature') return STATES_WITH_UNICAMERAL.has(state as 'NE')
  if (STATES_WITH_UNICAMERAL.has(state as 'NE')) return false
  return chamber === 'upper' || chamber === 'lower'
}

export function normalizeStateLegDistrictCode(
  state: string,
  chamber: OpenStatesOrgClassification,
  rawDistrict: string,
): string | null {
  if (!isStateChamberSupported(state, chamber)) return null

  // At-large case (rare for state houses; WY uses it).
  if (rawDistrict.toLowerCase() === 'at-large') return `${state}-AL`

  if (STATES_KNOWN_UNNORMALIZABLE.has(state)) {
    // NH and similar — log + skip handled by caller.
    return null
  }

  if (STATES_MULTIMEMBER_LETTER_SUFFIX.has(state)) {
    // MD: '1A' / '1B' / '1C' all map to district '01'.
    const numericPart = rawDistrict.match(/^\d+/)?.[0]
    if (!numericPart) return null
    return `${state}-${numericPart.padStart(2, '0')}`
  }

  if (STATES_LETTER_ONLY_DISTRICTS.has(state)) {
    // AK: 'A', 'B', etc.
    if (!/^[A-Z]+$/.test(rawDistrict)) return null
    return `${state}-${rawDistrict}`
  }

  // Default: numeric district, zero-pad to at least 2 digits.
  if (!/^\d+$/.test(rawDistrict)) return null
  const padded = rawDistrict.padStart(2, '0')
  return `${state}-${padded}`
}
```

- [ ] **Step 5: Run passing tests**

```bash
pnpm --filter @chiaro/db test state-leg-config
```

Expected: 8/8 pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/db/package.json pnpm-lock.yaml \
        packages/db/supabase/seed/state-leg-config.ts \
        packages/db/supabase/seed/state-leg-config.test.ts
git commit -m "feat(db): state-leg-config — per-state OpenStates → TIGER district mapping

normalizeStateLegDistrictCode(state, chamber, rawDistrict) → matched
TIGER districts.code or null. Per-state rules:

- Most states: numeric, zero-pad to 2 digits (CA-15, TX-142)
- MD multi-member: strip letter suffix (1A/1B/1C → 01)
- NE unicameral: chamber='legislature', codes match state_senate tier
- AK: letter-only codes (AK-A, AK-B)
- WY house: 'At-Large' → STATE-AL
- NH: multi-word codes ('Rockingham 5') return null — known limitation
- DC/territories: not supported, return null

8 vitest plans cover all branches.

Adds yaml@^2 dep to @chiaro/db (needed by Task 6 YAML loader)."
```

---

## Task 6 — OpenStates YAML loader

**Files:**
- Create: `packages/db/supabase/seed/openstates-yaml-loader.ts`
- Create: `packages/db/supabase/seed/openstates-yaml-loader.test.ts`
- Create: `packages/db/supabase/seed/fixtures/openstates-people/` (subdirectory)
- Create: 6 fixture YAML files (see Step 4)

Walks YAML files from a local directory (in tests: the fixtures dir; in production: a clone of `github.com/openstates/people`). Parses each file into a normalized `OpenStatesPerson` record. Filters out incomplete/non-current rows.

- [ ] **Step 1: Create fixture YAML files**

Create directory: `packages/db/supabase/seed/fixtures/openstates-people/`

Then 6 files. Use these exact contents (they exercise the test cases in Task 5 + Task 8). Real OpenStates YAML has more fields; these include only what the ingest reads.

`ca-sample-assemblymember.yml`:
```yaml
id: ocd-person/00000000-0000-0000-0000-000000000001
name: Test Asm
given_name: Test
family_name: Asm
party:
  - name: Democratic
image: https://example.com/asm.jpg
email: asm@example.test
roles:
  - type: lower
    jurisdiction: ocd-jurisdiction/country:us/state:ca/government
    district: '15'
    title: Assemblymember
    start_date: '2024-12-02'
    end_date: '2026-12-01'
offices:
  - classification: capitol
    address: 1 Capitol, Sacramento CA
    voice: 555-0100
links:
  - url: https://a15.asmdc.org/
```

`ca-sample-senator.yml`:
```yaml
id: ocd-person/00000000-0000-0000-0000-000000000002
name: Test Sen
given_name: Test
family_name: Sen
party:
  - name: Republican
image: https://example.com/sen.jpg
roles:
  - type: upper
    jurisdiction: ocd-jurisdiction/country:us/state:ca/government
    district: '8'
    title: Senator
    start_date: '2024-12-02'
    end_date: '2028-12-01'
offices:
  - classification: capitol
    address: 1 Capitol, Sacramento CA
    voice: 555-0200
```

`ne-sample-unicameral-senator.yml`:
```yaml
id: ocd-person/00000000-0000-0000-0000-000000000003
name: Test NE Sen
given_name: Test
family_name: NE
party:
  - name: Nonpartisan
image: https://example.com/ne.jpg
roles:
  - type: legislature
    jurisdiction: ocd-jurisdiction/country:us/state:ne/government
    district: '23'
    title: Senator
    start_date: '2025-01-01'
    end_date: '2029-01-01'
offices:
  - classification: capitol
    address: NE State Capitol
    voice: 555-0300
```

`md-sample-delegate-1A.yml`:
```yaml
id: ocd-person/00000000-0000-0000-0000-000000000004
name: Test Del 1A
given_name: Test
family_name: One-A
party:
  - name: Democratic
roles:
  - type: lower
    jurisdiction: ocd-jurisdiction/country:us/state:md/government
    district: 1A
    title: Delegate
    start_date: '2023-01-11'
    end_date: '2027-01-13'
```

`md-sample-delegate-1B.yml`:
```yaml
id: ocd-person/00000000-0000-0000-0000-000000000005
name: Test Del 1B
party:
  - name: Republican
roles:
  - type: lower
    jurisdiction: ocd-jurisdiction/country:us/state:md/government
    district: 1B
    title: Delegate
    start_date: '2023-01-11'
    end_date: '2027-01-13'
```

`md-sample-delegate-1C.yml`:
```yaml
id: ocd-person/00000000-0000-0000-0000-000000000006
name: Test Del 1C
party:
  - name: Democratic
roles:
  - type: lower
    jurisdiction: ocd-jurisdiction/country:us/state:md/government
    district: 1C
    title: Delegate
    start_date: '2023-01-11'
    end_date: '2027-01-13'
```

- [ ] **Step 2: Write failing test**

Create `packages/db/supabase/seed/openstates-yaml-loader.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOpenStatesYamlDir } from './openstates-yaml-loader.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-people')

describe('openstates-yaml-loader', () => {
  it('loads all 6 fixture files', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    expect(people).toHaveLength(6)
  })

  it('returns each person with normalized core fields', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    const asm = people.find(p => p.id === 'ocd-person/00000000-0000-0000-0000-000000000001')
    expect(asm).toBeDefined()
    expect(asm!.name).toBe('Test Asm')
    expect(asm!.party).toBe('Democratic')
    expect(asm!.image).toBe('https://example.com/asm.jpg')
    expect(asm!.email).toBe('asm@example.test')
    expect(asm!.role.type).toBe('lower')
    expect(asm!.role.district).toBe('15')
    expect(asm!.role.title).toBe('Assemblymember')
    expect(asm!.role.state).toBe('CA')
    expect(asm!.offices).toHaveLength(1)
    expect(asm!.offices[0]!.classification).toBe('capitol')
  })

  it('parses NE legislature (unicameral) correctly', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    const ne = people.find(p => p.role.state === 'NE')!
    expect(ne.role.type).toBe('legislature')
    expect(ne.party).toBe('Nonpartisan')
  })

  it('parses MD multi-member districts (1A, 1B, 1C)', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    const mds = people.filter(p => p.role.state === 'MD')
    expect(mds).toHaveLength(3)
    expect(new Set(mds.map(p => p.role.district))).toEqual(new Set(['1A','1B','1C']))
  })

  it('skips malformed files and continues (graceful)', async () => {
    // Write a malformed YAML to a tmp file, confirm loader returns the
    // 6 valid plus a count of parse errors. Spec says skip-with-log; we use
    // a return-value `errors` array.
    const tmpDir = join(__dirname, 'fixtures', 'openstates-people-broken-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(join(tmpDir, 'good.yml'), `id: ocd-person/x\nname: G\nparty: [{name: D}]\nroles: [{type: lower, jurisdiction: ocd-jurisdiction/country:us/state:ca/government, district: '1', title: Asm, start_date: '2024-01-01', end_date: '2026-01-01'}]\n`)
    await writeFile(join(tmpDir, 'broken.yml'), `[invalid yaml syntax: : :`)
    try {
      const result = await loadOpenStatesYamlDir(tmpDir)
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('G')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('returns empty array for empty dir', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-people-empty-tmp')
    const { mkdir, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    try {
      expect(await loadOpenStatesYamlDir(tmpDir)).toEqual([])
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
pnpm --filter @chiaro/db test openstates-yaml-loader
```

Expected: module-not-found error.

- [ ] **Step 4: Implement loader**

Create `packages/db/supabase/seed/openstates-yaml-loader.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

export type OpenStatesRoleType = 'upper' | 'lower' | 'legislature'

export interface OpenStatesPerson {
  id: string                    // ocd-person/<uuid>
  name: string
  given_name?: string
  family_name?: string
  party: string                 // first party name in array
  image?: string
  email?: string
  role: {
    type: OpenStatesRoleType
    state: string               // 2-char uppercase derived from jurisdiction id
    district: string
    title: string
  }
  offices: Array<{
    classification?: string     // 'capitol' | 'district' | 'primary'
    address?: string
    voice?: string
    fax?: string
  }>
}

/**
 * Walk every .yml/.yaml file in a directory (non-recursive — OpenStates
 * doesn't nest beyond `data/<state>/legislature/`). Parse each, normalize,
 * skip files that fail to parse or are missing required fields. Returns
 * the valid list; errors are logged to stderr.
 */
export async function loadOpenStatesYamlDir(dir: string): Promise<OpenStatesPerson[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const yamlFiles = entries.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

  const people: OpenStatesPerson[] = []
  for (const file of yamlFiles) {
    const path = join(dir, file)
    try {
      const text = await readFile(path, 'utf8')
      const raw = parseYaml(text) as Record<string, unknown> | null
      const normalized = normalize(raw)
      if (normalized) people.push(normalized)
    } catch (err) {
      console.error(`[openstates-yaml-loader] parse error in ${file}: ${(err as Error).message}`)
    }
  }
  return people
}

function normalize(raw: Record<string, unknown> | null): OpenStatesPerson | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || !raw.id.startsWith('ocd-person/')) return null
  if (typeof raw.name !== 'string') return null

  const partyArr = raw.party as Array<{ name?: string }> | undefined
  const party = Array.isArray(partyArr) && partyArr[0]?.name ? partyArr[0].name : null
  if (!party) return null

  const roles = (raw.roles as Array<Record<string, unknown>> | undefined) ?? []
  // Pick the role whose end_date is in the future (current term). Fall back to first.
  const now = new Date().toISOString().slice(0, 10)
  const current = roles.find(r =>
    typeof r.end_date === 'string' && r.end_date >= now
  ) ?? roles[0]
  if (!current) return null

  const roleType = current.type
  if (roleType !== 'upper' && roleType !== 'lower' && roleType !== 'legislature') return null

  const jurisdiction = typeof current.jurisdiction === 'string' ? current.jurisdiction : ''
  const stateMatch = jurisdiction.match(/state:([a-z]{2})/)
  if (!stateMatch) return null
  const state = stateMatch[1]!.toUpperCase()

  const district = current.district != null ? String(current.district) : ''
  if (!district) return null

  const title = typeof current.title === 'string' ? current.title : ''
  if (!title) return null

  const offices = ((raw.offices as Array<Record<string, unknown>> | undefined) ?? []).map(o => ({
    classification: typeof o.classification === 'string' ? o.classification : undefined,
    address: typeof o.address === 'string' ? o.address : undefined,
    voice: typeof o.voice === 'string' ? o.voice : undefined,
    fax: typeof o.fax === 'string' ? o.fax : undefined,
  }))

  return {
    id: raw.id,
    name: raw.name,
    given_name: typeof raw.given_name === 'string' ? raw.given_name : undefined,
    family_name: typeof raw.family_name === 'string' ? raw.family_name : undefined,
    party,
    image: typeof raw.image === 'string' ? raw.image : undefined,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    role: { type: roleType, state, district, title },
    offices,
  }
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @chiaro/db test openstates-yaml-loader
```

Expected: 6/6 pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/db/supabase/seed/openstates-yaml-loader.ts \
        packages/db/supabase/seed/openstates-yaml-loader.test.ts \
        packages/db/supabase/seed/fixtures/openstates-people/
git commit -m "feat(db): openstates-yaml-loader + 6 fixture YAML files

loadOpenStatesYamlDir(dir) → OpenStatesPerson[] walks .yml/.yaml files
in a directory, parses with yaml@2, normalizes:
- id, name, given/family_name, party (first .name in array), image, email
- Picks the role whose end_date >= today (current term)
- Extracts state from jurisdiction id (ocd-jurisdiction/.../state:XX/...)
- offices[] preserved with classification/address/voice/fax

Fixture set covers: CA assemblymember + senator, NE unicameral
(Nonpartisan), MD 3 multi-member delegates (1A/1B/1C).

Loader is fault-tolerant: malformed YAML → logged to stderr, skipped.
Missing dir → empty array. Missing required fields (id, name, party,
role, district, state, title) → skipped silently."
```

---

## Task 7 — State officials ingest orchestrator

**Files:**
- Create: `packages/db/supabase/seed/state-officials-ingest.ts`
- Create: `packages/db/supabase/seed/state-officials-ingest.test.ts`
- Modify: `packages/db/package.json` (add `seed:state-officials` script)

The orchestrator pulls everything together: YAML loader → state-leg-config normalization → DB upsert into `public.officials` + `public.district_offices`. Defensive guards mirror `officials-ingest.ts`.

- [ ] **Step 1: Write failing test**

Create `packages/db/supabase/seed/state-officials-ingest.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestStateOfficials } from './state-officials-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL    = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-people')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  // Pre-seed the districts the fixture legislators belong to. Use a unique
  // source_version so afterEach can clean precisely.
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',       'CA', 'CA-15', 'CA AD 15',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-stateleg'),
      ('state_senate',      'CA', 'CA-08', 'CA SD 8',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-stateleg'),
      ('state_legislature', 'NE', 'NE-23', 'NE District 23',
        st_geogfromtext('MULTIPOLYGON(((-100 40,-99 40,-99 41,-100 41,-100 40)))'), 'FX-stateleg'),
      ('state_house',       'MD', 'MD-01', 'MD HD 01',
        st_geogfromtext('MULTIPOLYGON(((-77 39,-76 39,-76 40,-77 40,-77 39)))'), 'FX-stateleg')
    on conflict (tier, code) do nothing
  `)
})

afterEach(async () => {
  // Clean every FK child + officials + districts we seeded.
  await client.query("delete from public.district_offices where official_id in (select id from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%')")
  await client.query("delete from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'")
  await client.query("delete from public.districts where source_version = 'FX-stateleg'")
  await client.end()
})

describe('ingestStateOfficials', () => {
  it('happy path: 6 fixture legislators → 6 officials rows', async () => {
    const stats = await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    expect(stats.errors).toEqual([])
    expect(stats.officialsUpserted).toBe(6)
    const rows = await client.query(
      "select chamber, state, district_code, title, party from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%' order by state, district_code, title"
    )
    expect(rows.rows.length).toBe(6)
  })

  it('NE unicameral: chamber=state_legislature, party=Nonpartisan', async () => {
    await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    const rows = await client.query(
      "select chamber::text as chamber, party from public.officials where openstates_person_id = 'ocd-person/00000000-0000-0000-0000-000000000003'"
    )
    expect(rows.rows[0]).toMatchObject({ chamber: 'state_legislature', party: 'Nonpartisan' })
  })

  it('MD multi-member: 3 delegates share district_id (MD-01)', async () => {
    await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    const rows = await client.query(`
      select count(distinct district_id)::int as district_count, count(*)::int as officials_count
      from public.officials
      where state = 'MD' and openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'
    `)
    expect(rows.rows[0].officials_count).toBe(3)
    expect(rows.rows[0].district_count).toBe(1)
  })

  it('title preserved verbatim (Assemblymember/Senator/Delegate)', async () => {
    await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    const rows = await client.query(`
      select title from public.officials
      where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'
      order by title
    `)
    const titles = rows.rows.map((r: { title: string }) => r.title)
    expect(titles).toContain('Assemblymember')
    expect(titles).toContain('Senator')
    expect(titles).toContain('Delegate')
  })

  it('offices upserted to public.district_offices', async () => {
    await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    const rows = await client.query(`
      select count(*)::int as office_count
      from public.district_offices do
      join public.officials o on o.id = do.official_id
      where o.openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'
    `)
    // CA-asm + CA-sen + NE all have 1 office each = 3 total.
    // (The 3 MD delegates have no offices in fixture.)
    expect(rows.rows[0].office_count).toBe(3)
  })

  it('idempotent re-run: same fixture → same row counts, no duplicates', async () => {
    await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    const stats2 = await ingestStateOfficials({ fixturesDir: FIXTURE_DIR })
    expect(stats2.errors).toEqual([])
    const rows = await client.query(
      "select count(*)::int as c from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'"
    )
    expect(rows.rows[0].c).toBe(6)
  })

  it('legislator with unmatched district (NH-style) logged + skipped', async () => {
    // Write a tmp NH fixture that returns null from state-leg-config.
    const tmpDir = join(__dirname, 'fixtures', 'openstates-people-nh-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(join(tmpDir, 'nh.yml'), [
      `id: ocd-person/00000000-0000-0000-0000-0000000000NH`,
      `name: Test NH`,
      `party: [{name: Republican}]`,
      `roles:`,
      `  - type: lower`,
      `    jurisdiction: ocd-jurisdiction/country:us/state:nh/government`,
      `    district: 'Rockingham 5'`,
      `    title: Representative`,
      `    start_date: '2024-12-04'`,
      `    end_date: '2026-12-02'`,
    ].join('\n'))
    try {
      const stats = await ingestStateOfficials({ fixturesDir: tmpDir })
      expect(stats.officialsUpserted).toBe(0)
      expect(stats.unmatchedDistricts).toContain('NH:Rockingham 5')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('pre-flight count below threshold aborts non-zero', async () => {
    // Default MIN_STATE_HOUSE_COUNT=4500, MIN_STATE_SENATE_COUNT=1800. Our
    // fixture has 6 legislators. Override the minimums via opts to verify
    // the gate. Use a high min to force the abort path.
    await expect(
      ingestStateOfficials({
        fixturesDir: FIXTURE_DIR,
        minStateHouseCount: 1000,
        minStateSenateCount: 1000,
      })
    ).rejects.toThrow(/pre-flight count/i)
    // No officials should have been inserted.
    const rows = await client.query(
      "select count(*)::int as c from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%'"
    )
    expect(rows.rows[0].c).toBe(0)
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
pnpm --filter @chiaro/db test state-officials-ingest
```

Expected: module not found.

- [ ] **Step 3: Implement orchestrator**

Create `packages/db/supabase/seed/state-officials-ingest.ts`:

```ts
import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { loadOpenStatesYamlDir, type OpenStatesPerson } from './openstates-yaml-loader.ts'
import { normalizeStateLegDistrictCode } from './state-leg-config.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Defaults match real-world coverage (~5,400 state house seats + ~1,972 senate
// seats nationwide). Configurable for tests.
const DEFAULT_MIN_STATE_HOUSE_COUNT  = 4500
const DEFAULT_MIN_STATE_SENATE_COUNT = 1800

const DEACTIVATION_THRESHOLD_FRACTION = 0.01
const DEACTIVATION_THRESHOLD_MIN      = 50

export interface IngestStateOfficialsOpts {
  fixturesDir?: string
  minStateHouseCount?: number
  minStateSenateCount?: number
  allowDeactivations?: number
}

export interface IngestStateOfficialsStats {
  officialsUpserted: number
  officesUpserted: number
  unmatchedDistricts: string[]      // 'STATE:rawDistrict'
  errors: string[]
  deactivated: number
}

export async function ingestStateOfficials(
  opts: IngestStateOfficialsOpts = {},
): Promise<IngestStateOfficialsStats> {
  const fixturesDir = opts.fixturesDir
    ?? process.env.OPENSTATES_DATA_DIR
    ?? join(__dirname, 'fixtures', 'openstates-people')
  const minHouse  = opts.minStateHouseCount  ?? DEFAULT_MIN_STATE_HOUSE_COUNT
  const minSenate = opts.minStateSenateCount ?? DEFAULT_MIN_STATE_SENATE_COUNT

  const people = await loadOpenStatesYamlDir(fixturesDir)

  // Pre-flight counts (by chamber type)
  const houseCount  = people.filter(p => p.role.type === 'lower').length
  const senateCount = people.filter(p => p.role.type === 'upper' || p.role.type === 'legislature').length
  if (houseCount < minHouse || senateCount < minSenate) {
    throw new Error(
      `pre-flight count below threshold: lower=${houseCount} (min ${minHouse}), ` +
      `upper+legislature=${senateCount} (min ${minSenate}). ` +
      `Likely cause: openstates/people YAML repo not fully cloned, or fixturesDir is wrong. ` +
      `Aborting with zero DB writes.`,
    )
  }

  const stats: IngestStateOfficialsStats = {
    officialsUpserted: 0,
    officesUpserted: 0,
    unmatchedDistricts: [],
    errors: [],
    deactivated: 0,
  }

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    for (const person of people) {
      const code = normalizeStateLegDistrictCode(
        person.role.state, person.role.type, person.role.district,
      )
      if (!code) {
        stats.unmatchedDistricts.push(`${person.role.state}:${person.role.district}`)
        continue
      }

      // Lookup district by (tier, code). The tier corresponds to chamber type.
      const tier =
        person.role.type === 'lower'        ? 'state_house' :
        person.role.type === 'upper'        ? 'state_senate' :
        /* legislature (NE) */                'state_legislature'

      // Special case: NE unicameral district codes live under state_legislature
      // tier explicitly. (Earlier slices placed NE state senate under
      // state_senate tier per tiger-config.ts.) Some TIGER datasets actually
      // index NE under state_senate. Try both — match either.
      const districtRow = await client.query<{ id: string }>(
        `select id from public.districts
         where code = $1 and tier in ($2, $3)
         limit 1`,
        [code, tier, person.role.type === 'legislature' ? 'state_senate' : tier],
      )
      if (districtRow.rowCount === 0) {
        stats.unmatchedDistricts.push(`${person.role.state}:${person.role.district}`)
        continue
      }
      const districtId = districtRow.rows[0]!.id

      // Map OpenStates role type → official_chamber enum.
      const chamber =
        person.role.type === 'lower'        ? 'state_house' :
        person.role.type === 'upper'        ? 'state_senate' :
                                              'state_legislature'

      // For state senators senate_class is NULL (not applicable like federal).
      const upsert = await client.query<{ id: string }>(`
        insert into public.officials (
          openstates_person_id,
          first_name, last_name, full_name,
          chamber, party, state,
          district_id, district_code, title, senate_class,
          in_office, source_version
        )
        values (
          $1, $2, $3, $4, $5::public.official_chamber, $6, $7,
          $8::uuid, $9, $10, null, true, 'openstates'
        )
        on conflict (openstates_person_id) where openstates_person_id is not null
        do update set
          first_name    = excluded.first_name,
          last_name     = excluded.last_name,
          full_name     = excluded.full_name,
          chamber       = excluded.chamber,
          party         = excluded.party,
          state         = excluded.state,
          district_id   = excluded.district_id,
          district_code = excluded.district_code,
          title         = excluded.title,
          in_office     = true,
          source_version = excluded.source_version
        returning id
      `, [
        person.id,
        person.given_name ?? '',
        person.family_name ?? '',
        person.name,
        chamber,
        person.party,
        person.role.state,
        districtId,
        person.role.district,
        person.role.title,
      ])
      const officialId = upsert.rows[0]!.id
      stats.officialsUpserted += 1

      // Upsert offices into public.district_offices.
      // Use (official_id, address) as the natural dedupe key. Replace strategy:
      // delete existing offices for this official, then re-insert. Simpler than
      // a per-row upsert when offices change shape between runs.
      await client.query(
        'delete from public.district_offices where official_id = $1',
        [officialId],
      )
      for (const office of person.offices) {
        if (!office.address) continue
        await client.query(
          `insert into public.district_offices
             (official_id, address, city, state, phone, source_url)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            officialId,
            office.address,
            office.address.split(',').slice(-2, -1)[0]?.trim() ?? '',  // crude city extraction
            person.role.state,
            office.voice ?? null,
            'https://openstates.org/',
          ],
        )
        stats.officesUpserted += 1
      }
    }

    // Deactivation sweep: any state official we have in DB but NOT in this
    // run's YAML → soft-delete (in_office=false), bounded by allow-deactivations.
    // The MVP fixture run won't exercise this fully; production runs will.
    const active = await client.query<{ count: number }>(`
      select count(*)::int as count from public.officials
      where openstates_person_id is not null and in_office = true
    `)
    const incomingIds = new Set(people.map(p => p.id))
    const allDb = await client.query<{ id: string; openstates_person_id: string }>(`
      select id, openstates_person_id from public.officials
      where openstates_person_id is not null and in_office = true
    `)
    const toDeactivate = allDb.rows.filter(r => !incomingIds.has(r.openstates_person_id))
    const threshold = Math.max(
      DEACTIVATION_THRESHOLD_MIN,
      Math.floor(active.rows[0]!.count * DEACTIVATION_THRESHOLD_FRACTION),
    )
    if (toDeactivate.length > threshold && opts.allowDeactivations !== toDeactivate.length) {
      throw new Error(
        `Refusing to deactivate ${toDeactivate.length} state officials (threshold=${threshold}). ` +
        `Re-run with --allow-deactivations=${toDeactivate.length} to acknowledge.`,
      )
    }
    if (toDeactivate.length > 0) {
      const ids = toDeactivate.map(r => r.id)
      await client.query(
        'update public.officials set in_office = false where id = any($1::uuid[])',
        [ids],
      )
      stats.deactivated = toDeactivate.length
    }
  } finally {
    await client.end()
  }

  return stats
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const allowDeactArg = process.argv.find(a => a.startsWith('--allow-deactivations='))
  const allowDeactivations = allowDeactArg
    ? Number(allowDeactArg.split('=')[1])
    : undefined
  ingestStateOfficials({ allowDeactivations })
    .then(stats => {
      console.log('Ingest summary (state officials):')
      console.log(`  officials upserted: ${stats.officialsUpserted}`)
      console.log(`  offices upserted:   ${stats.officesUpserted}`)
      console.log(`  unmatched:          ${stats.unmatchedDistricts.length}`)
      console.log(`  errors:             ${stats.errors.length}`)
      console.log(`  deactivated:        ${stats.deactivated}`)
      if (stats.unmatchedDistricts.length > 0) {
        console.log('  unmatched districts (first 20):')
        for (const u of stats.unmatchedDistricts.slice(0, 20)) console.log(`    - ${u}`)
      }
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => {
      console.error(err.message)
      process.exit(1)
    })
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @chiaro/db test state-officials-ingest
```

Expected: 8/8 pass. If the pre-flight test fails because the fixture passes, check that the test uses high thresholds (1000 each) — the fixture has 1 house + 2 upper/legislature + 3 lower = 4 lower + 2 upper+legis. The pre-flight should reject at min=1000.

If the MD multi-member test fails (expected `district_count === 1` but got 3): the `state-leg-config.ts` MD logic in Task 5 maps `1A`/`1B`/`1C` all to `MD-01`. Verify Task 5 fixture passed and that we lookup district by code (not by raw OpenStates string).

- [ ] **Step 5: Add seed script to package.json**

Find `packages/db/package.json` and add to the `scripts` block:

```json
{
  "scripts": {
    "...": "...",
    "seed:state-officials": "tsx supabase/seed/state-officials-ingest.ts"
  }
}
```

Place it alphabetically with the other `seed:*` scripts.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @chiaro/db typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/db/supabase/seed/state-officials-ingest.ts \
        packages/db/supabase/seed/state-officials-ingest.test.ts \
        packages/db/package.json
git commit -m "feat(db): state-officials-ingest orchestrator + pnpm seed:state-officials

Pulls OpenStates YAML → normalizes via openstates-yaml-loader →
maps districts via state-leg-config → upserts into public.officials
(by openstates_person_id) + public.district_offices.

Defensive guards mirror officials-ingest.ts (slice 3):
- Pre-flight count: lower >= MIN_STATE_HOUSE_COUNT (4500),
  upper+legislature >= MIN_STATE_SENATE_COUNT (1800). Override via opts.
- Deactivation threshold: max(50, 1% of active). Refuses to deactivate
  more without --allow-deactivations=N exact-match flag.

Unmatched districts (NH multi-word, DC, territories) logged to
stats.unmatchedDistricts and counted in the CLI summary — do not abort.

MD multi-member (1A/1B/1C) all map to MD-01 (verified via vitest case).
NE unicameral chamber=state_legislature, party=Nonpartisan supported.

8 vitest cases all green."
```

---

## Task 8 — Web: derivation + DistrictBadge update

**Files:**
- Create: `apps/web/lib/derivations/officials-by-level.ts`
- Create: `apps/web/test/derivations/officials-by-level.test.ts`
- Modify: `apps/web/components/cards/DistrictBadge.tsx`
- Modify: `apps/web/test/components/cards/DistrictBadge.test.tsx`

Adds the home-page partition helper + extends the existing DistrictBadge to handle the 3 new chamber values.

- [ ] **Step 1: Write failing derivation test**

Create `apps/web/test/derivations/officials-by-level.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupOfficialsByLevel } from '@/lib/derivations/officials-by-level'
import type { OfficialWithDistrict } from '@chiaro/officials'

function mkOfficial(chamber: OfficialWithDistrict['chamber'], name: string): OfficialWithDistrict {
  return {
    id: name, bioguide_id: name, full_name: name, first_name: name, last_name: '',
    chamber, party: 'D', state: 'CA', district_id: 'd', in_office: true,
    senate_class: null, source_version: 'x', opensecrets_id: null, fec_candidate_id: null,
    openstates_person_id: null, district_code: null, title: null,
    district: { id: 'd', tier: 'federal_house', state: 'CA', code: 'CA-12', name: 'CA-12' },
  } as unknown as OfficialWithDistrict
}

describe('groupOfficialsByLevel', () => {
  it('empty input returns empty groups', () => {
    expect(groupOfficialsByLevel([])).toEqual({ federal: [], state: [] })
  })

  it('partitions by chamber level', () => {
    const officials = [
      mkOfficial('federal_house', 'Pelosi'),
      mkOfficial('federal_senate', 'Padilla'),
      mkOfficial('state_house', 'Asm'),
      mkOfficial('state_senate', 'Sen'),
    ]
    const grouped = groupOfficialsByLevel(officials)
    expect(grouped.federal.map(o => o.full_name)).toEqual(['Pelosi', 'Padilla'])
    expect(grouped.state.map(o => o.full_name)).toEqual(['Asm', 'Sen'])
  })

  it('state_legislature (NE) classified as state', () => {
    const ne = mkOfficial('state_legislature', 'NE-Sen')
    expect(groupOfficialsByLevel([ne]).state).toHaveLength(1)
  })

  it('orders federal: house-then-senate; state: house-then-senate-then-legislature', () => {
    const officials = [
      mkOfficial('state_senate', 'S-Sen'),
      mkOfficial('federal_senate', 'F-Sen'),
      mkOfficial('state_legislature', 'NE'),
      mkOfficial('federal_house', 'F-Rep'),
      mkOfficial('state_house', 'S-Rep'),
    ]
    const grouped = groupOfficialsByLevel(officials)
    expect(grouped.federal.map(o => o.full_name)).toEqual(['F-Rep', 'F-Sen'])
    expect(grouped.state.map(o => o.full_name)).toEqual(['S-Rep', 'S-Sen', 'NE'])
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test officials-by-level
```

Expected: import error.

- [ ] **Step 3: Implement derivation**

Create `apps/web/lib/derivations/officials-by-level.ts`:

```ts
import type { OfficialWithDistrict } from '@chiaro/officials'
import { isFederalLevel, isStateLevel, isHouseChamber } from '@chiaro/officials'

const STATE_ORDER: Record<string, number> = {
  state_house:       0,
  state_senate:      1,
  state_legislature: 2,
}

const FEDERAL_ORDER: Record<string, number> = {
  federal_house:  0,
  federal_senate: 1,
}

function compareByChamber(orderMap: Record<string, number>) {
  return (a: OfficialWithDistrict, b: OfficialWithDistrict) =>
    (orderMap[a.chamber] ?? 99) - (orderMap[b.chamber] ?? 99)
}

export interface OfficialsByLevel {
  federal: OfficialWithDistrict[]
  state:   OfficialWithDistrict[]
}

export function groupOfficialsByLevel(officials: OfficialWithDistrict[]): OfficialsByLevel {
  const federal: OfficialWithDistrict[] = []
  const state:   OfficialWithDistrict[] = []
  for (const o of officials) {
    if (isFederalLevel(o.chamber)) federal.push(o)
    else if (isStateLevel(o.chamber)) state.push(o)
  }
  federal.sort(compareByChamber(FEDERAL_ORDER))
  state.sort(compareByChamber(STATE_ORDER))
  return { federal, state }
}
```

Helper `isHouseChamber` may not actually be used — drop the unused import if your linter complains. The sort uses `chamber` ordering directly via `STATE_ORDER` / `FEDERAL_ORDER` lookups.

- [ ] **Step 4: Run passing tests**

```bash
pnpm --filter @chiaro/web test officials-by-level
```

Expected: 4/4 pass.

- [ ] **Step 5: Read existing DistrictBadge**

```bash
cat apps/web/components/cards/DistrictBadge.tsx
```

Note the current props + how it derives labels. Likely props: `chamber: 'house' | 'senate'`, `stateName`, `districtNumber`, `atLarge?`. The label is something like `"CA District 12"` or `"California's At-Large District"`.

- [ ] **Step 6: Extend DistrictBadge for state chambers**

Update `apps/web/components/cards/DistrictBadge.tsx`. The prop `chamber` type was `'house' | 'senate'`. Change to the 5-value union from `@chiaro/officials`. Branch the label logic by chamber level:

```tsx
import { isStateLevel, type OfficialChamber } from '@chiaro/officials'

interface DistrictBadgeProps {
  chamber: OfficialChamber
  stateName: string         // 'California'
  stateAbbrev: string       // 'CA'
  districtCode: string      // raw — '12', '15A', 'AL', '23'
  atLarge?: boolean
}

export function DistrictBadge({ chamber, stateName, stateAbbrev, districtCode, atLarge }: DistrictBadgeProps) {
  let label: string
  if (atLarge) {
    label = `${stateName}'s At-Large District`
  } else if (chamber === 'federal_house') {
    label = `${stateName} District ${districtCode}`
  } else if (chamber === 'federal_senate') {
    label = `${stateName} Senate`
  } else if (chamber === 'state_house') {
    label = `${stateAbbrev}-${districtCode}`     // Compact for state — matches list density
  } else if (chamber === 'state_senate') {
    label = `${stateAbbrev}-SD ${districtCode}`
  } else if (chamber === 'state_legislature') {
    label = `${stateAbbrev}-LD ${districtCode}` // Nebraska unicameral
  } else {
    label = `${stateAbbrev}-${districtCode}`
  }
  return <Badge>{label}</Badge>  // Existing styled component
}
```

Adapt the JSX to match the file's existing markup style. The `Badge` import is whatever the file currently uses (probably an inline styled element).

- [ ] **Step 7: Update DistrictBadge tests**

Open `apps/web/test/components/cards/DistrictBadge.test.tsx`. Existing tests cover federal cases. Add 3 cases:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

describe('DistrictBadge — state chambers', () => {
  it('state_house renders state-NN compact', () => {
    const { getByText } = render(
      <DistrictBadge chamber="state_house" stateName="California" stateAbbrev="CA" districtCode="15" />,
    )
    expect(getByText('CA-15')).toBeTruthy()
  })

  it('state_senate renders state-SD N label', () => {
    const { getByText } = render(
      <DistrictBadge chamber="state_senate" stateName="California" stateAbbrev="CA" districtCode="8" />,
    )
    expect(getByText('CA-SD 8')).toBeTruthy()
  })

  it('state_legislature (NE) renders state-LD N label', () => {
    const { getByText } = render(
      <DistrictBadge chamber="state_legislature" stateName="Nebraska" stateAbbrev="NE" districtCode="23" />,
    )
    expect(getByText('NE-LD 23')).toBeTruthy()
  })
})
```

Existing federal cases may need a tweak: if they passed `chamber: 'house'` or `chamber: 'senate'`, update to `federal_house` / `federal_senate`. (Task 3 should have caught this; verify.)

- [ ] **Step 8: Run tests + typecheck**

```bash
pnpm --filter @chiaro/web test DistrictBadge
pnpm --filter @chiaro/web typecheck
```

Expected: all DistrictBadge tests pass; typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/derivations/officials-by-level.ts \
        apps/web/test/derivations/officials-by-level.test.ts \
        apps/web/components/cards/DistrictBadge.tsx \
        apps/web/test/components/cards/DistrictBadge.test.tsx
git commit -m "feat(web): groupOfficialsByLevel + DistrictBadge state chamber support

- New derivation apps/web/lib/derivations/officials-by-level.ts:
  groupOfficialsByLevel(officials) → { federal, state }, each sorted
  house-then-senate (state group also includes NE state_legislature).
- DistrictBadge extended: chamber prop now accepts the 5-value
  OfficialChamber. Per-chamber label:
  - federal_house: '<State> District <N>'
  - federal_senate: '<State> Senate'
  - state_house: '<ST>-<N>' (compact for list density)
  - state_senate: '<ST>-SD <N>'
  - state_legislature: '<ST>-LD <N>' (Nebraska unicameral)
  - at-large: '<State>'s At-Large District' (unchanged)
- 7 new vitest cases (4 derivation + 3 DistrictBadge state)."
```

---

## Task 9 — Web: ComingSoonCard + StateOfficialsCardSection + home integration

**Files:**
- Create: `apps/web/components/cards/ComingSoonCard.tsx`
- Create: `apps/web/test/components/cards/ComingSoonCard.test.tsx`
- Create: `apps/web/components/state/StateOfficialsCardSection.tsx`
- Create: `apps/web/test/components/state/StateOfficialsCardSection.test.tsx`
- Modify: `apps/web/components/OfficialsCard.tsx` (existing home card)

The state section component + the placeholder card primitive used by the detail page (Task 10) and possibly other places.

- [ ] **Step 1: Write ComingSoonCard test**

Create `apps/web/test/components/cards/ComingSoonCard.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComingSoonCard } from '@/components/cards/ComingSoonCard'

describe('ComingSoonCard', () => {
  it('renders category title in header', () => {
    const { getByText } = render(<ComingSoonCard category="Finance" />)
    expect(getByText('Finance')).toBeTruthy()
  })

  it('renders per-category coming-soon copy in body', () => {
    const { getByText } = render(<ComingSoonCard category="Service Record" />)
    expect(getByText(/Bills \+ votes — coming soon/i)).toBeTruthy()
  })

  it('accepts all 5 category values', () => {
    const categories = [
      'Service Record', 'Issue Positions', 'Community Presence',
      'Finance', 'Ethics & Accountability',
    ] as const
    for (const c of categories) {
      const { getByText } = render(<ComingSoonCard category={c} />)
      expect(getByText(c)).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
pnpm --filter @chiaro/web test ComingSoonCard
```

Expected: module not found.

- [ ] **Step 3: Implement ComingSoonCard**

Create `apps/web/components/cards/ComingSoonCard.tsx`:

```tsx
import { COLORS } from '@chiaro/ui-tokens'

export type ComingSoonCategory =
  | 'Service Record'
  | 'Issue Positions'
  | 'Community Presence'
  | 'Finance'
  | 'Ethics & Accountability'

const CATEGORY_COPY: Record<ComingSoonCategory, string> = {
  'Service Record':         'Bills + votes — coming soon',
  'Issue Positions':        'Scorecards — coming soon',
  'Community Presence':     'Town halls — coming soon',  // (offices live in bio section)
  'Finance':                'Campaign finance — coming soon',
  'Ethics & Accountability':'STOCK Act compliance — coming soon',
}

export function ComingSoonCard({ category }: { category: ComingSoonCategory }) {
  return (
    <div
      style={{
        background: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${COLORS.neutral.border}`,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.neutral.text }}>
        {category}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: COLORS.neutral.textMuted }}>
        {CATEGORY_COPY[category]}
      </div>
    </div>
  )
}
```

Adapt the styled-element format to match the existing `MetricCardShell` component's style. If `MetricCardShell` uses `tailwind` or `styled-components`, use the same. The shell dimensions (padding, border, radius) MUST match so the page rhythm holds when ComingSoon cards sit beside federal-style cards.

If existing card files import from `@chiaro/ui-tokens` for `COLORS.neutral.surface` etc., verify those tokens exist. If not, fall back to the closest `COLORS.neutral.*` or `COLORS.brand.*` available.

- [ ] **Step 4: Run passing test**

```bash
pnpm --filter @chiaro/web test ComingSoonCard
```

Expected: 3/3 pass.

- [ ] **Step 5: Write StateOfficialsCardSection test**

Create `apps/web/test/components/state/StateOfficialsCardSection.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StateOfficialsCardSection } from '@/components/state/StateOfficialsCardSection'
import type { OfficialWithDistrict } from '@chiaro/officials'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function mkState(
  chamber: OfficialWithDistrict['chamber'],
  fullName: string,
  id = 'oid-' + fullName,
): OfficialWithDistrict {
  return {
    id, full_name: fullName, first_name: '', last_name: '',
    bioguide_id: null, openstates_person_id: 'ocd-person/' + id,
    chamber, party: 'D', state: 'CA',
    district_id: 'did', district_code: '15', title: 'Assemblymember',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
  } as unknown as OfficialWithDistrict
}

describe('StateOfficialsCardSection', () => {
  it('renders State heading + cards for each state official', () => {
    const officials = [
      mkState('state_house', 'Asm Test'),
      mkState('state_senate', 'Sen Test'),
    ]
    const { getByText } = render(<StateOfficialsCardSection officials={officials} />)
    expect(getByText('State')).toBeTruthy()
    expect(getByText('Asm Test')).toBeTruthy()
    expect(getByText('Sen Test')).toBeTruthy()
  })

  it('renders nothing when officials empty (DC user)', () => {
    const { container } = render(<StateOfficialsCardSection officials={[]} />)
    expect(container.querySelector('[data-testid="state-section"]')).toBeNull()
  })

  it('NE legislator labeled as State Senator (chamber=state_legislature)', () => {
    const ne = mkState('state_legislature', 'NE Test')
    ne.state = 'NE'
    ne.title = 'Senator'
    const { getByText } = render(<StateOfficialsCardSection officials={[ne]} />)
    expect(getByText('State Senator')).toBeTruthy()
  })

  it('tap routes to /state-officials/[id]', () => {
    mockPush.mockReset()
    const { getByText } = render(
      <StateOfficialsCardSection officials={[mkState('state_house', 'Asm Test', 'state-id-1')]} />,
    )
    fireEvent.click(getByText('Asm Test'))
    expect(mockPush).toHaveBeenCalledWith('/state-officials/state-id-1')
  })
})
```

- [ ] **Step 6: Run failing**

```bash
pnpm --filter @chiaro/web test StateOfficialsCardSection
```

Expected: module not found.

- [ ] **Step 7: Implement StateOfficialsCardSection**

Create `apps/web/components/state/StateOfficialsCardSection.tsx`:

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { COLORS } from '@chiaro/ui-tokens'
import { isSenateChamber, type OfficialWithDistrict } from '@chiaro/officials'

function chamberLabelFor(o: OfficialWithDistrict): string {
  if (o.chamber === 'state_house') return 'State Representative'
  if (o.chamber === 'state_senate' || o.chamber === 'state_legislature') return 'State Senator'
  // Fallback — shouldn't hit this for state officials.
  return o.title ?? 'State Legislator'
}

export function StateOfficialsCardSection({
  officials,
}: {
  officials: OfficialWithDistrict[]
}) {
  const router = useRouter()
  if (officials.length === 0) return null

  return (
    <section data-testid="state-section" style={{ marginTop: 24 }}>
      <h3 style={{
        fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
        color: COLORS.neutral.textMuted, marginBottom: 12,
      }}>
        State
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {officials.map(o => (
          <button
            key={o.id}
            onClick={() => router.push(`/state-officials/${o.id}`)}
            style={{
              textAlign: 'left',
              padding: 12,
              border: `1px solid ${COLORS.neutral.border}`,
              borderRadius: 12,
              background: COLORS.neutral.surface,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {chamberLabelFor(o)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.neutral.text, marginTop: 2 }}>
              {o.full_name}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
```

Adapt to match the existing card styling in the codebase (replace inline styles with whatever pattern OfficialsCard uses today — tailwind, styled-components, CSS modules).

- [ ] **Step 8: Run passing tests**

```bash
pnpm --filter @chiaro/web test StateOfficialsCardSection
```

Expected: 4/4 pass.

- [ ] **Step 9: Integrate into home OfficialsCard**

Open `apps/web/components/OfficialsCard.tsx`. Currently renders a flat list of officials. Update to use `groupOfficialsByLevel` + render Federal section (existing logic, extracted) + new StateOfficialsCardSection:

Find the existing render block (probably maps over `officials` directly). Replace with:

```tsx
import { groupOfficialsByLevel } from '@/lib/derivations/officials-by-level'
import { StateOfficialsCardSection } from '@/components/state/StateOfficialsCardSection'

// ... inside the component:
const { federal, state } = groupOfficialsByLevel(officials)

return (
  <div>
    {federal.length > 0 && (
      <section data-testid="federal-section">
        <h3>Federal</h3>
        {/* existing federal cards render — keep current AlignmentChip rows etc. */}
        {federal.map(renderFederalCard)}
      </section>
    )}
    <StateOfficialsCardSection officials={state} />
  </div>
)
```

The exact JSX depends on the current OfficialsCard layout. Two changes are non-negotiable:
1. Add `<h3>Federal</h3>` (or matching styled heading) above the existing federal cards.
2. Mount `<StateOfficialsCardSection officials={state} />` AFTER the federal section.

Both sections handle their own empty state internally (StateOfficialsCardSection returns null; Federal section can use `federal.length > 0 && ...` guard).

- [ ] **Step 10: Run all home-card tests + typecheck**

```bash
pnpm --filter @chiaro/web test OfficialsCard
pnpm --filter @chiaro/web typecheck
```

Expected: all green. If existing OfficialsCard tests fail because they assert a flat list with no "Federal" heading, update those tests to expect the new heading.

- [ ] **Step 11: Commit**

```bash
git add apps/web/components/cards/ComingSoonCard.tsx \
        apps/web/test/components/cards/ComingSoonCard.test.tsx \
        apps/web/components/state/StateOfficialsCardSection.tsx \
        apps/web/test/components/state/StateOfficialsCardSection.test.tsx \
        apps/web/components/OfficialsCard.tsx
git commit -m "feat(web): ComingSoonCard + StateOfficialsCardSection + home integration

- ComingSoonCard (apps/web/components/cards/) — slot-shaped placeholder
  with per-category copy. 5 categories: Service Record, Issue Positions,
  Community Presence, Finance, Ethics & Accountability.
- StateOfficialsCardSection — renders 'State' heading + chip cards;
  hides entirely when officials empty (DC user). Chamber label:
  state_house → State Representative; state_senate +
  state_legislature → State Senator. Card tap → /state-officials/[id].
- OfficialsCard home component: split into Federal + State sections via
  groupOfficialsByLevel derivation. Each section guards its own empty
  state.

7 new vitest cases (3 ComingSoonCard + 4 StateOfficialsCardSection)."
```

---

## Task 10 — Web: state route + StateOfficialDetailPage + cross-route guards

**Files:**
- Create: `apps/web/app/state-officials/[id]/page.tsx`
- Create: `apps/web/components/state/StateOfficialDetailPage.tsx`
- Create: `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`
- Create: `apps/web/test/app/officials-route-guards.test.tsx`
- Modify: `apps/web/app/officials/[id]/page.tsx` (add chamber guard at top)

The detail route + guards for both routes.

- [ ] **Step 1: Write StateOfficialDetailPage test**

Create `apps/web/test/components/state/StateOfficialDetailPage.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'
import type { OfficialWithDistrict } from '@chiaro/officials'

function mkState(overrides: Partial<OfficialWithDistrict> = {}): OfficialWithDistrict {
  return {
    id: 'oid', full_name: 'Test Asm', first_name: 'Test', last_name: 'Asm',
    bioguide_id: null, openstates_person_id: 'ocd-person/x',
    chamber: 'state_house', party: 'Democratic', state: 'CA',
    district_id: 'did', district_code: '15', title: 'Assemblymember',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
    ...overrides,
  } as unknown as OfficialWithDistrict
}

describe('StateOfficialDetailPage', () => {
  it('renders bio header with name + party + district', () => {
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />)
    expect(getByText('Test Asm')).toBeTruthy()
    expect(getByText(/Democratic/)).toBeTruthy()
    expect(getByText(/CA-15/)).toBeTruthy()
  })

  it('renders 5 ComingSoonCard placeholders', () => {
    const { getAllByText } = render(<StateOfficialDetailPage official={mkState()} offices={[]} />)
    // Each ComingSoon header text is a category name.
    expect(getAllByText(/Service Record|Issue Positions|Community Presence|Finance|Ethics & Accountability/i))
      .toHaveLength(5)
  })

  it('renders offices section above the placeholder cascade', () => {
    const offices = [{
      id: 'o1', official_id: 'oid', address: '1 Capitol, Sacramento CA',
      city: 'Sacramento', state: 'CA', zip: null, phone: '555-0100',
      source_url: 'https://openstates.org/',
    }]
    const { getByText } = render(<StateOfficialDetailPage official={mkState()} offices={offices as never} />)
    expect(getByText(/1 Capitol/)).toBeTruthy()
    expect(getByText('555-0100')).toBeTruthy()
  })

  it('NE state_legislature renders chamber as State Senator', () => {
    const ne = mkState({ chamber: 'state_legislature', state: 'NE', title: 'Senator',
      district: { id: 'did', tier: 'state_legislature', state: 'NE', code: 'NE-23', name: 'NE District 23' } })
    const { getByText } = render(<StateOfficialDetailPage official={ne} offices={[]} />)
    expect(getByText(/State Senator/)).toBeTruthy()
  })

  it('multi-member district shows district_code with title', () => {
    const md = mkState({ state: 'MD', district_code: '1A', title: 'Delegate',
      district: { id: 'did', tier: 'state_house', state: 'MD', code: 'MD-01', name: 'MD HD 01' } })
    const { getByText } = render(<StateOfficialDetailPage official={md} offices={[]} />)
    expect(getByText(/Delegate/)).toBeTruthy()
    expect(getByText(/MD-01/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm --filter @chiaro/web test StateOfficialDetailPage
```

Expected: module not found.

- [ ] **Step 3: Implement StateOfficialDetailPage**

Create `apps/web/components/state/StateOfficialDetailPage.tsx`:

```tsx
import { COLORS } from '@chiaro/ui-tokens'
import { ComingSoonCard, type ComingSoonCategory } from '@/components/cards/ComingSoonCard'
import { DistrictBadge } from '@/components/cards/DistrictBadge'
import type { OfficialWithDistrict } from '@chiaro/officials'
import type { Database } from '@chiaro/db'

type DistrictOffice = Database['public']['Tables']['district_offices']['Row']

const CATEGORIES: ComingSoonCategory[] = [
  'Service Record',
  'Issue Positions',
  'Community Presence',
  'Finance',
  'Ethics & Accountability',
]

function chamberLabel(chamber: OfficialWithDistrict['chamber']): string {
  if (chamber === 'state_house') return 'State Representative'
  return 'State Senator'  // covers state_senate + state_legislature
}

function stateNameFromAbbrev(abbrev: string): string {
  // Lightweight; full list of 50 lives in @chiaro/ui-tokens or @chiaro/location.
  // For MVP, fallback to abbrev if no helper available.
  return abbrev
}

export function StateOfficialDetailPage({
  official,
  offices,
}: {
  official: OfficialWithDistrict
  offices: DistrictOffice[]
}) {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {/* Bio header */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: COLORS.neutral.text }}>
          {official.full_name}
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>
            {chamberLabel(official.chamber)}
          </span>
          <span style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>·</span>
          <span style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>
            {official.party}
          </span>
          <span style={{ fontSize: 14, color: COLORS.neutral.textMuted }}>·</span>
          <DistrictBadge
            chamber={official.chamber}
            stateName={stateNameFromAbbrev(official.state)}
            stateAbbrev={official.state}
            districtCode={official.district_code ?? official.district?.code ?? ''}
          />
        </div>
      </header>

      {/* Offices contact section — real data, between bio and placeholder cascade */}
      {offices.length > 0 && (
        <section style={{ marginBottom: 24 }} data-testid="offices-section">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Offices</h2>
          {offices.map(office => (
            <div key={office.id} style={{ padding: 12, border: `1px solid ${COLORS.neutral.border}`, borderRadius: 8, marginBottom: 8 }}>
              <div>{office.address}</div>
              {office.phone && <div style={{ marginTop: 4, color: COLORS.neutral.textMuted }}>{office.phone}</div>}
            </div>
          ))}
        </section>
      )}

      {/* Category cascade — all ComingSoonCard placeholders */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run passing test**

```bash
pnpm --filter @chiaro/web test StateOfficialDetailPage
```

Expected: 5/5 pass.

- [ ] **Step 5: Create the state route**

Create `apps/web/app/state-officials/[id]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { fetchOfficial, fetchOfficialDistrictOffices, isStateLevel } from '@chiaro/officials'
import { getServerClient } from '@/lib/supabase-server'
import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'

export default async function StateOfficialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getServerClient()
  const official = await fetchOfficial(client, id)
  if (!isStateLevel(official.chamber)) {
    redirect(`/officials/${id}`)
  }
  const offices = await fetchOfficialDistrictOffices(client, id)
  return <StateOfficialDetailPage official={official} offices={offices} />
}
```

Adapt `getServerClient()` import to whatever the federal page uses (could be `createServerClient` from `@/lib/supabase/server` or similar). Mirror the federal page's pattern exactly.

- [ ] **Step 6: Add cross-route guard to federal page**

Open `apps/web/app/officials/[id]/page.tsx`. At the very top of the page component body (after the params await, after fetchOfficial), add:

```tsx
import { isStateLevel } from '@chiaro/officials'

// ... in the page component:
const official = await fetchOfficial(client, id)
if (isStateLevel(official.chamber)) {
  redirect(`/state-officials/${id}`)
}
// ... rest of existing federal logic
```

Don't restructure the rest of the page — minimal change.

- [ ] **Step 7: Write route-guard test**

Create `apps/web/test/app/officials-route-guards.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'

// We test the predicate behavior via isStateLevel + a smoke test that
// confirms the redirect call shape. Full route integration is exercised
// in the manual smoke step + by CI's build.

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`__REDIRECT__:${url}`) }),
}))

describe('chamber-based route guards', () => {
  it('isStateLevel correctly classifies all 5 chambers', async () => {
    const { isStateLevel } = await import('@chiaro/officials')
    expect(isStateLevel('federal_house')).toBe(false)
    expect(isStateLevel('federal_senate')).toBe(false)
    expect(isStateLevel('state_house')).toBe(true)
    expect(isStateLevel('state_senate')).toBe(true)
    expect(isStateLevel('state_legislature')).toBe(true)
  })

  // Full redirect-flow tests against real Next routes belong in an e2e
  // suite (Playwright). For the MVP we keep coverage at the predicate
  // level + manual smoke verification.
})
```

- [ ] **Step 8: Run tests + typecheck + build**

```bash
pnpm --filter @chiaro/web test officials-route-guards
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/web build
```

Expected: all green. The build proves the new route renders without runtime errors during static analysis.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/state-officials/ \
        apps/web/components/state/StateOfficialDetailPage.tsx \
        apps/web/test/components/state/StateOfficialDetailPage.test.tsx \
        apps/web/test/app/officials-route-guards.test.tsx \
        apps/web/app/officials/[id]/page.tsx
git commit -m "feat(web): /state-officials route + StateOfficialDetailPage + cross-route guards

- New route apps/web/app/state-officials/[id]/page.tsx fetches the
  official, redirects to /officials/[id] if chamber is federal, else
  fetches district_offices and renders StateOfficialDetailPage.
- StateOfficialDetailPage layout:
  - bio header (name, chamber label, party, DistrictBadge)
  - offices section (real data from district_offices) — only if any
  - 5 ComingSoonCard placeholders for the federal-only categories
- Federal /officials/[id] gets a symmetric guard: state IDs redirect to
  /state-officials/[id].

Test coverage:
- StateOfficialDetailPage: 5 cases (bio render, placeholders count,
  offices render, NE chamber label, MD multi-member display)
- Route guards: predicate-level via isStateLevel (full redirect-flow
  tests deferred to future e2e suite)."
```

---

## Task 11 — Mobile: home parity (OfficialsCard split + DistrictBadge + ComingSoonCard)

**Files:**
- Modify: `apps/mobile/components/OfficialsCard.tsx`
- Modify: `apps/mobile/components/cards/DistrictBadge.tsx`
- Modify: `apps/mobile/test/components/cards/DistrictBadge.test.tsx`
- Create: `apps/mobile/components/cards/ComingSoonCard.tsx`
- Create: `apps/mobile/test/components/cards/ComingSoonCard.test.tsx`
- Create: `apps/mobile/components/state/StateOfficialsCardSection.tsx`
- Create: `apps/mobile/test/components/state/StateOfficialsCardSection.test.tsx`

Mirror Task 8 + Task 9's web work in React Native.

- [ ] **Step 1: Create mobile ComingSoonCard**

Create `apps/mobile/components/cards/ComingSoonCard.tsx`. Mirror the web file structure but use RN primitives:

```tsx
import { View, Text } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

export type ComingSoonCategory =
  | 'Service Record'
  | 'Issue Positions'
  | 'Community Presence'
  | 'Finance'
  | 'Ethics & Accountability'

const CATEGORY_COPY: Record<ComingSoonCategory, string> = {
  'Service Record':         'Bills + votes — coming soon',
  'Issue Positions':        'Scorecards — coming soon',
  'Community Presence':     'Town halls — coming soon',
  'Finance':                'Campaign finance — coming soon',
  'Ethics & Accountability':'STOCK Act compliance — coming soon',
}

export function ComingSoonCard({ category }: { category: ComingSoonCategory }) {
  return (
    <View style={{
      backgroundColor: COLORS.neutral.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.neutral.border,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.neutral.text }}>
        {category}
      </Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: COLORS.neutral.textMuted }}>
        {CATEGORY_COPY[category]}
      </Text>
    </View>
  )
}
```

- [ ] **Step 2: Mobile ComingSoonCard test**

Create `apps/mobile/test/components/cards/ComingSoonCard.test.tsx`. Use `@testing-library/react-native`:

```tsx
import { render } from '@testing-library/react-native'
import { describe, expect, it } from 'vitest'
import { ComingSoonCard } from '@/components/cards/ComingSoonCard'

describe('mobile ComingSoonCard', () => {
  it('renders category title', () => {
    const { getByText } = render(<ComingSoonCard category="Finance" />)
    expect(getByText('Finance')).toBeTruthy()
  })

  it('renders per-category copy', () => {
    const { getByText } = render(<ComingSoonCard category="Service Record" />)
    expect(getByText(/Bills \+ votes — coming soon/i)).toBeTruthy()
  })

  it('accepts all 5 categories', () => {
    const categories = [
      'Service Record', 'Issue Positions', 'Community Presence',
      'Finance', 'Ethics & Accountability',
    ] as const
    for (const c of categories) {
      const { getByText } = render(<ComingSoonCard category={c} />)
      expect(getByText(c)).toBeTruthy()
    }
  })
})
```

Adjust the import name if jest-expo uses a different test runner (`@jest/globals` vs vitest). Check `apps/mobile/jest.config.js` for the test framework. Existing tests reveal the pattern.

- [ ] **Step 3: Run mobile ComingSoonCard test**

```bash
pnpm --filter @chiaro/mobile test ComingSoonCard
```

Expected: 3/3 pass.

- [ ] **Step 4: Update mobile DistrictBadge**

Mirror Task 8 Step 6's change in `apps/mobile/components/cards/DistrictBadge.tsx`. Same chamber-aware label logic; use RN `<View>` / `<Text>` instead of `<div>` / `<span>`.

Update `apps/mobile/test/components/cards/DistrictBadge.test.tsx` to add the same 3 state-chamber cases as Task 8 Step 7.

```bash
pnpm --filter @chiaro/mobile test DistrictBadge
```

Expected: all green.

- [ ] **Step 5: Create mobile StateOfficialsCardSection**

Create `apps/mobile/components/state/StateOfficialsCardSection.tsx`. Mirror the web version with RN primitives:

```tsx
import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '@chiaro/ui-tokens'
import type { OfficialWithDistrict } from '@chiaro/officials'

function chamberLabelFor(o: OfficialWithDistrict): string {
  if (o.chamber === 'state_house') return 'State Representative'
  if (o.chamber === 'state_senate' || o.chamber === 'state_legislature') return 'State Senator'
  return o.title ?? 'State Legislator'
}

export function StateOfficialsCardSection({
  officials,
}: {
  officials: OfficialWithDistrict[]
}) {
  const router = useRouter()
  if (officials.length === 0) return null

  return (
    <View testID="state-section" style={{ marginTop: 24 }}>
      <Text style={{
        fontSize: 14, fontWeight: '700', textTransform: 'uppercase',
        color: COLORS.neutral.textMuted, marginBottom: 12,
      }}>
        State
      </Text>
      <View style={{ gap: 8 }}>
        {officials.map(o => (
          <Pressable
            key={o.id}
            onPress={() => router.push(`/state-officials/${o.id}`)}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: COLORS.neutral.border,
              borderRadius: 12,
              backgroundColor: COLORS.neutral.surface,
            }}
          >
            <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {chamberLabelFor(o)}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.neutral.text, marginTop: 2 }}>
              {o.full_name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
```

- [ ] **Step 6: Mobile StateOfficialsCardSection test**

Create `apps/mobile/test/components/state/StateOfficialsCardSection.test.tsx`. Mirror web tests + use RN test helpers. Mock `expo-router` (see how existing mobile component tests mock router — usually via `vi.mock('expo-router', ...)` or jest.mock):

```tsx
import { render, fireEvent } from '@testing-library/react-native'
import { describe, expect, it, vi } from 'vitest'

const mockPush = vi.fn()
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { StateOfficialsCardSection } from '@/components/state/StateOfficialsCardSection'
import type { OfficialWithDistrict } from '@chiaro/officials'

function mkState(chamber: OfficialWithDistrict['chamber'], fullName: string, id = 'oid-' + fullName) {
  return {
    id, full_name: fullName, chamber, party: 'D', state: 'CA',
    district_code: '15', title: 'Assemblymember',
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
  } as unknown as OfficialWithDistrict
}

describe('mobile StateOfficialsCardSection', () => {
  it('renders heading + cards', () => {
    const { getByText } = render(
      <StateOfficialsCardSection officials={[mkState('state_house', 'Asm Test')]} />,
    )
    expect(getByText('State')).toBeTruthy()
    expect(getByText('Asm Test')).toBeTruthy()
  })

  it('renders nothing when empty', () => {
    const { queryByTestId } = render(<StateOfficialsCardSection officials={[]} />)
    expect(queryByTestId('state-section')).toBeNull()
  })

  it('NE labeled State Senator', () => {
    const ne = mkState('state_legislature', 'NE Test')
    const { getByText } = render(<StateOfficialsCardSection officials={[ne]} />)
    expect(getByText('State Senator')).toBeTruthy()
  })

  it('tap routes to /state-officials/[id]', () => {
    mockPush.mockReset()
    const { getByText } = render(
      <StateOfficialsCardSection officials={[mkState('state_house', 'Asm Test', 'state-id-1')]} />,
    )
    fireEvent.press(getByText('Asm Test'))
    expect(mockPush).toHaveBeenCalledWith('/state-officials/state-id-1')
  })
})
```

```bash
pnpm --filter @chiaro/mobile test StateOfficialsCardSection
```

Expected: 4/4 pass.

- [ ] **Step 7: Integrate into mobile OfficialsCard**

Open `apps/mobile/components/OfficialsCard.tsx`. Same change pattern as Task 9 Step 9: import `groupOfficialsByLevel` (it lives in `apps/mobile/lib/derivations/` — if not present, mirror the web file there too) + render Federal section + StateOfficialsCardSection.

If `apps/mobile/lib/derivations/officials-by-level.ts` doesn't exist, create it as a near-copy of the web file with the same logic (TypeScript code is identical; only the test framework differs).

```bash
pnpm --filter @chiaro/mobile test OfficialsCard
pnpm --filter @chiaro/mobile typecheck
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/cards/ComingSoonCard.tsx \
        apps/mobile/test/components/cards/ComingSoonCard.test.tsx \
        apps/mobile/components/cards/DistrictBadge.tsx \
        apps/mobile/test/components/cards/DistrictBadge.test.tsx \
        apps/mobile/components/state/StateOfficialsCardSection.tsx \
        apps/mobile/test/components/state/StateOfficialsCardSection.test.tsx \
        apps/mobile/components/OfficialsCard.tsx \
        apps/mobile/lib/derivations/officials-by-level.ts
git commit -m "feat(mobile): home parity — Federal+State sections, DistrictBadge state, ComingSoonCard

Mirrors apps/web changes:
- ComingSoonCard (RN primitives, same per-category copy)
- DistrictBadge extended to 5-value chamber (state_house compact,
  state_senate 'ST-SD N', state_legislature 'ST-LD N')
- StateOfficialsCardSection — 'State' section heading + chip cards,
  hides on empty
- OfficialsCard home: groupOfficialsByLevel + Federal + State sections
- apps/mobile/lib/derivations/officials-by-level.ts (mirror of web)

10 new mobile vitest cases."
```

---

## Task 12 — Mobile: state route + StateOfficialDetailPage + guards

**Files:**
- Create: `apps/mobile/app/state-officials/[id].tsx`
- Create: `apps/mobile/components/state/StateOfficialDetailPage.tsx`
- Create: `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`
- Modify: `apps/mobile/app/officials/[id].tsx` (add chamber guard)

Mirror Task 10 in mobile.

- [ ] **Step 1: Create mobile StateOfficialDetailPage**

Create `apps/mobile/components/state/StateOfficialDetailPage.tsx`. Mirror the web file with RN primitives. Same shape: bio header → offices section → 5 ComingSoonCard placeholders. Use `<View>`, `<Text>`, `<ScrollView>` (so the page scrolls on small screens).

- [ ] **Step 2: Write detail test**

Create `apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx`. Same 5 cases as web Task 10 Step 1, adapted for RN.

```bash
pnpm --filter @chiaro/mobile test StateOfficialDetailPage
```

Expected: 5/5 pass.

- [ ] **Step 3: Create mobile state route**

Create `apps/mobile/app/state-officials/[id].tsx`. Mirror Task 10 Step 5's web route — fetch official, redirect if federal, fetch offices, render StateOfficialDetailPage.

In Expo Router, redirect is via `router.replace`:

```tsx
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router'
import { useOfficialDetail, useOfficialDistrictOffices } from '@chiaro/officials/hooks'
import { isStateLevel } from '@chiaro/officials'
import { StateOfficialDetailPage } from '@/components/state/StateOfficialDetailPage'

export default function StateOfficialRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: official, isLoading } = useOfficialDetail(id)
  const { data: offices } = useOfficialDistrictOffices(id)

  if (isLoading || !official) return null  // loading skeleton handled by hook
  if (!isStateLevel(official.chamber)) {
    return <Redirect href={`/officials/${id}` as never} />
  }
  return <StateOfficialDetailPage official={official} offices={offices ?? []} />
}
```

Hook names may differ — check `packages/officials/src/hooks.ts` for the actual exports.

- [ ] **Step 4: Add mobile federal route guard**

Open `apps/mobile/app/officials/[id].tsx`. Add chamber check near the top:

```tsx
import { isStateLevel } from '@chiaro/officials'
import { Redirect } from 'expo-router'

// ... inside the component, after useOfficialDetail:
if (official && isStateLevel(official.chamber)) {
  return <Redirect href={`/state-officials/${id}` as never} />
}
```

- [ ] **Step 5: Typecheck + test**

```bash
pnpm --filter @chiaro/mobile typecheck
pnpm --filter @chiaro/mobile test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/state-officials/ \
        apps/mobile/components/state/StateOfficialDetailPage.tsx \
        apps/mobile/test/components/state/StateOfficialDetailPage.test.tsx \
        apps/mobile/app/officials/[id].tsx
git commit -m "feat(mobile): /state-officials route + StateOfficialDetailPage + cross-route guards

Mirrors apps/web Task 10:
- New route /state-officials/[id] fetches official, redirects via
  expo-router <Redirect> if chamber is federal, else renders
  StateOfficialDetailPage
- StateOfficialDetailPage layout: bio header + offices section + 5
  ComingSoonCard placeholders
- Federal /officials/[id] gets symmetric chamber guard.

5 mobile detail-page tests green."
```

---

## Task 13 — Extend @chiaro/officials integration test

**Files:**
- Modify: `packages/officials/test/queries.integration.test.ts`

Add ~3 cases verifying federal + state officials coexist via `fetchMyOfficials`.

- [ ] **Step 1: Read current test setup**

```bash
cat packages/officials/test/queries.integration.test.ts | head -100
```

Note the beforeAll pattern (seeds federal districts + officials + user_districts + signs in). Note the existing cleanup with `bioguide_id IN (...)` deletes.

- [ ] **Step 2: Extend beforeAll to also seed a state official**

Find the `await svc.from('officials').insert([...])` block in `beforeAll`. Add a state Assemblymember entry alongside the 3 federal:

```ts
// Add to the seed block (alongside Pelosi, Feinstein, Padilla):
await svc.from('officials').insert([
  // ... existing 3 federal ...
  {
    openstates_person_id: 'ocd-person/00000000-0000-0000-0000-000000000001-int',
    full_name: 'Test Asm', first_name: 'Test', last_name: 'Asm',
    chamber: 'state_house', party: 'Democratic', state: 'CA',
    district_id: districtStateHouseCA,  // need to seed this district above
    district_code: '15', title: 'Assemblymember',
    senate_class: null, source_version: 'openstates',
  },
])
```

You'll also need to seed a state_house district + add it to user_districts. Find the existing district seeds; add:

```ts
const { data: dCA3, error: e3 } = await svc.from('districts').insert({
  tier: 'state_house', state: 'CA', code: 'CA-15',
  name: 'CA Assembly District 15',
  geometry: 'MULTIPOLYGON(((-122.5 37.5, -122 37.5, -122 38, -122.5 38, -122.5 37.5)))',
  source_version: 'FX',
}).select().single()
expect(e3).toBeNull()
const districtStateHouseCA = dCA3!.id

// ...later, alongside the existing user_districts inserts:
await svc.from('user_districts').insert([
  // ... existing 2 federal entries ...
  { user_id: testUserId, district_id: districtStateHouseCA, tier: 'state_house' },
])
```

- [ ] **Step 3: Add the new test cases**

After the existing cases (in the same `describe('fetchMyOfficials', ...)` block), add:

```ts
it('returns federal + state officials together when user has both district links', async () => {
  const officials = await fetchMyOfficials(anon)
  expect(officials).toHaveLength(4)  // 3 federal + 1 state
  const stateIds = officials
    .filter(o => o.chamber === 'state_house' || o.chamber === 'state_senate' || o.chamber === 'state_legislature')
    .map(o => o.openstates_person_id)
  expect(stateIds).toContain('ocd-person/00000000-0000-0000-0000-000000000001-int')
})

it('state official has district_code + title fields populated', async () => {
  const officials = await fetchMyOfficials(anon)
  const stateAsm = officials.find(o => o.chamber === 'state_house')!
  expect(stateAsm.district_code).toBe('15')
  expect(stateAsm.title).toBe('Assemblymember')
})

it('federal officials keep bioguide_id and have null openstates_person_id', async () => {
  const officials = await fetchMyOfficials(anon)
  const pelosi = officials.find(o => o.bioguide_id === 'P000197')!
  expect(pelosi.openstates_person_id).toBeNull()
})
```

- [ ] **Step 4: Update afterAll cleanup**

Find the afterAll cleanup. Add the state official's deletion:

```ts
// Alongside existing officials.delete().in('bioguide_id', [...])
await svc.from('officials').delete().like('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int%')
```

- [ ] **Step 5: Verify (requires Supabase + env vars)**

```bash
# Locally, requires SUPABASE_SERVICE_ROLE_KEY etc:
pnpm --filter @chiaro/officials test queries.integration
```

If you can't run integration tests locally (no Supabase), commit + let CI verify in the `test` job.

- [ ] **Step 6: Commit**

```bash
git add packages/officials/test/queries.integration.test.ts
git commit -m "test(officials): extend integration suite for federal + state coexistence

beforeAll seeds 1 state_house district + 1 state Assemblymember
alongside the existing 3 federal officials. user_districts gets a
state_house entry. afterAll cleanup adapted.

3 new cases:
- fetchMyOfficials returns all 4 (3 federal + 1 state)
- state official has district_code + title populated
- federal officials retain bioguide_id, openstates_person_id null"
```

---

## Task 14 — Documentation + final workspace verify

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update slice list in CLAUDE.md**

Find the "Slices delivered" section. Add the slice 5C entry after the existing slice list, before the trailing paragraph:

```markdown
- **Sub-slice 5C — state officials identity** (2026-05-19, PR #14): OpenStates ingest of US state legislators (state house + state senate + NE unicameral) via the `openstates/people` GitHub YAML repo. Calibrated users see state reps alongside federal on home + new `/state-officials/[id]` route with 5 federal-only categories rendered as `ComingSoonCard` placeholders. Migrations 0028 (chamber enum 5-value expand) + 0029 (openstates_person_id + district_code + title columns, party CHECK relaxed). 18 new pgTAP plans + ~50 new vitest cases.
```

(Adjust the PR number to whatever the actual PR is — likely the next sequential.)

- [ ] **Step 2: Bump numeric claims**

Find and update:
- `pnpm db:reset                          # apply all migrations 0001–0027` → `0001–0029`
- `pnpm db:test                           # pgTAP suite (228 tests across 18 files)` → `246 tests across 20 files`

(Compute: 228 prior + 18 new from Tasks 1 + 4 = 246. 18 prior files + 2 new = 20.)

- [ ] **Step 3: Update environment variable table**

The env-var table has no new entries — state officials uses no API key (YAML repo source). Skip the table.

- [ ] **Step 4: Add Gotcha #8**

After the existing 7 gotchas in CLAUDE.md, add:

```markdown
8. **State-legislator data sources have known quirks** —
   - **OpenStates `openstates/people` GitHub YAML repo is the source of truth**, not the v3 API. Free, no rate limits, audit trail via git diffs.
   - **NE is unicameral**: chamber=`state_legislature`, party often `Nonpartisan`. The state_senate UI label still says "State Senator" by design.
   - **MD multi-member districts** (1A/1B/1C): all delegates share the same `district_id` (matched to `MD-01` via `state-leg-config.ts`). Multiple officials per district is legitimate.
   - **NH multi-word district codes** (e.g. "Rockingham 5") aren't normalizable to TIGER `STATE-N` format — `state-leg-config.ts` returns null, ingest logs to `stats.unmatchedDistricts` + skips. Documented as a known limitation.
   - **AK uses letter-only districts** (`A`, `B`...): code is `AK-<letter>`, not zero-padded.
   - **Party values** are no longer CHECK-constrained as of migration 0029 — state legislators include Nonpartisan (NE), DFL (MN), Working Families, Progressive (VT), and minor parties.
   - **DC + territories** (Guam, USVI, NMI, AS) are NOT covered by OpenStates and intentionally skipped.
```

- [ ] **Step 5: Update slice-5C spec link**

If the spec mentions `docs/superpowers/specs/2026-05-19-state-officials-identity-design.md`, ensure it's findable. (Already added by the brainstorming workflow.)

- [ ] **Step 6: Run final workspace sweep**

```bash
pnpm -r typecheck 2>&1 | tail -10
pnpm --filter @chiaro/web build 2>&1 | tail -10
pnpm --filter @chiaro/web test 2>&1 | tail -5
pnpm --filter @chiaro/mobile test 2>&1 | tail -5
pnpm --filter @chiaro/db test 2>&1 | tail -10
pnpm --filter @chiaro/officials test 2>&1 | tail -10
pnpm db:reset 2>&1 | tail -5
pnpm db:test 2>&1 | tail -5
```

Expected: all green. The integration-tested packages (profile, location, officials, bills) will surface their pre-existing "needs SUPABASE_SERVICE_ROLE_KEY" gates locally — that's expected; CI handles them against the booted instance.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): sub-slice 5C — state officials identity

- New slice entry referencing PR + commit SHA
- Migration range bumped 0001-0029
- pgTAP count: 246 tests across 20 files
- New Gotcha #8: state legislator data source quirks (NE unicameral,
  MD multi-member, NH multi-word skip, AK letter codes, party values
  unconstrained, DC/territories excluded)"
```

---

## Self-review notes

Spec coverage:
- Goal + scope ✓ (entire slice plan delivers identity-only state legislators)
- Locked decisions ✓ (Approach 2 chamber enum expand = Task 1, openstates/people YAML = Task 6, split routes = Tasks 10 + 12, ComingSoon placeholders = Task 9 + 10)
- Architecture data flow ✓ (Tasks 5-7 = ingest, Task 8 = derivation, Tasks 9-12 = UI)
- Schema migrations ✓ (Task 1 = 0028, Task 4 = 0029)
- Components ✓ (Tasks 8-12 cover web + mobile, all named components present)
- Error handling ✓ (per-state stats, defensive guards, route guards covered in their respective tasks)
- Testing ✓ (Tasks 1+4 = pgTAP; Tasks 2, 5, 6, 7, 8, 9, 10, 11, 12 each include vitest coverage)
- Acceptance criteria (12 items in spec) → mapped:
  1. Migration 0028 backfills federal → Task 1 + Task 3 ripple
  2. Migration 0029 columns + CHECK → Task 4
  3. seed:state-officials + guards → Task 7
  4. CA test user federal + state on home (web) → Tasks 8 + 9
  5. NE test user web → Task 9 (StateOfficialsCardSection test)
  6. State detail page (web) → Task 10
  7. /officials redirects state IDs → Task 10
  8. /state-officials redirects federal IDs → Task 10
  9. Mobile parity → Tasks 11 + 12
  10. Federal tests pass → Task 3 ripple + Task 13 (integration)
  11. Typecheck clean → enforced at every commit's verify step
  12. New pgTAP + vitest green → Tasks 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13

Placeholder scan: no "TBD" / "TODO" / "later". Step 3 ("ripple-fix") is the biggest gray area — it's necessarily file-list-by-grep rather than enumerated. Acceptable because (a) the typechecker drives the discovery and (b) the pattern is mechanical replace.

Type consistency: `OfficialChamber` 5-value union defined in Task 2 step 2, used consistently in all later tasks. `OfficialWithDistrict` shape unchanged (just adds chamber-typed field). `OpenStatesPerson` defined in Task 6, consumed by Task 7. `ComingSoonCategory` defined in Task 9, consumed by Task 10. `IngestStateOfficialsStats` defined in Task 7 only.

Cross-task references:
- Task 3 depends on Task 2's helpers (`isHouseChamber`, `isSenateChamber`)
- Tasks 8 + 9 depend on Task 2's chamber union (web)
- Tasks 11 + 12 depend on Task 2's chamber union (mobile)
- Task 13 depends on Task 4's openstates_person_id column

All ordering correct. No forward refs.

---

## Report (after Task 14)

Reply with **DONE | DONE_WITH_CONCERNS | BLOCKED** and:
- List of all PR refs + commit SHAs for each task
- Total test counts: pgTAP, web vitest, mobile vitest, db seed vitest, officials vitest
- Any deferred items / known limitations (NH, DC, territories — expected) and any new ones surfaced during implementation
- Confirmation of final workspace verification status
