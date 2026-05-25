# Slice 15 — NY-side production parsers (town_halls + district_offices + ethics combined)

**Date:** 2026-05-24
**Scope tier:** Compressed-to-full slice boundary (~24 files; 3 parsers, 2 new subfolders, 4 HTML fixtures, 6 new + 4 modified tests)
**Predecessor slices:** 5H (state community presence stubs), 5I (state ethics stubs), 9 (HTML-scrape pattern + Ballotpedia recall coverage), 11 (subfolder layout + shared helper pattern), 12 (audit that drove slice 15 scope), 13 (deprecation precedent), 14 (RNW a11y patterns — not directly relevant but recent).

## Goal

Ship 3 NY-side bucket-A production parsers from the slice 12 audit: NY town_halls (Senate-side), NY district_offices (Assembly + Senate), NY COELIG ethics enforcement (combined parser writing to both `state_ethics_complaints` and `state_official_events`). Closes the 3 highest-leverage NY stubs and validates the combined-parser pattern (1 source → 2 schema sinks).

## Motivation

Slice 12's discovery audit identified 6 firm bucket-A parsers. Four of them are NY-side per "NY is the gold-standard data state for legislators." Slice 15 ships 3 NY parsers (the 4th, NY FDS, is PDF-only — deferred to a future PDF-parsing slice). Audit-recommended single-slice scope was "~4 parsers, NY-weighted"; this slice ships the cleanest 3.

The combined-parser pattern is novel for this codebase. NY COELIG's `enforcement-actions` table contains both ethics complaints (the regulatory case record) and campaign-finance-violation events (the public-record event date + penalty). Modeling both as separate adapters sharing a fetch+parse helper preserves the `StateEthicsAdapter` interface contract (each adapter has one `component` field) while avoiding code duplication.

## Key design decisions

1. **Slug naming: keep `ny-jcope` for ethics adapter, use `ny-coelig` for the new helper directory.** JCOPE (Joint Commission on Public Ethics) was renamed to COELIG (Commission on Ethics and Lobbying in Government) in 2022. The adapter slug stays `ny-jcope` for back-compat with the existing slice 5I stub + future `state_ethics_orgs` DB row continuity. The directory holding the new shared helper code uses `ny-coelig` (current agency name; clearer to future readers).

2. **`ny-senate` slug covers both Senate and Assembly for district_offices.** The existing stub uses `ny-senate` as the slug. The slug is the orchestrator dispatch key; it doesn't need to match every source URL hostname. The adapter's JSDoc notes "covers both NY State Senate + Assembly despite the slug naming."

3. **Combined parser via shared helper, not via interface refactor.** Option considered: change `StateEthicsAdapter` to allow one adapter to write to multiple sinks. Rejected — too invasive for one use case. Chosen: keep 2 adapter exports (`nyJcopeComplaints` + `nyJcopeEvents`), both call a shared `fetchEnforcementActions()` helper. Acceptable inefficiency: 2 HTTP fetches per orchestrator run instead of 1.

4. **District_offices subfolder pattern (slice 11 LCV precedent).** Two source URLs (Assembly directory + per-senator pages) → two parser files + one orchestrator. Matches `state-scorecards/lcv/{index,helpers,mi,co}.ts` shape.

5. **Town halls remains single-file (no subfolder).** One source URL, one HTML scrape. Subfolder would be overkill.

6. **Per-senator fetch loop for NY Senate offices.** No single-page directory exists for Senate side; need to iterate over 63 senators via `nysenate.gov/senators/{slug}/contact`. 1-req/sec courtesy throttle. Slug derived from `officials.full_name` (lowercase + hyphenated); failure-mode is per-senator skip + log to errors.

7. **`event_type` for COELIG events = `'campaign_finance_violation'`** (not `recall_*` or `expulsion`). Per slice 9 Ballotpedia precedent, recall/expulsion is sourced nationwide via the slice 9 adapter. NY COELIG is exclusively campaign-finance-violation territory.

8. **Audit-derived HTML selectors are best-guess; implementer verifies at scaffold time.** The slice 12 discovery audit described structure as "server-rendered table" / "single-page directory" without exhaustive selector capture. Implementer should fetch real URLs during Task 0-style discovery before writing the full parser body. Failure mode: parser misses rows → `stats.errors[]` logs surface for operator triage.

