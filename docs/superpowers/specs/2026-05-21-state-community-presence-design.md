# Sub-slice 5H — State Community Presence (design)

**Date:** 2026-05-21
**Branch:** `slice-5h-community-presence` (to be created at slice start)
**Scope:** Replace `ComingSoonCard('Community Presence')` on `/state-officials/[id]` with a real `StateCommunityPresenceCard` showing 3 signals: town halls + public meetings, committee hearings attended, district offices.

## Why this slice

`/state-officials/[id]` ships with 5 `ComingSoonCard` placeholders after slice 5C identity work. Slices 5D (Service Record) → 5E (Finance) → 5F (KPIs) → 5G (Issue Positions) have replaced 4 of them. This slice replaces the 5th (Community Presence); the only remaining ComingSoonCard after this is Ethics & Accountability (deferred to sub-slice 5I).

"Community Presence" answers: **how visible is this legislator in their district?** Three legible signals:

1. **Town halls + public meetings** — scheduled/upcoming/past events advertised by the legislator's office.
2. **Committee hearings attended** — composes from slice 5F `state_committee_memberships` + new `state_committee_hearings` table.
3. **District offices** — physical addresses + hours of district offices (not the capitol office).

Constituent engagement signals (newsletter cadence, response-rate-to-mail) considered and deferred — too fragmented and noisy for v1.

## Architecture summary

- **Hybrid adapter pattern**: TownHallProject nationwide overlay + 5 per-state core adapters (CA, NY, FL, TX, MI) + OpenStates v3 reuse for committee hearings. First slice combining all three patterns.
- **3 parallel state-side tables** + 1 attendance M:N table (4 new public.state_* tables total + 1 attendance join table = 5).
- **Single new card** on web + mobile with 3 collapsible subsections.
- **Workspace stays at 10 packages** (new types/queries/hooks slot into `@chiaro/officials` per slice 5E precedent).

## Schema (migrations 0042–0045)

### Migration 0042 — `state_town_halls`

```sql
create table public.state_town_halls (
  id                  uuid primary key default gen_random_uuid(),
  official_id         uuid not null references public.officials(id) on delete restrict,
  event_date          date not null,
  city                text,
  state               char(2) not null,
  format              text check (format in ('in_person','virtual','phone','hybrid')),
  attendance_estimate int,
  source_url          text not null,
  source              text not null,          -- 'townhallproject' | 'ca-leginfo' | etc.
  external_id         text,                   -- per-source dedupe key (nullable)
  ingested_at         timestamptz not null default now(),
  unique (source, external_id)                -- partial dedupe (NULLs allowed per Postgres default)
);

create index state_town_halls_official_date_idx
  on public.state_town_halls(official_id, event_date desc);
create index state_town_halls_state_date_idx
  on public.state_town_halls(state, event_date desc);
```

Parallels federal `town_halls` (migration 0022) but with `RESTRICT` FK (audit-closure precedent) + `source`/`external_id` for multi-adapter dedup.

### Migration 0043 — `state_district_offices`

```sql
create table public.state_district_offices (
  id            uuid primary key default gen_random_uuid(),
  official_id   uuid not null references public.officials(id) on delete restrict,
  kind          text not null check (kind in ('district','satellite','capitol')),
  street_1      text not null,
  street_2      text,
  city          text not null,
  state         char(2) not null,
  postal_code   text,
  phone         text,
  email         text,
  hours_text    text,                          -- free-form (per-state conventions vary)
  source_url    text not null,
  ingested_at   timestamptz not null default now()
);

create index state_district_offices_official_idx
  on public.state_district_offices(official_id);
```

`kind = 'capitol'` retained for completeness even though our domain emphasis is district presence; some scrapers will surface capitol-office rows and dropping them silently would lose data.

### Migration 0044 — `state_committee_hearings` + attendance

