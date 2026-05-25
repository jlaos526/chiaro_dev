# CA + MI district_offices + TX ethics combined — slice 16 design

**Status:** approved 2026-05-24 (verbal — brainstorming flow)
**Builds on:** slice 15 NY parsers (`docs/superpowers/specs/2026-05-24-ny-parsers-design.md`) + slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`)

## Goal

Ship 3 production parsers replacing slice 5H/5I stubs:
1. CA district_offices (Senate single-page roster + Assembly per-member loop)
2. MI district_offices (Senate per-senator loop + House per-rep loop)
3. TX ethics combined parser (1 HTML source → 2 schema sinks: `state_ethics_complaints` + `state_official_events`)

Plus hoist `parseAddressText` from slice 15's `ny-senate/assembly.ts` to a district-office-scoped shared module.

Slice 16 validates that the slice 15 patterns (subfolder layout, combined-parser, per-member loop with throttle, address parsing, `vi.spyOn(globalThis,'fetch')` test stubbing) generalize beyond NY. Hits 3 of the remaining bucket-A ship candidates from the slice 12 audit (#2 CA district_offices, #4 MI district_offices, #6 TX ethics combined).

## Non-goals

- **No PDF parsing.** TX per-case sworn-complaint PDFs at `ethics.state.tx.us/data/enforcement/sworn_complaints/<year>/<id>.pdf` deferred to a future PDF-parsing slice (NY FDS + MI PFD already pending in that slice).
- **No schema work.** pgTAP plan count stays at 402. No new migrations.
- **No special TLS-retry wrapper for MI House.** Existing try/catch + silent skip is sufficient v1; slice 17 adds retry if production pass rate justifies.
- **No `state_ethics_orgs` row insertion / mutation.** Adapter slugs match existing slice 5H/5I stub naming for back-compat.
- **No new workspace deps.** `cheerio` already installed since slice 9; everything else is standard pg + vitest.

## Architecture

```
state-community/district-offices/
  _shared.ts                                            # NEW: parseAddressText hoisted from slice 15
  ca-leginfo/                                           # NEW: replaces ca-leginfo.ts stub
    index.ts                                            # adapter export; Promise.all dispatch
    senate.ts                                           # senate.ca.gov/senators single-page (40)
    assembly.ts                                         # assembly.ca.gov/assemblymembers/{n} per-member (80)
    index.test.ts + senate.test.ts + assembly.test.ts
  mi-legislature/                                       # NEW: replaces mi-legislature.ts stub
    index.ts                                            # adapter export; Promise.all dispatch
    senate.ts                                           # senate.michigan.gov/senators per-senator (38)
    house.ts                                            # house.mi.gov/AllRepresentatives per-rep (110)
    index.test.ts + senate.test.ts + house.test.ts
  ny-senate/                                            # MODIFIED: assembly.ts + senate.ts re-import parseAddressText
    assembly.ts                                         # parseAddressText removed; import from ../_shared.ts
    senate.ts                                           # import path updated to ../_shared.ts
state-ethics/tx-tec/                                    # NEW directory mirroring ny-coelig/ pattern
  shared.ts                                             # fetchSwornComplaintOrders → {complaints, events, errors}
  shared.test.ts
state-ethics/complaints/tx-tec.ts                       # MODIFIED: wraps shared helper
state-ethics/complaints/tx-tec.test.ts                  # MODIFIED: 3 wrapper tests
state-ethics/events/tx-tec.ts                           # MODIFIED: wraps shared helper
state-ethics/events/tx-tec.test.ts                      # MODIFIED: 3 wrapper tests
fixtures/state-community/
  ca-senate-roster.html                                 # 5 senator cards (single-page roster)
  ca-assemblymember-detail.html                         # 1 AM detail page
  mi-senator-detail.html                                # 1 MI senator detail
  mi-rep-detail.html                                    # 1 MI rep detail
fixtures/state-ethics/
  tx-tec-orders.html                                    # ~10 sworn-complaint order rows