## Architecture

### Town halls: `state-community/town-halls/ny-senate.ts` (MODIFY)

Single-source HTML scrape from `nysenate.gov/events?event-type=town_hall`. Production fetcher exported as the adapter's `fetchEvents`. Parser exported as `parseNysenateEventsHtml(html) → ParsedEvent[]`.

Event structure: `<article class="event-card">` containing event link, byline (senator name), `<time datetime>`, location, format. Parser extracts each field; chamber inferred as `state_senate` (Assembly-side defers per audit bucket-G). `format` field uses the existing `deriveFormat(formatText, location)` helper from `seed/shared/town-halls-helpers.ts`.

### District offices: `state-community/district-offices/ny-senate/` (NEW SUBFOLDER)

```
ny-senate/
  index.ts                 # adapter export; dispatches BOTH fetchers + concatenates
  assembly.ts              # parseNyAssemblyDirectoryHtml + fetchAssemblyOffices
  senate.ts                # parseNySenatorContactHtml + fetchSenateOffices (per-senator loop)
```

Old flat `ny-senate.ts` + `.test.ts` deleted; subfolder takes over.

**Assembly side:** Single-page `nyassembly.gov/mem/` directory with all 150 AMs. One HTTP fetch; parser extracts `member-card` blocks. Emits one `NormalizedDistrictOffice` row per non-null address (kind: 'capitol' for Albany, 'district' for local).

**Senate side:** Per-senator fetch loop iterating over the 63 NY senators. Query `officials` table for the legislator list; derive `slug` from `full_name` (lowercase + hyphenated); fetch `nysenate.gov/senators/{slug}/contact` for each. 1-req/sec courtesy throttle between fetches. Parser extracts Albany + District office text under labeled headings via regex (audit: HTML is "unstructured `<br>`-separated text — parseable via regex/heuristic, not microdata"). Same dual-emission as Assembly side.

**Slug derivation port-time verification:** the implementer fetches 2-3 real senator URLs during Task 3 scaffolding to confirm the slug pattern. If the derivation fails for some senators (e.g., URL uses `senator-jane-doe` instead of `jane-doe`), the loop logs to errors + skips per-senator; doesn't crash the slice.

### Ethics combined: `state-ethics/ny-coelig/` (NEW SUBFOLDER) + 2 adapter MODIFY

```
state-ethics/ny-coelig/
  shared.ts                # fetchEnforcementActions() → { complaints, events, errors }
  shared.test.ts           # parser + classifier + status-mapping tests
state-ethics/complaints/ny-jcope.ts          # MODIFY — calls shared.fetchEnforcementActions, returns .complaints
state-ethics/events/ny-jcope.ts              # MODIFY — calls shared.fetchEnforcementActions, returns .events
```

**Combined parser shape:**

```ts
export interface CoeligEnforcementResult {
  complaints: NormalizedEthicsComplaint[]
  events: NormalizedOfficialEvent[]
  errors: string[]
}

export async function fetchEnforcementActions(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<CoeligEnforcementResult>
```

**Per-row dual emission:** each parsed row from the enforcement table emits BOTH a complaint row (regulatory case record) AND an event row (public-record `campaign_finance_violation` with date + penalty). Same source_url for both (the COELIG case detail page); external_id parsed from `/cases/{id}` URL slug (with `complaint-` / `event-` prefix to disambiguate the two sink rows).

**Classifier (filter non-legislator rows):**

```ts
const LEGISLATOR_AGENCY_RE = /\b(NY State (?:Assembly|Senate)|State Legislature)\b/i
```

Drops rows where the agency column refers to executive-branch / county / lobbying agencies (the COELIG table covers more than just legislators). Chamber inferred from the agency text: "Assembly" → `state_house`, "Senate" → `state_senate`.

**Status enum mapping:**

```ts
function mapStatus(text: string): NormalizedEthicsComplaint['status'] {
  const norm = text.trim().toLowerCase()
  if (norm.includes('open') || norm.includes('pending')) return 'open'
  if (norm.includes('dismiss')) return 'dismissed'
  if (norm.includes('settle') || norm.includes('consent')) return 'settled'
  if (norm.includes('sanction') || norm.includes('penalty') || norm.includes('order')) return 'sanctioned'
  return 'closed_no_action'
}
```

