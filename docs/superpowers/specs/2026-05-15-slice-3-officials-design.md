# Slice 3: Officials — Design

**Date:** 2026-05-15
**Status:** Draft for review
**Slice:** Third vertical slice — federal officials (house + senate), end-to-end on web + mobile.

## Goal

Smallest end-to-end slice that proves the **officials** pillar. A signed-in, calibrated user lands on home and immediately sees *their* 3 federal officials (1 house rep + 2 senators); a dedicated `/officials` list page shows the same delegation grouped by chamber; a detail page shows photo, party, state, district, term info, and links to the official's gov page + Twitter.

No bills, no voting records, no alignment scoring, no state/local officials, no admin edit UI — that's slice 4+.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Profile schema | Separate `officials` table only — no `official_profiles`. Citizens' `profiles` table is untouched. |
| 2 | Tier scope | Federal only — house reps + senators. State/local deferred. |
| 3 | Data source — primary | **Congress.gov API v3** (Library of Congress, `api.congress.gov/v3`). ProPublica's Congress API is dead. |
| 4 | Data source — slice 4+ additional | **`github.com/unitedstates/congress-legislators`** YAML files for leadership role history + historical committee structure. Documented but no code in slice 3. |
| 5 | Data-fetching layer | **TanStack Query** (web + mobile, same package). New domain package `packages/officials` exporting hooks + raw fetchers. Per-app `QueryClientProvider` setup. |
| 6 | UI scope | 3 screens × 2 apps = 6 components: home officials card, `/officials` list, `/officials/[id]` detail. |
| 7 | Mobile parity | Both apps ship in this slice. Slice 2.5 (on-device DoD validation of slice 2's mobile baseline) runs orthogonally. |
| 8 | Officials↔districts link | Single FK `officials.district_id → districts.id`. Each federal official → exactly one district. |
| 9 | RLS on officials | Public-read (matches `districts`); writes via service role from the ingest script only. |
| 10 | Ingest cadence | Manual `pnpm seed:officials` for now; matches TIGER seed pattern. Cron / CI scheduling deferred. |
| 11 | Portrait strategy | Hot-link from `bioguide.congress.gov` (predictable URL by `bioguide_id`). Provision `officials-portraits` storage bucket but don't populate it until slice 4 admin UI. |
| 12 | Shared design tokens | New `packages/ui-tokens` package holds brand colors + new party palette. Slice 3's `PartyBadge` imports from there; existing inline colors in `DistrictPanel` / `DistrictMap` migrate incrementally (slice-3.5 cleanup, not blocking). |
| 13 | Ingest safety posture | Defensive: (a) deactivation pivots on explicit just-ingested bioguide_id set, not on `source_version`; (b) pre-flight sanity check refuses to proceed if fetched counts implausibly low; (c) deactivation threshold guard requires explicit `--allow-deactivations` flag for unusual mass-deactivation events; (d) entire upsert + deactivation wrapped in one transaction; (e) every run logged in new `officials_ingest_runs` audit table. |

## Architecture

### Monorepo additions

```
packages/
  db/
    supabase/
      migrations/
        0009_officials.sql                       # officials table + bucket provisioning
        0010_officials_rls.sql                   # public-read; service-role-only write
        0011_user_locations_geojson_view.sql     # table-stakes (audit #5)
        0012_push_tokens.sql                     # table-stakes (audit #6)
        0013_officials_ingest_runs.sql           # ingest audit table (Decisions #13)
      seed/
        officials-ingest.ts                      # main ingest script
        congress-gov.ts                          # source adapter (Congress.gov v3)
        officials-config.ts                      # constants (CONGRESS = '119', etc.)
      tests/
        officials_rls.test.sql                   # pgTAP

  officials/                                     # NEW domain package
    package.json
    tsconfig.json
    src/
      index.ts                                   # public exports
      types.ts                                   # OfficialRow, OfficialWithDistrict
      queries.ts                                 # raw fetcher fns
      keys.ts                                    # TanStack hierarchical key factory
      hooks.ts                                   # useMyOfficials, useOfficial
      schemas.ts                                 # zod validation for Congress.gov payloads

  ui-tokens/                                     # NEW shared design-token package
    package.json
    tsconfig.json
    src/
      index.ts                                   # brand colors, party palette, spacing scale
      colors.ts                                  # named color constants (no inline hex in apps)
      party.ts                                   # party → color/label maps for D/R/I/L/G/ID

apps/
  web/
    app/
      officials/
        page.tsx                                 # list route
        [id]/page.tsx                            # detail route
    components/
      OfficialsCard.tsx                          # home-page card
      OfficialsList.tsx                          # used by list route
      OfficialDetail.tsx                         # used by detail route
      OfficialAvatar.tsx                         # shared sub-component
      PartyBadge.tsx                             # shared sub-component
    lib/
      query-client.tsx                           # QueryClientProvider + per-request client

  mobile/
    app/
      (app)/
        officials/
          index.tsx                              # list route
          [id].tsx                               # detail route
    components/
      OfficialsCard.tsx
      OfficialsList.tsx
      OfficialDetail.tsx
      OfficialAvatar.tsx
      PartyBadge.tsx
    lib/
      query-client.tsx                           # QueryClientProvider setup
```

### Schema migrations

#### `0009_officials.sql`

```sql
create type public.official_chamber as enum ('house','senate');

create table public.officials (
  id              uuid        primary key default gen_random_uuid(),
  bioguide_id     text        not null unique,                   -- universal congressional ID; upsert key
  first_name      text        not null,
  last_name       text        not null,
  full_name       text        not null,
  chamber         public.official_chamber not null,
  party           text        not null check (party in ('D','R','I','L','G','ID')),
  state           text        not null check (length(state) = 2),
  district_id     uuid        not null references public.districts(id) on delete restrict,
  senate_class    smallint    check (senate_class is null or senate_class in (1,2,3)),
  portrait_url    text,
  official_url    text,
  twitter_handle  text,
  next_election   date,
  in_office       boolean     not null default true,
  source_version  text        not null,                          -- congress number, e.g. '119'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.officials add constraint senate_class_matches_chamber
  check ((chamber = 'senate' and senate_class is not null)
      or (chamber = 'house'  and senate_class is null));

create index officials_district_idx       on public.officials(district_id);
create index officials_state_chamber_idx  on public.officials(state, chamber) where in_office;

create trigger officials_touch_updated_at
  before update on public.officials
  for each row execute function public.touch_updated_at();

-- Storage bucket for portraits (populated by slice 4 admin UI; not slice 3)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('officials-portraits', 'officials-portraits', true, 1048576,
          '{image/jpeg,image/png,image/webp}')
  on conflict (id) do nothing;
```

#### `0010_officials_rls.sql`

```sql
alter table public.officials enable row level security;
create policy officials_select_all on public.officials for select using (true);
-- no insert/update/delete policies → service_role is the only writer.
```

#### `0011_user_locations_geojson_view.sql` (table-stakes from audit #5)

```sql
create or replace view public.user_locations_geojson
  with (security_invoker = true) as
select
  user_id,
  home_address_text,
  st_asgeojson(home_location::geometry)::jsonb as home_location_geojson,
  created_at, updated_at
from public.user_locations;
-- security_invoker = true → view inherits caller's RLS on user_locations (self-only)
```

#### `0012_push_tokens.sql` (table-stakes from audit #6)

```sql
create type public.push_platform as enum ('ios','android','web');

create table public.push_tokens (
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  platform   public.push_platform not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;
create policy push_tokens_select_self on public.push_tokens for select  using (auth.uid() = user_id);
create policy push_tokens_upsert_self on public.push_tokens for insert with check (auth.uid() = user_id);
create policy push_tokens_delete_self on public.push_tokens for delete  using (auth.uid() = user_id);
```

#### `0013_officials_ingest_runs.sql` (ingest audit table — Decisions #13)

```sql
create table public.officials_ingest_runs (
  id                 uuid        primary key default gen_random_uuid(),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  congress           text        not null,
  source             text        not null,                          -- e.g. 'congress.gov.v3'
  fetched_count      int,                                           -- total members returned by adapter
  ingested_count     int,                                           -- rows upserted (insert + update)
  deactivated_count  int,                                           -- rows flipped to in_office=false
  status             text        not null check (status in ('in_progress','completed','failed','aborted')),
  error              text,                                          -- truncated message if failed/aborted
  flags              text[],                                        -- e.g. {'--allow-deactivations=99'}
  notes              text
);

create index officials_ingest_runs_started_idx on public.officials_ingest_runs(started_at desc);

alter table public.officials_ingest_runs enable row level security;
-- no policies → only service_role can read or write the audit trail
```

### Ingest pipeline

**Location:** `packages/db/supabase/seed/officials-ingest.ts`, mirroring the TIGER ingest pattern (tsx shebang, direct `pg` client, retry + resume + structured stats).

**Source: Congress.gov v3.** Auth via `CONGRESS_GOV_API_KEY` header (free signup at `api.data.gov`). Rate limit: 5,000 req/hour. Endpoints used: `/v3/member?congress=119&currentMember=true&offset=…&limit=250`. Portraits derived from `bioguide_id` via `https://bioguide.congress.gov/bioguide/photo/{first-letter-of-lastname}/{bioguide_id}.jpg`.

**Adapter pattern.** `congress-gov.ts` exports a `fetchMembers(chamber, congress, apiKey)` function returning a normalized `NormalizedMember[]` shape. The rest of `officials-ingest.ts` consumes that shape — never raw Congress.gov JSON. Swapping providers is a one-file change.

**NormalizedMember shape:**

```ts
export type NormalizedMember = {
  bioguideId: string
  firstName: string
  lastName: string
  fullName: string
  chamber: 'house' | 'senate'
  party: 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'
  state: string                  // 2-letter
  districtNumber: number | null  // null for senators; 0 for at-large house seats
  senateClass: 1 | 2 | 3 | null  // null for house
  portraitUrl: string
  officialUrl: string | null
  nextElection: string | null    // YYYY-MM-DD
}
```

**Ingest flow (defensive — Decisions #13):**

1. **Open audit run.** `insert into officials_ingest_runs (congress, source, status, flags) values ('119','congress.gov.v3','in_progress', ARRAY[…cli flags…]) returning id` — capture `runId` for later updates.
2. **Fetch both chambers in parallel** (paginate 250/page through `/v3/member`). Capture `fetchedHouse[]` and `fetchedSenate[]` normalized arrays.
3. **Pre-flight sanity check (Improvement 2).** Abort the run if `fetchedHouse.length < 400` or `fetchedSenate.length < 95`. On abort: `update officials_ingest_runs set status='aborted', error=$1, completed_at=now() where id=$runId`. No DB writes to `officials`. Process exits non-zero.
4. **Build a district lookup map once:** `key = '{tier}:{state}[:{districtNumber}]' → district.id`. Avoids N+1.
5. **Begin transaction (Improvement 4).** All remaining writes to `officials` happen inside one `BEGIN … COMMIT`.
6. **Resolve district + upsert each member.**
   - House: `federal_house:{state}:{districtNumber}`
   - Senate: `federal_senate:{state}` (both senators FK to the same row)
   - Members with no resolvable district go into `stats.unresolved` and are *not* upserted.
   - `on conflict (bioguide_id) do update set …` writes/refreshes the row; `source_version` is set to current `CONGRESS` on every upsert (now meaning "last congress this member was observed serving in").
7. **Compute deactivation set (Improvement 1).** Let `ingestedBioguideIds = fetchedHouse ∪ fetchedSenate` (the set we just successfully upserted, after filtering out unresolved). Issue:
   ```sql
   select count(*) from officials
     where in_office = true and bioguide_id != all($1::text[])
   ```
   Call this count `toDeactivate`.
8. **Threshold guard (Improvement 3).** Compute `currentActiveCount = (select count(*) from officials where in_office = true)`. If `toDeactivate > max(5, ceil(currentActiveCount * 0.01))` *and* no `--allow-deactivations=N` flag was passed *or* the flag's N doesn't match `toDeactivate`: **ROLLBACK** the transaction, record `status='aborted'`, log the count + the exact `--allow-deactivations` flag to add, exit non-zero. Operator must consciously re-run with the flag.
9. **Deactivate-missing pass (Improvement 1).** Inside the same transaction:
   ```sql
   update officials
     set in_office = false
     where in_office = true
       and bioguide_id != all($1::text[])  -- $1 = ingestedBioguideIds[]
   returning id;
   ```
   This catches both cross-congress departures and within-congress departures (someone removed mid-term). Returning rows gives us the actual `deactivated_count`.
10. **Close audit run on success.** Still inside the transaction: `update officials_ingest_runs set status='completed', completed_at=now(), fetched_count=$1, ingested_count=$2, deactivated_count=$3 where id=$runId`. Then `COMMIT`.
11. **On any thrown error inside the transaction.** Catch → `ROLLBACK` → record `status='failed'` and truncated error message on the audit row (in a separate transaction; the audit row itself must persist). Exit non-zero.
12. **Print structured stats** to stdout: `{ runId, ingested, unresolved, deactivated, errors }` — for human inspection and CI logs.

**At-large house seats** (AK, DE, MT, ND, SD, VT, WY): confirm at implementation time whether Congress.gov returns `district: 0`, `district: 1`, or omits the field. Reconcile with TIGER's coding by inspecting existing `districts` rows for these states. Document the convention in `officials-config.ts`.

**Env vars:**
- `CONGRESS_GOV_API_KEY` (required for ingest; server-side only; never sent to clients)
- Added to `.env.example` at repo root and `apps/web/.env.example`.

**Runtime:** `pnpm seed:officials` (new script in root `package.json` mirroring `seed:tiger`). Local dev runs it after `seed:tiger`. CI scheduling deferred — slice 3 doesn't gate on it.

### Slice 4+ additional source (documented, no slice 3 code)

When slice 4 (bills + votes) gets designed, the **`github.com/unitedstates/congress-legislators`** repo fills gaps Congress.gov doesn't cover well:

- Leadership role history with date ranges (`legislators-current.yaml` + `legislators-historical.yaml`, `leadership_roles[]` field with start/end dates and titles) — the cleanest free source for this.
- Historical committee structure (`committees-historical.yaml`, 93rd Congress onward).
- District office contact info (`legislators-district-offices.yaml`).
- Official social media accounts (`legislators-social-media.yaml`).

Universal join key: every record has `bioguide_id`, matching our `officials.bioguide_id` upsert column. Zero auth, daily community-maintained updates. Likely integration in slice 4: a `seed/unitedstates-legislators-ingest.ts` script populates new `officials_leadership_history`, `committees`, etc. tables.

**Not in slice 3.** Document the source choice now so slice 4 planning doesn't re-litigate.

For voting records and bill subject categorization, Congress.gov v3 itself is sufficient: `/v3/vote`, `/v3/house-vote`, `/v3/senate-vote`, and `/v3/bill` (`policyArea` + `subjects` fields, both assigned by the Library of Congress — the canonical taxonomy GovTrack and ProPublica also surfaced). For historical committee *membership* (not structure), GovTrack bulk data (`data.govtrack.us`) is a redundancy option in slice 4+.

### Data-fetching layer (`packages/officials`)

New domain package, matching the existing `packages/location` / `packages/profile` shape. Audit recommended a single `packages/queries` or `packages/api`; deviation here keeps domain alignment consistent with existing packages and avoids cross-cutting unrelated domains.

**Peer deps:** `@tanstack/react-query`, `react`, `@chiaro/db`, `@chiaro/supabase-client`.

**Query-key factory** (`keys.ts`):

```ts
export const officialsKeys = {
  all: ['officials'] as const,
  lists: () => [...officialsKeys.all, 'list'] as const,
  myList: () => [...officialsKeys.lists(), 'mine'] as const,
  detail: (id: string) => [...officialsKeys.all, 'detail', id] as const,
} as const
```

Hierarchical pattern — invalidate `officialsKeys.all` to refresh everything, or `officialsKeys.detail(id)` to surgically refresh one record after a hypothetical mutation.

**Raw fetchers** (`queries.ts`): plain async functions taking a `ChiaroClient`. Pattern matches existing `getMyProfile(client)` in `@chiaro/profile`. Includes:

- `fetchMyOfficials(client)` — joins through `user_districts → districts → officials` for the current user. Returns `OfficialWithDistrict[]`.
- `fetchOfficial(client, id)` — single-row lookup with district eagerly joined.

**Hooks** (`hooks.ts`): tiny wrappers around `useQuery`. Both hooks take the client explicitly (no implicit context):

```ts
export function useMyOfficials(client: ChiaroClient) {
  return useQuery({
    queryKey: officialsKeys.myList(),
    queryFn: () => fetchMyOfficials(client),
    staleTime: 5 * 60 * 1000,   // officials change rarely
    gcTime:    30 * 60 * 1000,
  })
}
```

**Per-app `QueryClientProvider` setup:** small per-app file (`apps/web/lib/query-client.tsx` and `apps/mobile/lib/query-client.tsx`), wired into each app's root layout. Web uses the Next 15 SSR-safe pattern (`new QueryClient()` inside a `'use client'` component memoized with `useState`). Mobile creates one QueryClient for the app's lifetime. DevTools (`@tanstack/react-query-devtools`) wired into web only, gated behind `NODE_ENV !== 'production'`.

### UI surfaces

Three logical screens × two apps = six new component files plus two route files per app. Reusable atomic components extracted as shared building blocks.

| Surface | Web | Mobile |
|---|---|---|
| Home officials card | `apps/web/components/OfficialsCard.tsx` (`'use client'`, calls `useMyOfficials`) | `apps/mobile/components/OfficialsCard.tsx` |
| Officials list page | `apps/web/app/officials/page.tsx` + `apps/web/components/OfficialsList.tsx` | `apps/mobile/app/(app)/officials/index.tsx` + `apps/mobile/components/OfficialsList.tsx` |
| Official detail page | `apps/web/app/officials/[id]/page.tsx` + `apps/web/components/OfficialDetail.tsx` | `apps/mobile/app/(app)/officials/[id].tsx` + `apps/mobile/components/OfficialDetail.tsx` |

**Shared atomic components:**
- `OfficialAvatar` — photo + initials fallback
- `PartyBadge` — colored chip for D/R/I/L/G/ID; pulls colors + labels from new `@chiaro/ui-tokens` (party.ts)
- `OfficialMeta` — formatted "Senate · CA · Term ends Jan 2031" string

These stay app-local in slice 3. Promote to `@chiaro/officials` only if a third consumer appears. Colors and labels are *not* app-local — they live in `@chiaro/ui-tokens`.

**Home page integration:** `apps/web/app/page.tsx` and `apps/mobile/app/(app)/index.tsx` each render `<OfficialsCard />` as a sibling of the existing `<DistrictPanel />`. The DistrictPanel keeps its current inline-fetch pattern in slice 3 — migration to TanStack Query is **out of scope** (deferred to slice 3.5 cleanup PR; otherwise slice 3 grows).

## Visible outcome (definition of done)

A user who has completed slice 2 (signup → profile → calibrate) sees, on both apps:

1. Home screen shows their delegation card: 1 House rep + 2 Senators, with photo, name, and party badge.
2. Tapping "See all officials" navigates to `/officials`, showing the same 3 grouped by chamber.
3. Tapping any official navigates to `/officials/{id}`, showing photo, full name, party, state, district number (for house) or senate class (for senate), term info, "Open at congress.gov" external link, Twitter handle if present.
4. RLS verified: anonymous user gets 401 from any officials route requiring auth; authenticated user sees officials but cannot insert/update/delete; service role can write.
5. `pnpm seed:officials` runs to completion locally, populating ~541 rows (~441 house + ~100 senate), with stats printed.

## Out of scope (explicit)

- Migrating `DistrictPanel` to TanStack Query — deferred to slice 3.5 cleanup PR.
- Vote history, sponsored / cosponsored bills, news per official — slice 4+.
- State + local officials (Decisions #2) — slice 4+ once federal is solid.
- "Find officials anywhere" search by state/district — deferred to a future slice (likely slice 5+, alongside "browse all bills" — same global-search UX pattern).
- CI scheduling of `seed:officials` — manual local runs for slice 3.
- Re-uploading portraits to `officials-portraits` bucket — bucket provisioned (migration 0009) but populated only when slice 4 admin UI lands.
- Edit-an-official admin UI — separate admin surface, not slice 3.
- Migrating existing inline colors in `DistrictPanel` / `DistrictMap` (web + mobile) to `@chiaro/ui-tokens` — slice-3.5 cleanup. Slice 3 only requires the new `PartyBadge` to consume tokens; old call sites stay inline temporarily.
- Vote-alert push notifications — `push_tokens` table provisioned but only consumed in slice 5+.

## Open implementation questions (handled in plan, not design)

1. **`fetchMyOfficials` exact SQL.** Confirm one round-trip via `user_districts → districts → officials` works, or whether a `my_officials_view` simplifies the query layer.
2. **At-large house seats.** Reconcile Congress.gov's `district` value with how TIGER coded these for AK / DE / MT / ND / SD / VT / WY.
3. **Mobile route grouping.** Confirm `officials/` lives inside `(app)/` route group (auth-gated, matches existing structure).
4. **SSR prefetch on web home.** Optional polish — Server Component could `prefetchQuery` for `useMyOfficials` before hydration. Performance tweak, not blocking.
5. **Threshold-guard floor calibration.** Decisions #13 sets the deactivation guard at `max(5, 1% of active)`. With ~541 active, that's ~5 — basically any unexpected mass deactivation requires the flag. May need recalibration once natural turnover patterns are observed (post-election ingests routinely deactivate ~50–100 — those will always need `--allow-deactivations=N`, which is the intent, but the operator UX may want streamlining).
6. **`source_version` semantics post-Improvement 1.** With deactivation now driven by explicit set rather than `source_version`, the column means "last congress in which this member was observed actively serving." Confirm no downstream query relies on it for liveness checks (UI filters on `in_office=true`, not `source_version`).

## Cross-cutting concerns

- **Observability:** ingest script prints structured stats to stdout; failures throw + exit non-zero. Every run also writes a row to `officials_ingest_runs` (Decisions #13) — query `select * from officials_ingest_runs order by started_at desc limit 10` for recent history. Production telemetry (Sentry / PostHog for the apps; pg log for ingest) deferred to slice 3.5 audit follow-up.
- **Feature flagging:** no kill switch needed for slice 3 — officials are public-read and the ingest is offline-controlled. If Congress.gov degrades, no user-facing impact (existing rows stay).
- **Analytics events:** "officials_card_viewed", "official_detail_opened" — wire stubs only; full analytics infra deferred.
- **Accessibility:** photos get `alt={full_name}`; party badge has accessible label; list page heading hierarchy validated. Standard SSR-friendly Next 15 + RN a11y patterns.
- **Performance:** stale-time of 5 min on hooks; SSR caching on Next via React Server Components for the list page. 541-row table is tiny — no pagination needed.

## Verification plan

- Migrations apply cleanly on a fresh `supabase start` (db job in CI).
- `officials_rls.test.sql` pgTAP: anon → 0 rows on select, authed → all rows on select, anon insert/update/delete → blocked, service role insert/update/delete → success.
- Web typecheck + mobile typecheck pass workspace-wide (`pnpm -r typecheck`).
- Web build (`pnpm --filter @chiaro/web build`) passes Next 15.
- Mobile typecheck passes; on-device validation defers to slice 2.5.
- Integration test: `pnpm seed:officials` (against a recorded fixture of Congress.gov payloads, not the live API in CI — avoid rate-limit + key-exposure issues). Verifies the full pipeline: fetch adapter → normalize → upsert → deactivate-missing. Additional ingest-safety scenarios (each its own fixture):
  - **Happy path:** clean 541-member fixture → `officials_ingest_runs` row has `status='completed'`, deactivated_count = 0.
  - **Pre-flight abort (F2 / Improvement 2):** house fixture trimmed to 350 → script exits non-zero, `officials_ingest_runs.status='aborted'`, `officials` table untouched.
  - **Threshold guard (F3 / Improvement 3):** fixture omits 50 active members without the `--allow-deactivations=50` flag → ROLLBACK, no rows flipped, audit row records `status='aborted'` and the recommended flag. Re-run with `--allow-deactivations=50` → succeeds, 50 rows now `in_office=false`.
  - **Within-congress departure (F1 / Improvement 1):** seed an extra row with `bioguide_id='Z000999', in_office=true, source_version='119'`; fixture doesn't include them → that row flips to `in_office=false` in a single ingest pass (not deferred to next congress).
  - **Transaction atomicity (F4 / Improvement 4):** inject a forced error inside the deactivation pass → both upsert *and* deactivation roll back; `officials_ingest_runs.status='failed'` recorded in a separate transaction.