```

## Components

### 1. `parseAddressText` hoist (Task 1, prerequisite)

Currently lives at `state-community/district-offices/ny-senate/assembly.ts:71-104` (slice 15). With slice 16 adding 4 more callers (CA senate, CA assembly, MI senate, MI house) plus the 2 existing (NY assembly, NY senate), trigger for hoist is met (per slice 15 Lesson 2 "inline first, local-shared second, canonical-shared third").

**Hoist target:** `packages/db/supabase/seed/state-community/district-offices/_shared.ts` (new file). Underscore-prefixed signals "package-internal helper, not for cross-domain import" — distinct from `state-community/shared.ts` (interface definitions only). Justification for district-office-scoped vs `seed/shared/`: `parseAddressText` is district-office-specific (US-style street + city + state-code + zip + optional phone format); town_halls + ethics adapters don't parse addresses.

**Effect:**
- `_shared.ts` exports `parseAddressText` verbatim from slice 15
- `ny-senate/assembly.ts` removes local `parseAddressText` definition, imports from `../_shared.ts`
- `ny-senate/senate.ts` updates `import { parseAddressText } from './assembly.ts'` → `import { parseAddressText } from '../_shared.ts'`
- Slice 15 NY assembly + senate tests stay passing (zero behavior change)

### 2. CA district_offices (`ca-leginfo/` subfolder, Tasks 2-3)

**Slug:** `ca-leginfo` (back-compat with slice 5H stub — even though the source URLs are senate.ca.gov + assembly.ca.gov, not leginfo.legislature.ca.gov)

**Sub-parsers:**

- `senate.ts`: parses `senate.ca.gov/senators` single-page roster. All 40 senators' district office + Capitol office addresses on one HTML page (audit "best-in-class"). Single fetch; no per-member loop. Emits 2 `NormalizedDistrictOffice` per resolved senator (kind=capitol for Sacramento, kind=district for local).
- `assembly.ts`: per-AM loop. Queries `officials` table for CA `state_house` legislators, derives URL via `assembly.ca.gov/assemblymembers/{district_number}` (district_number from `officials.district_id` numeric portion). Per-member 1-req/sec throttle. ~80 fetches over ~80s in production. Tests stub the fetcher.
- `index.ts`: `Promise.all([senateFn(), assemblyFn()])` dispatch. Same shape as slice 15 `ny-senate/index.ts`.

**Production fetch volume:** 1 (Senate) + 80 (Assembly) = 81 GETs / ~80s per orchestrator run.

### 3. MI district_offices (`mi-legislature/` subfolder, Tasks 4-5)

**Slug:** `mi-legislature`

**Sub-parsers:**

- `senate.ts`: per-senator loop. Queries `officials` for MI `state_senate` (38 senators), derives URL via slug pattern `senate.michigan.gov/senators/{slug}/` where slug = `<firstname-lastname>` lowercase. Per-senator 1-req/sec throttle.
- `house.ts`: per-rep loop. Queries `officials` for MI `state_house` (110 reps), derives URL via `house.mi.gov/representative-{slug}` (audit-derived; verify against 2-3 real URLs during scaffold). Per-rep 1-req/sec throttle. **Known TLS-flake risk** (audit Lesson 4) — falls through existing try/catch + silent skip.
- `index.ts`: `Promise.all([senateFn(), houseFn()])`.

**Production fetch volume:** 38 + 110 = 148 GETs / ~148s per orchestrator run.

### 4. TX ethics combined parser (`tx-tec/`, Task 6)

**Pattern:** Exact analog of slice 15 `ny-coelig/`. 1 HTML source → `{complaints, events, errors}` via shared helper; 2 thin adapter wrappers.

**Source:** `ethics.state.tx.us/enforcement/sworn_complaints/orders/search/` — HTML table with columns Order #, Respondent, Date Issued, Year Filed, agency text.

**Status mapping** (TX-specific lexicon — different from NY COELIG):
- "Resolved" / "Final Order" / "Agreed Order" / "Penalty Order" → `sanctioned`
- "Dismissed" → `dismissed`
- "Pending" → `open`
- Unknown → `closed_no_action` (with explicit branch to catch the catch-all, per slice 15 Task 5 review fix)

**Chamber inference:**
- "Texas House" / "House of Representatives" → `state_house`
- "Texas Senate" / "Senate" → `state_senate`
- "Texas Legislature" / fallback → skip row (no chamber → can't resolve to specific official)

**event_type:** Always `campaign_finance_violation` (same as slice 15 NY COELIG — Ballotpedia covers recall/expulsion nationwide per slice 9).

**external_id:** TX Order # (e.g. "SC-202401-001") with `complaint-` / `event-` prefix to disambiguate the dual emission.

**Slug:** `tx-tec` (back-compat with slice 5I stub).

**HTML-only:** Per-case PDFs deferred. Summary text falls back to `${violation_type} (${agency})` generic per slice 15 NY COELIG.

### 5. Closure (Task 7)

- Append CLAUDE.md `## Slices delivered` slice 16 entry (parser list + 4-stub-elimination delta + parseAddressText hoist note)
- Write memory file `project_chiaro_slice16_ca_mi_tx_parsers.md` with squash SHA + durable lessons
- Add MEMORY.md index line
- Workspace verify gate