```sql
create table public.state_committee_hearings (
  id                       uuid primary key default gen_random_uuid(),
  openstates_committee_id  text,                -- nullable for non-OpenStates sources
  state                    char(2) not null,
  session                  text not null,       -- matches state_bills.session format
  hearing_date             date not null,
  location                 text,
  agenda_topic             text,
  source_url               text not null,
  ingested_at              timestamptz not null default now()
);

create index state_committee_hearings_committee_idx
  on public.state_committee_hearings(openstates_committee_id, hearing_date desc);
create index state_committee_hearings_state_session_idx
  on public.state_committee_hearings(state, session, hearing_date desc);

create table public.state_committee_hearing_attendance (
  hearing_id   uuid not null references public.state_committee_hearings(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  primary key (hearing_id, official_id)
);

create index state_committee_hearing_attendance_official_idx
  on public.state_committee_hearing_attendance(official_id);
```

`session` is text per slice 5D convention. `openstates_committee_id` nullable because per-state scrapes may not include it.

### Migration 0045 — RLS for 5 new tables + pgTAP plan(18)

`alter table … enable row level security` on all 5 new tables (4 base tables + attendance join table). Read = `authenticated`, write = `service_role`. Matches slice 5D/5E/5F/5G RLS convention.

**pgTAP** (`state_community_rls.test.sql`):

- 5 × `has_table` (state_town_halls + state_district_offices + state_committee_hearings + state_committee_hearing_attendance)
- 5 × `is(relrowsecurity, true)`
- 1 × `format` CHECK rejects bad value on `state_town_halls`
- 1 × `kind` CHECK rejects bad value on `state_district_offices`
- 1 × `(source, external_id)` UNIQUE allows NULL external_id (NULLs distinct)
- 1 × `(source, external_id)` UNIQUE rejects duplicate with non-NULL external_id
- 1 × `state_committee_hearing_attendance` primary key uniqueness
- 1 × FK `official_id` RESTRICT on town_halls
- 1 × FK `official_id` RESTRICT on district_offices
- 1 × FK `official_id` RESTRICT on attendance
- 1 × FK `hearing_id` CASCADE on attendance (delete hearing → attendance gone)

Total = 18 plans. After this slice: 355 + 18 = 373 across 28 files.

## Adapter architecture

### File layout

```
packages/db/supabase/seed/state-community/
  shared.ts                          # types + 3 upsert helpers
  shared.test.ts                     # 6 vitest cases
  town-halls/
    townhallproject.ts               # NATIONWIDE adapter
    townhallproject.test.ts
    ca-leginfo.ts                    # per-state augment
    ca-leginfo.test.ts
    ny-senate.ts                     + .test.ts
    fl-doe.ts                        + .test.ts
    tx-capitol.ts                    + .test.ts
    mi-legislature.ts                + .test.ts
  district-offices/
    ca-leginfo.ts                    + .test.ts
    ny-senate.ts                     + .test.ts
    fl-doe.ts                        + .test.ts
    tx-capitol.ts                    + .test.ts
    mi-legislature.ts                + .test.ts
  committee-hearings/
    openstates-v3.ts                 # reuses 5F fetch+cache infra
    openstates-v3.test.ts
state-community-ingest.ts             # orchestrator
state-community-ingest.test.ts        # 6 vitest cases
fixtures/state-community/             # 11 fixture JSON files
```

11 adapters total: 1 nationwide (TownHallProject) + 5 per-state town halls + 5 per-state offices + 1 OpenStates hearings. v1 ships all 11 as stubs returning `[]`; production parsers per (source, state) are operator follow-up.

### Adapter interfaces (shared.ts)

```ts
export interface NormalizedTownHall {
  official_openstates_person_id?: string  // resolves to official_id in upsert
  legislator_name?: string                // fallback when openstates_person_id unavailable
  event_date: string                      // ISO date
  city?: string
  state: string
  format?: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  attendance_estimate?: number
  source_url: string
  source: string                          // 'townhallproject' | 'ca-leginfo' | ...
  external_id?: string                    // per-source dedupe key
}

export interface NormalizedDistrictOffice {
  official_openstates_person_id: string
  kind: 'district' | 'satellite' | 'capitol'
  street_1: string
  street_2?: string
  city: string
  state: string
  postal_code?: string
  phone?: string
  email?: string
  hours_text?: string
  source_url: string
}

export interface NormalizedCommitteeHearing {
  openstates_committee_id?: string
  state: string
  session: string
  hearing_date: string
  location?: string
  agenda_topic?: string
  source_url: string
  attendees_openstates_person_ids: string[]  // resolves to official_ids in attendance upsert
}

export interface StateCommunityAdapter {
  slug: string
  component: 'halls' | 'offices' | 'hearings'
  covered_states: string[]
  fetchEvents(opts: { client: Client; state?: string; session?: string }): Promise<Array<
    NormalizedTownHall | NormalizedDistrictOffice | NormalizedCommitteeHearing
  >>
}
```

