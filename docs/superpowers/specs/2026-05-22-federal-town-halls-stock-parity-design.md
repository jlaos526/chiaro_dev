# Slice 8 — Federal town_halls + stock_transactions Schema Parity + Mobilize Adapter

**Date:** 2026-05-22
**Branch:** `slice-8-federal-parity`
**Scope:** Close 2 federal/state schema asymmetries (federal `town_halls` + `stock_transactions` lack source/external_id columns); ship federal `mobilize` adapter for town halls; extract shared helpers + clean up slice 7 `as FinanceState` cast.

## Why this slice

After slice 7 shipped 2 production parsers and validated the stub pattern, the federal/state asymmetries documented in slice 7 closure notes need cleanup:

1. **Federal `town_halls` (migration 0022)** lacks `source` + `external_id` columns — the state side added them in slice 5H migration 0042 for multi-adapter dedup. Without these columns, federal can't UPSERT via stable per-source event ids; the legacy `town-halls-ingest.ts` script does delete-and-replace per Congress window instead.

2. **Federal `stock_transactions` (migration 0022)** has the same asymmetry. State `state_stock_transactions` (slice 5I migration 0046) added `source` + `external_id` for the same reason.

3. **`resolveOfficialByName`** (slice 5E helper) lives in `state-finance/shared.ts` with `state: FinanceState` (5-state union). Slice 7 mobilize adapter casts `as FinanceState` for nationwide coverage — tech debt to move the helper to a general module and broaden its types.

4. **`deriveFormat`** helper lives in `state-community/town-halls/mobilize-helpers.ts` and is fully tier-agnostic. Federal mobilize adapter needs the same logic — extract to shared module instead of duplicating.

**Federal `town_halls.official_id` FK CASCADE→RESTRICT flip already shipped** in migration 0026 (slice 5B audit closure). Slice 7 closure memory was wrong about this; correct. No FK migration needed in this slice.

## Architecture summary

- **2 schema migrations:** 0051 town_halls parity + 0052 stock_transactions parity. Each adds `source` (NOT NULL after backfill) + `external_id` (nullable) + `(source, external_id)` UNIQUE. Existing rows backfill `source='legacy'`.
- **2 new shared modules:** `seed/shared/officials.ts` (resolveOfficialByName + Chamber union) + `seed/shared/town-halls-helpers.ts` (deriveFormat). 5 state-finance imports updated; slice 7 cast eliminated.
- **Federal mobilize adapter** at `seed/federal-community/town-halls/mobilize.ts` + helpers + fixture + tests. Writes to federal `town_halls` via new (source, external_id) UNIQUE.
- **Federal seed script** `seed/federal-community-mobilize-ingest.ts` + `pnpm seed:federal-town-halls-mobilize` CLI.
- **Zero new packages.** Workspace stays at 10.
- **~16 new pgTAP plans** (2 new files). After slice: 393 → 409 across 31 files.

## Schema (migrations 0051–0052)

### Migration 0051 — town_halls parity

```sql
-- Slice 8: federal town_halls source/external_id parity with state pattern (slice 5H 0042).
-- Existing rows get source='legacy' backfill; external_id stays NULL (NULLs distinct per PG default).

alter table public.town_halls
  add column source       text,
  add column external_id  text;

update public.town_halls
  set source = 'legacy'
  where source is null;

alter table public.town_halls
  alter column source set not null;

alter table public.town_halls
  add constraint town_halls_source_external_id_unique
  unique (source, external_id);

comment on column public.town_halls.source is
  'Adapter slug. mobilize = production parser (slice 8); legacy = pre-slice-8 ingest from town-halls-ingest.ts.';
comment on column public.town_halls.external_id is
  'Per-source stable id for UPSERT dedup. NULL allowed (NULLs distinct per Postgres default). Legacy rows have NULL.';
```

### Migration 0052 — stock_transactions parity

