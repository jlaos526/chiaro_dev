# State Officials Identity — Design Spec (sub-slice 5C)

**Date:** 2026-05-19
**Status:** Design — pending plan
**Scope:** Identity-only ingest of state-level legislators (state house + state senate + Nebraska unicameral) via the `openstates/people` GitHub YAML repo. Show calibrated users their state reps alongside federal on home + a new dedicated detail route. Federal-only feature categories render as placeholders.
**Predecessors:** Slice 3 (federal officials), Slice 4 (officials detail redesign), Slice 5B (Sentry telemetry — gives us the error capture path for the new route guards).
**Followers:** Sub-slice 5D (state bills + votes), 5E (state finance), 5F (state scorecards + metrics).

---

## Goal

A calibrated user signs in and sees their state-level legislators (state house + state senate, plus NE unicameral) alongside their federal reps. Tapping a state rep routes to a minimal detail page showing identity + district + party + contact info, with the 5 federal-only categories rendered as "Coming soon" placeholders.

## Out of scope

Deferred to later sub-slices in the state-officials arc:

| Sub-slice | Adds |
|---|---|
| 5D | State bills + votes (LegiScan or per-state APIs) |
| 5E | State campaign finance (FollowTheMoney) |
| 5F | State scorecards + state-level metrics |