### Three ingest paths

**Town halls** (run order):

1. TownHallProject nationwide adapter runs FIRST → seeds baseline rows tagged `source='townhallproject'`.
2. Per-state adapters run NEXT → UPSERT by `(source, external_id)`. Per-source isolation: per-state augment with `source='ca-leginfo'` doesn't collide with TownHallProject rows.

**District offices**: per-state only. 5 adapters. No nationwide source.

**Committee hearings**: OpenStates v3 single adapter. Reuses 5F's `.cache/openstates/committees/<state>.json` files. Task 1 verifies whether existing cache already includes `meetings[]`; if yes, no new fetcher. If no, extend `openstates-committees-fetch.ts` to include `?include=meetings`.

### Orchestrator CLI

```bash
pnpm seed:state-community --component=halls   --state=CA     # surgical
pnpm seed:state-community --component=offices                # all 5 states
pnpm seed:state-community --component=hearings --session=2025
pnpm seed:state-community --component=all     --skip-on-error
```

`--component=all` runs halls → offices → hearings in order. `--skip-on-error` keeps siblings running when one adapter throws. Default (no flag) aborts on first throw.

### Stats shape

```ts
export interface StateCommunityStats {
  component: 'halls' | 'offices' | 'hearings'
  adapter_slug: string
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
  skipped?: boolean
  skipReason?: string
}

export interface IngestStateCommunityStats {
  adaptersAttempted: number
  adaptersOk: number
  totalRowsUpserted: number
  totalOfficialsUnmatched: number
  byAdapter: StateCommunityStats[]
}
```

## Domain layer (@chiaro/officials)

All 3 hooks slot into `@chiaro/officials` (workspace stays at 10 packages).

### Types

```ts
export type StateTownHallRow             = Database['public']['Tables']['state_town_halls']['Row']
export type StateDistrictOfficeRow       = Database['public']['Tables']['state_district_offices']['Row']
export type StateCommitteeHearingRow     = Database['public']['Tables']['state_committee_hearings']['Row']
```

### Query keys

```ts
officialsKeys.stateTownHalls         = (officialId) => ['officials', 'stateTownHalls',         officialId] as const
officialsKeys.stateDistrictOffices   = (officialId) => ['officials', 'stateDistrictOffices',   officialId] as const
officialsKeys.stateCommitteeHearings = (officialId) => ['officials', 'stateCommitteeHearings', officialId] as const
```

### Fetchers + hooks

```ts
// Town halls: past 12 months + upcoming, ordered event_date desc
fetchOfficialStateTownHalls(client, officialId) → StateTownHallRow[]
useOfficialStateTownHalls(client, officialId): UseQueryResult<StateTownHallRow[], Error>

// District offices: all rows, ordered by custom kind priority (district → satellite → capitol)
// implemented via CASE WHEN in ORDER BY, since Postgres text-asc would put capitol first
fetchOfficialStateDistrictOffices(client, officialId) → StateDistrictOfficeRow[]
useOfficialStateDistrictOffices(client, officialId): UseQueryResult<StateDistrictOfficeRow[], Error>

// Committee hearings: 2-step (find hearing_ids via attendance.in('official_id', oid), then fetch hearings)
// Filters to most recent session by default
fetchOfficialStateCommitteeHearings(client, officialId, session?) → StateCommitteeHearingRow[]
useOfficialStateCommitteeHearings(client, officialId, session?): UseQueryResult<StateCommitteeHearingRow[], Error>
```