```sql
-- Slice 8: federal stock_transactions source/external_id parity with state pattern (slice 5I 0046).
-- No federal adapter wired in slice 8 — just schema parity. Existing rows get source='legacy' backfill.

alter table public.stock_transactions
  add column source       text,
  add column external_id  text;

update public.stock_transactions
  set source = 'legacy'
  where source is null;

alter table public.stock_transactions
  alter column source set not null;

alter table public.stock_transactions
  add constraint stock_transactions_source_external_id_unique
  unique (source, external_id);

comment on column public.stock_transactions.source is
  'Adapter slug. Federal stock-transactions adapter not yet wired in slice 8; legacy = pre-slice-8 ingest from stock-watcher-ingest.ts.';
```

### pgTAP plan(~16, 2 new files)

`town_halls_parity.test.sql` (8 plans):
- `has_column` source + external_id
- `source` is NOT NULL after migration
- `external_id` allows NULL
- `(source, external_id)` UNIQUE constraint exists
- (source, external_id) UNIQUE allows multiple NULL external_id rows
- (source, external_id) UNIQUE rejects duplicate non-NULL pair
- Legacy backfill: existing rows have `source='legacy'`
- FK `official_id` still RESTRICT (post-0026 + post-0051)

`stock_transactions_parity.test.sql` (8 plans): same shape for stock_transactions.

Total: 393 + 16 = 409 across 31 files.

## Shared helpers extraction

### `seed/shared/officials.ts` (NEW)

```ts
import type { Client } from 'pg'

export type Chamber =
  | 'state_house'
  | 'state_senate'
  | 'state_legislature'
  | 'federal_house'
  | 'federal_senate'

export async function resolveOfficialByName(
  client: Client,
  opts: { full_name: string; state: string; chamber: Chamber },
): Promise<string | null> {
  const res = await client.query<{ id: string }>(
    `select id from public.officials
     where lower(full_name) = lower($1) and state = $2 and chamber = $3
       and in_office = true
     limit 1`,
    [opts.full_name, opts.state, opts.chamber],
  )
  return res.rows[0]?.id ?? null
}
```

**5 imports to update** in `state-finance/fetch-{ca,ny,fl,tx,mi}.ts`:

```ts
// before:
import { resolveOfficialByName } from './shared.ts'
// after:
import { resolveOfficialByName } from '../shared/officials.ts'
```

**1 import to update** in slice 7 `state-community/town-halls/mobilize.ts`:

```ts
// before:
import { resolveOfficialByName, type FinanceState } from '../../state-finance/shared.ts'
// ...
state: state as FinanceState,
// after:
import { resolveOfficialByName, type Chamber } from '../../shared/officials.ts'
// ...
state,  // plain string, no cast needed
```

`state-finance/shared.ts` removes the duplicate `resolveOfficialByName` definition + the `FinanceState` type stays (still used internally by finance adapters). Re-export `resolveOfficialByName` from `'../shared/officials.ts'` for backwards-compat if any external consumer imports from `state-finance/shared.ts`.

### `seed/shared/town-halls-helpers.ts` (NEW)

```ts
interface EventForFormat {
  is_virtual: boolean
  event_url: string | null
  location: { venue?: string } | null
}

const VIRTUAL_URL_RE = /zoom\.us|meet\.google|teams\.microsoft/i

export function deriveFormat(event: EventForFormat): 'in_person' | 'virtual' | 'phone' | 'hybrid' {
  if (event.is_virtual === true) return 'virtual'
  const eventUrl = event.event_url ?? ''
  const hasVirtualLink = VIRTUAL_URL_RE.test(eventUrl)
  const hasPhysicalLocation = !!event.location?.venue
  if (hasVirtualLink && hasPhysicalLocation) return 'hybrid'
  if (hasVirtualLink) return 'virtual'
  return 'in_person'
}
```

Slice 7 `state-community/town-halls/mobilize-helpers.ts` removes local `deriveFormat` + `VIRTUAL_URL_RE`; re-exports `deriveFormat` from shared module for slice 7 tests' backwards-compat.

## Federal mobilize adapter

### File layout

