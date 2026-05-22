# Slice 7 — Production Parser Wiring (Mobilize.us + OpenStates YAML)

**Date:** 2026-05-22
**Branch:** `slice-7-parser-wiring`
**Scope:** Ship 2 production parsers against existing schema (no migrations): (1) `mobilize` adapter for nationwide state-legislator town halls (replaces dead TownHallProject), (2) fix `openstates-end-reason` adapter's YAML parsing + jurisdiction-format extraction.

## Why this slice

After 9 slices of state-officials redesign (5C–5I, slice 6 federal parity), 37 adapter stubs are deployed across slices 5G/5H/5I returning `[]`. None ship real data yet — operator follow-up has been deferred.

This slice **proves the operator parser-wiring pattern end-to-end** with 2 real parsers, validating the stub-shipping architecture:

1. **Mobilize.us** — nationwide town-hall coverage. Replaces the dead TownHallProject adapter from slice 5H (verified defunct; last commit 2021, 2 stale events). Mobilize.us API is live + free + no auth required + 2,439 active town halls including state legislators.

2. **OpenStates `end_reason` YAML parser fix** — slice 5I shipped `openstates-end-reason.ts` with `JSON.parse()` that fails silently on the slice 5C YAML cache. Two bugs in one task: YAML parsing + jurisdiction-format regex.

## Architecture summary

- **Zero schema work.** Migrations stay at 0050. pgTAP unchanged at 393 plans across 29 files.
- **Workspace stays at 10 packages.**
- **2 production parsers + 1 orchestrator update + 1 stub-deprecation:**
  - `mobilize.ts` (new) → writes `state_town_halls`
  - `openstates-end-reason.ts` (modified) → writes `state_official_events`
  - `state-community-ingest.ts` (modified) → swaps dispatch order
  - `townhallproject.ts` (modified JSDoc) → marked deprecated, stub retained
- **~10 tasks across 4 phases:** ~1500-line plan doc, smaller than 5xx/6 slices.

## Mobilize.us adapter (Section 1)

**Replaces:** `townhallproject` stub in slice 5H's `state-community/town-halls/` directory.

**File layout:**
```
packages/db/supabase/seed/state-community/town-halls/
  mobilize.ts                       # NEW
  mobilize.test.ts                  # NEW — 6 vitest cases
  townhallproject.ts                # MODIFIED — JSDoc deprecation note
  townhallproject.test.ts           # UNCHANGED — still passes
packages/db/supabase/seed/fixtures/state-community/
  mobilize.json                     # NEW — sample Mobilize API response (5-10 events)
packages/db/supabase/seed/state-community-ingest.ts   # MODIFIED — ADAPTERS_DEFAULT order
```

### API contract

```
GET https://api.mobilize.us/v1/events?event_types=town_hall&per_page=100&page=N
```

- **Auth:** none required for public events endpoint
- **Pagination:** response has `count` / `next` / `data[]`. Adapter fetches all pages until `next === null`.
- **Rate limits:** none documented as of 2026-05-22. Adapter does NOT preemptively rate-limit; standard retry-on-429 if encountered (matches slice 5D OpenStates v3 fetcher pattern).
- **No caching layer in v1.** ~24 requests per full run (2,400 events / 100 per page). Re-evaluate if Mobilize tightens rate limits.

### State-vs-federal classification

Mobilize's `event_type` is just `"TOWN_HALL"` — no structured federal-vs-state distinction. Adapter classifies via regex on `event.title` (with fallback to `event.description`):

```ts
const STATE_LEGISLATOR_RE = /\b(State Senator|State Rep\.?|State Representative|Assemblymember|Assemblyman|Assemblywoman|Delegate)\b/i
```

Events not matching → skipped + logged to `stats.errors` as `"federal or non-state event skipped: <title>"`.

### Name extraction

After classifying an event as state-legislator:

```ts
const NAME_RE = /(?:State Senator|State Rep\.?|State Representative|Assemblymember|Assemblyman|Assemblywoman|Delegate)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/

const m = event.title.match(NAME_RE)
const legislatorName = m ? m[1] : null  // e.g. "Mike Foote"
```

If no match → skip event + log `"could not extract legislator name: <title>"`.

### State extraction

Mobilize event shape includes `event.location.state` (2-letter code). Adapter prefers this; falls back to scanning `event.location.venue` (e.g., "1234 Main St, Sacramento, CA 95814").

### Name resolution

Reuse `resolveOfficialByName(client, { full_name, state })` from slice 5E (the per-state finance adapters). Case-insensitive exact match against `officials.full_name`.

```ts
const officialId = await resolveOfficialByName(client, {
  full_name: legislatorName,
  state: eventState,
})
if (!officialId) {
  stats.officialsUnmatched.push(`${legislatorName} (${eventState})`)
  continue
}
```

### Format derivation

```ts
function deriveFormat(event: MobilizeEvent): 'in_person' | 'virtual' | 'phone' | 'hybrid' {
  if (event.is_virtual === true) return 'virtual'
  const eventUrl = event.event_url ?? ''
  const hasVirtualLink = /zoom\.us|meet\.google|teams\.microsoft/.test(eventUrl)
  const hasPhysicalLocation = !!event.location?.venue
  if (hasVirtualLink && hasPhysicalLocation) return 'hybrid'
  if (hasVirtualLink) return 'virtual'
  return 'in_person'
}
```

### External_id

`external_id: mobilize-${event.id}` — stable per-event ID for dedup via the `(source, external_id)` UNIQUE constraint on `state_town_halls` (from slice 5H migration 0042).

### Adapter export shape

```ts
export const mobilize: StateCommunityAdapter = {
  slug: 'mobilize',
  component: 'halls',
  covered_states: ALL_50_STATES,
  async fetchEvents(opts) {
    const fetcher = (opts as { fetcher?: () => Promise<NormalizedTownHall[]> }).fetcher
    if (fetcher) return fetcher()
    return fetchAndNormalizeMobilizeEvents(opts.client, opts.state)
  },
}
```

`fetchAndNormalizeMobilizeEvents` is the production path — performs pagination, classification, name resolution, normalization. Returns `NormalizedTownHall[]` ready for the orchestrator's UPSERT loop.

### Stats reported