All 3 hooks use explicit `UseQueryResult<T, Error>` return annotation per TS2742 fix from slice 5D. Standard 5-min staleTime / 30-min gcTime.

Barrel re-exports added to `packages/officials/src/index.ts` up front (slice 5E lesson).

## UI: StateCommunityPresenceCard

### Web + mobile parallel components

**Web** (`apps/web/components/state/StateCommunityPresenceCard.tsx`):
- Card with title "Community Presence"
- Header summary row: `N town halls · M hearings attended · K offices` (em-dash for NULL signals, `0` for true zero per [[feedback-null-vs-zero-metrics]])
- 3 collapsible subsections (collapsed by default), each calling its own list component

Sub-components:
- `StateTownHallsList.tsx` — clickable rows opening `source_url`
- `StateCommitteeHearingsList.tsx` — caps at 3 visible + "and N more"
- `StateDistrictOfficesList.tsx` — address + phone + hours_text inline

**Mobile** mirrors with RN primitives. Jest-expo tests use mutable `let mockX = DEFAULT` pattern reset in `beforeEach` per [[feedback-jest-expo-dynamic-mock-pattern]].

### Tokens

`COLORS.signal.success` for "Hybrid"/"In person" format chips. `COLORS.signal.warning` for upcoming events (future `event_date`). `COLORS.neutral.textMuted` for dates/metadata. `COLORS.brand.text` for primary text. No inline hex (slice 5G token-vocabulary lesson).

### Detail-page swap

On both `apps/{web,mobile}/components/state/StateOfficialDetailPage.tsx`:

```tsx
<ComingSoonCard title="Community Presence" />
// becomes:
<StateCommunityPresenceCard officialId={official.id} />
```

Detail-page test placeholder count decrements by 1 (down to whatever remains — Ethics & Accountability typically).

## Testing matrix

**pgTAP** (16 new plans, 1 new file): see migration 0045 section.

**Vitest db tests** (~62 cases):
- `shared.test.ts`: 6 cases (3 upsert helpers × happy + idempotent)
- 11 adapter test files × 4 cases each = 44 cases
- `state-community-ingest.test.ts`: 6 cases (mirrors slice 5G orchestrator tests: all-components, --component filter, --state filter, --state filter skips non-covering adapter, throw + skip-on-error, default abort)
- Total db = 56–62 cases depending on per-adapter test variance

**Vitest officials**: 3 new hook test cases (one per new hook).

**Vitest web**: 6 cases for `StateCommunityPresenceCard` + 3 cases × 3 sub-list components = 15 web cases.

**Jest-expo**: ~12 mobile cases (card + 3 sub-list components).

**Officials integration**: +3 cases (anon SELECT denied / authd allowed / hearings join via attendance M:N).

## Acceptance criteria (15)

1. Migrations 0042–0045 apply cleanly; 4 new tables + 1 attendance join table present with correct FKs (RESTRICT to officials.id, CASCADE on attendance.hearing_id).
2. RLS enabled on all 5 new tables (4 base + attendance; read=authenticated, write=service_role).
3. `state_town_halls.(source, external_id)` UNIQUE allows NULL external_id (Postgres default); rejects non-NULL duplicates.
4. TownHallProject nationwide adapter + 5 per-state town-hall adapters ship as stubs returning `[]`.
5. 5 per-state district-office adapters ship as stubs.
6. OpenStates v3 committee-hearings adapter reuses 5F fetch+cache if `meetings[]` already present in cache; otherwise extends the existing fetcher in 0–1 commits.
7. `pnpm seed:state-community --component=halls|offices|hearings|all [--state=XX] [--skip-on-error]` works for all combos.
8. `useOfficialStateTownHalls` returns past-12-month + upcoming, ordered desc by event_date.
9. `useOfficialStateDistrictOffices` ordered by custom kind priority (district → satellite → capitol via CASE WHEN).
10. `useOfficialStateCommitteeHearings` joins via attendance M:N + filters to current session via 2-step PostgREST fetcher.
11. Web + mobile `StateCommunityPresenceCard` mounts on `/state-officials/[id]` replacing `ComingSoonCard('Community Presence')`.
12. Header summary row distinguishes NULL (no data ingested) from 0 (truly zero) via em-dash convention.
13. Subsections start collapsed; clicking toggles expansion; clicking a town-hall row opens `source_url`.
14. `pnpm -r typecheck` clean across 10 packages; Next 15 build clean; pgTAP 373 across 28 files.
15. CLAUDE.md slice 5H entry + Gotcha #13 + Quick start updated.