## Data flow

Each adapter is a `StateCommunityAdapter` or `StateEthicsAdapter`:

```
opts.client + opts.fetcher? → adapter.fetchEvents
                              ├── injected fetcher? → short-circuit
                              └── production path:
                                  ├── CA: Promise.all([senate(roster), assembly(per-member loop)])
                                  ├── MI: Promise.all([senate(per-senator), house(per-rep)])
                                  └── TX: 2 separate fetches (one per wrapper, v1 inefficiency)
                                  → NormalizedXxx[] | {complaints, events, errors}
```

`resolveOpenstatesPersonId(client, {full_name, state, chamber})` returns the openstates_person_id keyed off `officials.full_name` + state + chamber. State-tier orchestrators key Normalized* rows off openstates_person_id (not officials.id) per slice 5G/5H/5I convention; upsert helpers resolve to officials.id inside the DB write.

## Error handling

- **Per-member fetch failure** (network / DNS / 503): `try/catch` with `continue`. No log surface in v1.
- **Per-member slug-URL mismatch:** returns parseable HTML that doesn't match selectors → 0 emitted rows for that member. Silent acceptable v1 degradation.
- **Resolve-by-name fails** (legislator not in DB or chamber mismatch): silent skip; TX combined parser logs to `errors[]` via shared helper.
- **TLS handshake failure** (MI House): same try/catch silent skip; failure rate visible only via row count drop in production.

Slice 17 (or whenever MI House TLS becomes a measurable problem) will add `stats.errors[]` surface + retry helper.

## Testing strategy

- **HTML fixtures** committed (6 new) — pruned representative samples per slice 15 precedent
- **Parser unit tests** (~30-40 cases) — assert specific field values, not just row counts (per slice 15 Lesson 13)
- **Adapter shape tests** (~9 cases) — slug + component + covered_states + injected-fetcher short-circuit
- **Production-path tests** stub `globalThis.fetch` via `vi.spyOn` (per slice 15 Lesson 12) to avoid network leaks during `pnpm test`
- **No new pgTAP work** (no schema changes)