```
packages/db/supabase/seed/federal-community/                          # NEW dir
  town-halls/
    mobilize.ts + .test.ts                # federal mobilize adapter
    mobilize-helpers.ts + .test.ts        # federal-tier classifier + name + chamber

packages/db/supabase/seed/
  federal-community-mobilize-ingest.ts + .test.ts    # standalone CLI orchestrator
  fixtures/federal-community/
    mobilize.json                         # federal-tier sample events (5-8)
```

### Federal classifier + chamber inference

```ts
// federal-community/town-halls/mobilize-helpers.ts

// Match federal titles. CRITICAL: must NOT match "State Senator" — uses negative
// lookbehind to skip events whose title prefixes the role with "State".
// Lookbehind is supported in Node 22+ / V8 9+ (deployed since 2021).
export const FEDERAL_LEGISLATOR_RE =
  /\b(?<!State\s)(?<!State\s+)(Senator|Representative|Congressman|Congresswoman|Rep\.?)\b/i

export const FEDERAL_NAME_RE =
  /(?<!State\s)(?<!State\s+)(?:Senator|Representative|Congressman|Congresswoman|Rep\.?)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,1})/

export function isFederalLegislatorEvent(title: string, description: string): boolean {
  return FEDERAL_LEGISLATOR_RE.test(title) || FEDERAL_LEGISLATOR_RE.test(description)
}

export function extractFederalLegislatorName(title: string): string | null {
  const m = title.match(FEDERAL_NAME_RE)
  return m ? m[1]! : null
}

export type FederalChamber = 'federal_house' | 'federal_senate'

export function inferFederalChamber(title: string): FederalChamber | null {
  // Order: senate first (Senator matches first), then house. Negative-lookbehind
  // on "State" prefix gates each.
  if (/\b(?<!State\s)Senator\b/i.test(title)) return 'federal_senate'
  if (/\b(?<!State\s)(Representative|Congressman|Congresswoman|Rep\.?)\b/i.test(title)) {
    return 'federal_house'
  }
  return null
}
```

If lookbehind support concerns arise in Node/V8/esbuild/vitest at implementation time, fall back to 2-step classifier:

```ts
function isFederalLegislatorEventFallback(title: string, description: string): boolean {
  const combined = `${title} ${description}`
  const matches = /\b(Senator|Representative|Congressman|Congresswoman|Rep\.?)\s+[A-Z]/i.test(combined)
  if (!matches) return false
  // Reject if any match is preceded by "State"
  return !/State\s+(Senator|Representative|Rep\.?)/i.test(combined)
}
```

Implementer task tests verify whichever approach works in the build pipeline.

### Federal adapter

```ts
// federal-community/town-halls/mobilize.ts

import type { Client } from 'pg'
import {
  isFederalLegislatorEvent,
  extractFederalLegislatorName,
  inferFederalChamber,
  type FederalChamber,
} from './mobilize-helpers.ts'
import { deriveFormat } from '../../shared/town-halls-helpers.ts'
import { resolveOfficialByName, type Chamber } from '../../shared/officials.ts'

interface MobilizeEvent {
  id: number
  title: string
  description?: string
  event_type: string
  is_virtual: boolean
  event_url: string | null
  location: { venue?: string; locality?: string; region?: string } | null
  timeslots: Array<{ start_date: number }>
}

interface FederalTownHallRow {
  bioguide_id?: string
  official_openstates_person_id?: string
  legislator_name: string
  event_date: string
  city?: string
  state: string
  format?: 'in_person' | 'virtual' | 'phone' | 'hybrid'
  attendance_estimate?: number
  source_url: string
  source: 'mobilize'
  external_id: string
}

/**
 * Parse Mobilize events into FederalTownHallRow[]. Pure function; one
 * client.query per event for name → official_id resolution. Exported for tests.
 */
export async function parseFederalMobilizeEvents(
  events: MobilizeEvent[],
  client: Client,
): Promise<FederalTownHallRow[]> {
  const out: FederalTownHallRow[] = []
  for (const event of events) {
    const description = event.description ?? ''
    if (!isFederalLegislatorEvent(event.title, description)) continue

    const name = extractFederalLegislatorName(event.title)
      ?? extractFederalLegislatorName(description)
    if (!name) continue

    const state = event.location?.region
    if (!state || !/^[A-Z]{2}$/.test(state)) continue

    const chamber = inferFederalChamber(event.title) ?? inferFederalChamber(description)
    if (!chamber) continue

    const officialId = await resolveOfficialByName(client, {
      full_name: name, state, chamber: chamber as Chamber,
    })
    if (!officialId) continue

    const startTs = event.timeslots[0]?.start_date
    if (!startTs) continue
    const eventDate = new Date(startTs * 1000).toISOString().slice(0, 10)

    out.push({
      legislator_name: name,
      event_date: eventDate,
      city: event.location?.locality,
      state,
      format: deriveFormat({
        is_virtual: event.is_virtual,
        event_url: event.event_url,
        location: event.location,
      }),
      source_url: event.event_url ?? `https://www.mobilize.us/events/${event.id}/`,
      source: 'mobilize',
      external_id: `mobilize-${event.id}`,
    })
  }
  return out
}