Adapter populates `StateCommunityStats` per existing slice 5H pattern:
- `rowsUpserted` (number of town halls successfully UPSERTed by orchestrator)
- `officialsMatched` (count where `resolveOfficialByName` succeeded)
- `officialsUnmatched: string[]` (names that didn't resolve — operator triages)
- `errors: string[]` (federal events skipped, parse failures, network errors)

### Orchestrator dispatch order update

In `state-community-ingest.ts` `ADAPTERS_DEFAULT`, the halls section currently is:

```ts
const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
  // halls first (TownHallProject nationwide baseline, then per-state augment)
  townhallproject,
  caLeginfoTownHalls, nySenateTownHalls, flDoeTownHalls, txCapitolTownHalls, miLegislatureTownHalls,
  ...
]
```

Updates to:

```ts
const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
  // halls first (Mobilize nationwide baseline, then per-state augment)
  // townhallproject is deprecated (TownHallProject defunct since 2021) — remains as no-op stub for backwards-compat.
  mobilize,
  caLeginfoTownHalls, nySenateTownHalls, flDoeTownHalls, txCapitolTownHalls, miLegislatureTownHalls,
  ...
]
```

The `townhallproject` adapter is removed from the dispatch list (its stub returning `[]` never produced data anyway). Its file stays in the seed dir with JSDoc note:

```ts
/**
 * @deprecated TownHallProject went defunct in 2021 (last commit 2021-07-21,
 * Firebase data stale). Replaced by `mobilize.ts` (slice 7). Stub retained
 * for backwards-compat — never produced data so no DB cleanup needed.
 */
```

## OpenStates YAML parser fix (Section 2)

**File:** `packages/db/supabase/seed/state-ethics/events/openstates-end-reason.ts`

**Two bugs:**

### Bug 1 — JSON.parse fails silently on YAML

Slice 5I shipped:

```ts
person = JSON.parse(raw) as OpenStatesPerson
```

Slice 5C cache uses YAML (`.yml` / `.yaml` extension). The `JSON.parse` throws on YAML content; the surrounding try/catch swallows it; the adapter returns `[]`. Silent failure documented in slice 5I memory.

**Fix:**

```ts
import { parse as parseYaml } from 'yaml'

for (const file of files) {
  if (!file.endsWith('.json') && !file.endsWith('.yml') && !file.endsWith('.yaml')) continue
  let person: OpenStatesPerson
  try {
    const raw = await readFile(join(dir, file), 'utf8')
    if (file.endsWith('.yml') || file.endsWith('.yaml')) {
      person = parseYaml(raw) as OpenStatesPerson
    } else {
      person = JSON.parse(raw) as OpenStatesPerson
    }
  } catch {
    continue
  }
  // ...rest unchanged
}
```

`yaml` package is already a workspace dep (used by `packages/db/supabase/seed/openstates-yaml-loader.ts` from slice 5C). No install needed.

### Bug 2 — jurisdiction-format string mismatch

Slice 5I adapter has:

```ts
if (opts.state && role.jurisdiction !== opts.state) continue
// ...
const stateMatch = role.jurisdiction?.match(/^[A-Z]{2}$/)
const state = stateMatch ? role.jurisdiction! : opts.state ?? ''
```

This assumes `role.jurisdiction === 'CA'` (2-letter code). But OpenStates `openstates/people` YAML files use the full `ocd-jurisdiction/country:us/state:ca/government` format (Open Civic Data ID convention).

**Fix:**

```ts
const JURISDICTION_RE = /state:([a-z]{2})\//i

function extractState(jurisdiction: string | undefined): string | null {
  if (!jurisdiction) return null
  const m = jurisdiction.match(JURISDICTION_RE)
  return m ? m[1]!.toUpperCase() : null
}

// In the role loop:
const roleState = extractState(role.jurisdiction)
if (opts.state && roleState !== opts.state) continue

const state = roleState ?? opts.state ?? ''
if (!state) continue
```

### Test fixture

Add a YAML fixture file under `packages/db/supabase/seed/fixtures/state-ethics/events-openstates-yaml/`:

```yaml
# ocd-person-fx-yaml-ca-1.yml
id: ocd-person/fx-yaml-ca-1
name: Test YAML CA1
roles:
  - type: lower
    jurisdiction: ocd-jurisdiction/country:us/state:ca/government
    start_date: '2023-01-03'
    end_date: '2025-11-15'
    end_reason: resigned
```

Add a 2-case test extension to `openstates-end-reason.test.ts`:

1. **YAML fixture walked successfully** — points `OPENSTATES_PEOPLE_CACHE_DIR` at the new fixtures dir, runs `fetchEvents({ client, state: 'CA' })`, asserts 1 resignation event emitted with `state='CA'`.

2. **Mixed JSON + YAML in same dir** — both formats parse correctly, both emit events.

## Acceptance criteria (10)

1. `mobilize.ts` exists at `packages/db/supabase/seed/state-community/town-halls/mobilize.ts` with `slug: 'mobilize'`, `component: 'halls'`, `covered_states: ALL_50_STATES`.
2. `ADAPTERS_DEFAULT` in `state-community-ingest.ts` puts `mobilize` FIRST in halls dispatch; `townhallproject` removed from the list (file kept with deprecation JSDoc).
3. Mobilize adapter fetches paginated Mobilize API + classifies state-legislator events via `STATE_LEGISLATOR_RE`; federal events skipped + logged to `stats.errors`.
4. Name extraction via `NAME_RE` handles all 7 title patterns: State Senator, State Rep, State Rep., State Representative, Assemblymember, Assemblyman, Assemblywoman, Delegate.
5. `resolveOfficialByName` from slice 5E reused for openstates_person_id lookup; unmatched names → `stats.officialsUnmatched`.
6. `format` derivation: `is_virtual=true` → `'virtual'`, zoom/meet URL + venue → `'hybrid'`, zoom/meet URL only → `'virtual'`, else → `'in_person'`.
7. `external_id: mobilize-${event.id}` enables stable dedup via existing `(source, external_id)` UNIQUE on `state_town_halls`.
8. `openstates-end-reason.ts` handles `.yml`/`.yaml` files via `parseYaml`; `.json` files via `JSON.parse`; YAML fixture test case passes.
9. `openstates-end-reason.ts` extracts 2-letter state code from `ocd-jurisdiction/country:us/state:XX/government` pattern via `JURISDICTION_RE`.
10. CLAUDE.md slice 7 entry + Gotcha #16 (Mobilize state-legislator regex heuristic + name extraction caveats).

## Known v1 limitations (8)

1. **Mobilize name-extraction is regex-heuristic.** Title patterns drift over time. Operator monitors `officialsUnmatched[]` rate. Future: ML-based name resolver or human-curated mapping table.
2. **Federal-vs-state classification depends on title text.** A state legislator's town hall titled vaguely without "State Senator/Rep" prefix won't classify → skipped. Edge case; operator hand-curates exceptions in future.
3. **No caching layer for Mobilize fetches.** Each `pnpm seed:state-community --component=halls` re-fetches paginated API. ~24 requests per run. Add 7-day cache (slice 5D pattern) if rate-limited later.
4. **Mobilize API has no documented rate limits** as of 2026-05-22. Production parser respects standard retry-on-429.
5. **`townhallproject` stub remains in the codebase** for backwards-compat. Marked deprecated in JSDoc. Future slice could delete.
6. **OpenStates YAML fix doesn't add new test fixtures for the JSON path.** Existing JSON-based tests cover that branch; new YAML test fixture covers the new branch.
7. **No production-data validation in CI.** Operator runs `pnpm seed:state-community --component=halls` manually post-merge to verify real data flow.
8. **Mobilize event-count cap absent.** v1 emits all matched events with no per-official cap. If a legislator has 100+ town halls, all 100+ get written. Hook layer + UI handle pagination separately (`useOfficialStateTownHalls` is single-step PostgREST without limit; might cap in a future slice if data volume warrants).

## Out of scope

- Caching layer for Mobilize (defer until rate-limited)
- Mobilize cancellation/update tracking (events change over time; v1 treats each fetch as authoritative + UPSERTs)
- Geocoding Mobilize event addresses for distance calculations
- Federal town-hall ingestion from Mobilize (federal table `town_halls` from migration 0022 lacks `source`/`external_id` columns — separate slice for federal parity)
- Wiring any of the other 35 stub adapters across 5G/5H/5I (operator follow-up; slice 7 ships 1 substantive parser + 1 bug fix as a proof-of-pattern)
- NRA-PVF / Ballotpedia / per-state state-ethics adapters (left as stubs)

## Estimated scope

**~10 tasks across 4 phases:**

- **Phase A** (3 tasks): mobilize adapter — fixture + helpers + production fetcher/classifier/normalizer
- **Phase B** (1 task): orchestrator update — swap dispatch order + townhallproject deprecation JSDoc
- **Phase C** (2 tasks): OpenStates YAML fix — yaml.parse + jurisdiction regex + YAML fixture + 2 new test cases
- **Phase D** (4 tasks): CLAUDE.md + workspace verify + memory + branch handoff

**Validates the slice-5xx stub-shipping pattern end-to-end.** Operator can mass-produce additional parsers using mobilize.ts as the template for nationwide overlays.