Expected total: ~52 new vitest cases (similar to slice 15's ~62). Existing slice 15 NY tests stay passing (parseAddressText hoist preserves behavior).

## Verify gate

- `pnpm --filter @chiaro/db typecheck` + `pnpm -r typecheck` → green
- `pnpm --filter @chiaro/db exec vitest run` → ~620 tests pass (568 + ~52)
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans (no schema work; informational only)

## Risk + tradeoffs

1. **MI House TLS flake.** Audit observed TLS handshake failures during reconnaissance. Slice 16 relies on try/catch silent skip; if production pass rate is <50%, slice 17 adds explicit retry. v1 accepts whatever rate the existing pattern gives.

2. **TX status lexicon variance.** TX uses "Resolved" / "Agreed Order" / "Final Order" terminology not present in NY COELIG. Status mapping is TX-specific. Real catalog is audit-derived + 1-2 sample pages; new variants discovered in production trigger a mapping update (no code design change).

3. **CA Assembly URL pattern verification.** Audit-derived `assembly.ca.gov/assemblymembers/{district}` — verify against 2-3 real URLs during scaffold. Failure mode: silent 0-row per AM.

4. **`_shared.ts` filename convention.** Underscore prefix is one of several options (`parse-address.ts`, `address-text.ts`). Chose `_shared.ts` for symmetry with sibling `state-community/shared.ts` (interface defs) and `state-ethics/shared.ts`.

5. **Spec drift from real HTML selectors.** Same risk as slice 15. Mitigations: committed fixtures freeze the parser contract; JSDoc on each parser flags audit-derived selectors. Production drift surfaces via `stats.errors[]` (TX) + empty result arrays (CA/MI).

6. **Two TX HTTP fetches per orchestrator run** (1 per adapter wrapper). Same v1 inefficiency as slice 15. Cross-adapter memoization deferred until measured impact.

7. **CA + MI slug naming drift.** Slugs `ca-leginfo` and `mi-legislature` are legacy names — they don't reflect the actual source URLs (senate.ca.gov + house.mi.gov + senate.michigan.gov). Per slice 15 NY precedent (slug `ny-jcope` covers `ethics.ny.gov/enforcement-actions` / agency renamed to COELIG in 2022), slugs stay legacy for `state_community_orgs` row continuity. JSDoc explains the discrepancy.

## File count

- Created: ~20 files
  - 5 HTML fixtures (CA senate roster, CA AM detail, MI senator detail, MI rep detail, TX ethics orders)
  - 1 `_shared.ts` for parseAddressText hoist
  - CA + MI subfolders: 6 production files + 6 test files = 12 files
  - TX: 2 files (shared.ts + shared.test.ts)
- Modified: 6 files
  - 2 slice 15 NY files (assembly.ts + senate.ts re-import path)
  - 4 TX adapter wrappers (complaints/tx-tec.ts + .test.ts; events/tx-tec.ts + .test.ts)
- Modified (orchestrator): 1 file
  - `state-community-ingest.ts` — update imports for the 2 deleted flat stubs (slice 15 missed this and needed a follow-up fix commit; slice 16 plan handles in Tasks 2 + 4 inline to avoid the same trap)
- Deleted: 4 files
  - `state-community/district-offices/ca-leginfo.ts` + `ca-leginfo.test.ts`
  - `state-community/district-offices/mi-legislature.ts` + `mi-legislature.test.ts`
- **Total touched: ~31 files**

Comparable to slice 15 (~24 files; slice 16 is slightly larger due to 2-chamber sub-parser pattern × 2 states + the orchestrator + flat-stub deletion handling).

## Cross-references

- Slice 15 (NY parsers): `docs/superpowers/specs/2026-05-24-ny-parsers-design.md`, `docs/superpowers/plans/2026-05-24-ny-parsers.md`
- Slice 12 audit: `docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`
- Slice 11 (LCV subfolder precedent): `docs/superpowers/plans/2026-05-24-lcv-scorecards.md`
- Slice 9 (HTML-scrape pattern): `docs/superpowers/specs/...nra-ballotpedia-design.md` (NRA STATE_2_TO_NAME + Ballotpedia constraints)
- Gotcha #15 (federal/state asymmetry), Gotcha #18 (HTML-scrape constraints), Gotcha #20 (stub-shipping URL verification), Gotcha #22 (RNW 0.19 aria-expanded gap — not directly applicable to slice 16)
- Memory: `project_chiaro_slice15_ny_parsers.md` (durable lessons 11-15 directly inform slice 16 patterns)