Also out of scope for this slice:
- Scheduled refresh of state officials (pg_cron) — operator runs `pnpm seed:state-officials` manually
- DC city council (OpenStates classifies as `municipality`, not `state`)
- Territories (Guam, USVI, NMI, AS — not covered by OpenStates)
- New Hampshire's multi-word district codes (`"Rockingham 5"`) — documented as a known limitation; log + skip rather than ingest with bad district FK
- `ocd_division_id` as a districts join key (research recommended; deferred since per-state district code rules fit the existing `tiger-config.ts` pattern)
- Top-3 alignment chips on state-officials bio header (empty because no scorecards yet; existing component falls through gracefully)
- Federal-side merging of routes — the federal route stays exactly as slice 4 left it

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Data source | `openstates/people` GitHub YAML repo, pinned to a commit | No rate limits (vs API's 500/day free tier), audit trail via git diffs, reproducible builds, no API key needed. The v3 API stays available for ad-hoc lookups. |
| Schema approach | Approach 2 — expand `public.official_chamber` enum to 5 values | Self-documenting; reader doesn't need to join districts table to know level. Backed by NE's `state_legislature` reality. |
| Chamber enum values | `federal_house`, `federal_senate`, `state_house`, `state_senate`, `state_legislature` | NE unicameral emits `org_classification = "legislature"`; we mirror it explicitly. |
| Routing | Split routes: `/officials/[id]` (federal) + `/state-officials/[id]` (state) | Honest separation while data sets diverge; cross-route guards handle wrong-ID redirects; mergeable as a mechanical refactor in a future slice if state data reaches federal parity. |
| Detail page treatment | All 5 federal-only categories render as `ComingSoonCard` placeholders | User answer 2026-05-19 — transparency over hiding. Per-category copy. |
| Home layout | Two sections: "Federal" then "State", each hides if empty | User answer 2026-05-19 — clear hierarchy, scales to county/local layers. |
| PK strategy | `bioguide_id` (federal) XOR `openstates_person_id` (state), CHECK enforced | Mixed table avoids forking domain code. CHECK keeps semantics explicit. |
| District matching | `state-leg-config.ts` per-state normalization rules, mirroring `tiger-config.ts` | Existing pattern; NH known limitation documented. |
| Operational cron | Skipped for MVP | Federal seed doesn't have one either; asymmetric infra. Future operational slice if needed. |
| API key env var | None | YAML repo source has no auth. |
| Component scope | New `apps/web/components/state/` + `apps/mobile/components/state/` namespaces | Keeps state-specific UI isolated; federal route untouched. |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  github.com/openstates/people  (YAML repo, pinned commit)        │
└────────────┬────────────────────────────────────────────────────┘
             │ pnpm seed:state-officials (CLI, operator-run)
             ▼
┌────────────────────────────┐    ┌──────────────────────────────┐
│ openstates-yaml-loader.ts  │───▶│ state-officials-ingest.ts    │
│  (clone/pull + walk YAML)  │    │  - state-leg-config.ts rules │
└────────────────────────────┘    │  - defensive guards          │
                                  │  - per-state stats output    │
                                  └─────────────┬────────────────┘
                                                │ upsert via service role
                                                ▼
                          ┌─────────────────────────────────────┐
                          │ public.officials                    │
                          │  + openstates_person_id text UNIQUE │
                          │  + district_code text               │
                          │  + title text                       │
                          │  + chamber (5-value enum)           │
                          │  + party (no longer CHECK)          │
                          │ public.district_offices             │
                          │  (existing — reused for state)      │
                          └────────────┬────────────────────────┘
                                       │
              (existing fetchMyOfficials, NO change required)
                                       ▼
                          ┌─────────────────────────────────────┐
                          │ useMyOfficials hook (existing)      │
                          │   returns OfficialWithDistrict[]    │
                          └────────────┬────────────────────────┘
                                       │
              ┌───────────groupOfficialsByLevel───────┐
              ▼                                       ▼
  ┌──────────────────────┐               ┌──────────────────────┐
  │ FederalOfficialsCard │               │ StateOfficialsCard   │
  │  Section (existing)  │               │  Section (NEW)       │
  │  → /officials/[id]   │               │  → /state-officials/ │
  │                      │               │     [id]             │
  └──────────────────────┘               └──────────────────────┘
              │                                       │
              ▼                                       ▼
  ┌──────────────────────┐               ┌──────────────────────┐
  │ /officials/[id]      │               │ /state-officials/    │
  │  (federal page —     │               │   [id] (NEW)         │
  │   slice 4 layout,    │               │  bio header +        │
  │   guards state IDs)  │               │  contact + 5x        │
  │                      │               │  ComingSoonCard      │
  └──────────────────────┘               └──────────────────────┘
```

## Components

### New files

**Database:**
```
packages/db/supabase/migrations/0028_chamber_enum_expand.sql
packages/db/supabase/migrations/0029_officials_openstates_fields.sql
packages/db/supabase/tests/chamber_enum_expansion.test.sql
packages/db/supabase/tests/officials_openstates_fields.test.sql
```

**Seed pipeline:**
```
packages/db/supabase/seed/state-officials-ingest.ts
packages/db/supabase/seed/state-officials-ingest.test.ts
packages/db/supabase/seed/state-leg-config.ts
packages/db/supabase/seed/openstates-yaml-loader.ts
packages/db/supabase/seed/fixtures/openstates-people/
  ca-sample-assemblymember.yml
  ca-sample-senator.yml
  ne-sample-unicameral-senator.yml
  md-sample-delegate-1A.yml
  md-sample-delegate-1B.yml
  md-sample-delegate-1C.yml
```

**Web:**
```
apps/web/lib/derivations/officials-by-level.ts
apps/web/lib/derivations/officials-level.ts
apps/web/test/derivations/officials-by-level.test.ts
apps/web/test/derivations/officials-level.test.ts
apps/web/app/state-officials/[id]/page.tsx
apps/web/components/state/StateOfficialDetailPage.tsx
apps/web/components/state/StateOfficialsCardSection.tsx
apps/web/components/cards/ComingSoonCard.tsx
apps/web/test/components/state/StateOfficialDetailPage.test.tsx
apps/web/test/components/state/StateOfficialsCardSection.test.tsx
apps/web/test/app/officials-route-guards.test.tsx
```

**Mobile** (mirrors web — same filenames under `apps/mobile/`):
```
apps/mobile/app/state-officials/[id].tsx
apps/mobile/components/state/StateOfficialDetailPage.tsx
apps/mobile/components/state/StateOfficialsCardSection.tsx
apps/mobile/components/cards/ComingSoonCard.tsx
apps/mobile/test/components/state/{StateOfficialDetailPage,StateOfficialsCardSection}.test.tsx
apps/mobile/test/app/officials-route-guards.test.tsx
```

### Modified files

```
packages/db/src/types.ts                         # Auto-regen via supabase gen types
packages/db/package.json                         # +yaml@^2 dependency
packages/officials/src/types.ts                  # OfficialChamber: 5-value union; +isStateLevel(chamber); +levelOf(chamber)
packages/officials/src/schemas.ts                # zod chamber schema expanded
packages/officials/test/queries.integration.test.ts  # +3 cases — CA federal + CA state coexist; cleanup adapted
apps/web/app/officials/[id]/page.tsx             # +chamber guard: redirect state IDs to /state-officials/{id}
apps/web/components/OfficialsCard.tsx            # +StateOfficialsCardSection alongside existing Federal section
apps/web/components/cards/DistrictBadge.tsx      # +state_house/state_senate/state_legislature handling; multi-member label
apps/mobile/                                     # Mirrors of all the above
CLAUDE.md                                        # +Slice 5C entry; migration range 0001-0029; pgTAP count → 250
                                                 # +Gotcha #8: state legislator data sources (YAML repo source,
                                                 #   NH/MD/AK district quirks, NE chamber=state_legislature,
                                                 #   party value variety)
```

### Schema migrations

**Migration 0028 — `chamber_enum_expand.sql`**

Postgres can't drop enum values, so we swap. Inside a single transaction:

```sql
-- 1. Create the new enum type with 5 values.
create type public.official_chamber_v2 as enum (
  'federal_house',
  'federal_senate',
  'state_house',
  'state_senate',
  'state_legislature'
);

-- 2. Convert each of the 3 columns that reference public.official_chamber.
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

-- 3. Drop the old type and rename v2 → official_chamber.
drop type public.official_chamber;
alter type public.official_chamber_v2 rename to official_chamber;
```

**Migration 0029 — `officials_openstates_fields.sql`**

```sql
alter table public.officials
  add column if not exists openstates_person_id text,
  add column if not exists district_code        text,
  add column if not exists title                text;

create unique index if not exists officials_openstates_person_idx
  on public.officials(openstates_person_id)
  where openstates_person_id is not null;

-- Exactly one source ID per row. Federal rows have bioguide_id; state rows have openstates_person_id.
alter table public.officials
  add constraint officials_source_id_xor check (
    (bioguide_id is not null and openstates_person_id is null) or
    (bioguide_id is null     and openstates_person_id is not null)
  );

-- Relax party from CHECK-constrained to free text — needed for NE Nonpartisan, MN DFL,
-- Working Families, Progressive (VT), etc. Display normalization moves to @chiaro/ui-tokens.
alter table public.officials
  drop constraint if exists officials_party_check;
```

### Types + helpers

**`packages/officials/src/types.ts`** — expand `OfficialChamber`:

```ts
export type OfficialChamber =
  | 'federal_house'
  | 'federal_senate'
  | 'state_house'
  | 'state_senate'
  | 'state_legislature'

export function isStateLevel(chamber: OfficialChamber): boolean {
  return chamber === 'state_house'
      || chamber === 'state_senate'
      || chamber === 'state_legislature'
}

export function levelOf(chamber: OfficialChamber): 'federal' | 'state' {
  return isStateLevel(chamber) ? 'state' : 'federal'
}
```

### Cross-route guards

```ts
// apps/web/app/officials/[id]/page.tsx
export default async function FederalOfficialPage({ params }) {
  const client = await getServerClient()
  const official = await fetchOfficial(client, params.id)
  if (isStateLevel(official.chamber)) {
    redirect(`/state-officials/${params.id}`)
  }
  // ... existing slice 4 federal logic unchanged
}

// apps/web/app/state-officials/[id]/page.tsx (NEW)
export default async function StateOfficialPage({ params }) {
  const client = await getServerClient()
  const official = await fetchOfficial(client, params.id)
  if (!isStateLevel(official.chamber)) {
    redirect(`/officials/${params.id}`)
  }
  return <StateOfficialDetailPage official={official} />
}
```

### `ComingSoonCard` shape

```tsx
// apps/web/components/cards/ComingSoonCard.tsx
type CategoryLabel =
  | 'Service Record'
  | 'Issue Positions'
  | 'Community Presence'
  | 'Finance'
  | 'Ethics & Accountability'

export function ComingSoonCard({ category }: { category: CategoryLabel }) {
  return (
    <MetricCardShell
      // Same outer dimensions + corner radius as federal cards so page rhythm holds
      header={category}
      body={
        <ComingSoonBody
          // Per-category copy:
          // Service Record: "Bills + votes — coming soon"
          // Issue Positions: "Scorecards — coming soon"
          // Community Presence: "Town halls — coming soon"  (offices live above, in bio section)
          // Finance: "Campaign finance — coming soon"
          // Ethics & Accountability: "STOCK Act compliance — coming soon"
          message={...}
        />
      }
    />
  )
}
```

`StateOfficialDetailPage` lays out all 5 category cards as `ComingSoonCard` placeholders, preserving the federal page's visual rhythm. **The legislator's contact info (district_offices rows) is rendered separately in the bio-header section, NOT inside the Community Presence category card.** This avoids mixing real and placeholder treatment within a single category. The offices section lives between the bio identity row and the category cascade. Implementation reuses the federal `ConstituentConnectionCard.renderOffices` rendering — either by extracting a shared `OfficesList` component or by inlining the same JSX. The plan will choose.

## Data flow

1. **Ingest (manual)**: Operator runs `pnpm seed:state-officials`. The script:
   - Clones or pulls `openstates/people` to a local cache directory
   - Walks `data/<state>/legislature/*.yml` (canonical YAML location for current legislators)
   - For each person: extracts `id`, `name`, `given_name`, `family_name`, `party`, `image`, `email`, `current_role.{title,org_classification,district,division_id}`, `jurisdiction.id`, `offices[]`, `openstates_url`, `updated_at`
   - Maps `current_role.org_classification` (`upper`/`lower`/`legislature`) + `jurisdiction` state → `state_senate`/`state_house`/`state_legislature` chamber enum
   - Normalizes `current_role.district` via `state-leg-config.ts` per-state rules → matches `districts.code` (FK lookup)
   - Upserts into `public.officials` keyed by `openstates_person_id`
   - Upserts each `offices[]` entry into `public.district_offices` keyed by `(official_id, address)`
   - Soft-deactivates officials no longer present (in_office=false) — bounded by the `--allow-deactivations` guard
2. **User signs in + calibrates location** (existing slice 2/5A path): `user_districts` rows include `state_house` + `state_senate` district FKs alongside federal.
3. **Home page**: `useMyOfficials()` returns the joined `OfficialWithDistrict[]` filtered by `user_districts.district_id`. `groupOfficialsByLevel` partitions into federal + state. Each section renders its chips.
4. **State chip tap** → routes to `/state-officials/[id]`.
5. **State detail page**: fetches official, renders bio header + district + party + offices contact info + 5 `ComingSoonCard` placeholders.

## Error handling

[See Section 4 above — full coverage of ingest pipeline failures, database constraint violations, frontend route guards, frontend data states. Key items:]

- YAML fetch / parse failures isolated per state (retries + per-state stats)
- District match failures logged + skipped; NH expected to dominate this list
- Pre-flight count + deactivation threshold guards mirror `officials-ingest.ts` slice 3 pattern
- 0028 enum swap is transactional; rolls back atomically on failure
- 0029 column additions are pure-additive
- Cross-route guards redirect 302 between `/officials/[id]` ↔ `/state-officials/[id]`
- Empty home sections hide entirely (no placeholder spam)
- PII: none — state legislator data is fully public
- RLS: `officials` table read-permissive for authenticated; new rows inherit

## Testing

[See Section 5 above — full test inventory. Summary:]

- **2 new pgTAP files, ~18 new plans** (chamber enum expansion + officials openstates fields). Total pgTAP: **250 tests across 20 files**.
- **1 new vitest file** for ingest pipeline (`state-officials-ingest.test.ts`, ~12 cases)
- **2 new vitest files** for derivations (`officials-by-level.test.ts`, `officials-level.test.ts`, ~11 cases)
- **5 new vitest files** for web state components + route guards (~15 cases)
- **5 new vitest files** for mobile state components + route guards (~15 cases)
- **3 new cases** added to existing `@chiaro/officials/test/queries.integration.test.ts`
- No new live integration tests for OpenStates YAML — the loader is deterministic against fixtures

## Acceptance criteria

1. Migration 0028 expands `public.official_chamber` enum to 5 values; all existing federal officials rows backfilled.
2. Migration 0029 adds `openstates_person_id`, `district_code`, `title` columns to `public.officials` with bioguide⊕openstates CHECK; party CHECK relaxed.
3. `pnpm seed:state-officials` ingests fixture-based test data successfully; defensive guards trip when pre-flight count fails.
4. Calibrated CA test user (web): home shows "Federal" section (3 chips) + "State" section (1 Assemblymember + 1 State Senator) tapping each routes correctly.
5. NE test user (web): home shows "Federal" section + "State" section with 1 chamber=state_legislature card labeled "State Senator".
6. State officials detail page renders bio header, district badge, party, offices contact info, and 5 `ComingSoonCard` placeholders.
7. `/officials/{state-id}` redirects to `/state-officials/{state-id}`.
8. `/state-officials/{federal-id}` redirects to `/officials/{federal-id}`.
9. Mobile parity for items 4-8.
10. All existing federal tests pass unchanged (chamber values backfilled via 0028).
11. `pnpm -r typecheck` clean across all 9 packages.
12. ~18 new pgTAP plans + ~50 new vitest cases all green in CI.

## Known limitations (documented, not blocking)

- **NH multi-word district codes** (`"Rockingham 5"`): log mismatches, skip; revisit in a follow-up that adds per-state code parsers.
- **DC city council**: skipped (OpenStates classifies as municipality; TIGER doesn't include DC state-leg districts).
- **Territories** (Guam, USVI, NMI, AS): not covered by OpenStates.
- **No `ocd_division_id`** column on districts: per-state district-code matching deemed sufficient; revisit if the per-state rules grow unwieldy.
- **No scheduled refresh**: operator-run manual seed only.
- **State officials' bio header alignment chips empty**: scorecards data lands in 5F; existing chip-strip component falls through gracefully.

## Operator pre-flight (NOT auto-managed by code)

Operator action required after merge:
1. Run `pnpm seed:state-officials` once locally or in a workflow to populate state legislator data.
2. (Optional) Configure a periodic re-run via cron/GitHub Action if state turnover frequency warrants — out of MVP scope.

No new secrets required.

## See also

- [Slice 4 — bills/votes/metrics + officials detail redesign](2026-05-15-slice-4-bills-votes-metrics-design.md)
- [Slice 4 follow-up — officials detail redesign](2026-05-17-officials-detail-redesign-design.md)
- [Slice 5B — Sentry telemetry](2026-05-18-telemetry-design.md) — captures errors from the new state route guards
- Audit closure memory `project_chiaro_audit_2026_05_19_closure.md`
- CLAUDE.md gotchas #2 (TIGER district codes), #5 (officials ingest defensive guards), #7 (`pnpm test` not `-r test`)
