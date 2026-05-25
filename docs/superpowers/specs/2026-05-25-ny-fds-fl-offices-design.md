# NY FDS + FL district_offices — slice 17 design

**Status:** approved 2026-05-25 (verbal — brainstorming flow)
**Builds on:** slice 15 NY parsers + slice 16 CA/MI/TX parsers + slice 12 audit (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`)

## Goal

Ship 2 production parsers replacing slice 5H/5I stubs:
1. **NY financial_disclosures index** (`state-ethics/disclosures/ny-jcope.ts`) — HTML-scrape of `ethics.ny.gov/financial-disclosure-statements-elected-officials` filtered to current cycle (2024+). Index metadata only; PDF parsing deferred.
2. **FL district_offices** (`state-community/district-offices/fl-doe/` subfolder) — Senate + House per-member fetch loops mirroring slice 16 CA/MI patterns.

Slice 17 closes 2 of the 4 deferred audit candidates ("Defer to slice 14+" list — NY FDS index #7 + FL district_offices #9). The 2 remaining (MI PFD + CA FPPC Form 700) are PDF-bound, deferred to a dedicated PDF-parsing slice.

## Non-goals

- **No PDF parsing.** NY FDS records link out to PDFs (one Download link per filing); v1 records `source_url` pointing at the PDF but leaves `extracted_assets[]` + `extracted_income[]` null. Future PDF-parsing slice fills these.
- **No schema work.** pgTAP plan count stays at 402. No new migrations.
- **No new workspace deps.** `cheerio` already installed.
- **No SPA reverse-engineering.** FL EFDMS (Form 6 financial disclosures) is bucket B per audit — deferred to a future SPA-driving slice.
- **No backfill of historical NY FDS** (pre-2024). Future backfill slice can lift the year filter.
- **No `state_ethics_orgs` row insertion/mutation** beyond what slice 5I already shipped.

## Architecture

```
state-ethics/disclosures/
  ny-jcope.ts                                           # MODIFIED: replace stub with production HTML parser
  ny-jcope.test.ts                                      # MODIFIED: replace stub tests with ~10 production tests
state-community/district-offices/
  fl-doe/                                               # NEW directory replacing flat fl-doe.ts stub
    index.ts                                            # adapter export; Promise.all dispatch
    senate.ts                                           # flsenate.gov per-senator profile (40)
    senate.test.ts
    house.ts                                            # flhouse.gov per-rep profile (120)
    house.test.ts
    index.test.ts
state-community-ingest.ts                               # MODIFIED: 1 import path updated
fixtures/state-ethics/
  ny-fds-index.html                                     # NEW: ~6-row pruned NY FDS index page
fixtures/state-community/
  fl-senator-detail.html                                # NEW: 1 senator detail page
  fl-rep-detail.html                                    # NEW: 1 rep detail page
```

### Files in scope

- **Created (~11):**
  - 3 HTML fixtures (NY FDS index, FL senator detail, FL rep detail)
  - 6 FL files (index.ts + senate.ts + house.ts + 3 test files)
  - 0 helper hoists (parseAddressText already shared in slice 16's `_shared.ts`)
- **Modified (3):**
  - 2 NY FDS files (`state-ethics/disclosures/ny-jcope.ts` + `.test.ts` — replace stubs)
  - `state-community-ingest.ts` (1 import path updated)
- **Deleted (2):**
  - `state-community/district-offices/fl-doe.ts`
  - `state-community/district-offices/fl-doe.test.ts`
- **Total touched: ~16 files**

Smaller than slice 16 (no helper hoist, only 1 subfolder).

## Components

### 1. NY FDS index parser (Task 2)

**Slug:** `ny-jcope` (back-compat with slice 5I stub — even though COELIG renamed in 2022, `state_ethics_orgs` row continuity matters)
**Component:** `disclosures`
**Source:** `https://ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024`

**Parser shape:**
- Each result row in the HTML index: legislator name, office text (e.g. "NYS Assembly Member" / "NYS Senator"), filing year, Download link to PDF
- Chamber inference from office text: `NYS Assembly Member` → `state_house`, `NYS Senator` → `state_senate`
- Pagination: follow "next page" link until exhausted OR cap at 50 pages (safety bound)
- Per-record resolve: `resolveOpenstatesPersonId(client, { full_name, state: 'NY', chamber })`
- Emit: `NormalizedFinancialDisclosure` per filing with `source_url` = PDF Download URL

**Production fetch volume:** ~30-50 page fetches over ~30-50s at 1-req/sec.

**Status mapping:** NY FDS has no status field per se. Schema field `status` defaults to `'filed'` (typical for "filing exists"). Verify `NormalizedFinancialDisclosure` shape during implementation.

### 2. FL district_offices subfolder (Tasks 3-4)

**Slug:** `fl-doe` (back-compat with slice 5H stub — slug doesn't match the actual source URLs `flsenate.gov` + `flhouse.gov`, but stable for `state_community_orgs` row continuity)
**Component:** `offices`

**Sub-parsers:**

- `senate.ts`: per-senator profile loop
  - Source: `flsenate.gov/Senators/s{district}` (e.g. `s14` for District 14) — verify URL pattern against 2-3 real senators during scaffold
  - Or: fetch `flsenate.gov/senators` index first to get per-senator URLs (2-step crawl per audit "modest 2-step")
  - Implementer chooses based on URL discovery during scaffold. v1 prefers per-district URL if pattern is stable; falls back to index-driven crawl otherwise.
  - 40 senators

- `house.ts`: per-rep profile loop
  - Source: `flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}` (audit-derived)
  - `MemberId` may NOT be the district number — implementer verifies. If MemberId is opaque, fetch the index page first to map district → MemberId.
  - 120 reps

- `index.ts`: `Promise.all([senateFn(), houseFn()])` dispatch (mirrors slice 16 ca-leginfo + mi-legislature)

**Production fetch volume:** ~160 GETs (40 + 120) over ~160s at 1-req/sec. If index-driven 2-step is used for either chamber: +1-2 fetches for the index pages.

### 3. Closure (Task 5)

- CLAUDE.md `## Slices delivered` slice 17 entry
- Memory file `project_chiaro_slice17_ny_fds_fl_offices.md` with squash SHA + durable lessons
- MEMORY.md index line
- Workspace verify gate

## Data flow

```
opts.client + opts.fetcher? → adapter.fetchEvents
                              ├── injected fetcher? → short-circuit
                              └── production path:
                                  ├── NY FDS: paginate ethics.ny.gov index until exhausted or 50-page cap
                                  │   → resolve each row to openstates_person_id (chamber from office text)
                                  │   → emit NormalizedFinancialDisclosure
                                  └── FL: Promise.all([senate(per-member loop), house(per-member loop)])
                                      → emit NormalizedDistrictOffice
```

## Error handling

- **NY FDS pagination cap (50 pages):** prevents runaway in case "next page" link never terminates. Log `errors[]` if cap hit.
- **NY FDS unresolved legislator:** silent skip + log to `errors[]` (slice 15 NY COELIG pattern).
- **NY FDS office-text doesn't match chamber regex:** silent skip + log (e.g. former legislator, deceased, etc.).
- **FL per-member fetch failure:** try/catch + `continue` (slice 15/16 pattern).
- **FL URL pattern mismatch:** 0 parsed rows per member → silent skip.

Same patterns as slice 15/16.

## Testing strategy

- 3 HTML fixtures committed (NY FDS index sample, FL senator detail, FL rep detail)
- ~10 NY FDS tests + ~14 FL Senate tests + ~14 FL House tests + 3 FL index dispatch tests = ~40 new vitest cases
- Production-path tests stub `globalThis.fetch` via `vi.spyOn` (slice 15 Lesson 12)
- Field-value assertions (not just row counts) on parser outputs (slice 15 Lesson 13)
- Full @chiaro/db vitest run after each commit that touches the orchestrator (slice 15 Lesson 11)

Expected total: ~645 tests passing post-slice-17 (605 + ~40).

## Verify gate

- `pnpm -r typecheck` → 11 packages green
- `pnpm --filter @chiaro/db exec vitest run` → ~645 tests green
- `pnpm --filter @chiaro/web build` → 12 routes green
- pgTAP unchanged at 402 plans (informational)

## Risk + tradeoffs

1. **NY FDS pagination selector audit-derived.** "Next page" link structure (`<a rel="next">`, `<a class="next">`, or `<a aria-label="Next page">`) — verify against live HTML. Failure mode: 1-page-only ingest (silently underreports). Mitigation: log row count to operator; if persistently low, revisit selector.

2. **NY FDS office-text chamber inference variants.** "NYS Assembly Member" + "NYS Senator" + edge cases ("NYS Senate Member", "NYS Member of Assembly"). Regex matches `\bAssembly\b` → state_house; `\bSenator\b|\bSenate\b` → state_senate. Unknown variants → silent skip + `errors[]`.

3. **FL House MemberId not equal to district.** Per audit reconnaissance. Implementer verifies. If opaque:
   - Option (a): fetch `flhouse.gov/Sections/Representatives/representatives.aspx` once to extract district → MemberId mapping
   - Option (b): use `flhouse.gov/Sections/Representatives/details.aspx?MemberId={district}` and silently skip when MemberId-as-district returns 404 — accept partial coverage
   - Prefer (a). v1 falls back to (b) if discovery cost is high.

4. **FL Senate URL pattern shape.** `flsenate.gov/Senators/s{district}` (e.g. `s14`) is the typical pattern. Verify. Failure mode: 0 senators parsed; surfaced via row count = 0 in production logs.

5. **NY FDS `status` field semantics.** Schema likely has `status: 'filed' | 'late' | 'amended'` or similar. v1 defaults to `'filed'`. Verify schema during implementation.

6. **Year filter coupling.** v1 hardcodes `?year=2024` query param. If NY changes URL param name (e.g. to `?filing_year=`), parser fails silently. JSDoc flags audit-derived URL.

7. **Two HTTP fetches per FL run** (1 senate + 1 house). Same v1 inefficiency as slice 15/16. Cross-adapter caching deferred.

8. **Slug naming continues to drift from source URLs** — `fl-doe` (Department of Elections) for House + Senate parsers; `ny-jcope` (legacy agency) for FDS. JSDoc explains in each file.

## Schema verification needed during planning

The `NormalizedFinancialDisclosure` shape in `state-ethics/shared.ts` must be checked before writing the plan. Slice 15 Lesson 1 caught spec-invented fields in slice 15. Specifically verify:
- Required fields: `official_openstates_person_id`, `filing_year`, `source_url`, `state`, `source`
- Optional fields: `extracted_assets[]`, `extracted_income[]`, `extracted_liabilities[]`, `status`, `external_id`
- `source_url` storage: PDF Download URL goes here; UI links out to PDF directly

The actual shape may differ. If field names diverge, plan adapts; spec doesn't need rewrite.

## Cross-references

- Slice 12 audit: `docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md` (NY FDS = bucket A index + C PDFs; FL district_offices = bucket C-ish multi-hop)
- Slice 15 (NY parsers): `docs/superpowers/plans/2026-05-24-ny-parsers.md` (HTML-scrape + combined-parser patterns)
- Slice 16 (CA + MI + TX parsers): `docs/superpowers/plans/2026-05-24-ca-mi-tx-parsers.md` (per-member loop pattern + mid-slice broken-state avoidance + parseAddressText hoist)
- Gotcha #15 (federal/state asymmetry), Gotcha #18 (HTML-scrape constraints), Gotcha #20 (stub-shipping URL verification)
- Memory: [[project-chiaro-slice15-ny-parsers]] + [[project-chiaro-slice16-ca-mi-tx-parsers]] (durable lessons directly inform slice 17 patterns)