// Production fetcher (paginated); fails-empty on network errors.
async function fetchAndNormalizeFederal(client: Client): Promise<FederalTownHallRow[]> {
  // ... pagination logic identical to slice 7 state mobilize
}
```

### Federal seed script

```ts
// federal-community-mobilize-ingest.ts (NEW standalone CLI)

import { Client } from 'pg'
import { fetchAndNormalizeFederal } from './federal-community/town-halls/mobilize.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface FederalMobilizeStats {
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
}

export async function ingestFederalTownHallsMobilize(
  opts: { client?: Client; skipOnError?: boolean } = {},
): Promise<FederalMobilizeStats> {
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const stats: FederalMobilizeStats = {
    rowsUpserted: 0, officialsMatched: 0, officialsUnmatched: [], errors: [],
  }
  try {
    const events = await fetchAndNormalizeFederal(client)
    for (const e of events) {
      try {
        await client.query(`
          insert into public.town_halls (
            official_id, event_date, city, state, format,
            attendance_estimate, source_url, source, external_id
          ) values (
            (select id from public.officials where lower(full_name) = lower($1)
               and state = $2 and chamber = $3 and in_office = true limit 1),
            $4, $5, $6, $7, $8, $9, 'mobilize', $10
          )
          on conflict (source, external_id) where external_id is not null
          do update set
            event_date = excluded.event_date,
            city = excluded.city,
            format = excluded.format,
            source_url = excluded.source_url
        `, [
          e.legislator_name, e.state, /* chamber via separate resolve in parseFederalMobilizeEvents */,
          e.event_date, e.city ?? null, e.state, e.format ?? null,
          e.attendance_estimate ?? null, e.source_url, e.external_id,
        ])
        stats.rowsUpserted += 1
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push((err as Error).message)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }
  return stats
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const skipOnError = process.argv.includes('--skip-on-error')
  ingestFederalTownHallsMobilize({ skipOnError })
    .then(stats => {
      console.log(`Federal town halls (mobilize) ingest:`)
      console.log(`  rows upserted:        ${stats.rowsUpserted}`)
      console.log(`  officials matched:    ${stats.officialsMatched}`)
      console.log(`  officials unmatched:  ${stats.officialsUnmatched.length}`)
      console.log(`  errors:               ${stats.errors.length}`)
      process.exit(stats.errors.length === 0 ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
```

Add `"seed:federal-town-halls-mobilize": "tsx supabase/seed/federal-community-mobilize-ingest.ts"` to `packages/db/package.json`.

**Does NOT touch** existing `town-halls-ingest.ts` (legacy bioguide_id-based pipeline). Future slice could unify them.

## Acceptance criteria (12)

1. Migration 0051 applies cleanly; `town_halls.source` NOT NULL with `'legacy'` backfill; `external_id` nullable; `(source, external_id)` UNIQUE present.
2. Migration 0052 applies cleanly; same parity on `stock_transactions`.
3. `seed/shared/officials.ts` exists; `resolveOfficialByName` accepts general `Chamber` union covering state + federal.
4. `seed/shared/town-halls-helpers.ts` exists; `deriveFormat` exported.
5. All 5 `state-finance/fetch-XX.ts` imports updated to `'../shared/officials.ts'`.
6. Slice 7 `state-community/town-halls/mobilize.ts` drops `as FinanceState` cast; uses general `Chamber` type.
7. `federal-community/town-halls/mobilize.ts` exists; classifies federal titles via `FEDERAL_LEGISLATOR_RE` with negative-lookbehind on "State" prefix.
8. Federal mobilize adapter writes to `town_halls` (not `state_town_halls`) with `source='mobilize'` + `external_id='mobilize-${event.id}'`.
9. `inferFederalChamber()` maps "Senator" (no State prefix) → `federal_senate`; "Representative/Congressman/Rep." (no State prefix) → `federal_house`.
10. `pnpm seed:federal-town-halls-mobilize [--skip-on-error]` script works; idempotent re-run via UNIQUE.
11. `pnpm -r typecheck` clean; pgTAP 409 across 31 files; Next 15 build clean.
12. CLAUDE.md slice 8 entry + Gotcha #17 (federal/state mobilize classifier asymmetry: negative-lookbehind on State prefix; chamber inference order; lookbehind fallback to 2-step if needed).

## Known v1 limitations (8)

1. **Federal `stock_transactions` adapter not in scope.** Just schema parity. No live federal STOCK Act data source wired yet — operator follow-up. Future slice could mirror slice 7 mobilize pattern with `house-stock-watcher.com` or `senatestockwatcher.com` HTML scrape.
2. **Legacy federal `town-halls-ingest.ts` script unchanged.** Continues to delete-and-replace via bioguide_id resolution. New `seed:federal-town-halls-mobilize` is a separate orchestrator. Future slice could unify them into a shared dispatch matching state-community pattern.
3. **`FEDERAL_LEGISLATOR_RE` uses negative-lookbehind** — requires Node 22+ / V8 9+. Verify lookbehind support in implementer's environment; if issues, fall back to 2-step classifier (match base pattern, then filter out "State" prefix).
4. **Chamber inference fails for joint federal titles** — "Senator-Representative Joint Town Hall" would classify as senate (Senator matched first). Edge case; not handled in v1.
5. **NE unicameral case stays in state tier** — no overlap with federal mobilize classification.
6. **No CI validation of real federal Mobilize fetches.** Same as slice 7 — operator runs manually post-merge.
7. **Backfill `source='legacy'`** applies to ALL existing federal town_halls + stock_transactions rows uniformly. Operator can re-classify legacy rows via UPDATE if needed.
8. **`(source, external_id)` UNIQUE doesn't deduplicate legacy rows** with `external_id=NULL`. Legacy rows that share the same official_id + event_date could remain duplicated. Operator manually dedupes if needed.

## Out of scope

- Federal `stock_transactions` production adapter (schema-only this slice)
- Refactoring legacy `town-halls-ingest.ts` into multi-adapter orchestrator
- Federal `district_offices` schema parity (state has `kind` + `hours_text` columns federal lacks; per slice 6 Task 4 discovery)
- 7-day on-disk cache for mobilize (slice 5D pattern); defer until rate-limited
- Federal `stock_transactions.days_late` CHECK constraint changes (federal uses 45-day; state 30-day; intentional asymmetry per slice 5I)

## Estimated scope

**~14 tasks across 5 phases:**

- **Phase A** (3 tasks): migrations 0051 + 0052 + types regen + 2 pgTAP files
- **Phase B** (2 tasks): `seed/shared/officials.ts` + `seed/shared/town-halls-helpers.ts` + 5 state-finance import updates + slice 7 cast cleanup
- **Phase C** (3 tasks): federal mobilize-helpers + adapter + fixtures
- **Phase D** (2 tasks): federal-community-mobilize-ingest CLI + tests
- **Phase E** (4 tasks): CLAUDE.md + workspace verify + memory + handoff

Plan should anticipate ~2000-line plan doc.

**Closes 2 federal/state schema asymmetries** (town_halls + stock_transactions) + cleans up slice 7's cross-domain cast tech debt + builds federal mobilize parity infrastructure as the template for future federal-tier production parsers.