## Known v1 limitations (10)

1. **All 11 adapters ship as stubs returning `[]`.** Production parsers per (source, state) are operator follow-up. NRA-style centralized parser unlikely; each (source, state) tuple likely needs its own scraper.
2. **State coverage = core 5** (CA/NY/FL/TX/MI) for per-state adapters + TownHallProject nationwide overlay. Other 45 states out of v1 scope.
3. **`hours_text` is free-form** per state convention; no normalization to structured hours. UI renders as-is.
4. **`external_id` dedup is per-source-adapter responsibility.** Collisions across sources (same town hall ingested by both TownHallProject and a per-state adapter) won't dedup automatically — caller adapters set `external_id` deterministically per their source's stable id.
5. **Committee-hearing attendance accuracy depends on OpenStates `meetings[].roll_call[]`** or per-state augment populating it. Sparse for FL/TX per slice 5F hearings-count limitation. Reads as `0` for sparse-state legislators.
6. **Town-hall 12-month window is hardcoded** in `fetchOfficialStateTownHalls`. Operator-tunable via env or hook param later.
7. **No notification or calendar export** of upcoming town halls (intentionally out of scope).
8. **`kind` values capped at 3** (district/satellite/capitol). State-specific office types (e.g. "regional", "constituent service center") map to `satellite`. Operator could expand the CHECK constraint in a future slice if state conventions warrant.
9. **RLS matches slice 5D/5E/5F/5G** (`read=authenticated`, `write=service_role`); no fine-grained policies.
10. **Federal `town_halls` table stays unchanged** (CASCADE FK from migration 0022). State-side mirrors with RESTRICT (audit-closure precedent). Not retroactively flipped to keep federal slice 4 stable.

## Open implementation decisions (deferred to Task 1)

1. **Whether OpenStates v3 cache already includes `meetings[]`.** Slice 5F's fetcher requested `?include=memberships,subcommittees`. If `meetings[]` requires `?include=meetings`, Task 1 extends the fetcher in 1 commit before downstream tasks. Cache invalidation policy follows 5F's 7-day TTL.

2. **TownHallProject API surface.** As of 2026, TownHallProject (`townhallproject.com`) publishes an API at `townhallproject-86312.firebaseapp.com/api/townHalls`. Task 1 confirms availability + auth requirements. v1 ships a stub regardless; production parser is operator follow-up.

3. **`session` filtering for hearings**: hook defaults to "most recent session" by querying `select session from state_committee_hearings where official_id = … order by hearing_date desc limit 1`. Acceptable v1; operator may want explicit session in the future.

## Out of scope

- Constituent engagement signals (newsletter, mail response rate) — deferred indefinitely.
- Real-time event updates / push notifications.
- Federal-side Community Presence card on `/officials/[id]` (federal town_halls table exists but no UI card today — federal parity is a future cleanup).
- Stock disclosure tracking (slated for sub-slice 5I Ethics & Accountability).
- Ethics complaint history / recall history (slated for 5I).

## Estimated scope

~22 tasks across 7 phases:

- **Phase A** (4 tasks): migrations 0042–0045 + types regen
- **Phase B** (1 task): OpenStates `meetings[]` cache audit / fetcher extension
- **Phase C** (3 tasks): @chiaro/officials types/keys/queries/hooks/barrel + 3 hook tests
- **Phase D** (12 tasks): shared.ts + 11 adapters + orchestrator
- **Phase E** (4 tasks): Web card + 3 sub-list components + swap
- **Phase F** (4 tasks): Mobile parity + swap
- **Phase G** (3 tasks): officials integration + CLAUDE.md + final verify

Largest sub-slice since 5D state bills + votes. Plan should anticipate ~3000-line plan doc with verbatim code blocks per task.