Defends against COELIG status-text variants. Five canonical enum values from migration 0048.

### Per-adapter integration

Each ethics adapter (complaints + events) is reduced to a thin wrapper:

```ts
export const nyJcopeComplaints: StateEthicsAdapter = {
  slug: 'ny-jcope',
  component: 'complaints',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedEthicsComplaint[]> {
    const injected = (opts as never as { fetcher?: () => Promise<NormalizedEthicsComplaint[]> }).fetcher
    if (injected) return injected()
    const { complaints } = await fetchEnforcementActions(opts.client, {})
    return complaints
  },
}
```

Mirror structure for `nyJcopeEvents`.

## Files

**New (12 files):**

- `packages/db/supabase/seed/state-community/district-offices/ny-senate/index.ts`
- `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.ts`
- `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.ts`
- `packages/db/supabase/seed/state-community/district-offices/ny-senate/index.test.ts`
- `packages/db/supabase/seed/state-community/district-offices/ny-senate/assembly.test.ts`
- `packages/db/supabase/seed/state-community/district-offices/ny-senate/senate.test.ts`
- `packages/db/supabase/seed/state-ethics/ny-coelig/shared.ts`
- `packages/db/supabase/seed/state-ethics/ny-coelig/shared.test.ts`
- `packages/db/supabase/seed/fixtures/state-community/ny-senate-events.html`
- `packages/db/supabase/seed/fixtures/state-community/ny-assembly-mem.html`
- `packages/db/supabase/seed/fixtures/state-community/ny-senator-contact.html`
- `packages/db/supabase/seed/fixtures/state-ethics/ny-coelig-enforcement.html`

**Deleted (2 files):**

- `packages/db/supabase/seed/state-community/district-offices/ny-senate.ts` (replaced by subfolder)
- `packages/db/supabase/seed/state-community/district-offices/ny-senate.test.ts`

**Modified (5 files):**

- `packages/db/supabase/seed/state-community/town-halls/ny-senate.ts` (replace stub with production fetcher)
- `packages/db/supabase/seed/state-community/town-halls/ny-senate.test.ts` (parser + fetcher tests)
- `packages/db/supabase/seed/state-ethics/complaints/ny-jcope.ts` (call shared helper)
- `packages/db/supabase/seed/state-ethics/events/ny-jcope.ts` (call shared helper)
- `packages/db/supabase/seed/state-ethics/complaints/ny-jcope.test.ts` (parser + dispatch tests)
- `packages/db/supabase/seed/state-ethics/events/ny-jcope.test.ts` (parser + dispatch tests)
- `CLAUDE.md` (slice 15 entry; no new Gotcha required)

**Total: ~24 files** (12 new + 2 deleted + 5+2 modified). Compressed-to-full slice boundary.

## Tests

| Test file | Count |
|---|---|
| `state-community/town-halls/ny-senate.test.ts` | 5 |
| `state-community/district-offices/ny-senate/index.test.ts` | 3 |
| `state-community/district-offices/ny-senate/assembly.test.ts` | 4 |
| `state-community/district-offices/ny-senate/senate.test.ts` | 4 |
| `state-ethics/ny-coelig/shared.test.ts` | 8 |
| `state-ethics/complaints/ny-jcope.test.ts` | 3 |
| `state-ethics/events/ny-jcope.test.ts` | 3 |

**Total new test cases: ~30.**

## Acceptance criteria

1. `pnpm --filter @chiaro/db typecheck` green
2. `pnpm --filter @chiaro/db test --run state-community/town-halls/ny-senate` — 5 tests PASS
3. `pnpm --filter @chiaro/db test --run state-community/district-offices/ny-senate` — 11 tests PASS across 3 files
4. `pnpm --filter @chiaro/db test --run state-ethics/ny-coelig` — 8 tests PASS
5. `pnpm --filter @chiaro/db test --run state-ethics/complaints/ny-jcope` — 3 tests PASS
6. `pnpm --filter @chiaro/db test --run state-ethics/events/ny-jcope` — 3 tests PASS
7. `pnpm -r typecheck` green across 11 packages
8. `pnpm --filter @chiaro/web build` green
9. State stub count: 19 active → 16 active (3 NY stubs now production parsers)

## Commit sequence

5 commits on `slice-15-ny-parsers`:

1. `feat(state-community): NY town_halls production parser` (1 source file + 1 fixture + 5 tests)
2. `feat(state-community): NY district_offices Assembly directory parser` (subfolder scaffold + assembly.ts + 1 fixture + 4 tests)
3. `feat(state-community): NY district_offices per-senator fetch loop + dispatch` (senate.ts + index.ts + 1 fixture + 7 tests across 2 files)
4. `feat(state-ethics): NY COELIG enforcement combined parser` (ny-coelig/shared.ts + 2 adapter modifies + 1 fixture + 14 tests across 3 files)
5. `docs: slice 15 closure — CLAUDE.md entry + memory`

Squash-merge to master per established slice-handoff pattern.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| HTML structure on audit-derived selectors drifts (e.g. `article.event-card` doesn't match real DOM) | Medium | Implementer fetches a real URL during Task 1-4 scaffold to verify selectors before writing the full parser body. Fixtures committed to repo are frozen snapshots; production drift surfaces via `stats.errors[]`. |
| NY senator slug derivation (`full_name → slug`) doesn't match the URL pattern for some senators | Medium | Implementer verifies with 2-3 real senator URLs during Task 3 scaffold. Per-senator failure mode: log to errors + skip senator; production parser handles gracefully. |
| `LEGISLATOR_AGENCY_RE` misses an agency variant (e.g. "NY Senate" without "State" prefix) | Low | Audit-derived regex tested against fixture rows; per-row classification logged via `errors` on miss. Operator triages future drift. |
| `external_id` extraction from `/cases/{id}` URL fails when COELIG changes URL pattern | Low | Fallback to synthetic `${full_name}-${date}` ID. Documented in helper JSDoc. |
| Double-fetch of COELIG URL (each adapter fetches independently) wastes 1 HTTP request | Acknowledged | v1 inefficiency; documented. Cross-adapter memoization deferred to future slice. |
| `nysenate.gov/events?event-type=town_hall` URL param doesn't actually filter as audited | Medium | If filter doesn't work, parser filters in-memory by extracting event-type from card text. Implementer verifies at Task 1 scaffold. |
| NY Senate `/senators/{slug}/contact` page returns 404 for senators whose name format doesn't match audit's heuristic | Medium | Per-senator try/catch + log to errors. Slice ships even with partial Senate coverage. |
| Fetch volume (~68 HTTP requests per run) exceeds NY government site implicit rate limits | Low | 1-req/sec throttle on the 63-senator loop. Other parsers do 1-2 fetches each. Total runtime ~60-70 seconds; well under reasonable rate-limit thresholds. |

## Non-goals

- NY FDS (financial disclosures) PDF parsing — deferred to a future PDF-parsing slice
- NY Assembly side of town_halls — bucket-G per audit; defers to Mobilize.us nationwide
- Recall/expulsion events from NY COELIG — Ballotpedia (slice 9) already covers nationwide
- Cross-adapter memoization for the double-fetch of COELIG URL — v1 inefficiency acknowledged
- Other 3 audit-recommended parsers (CA + MI district_offices, TX ethics) — slice 16 scope
- `state_scorecard_orgs` row migration for ny-jcope → ny-coelig slug rename — slug stays legacy
- New Gotcha additions — Gotcha #18 (HTML-scrape constraints) + Gotcha #19f (createElement escape hatch) already cover the patterns used here

## Cross-references

- Slice 5H spec (`docs/superpowers/specs/2026-05-22-state-community-presence-design.md`) — original community presence stubs
- Slice 5I spec (`docs/superpowers/specs/2026-05-22-state-ethics-accountability-design.md`) — original ethics stubs (including the now-overspecified state_stock_transactions table dropped in slice 13)
- Slice 11 spec (`docs/superpowers/specs/2026-05-23-lcv-scorecards-design.md`) — subfolder layout + helpers pattern
- Slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) — drove slice 15 scope
- Gotcha #18 in CLAUDE.md — HTML-scrape adapter constraints (state-name URLs, browser UA, chamber inference)
- Gotcha #21 in CLAUDE.md — state vs federal schema asymmetry (stock_transactions over-specification)

## Open questions

None. All 5 brainstorming sections approved. Port-time decisions (selector verification, slug derivation) are documented as Task-level verification steps in the implementation plan.
