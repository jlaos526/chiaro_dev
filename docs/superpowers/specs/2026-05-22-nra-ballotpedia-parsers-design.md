# Slice 9 — NRA-PVF + Ballotpedia Recalls Production Parsers

**Date:** 2026-05-22
**Branch:** `slice-9-nra-ballotpedia`
**Scope:** Ship 2 more production parsers using slice 7 mobilize pattern — NRA-PVF state grades (HTML scrape, all 50 states, replaces slice 5G stub) + Ballotpedia recalls (HTML scrape, nationwide, replaces slice 5I stub).

## Why this slice

After slice 7 + 8 shipped 3 production parsers (Mobilize.us state, OpenStates YAML, Mobilize.us federal), 35 stub adapters remain across slices 5G/5H/5I. Slice 9 wires 2 more high-value targets using the HTML-scrape variant of the production parser pattern.

**Why these two:**
- **NRA-PVF**: centralized at `nrapvf.org/grades/<state-name>/`, one URL pattern serves all 50 states; letter→numeric mapping already in slice 5G adapter; lower friction than per-state ethics scrapers.
- **Ballotpedia recalls**: single index page + 3-4 per-year subpages cover ~200 recall events historically; one parser per state-tier event; complements slice 7's OpenStates resignation/death events.

**Why pivot from federal stock_transactions** (the original slice 9 candidate): community JSON sources are dead (`house-stock-watcher.com` DNS fails; `senatestockwatcher.com` repo frozen since 2021). Official source (`disclosures-clerk.house.gov`) requires PDF table extraction — 2-3x the scope + 10x the maintenance fragility of an HTML scrape. Documented for future when JSON sources revive or paid aggregators become affordable.

## Architecture summary

- **2 production parsers, zero schema work.** pgTAP unchanged at 409 plans across 31 files.
- **Workspace stays at 10 packages.** One new workspace dep: **`cheerio`** (jQuery-like HTML parser).
- **NRA-PVF adapter** replaces stub at `seed/state-scorecards/nra.ts`. Expands coverage 6 → 50 states (centralized URL pattern).
- **Ballotpedia adapter** replaces stub at `seed/state-ethics/events/ballotpedia-recalls.ts`. Index page + per-year subpages.
- **Reuses slice 8 shared modules:** `resolveOfficialByName` + `Chamber` from `seed/shared/officials.ts`.
- **Validates HTML-scrape pattern** as template for remaining 33 stubs.

## NRA-PVF adapter

### File layout

```
packages/db/supabase/seed/state-scorecards/
  nra.ts                            # MODIFIED — production fetcher replaces stub
  nra.test.ts                       # MODIFIED — production-path cases added
  nra-helpers.ts + .test.ts         # NEW — HTML extractor + chamber classifier + state-name map
packages/db/supabase/seed/fixtures/state-scorecards/
  nra-ca.html                       # NEW — sample CA grades page (typical layout)
  nra-tx.html                       # NEW — sample TX page (edge case: different table structure)
```

### URL pattern

`https://www.nrapvf.org/grades/<state-name-lowercase-hyphenated>/`

Examples:
- `https://www.nrapvf.org/grades/california/`
- `https://www.nrapvf.org/grades/new-york/`
- `https://www.nrapvf.org/grades/north-carolina/`

`STATE_2_TO_NAME` map in `nra-helpers.ts` provides 2-letter → full-name conversion (50 entries).

### HTML extraction

Each page contains tables of graded legislators. Adapter:
1. GETs the page with default fetch (NRA-PVF doesn't gate on User-Agent)
2. Parses HTML via `cheerio.load(html)`
3. Iterates table rows; per row extracts:
   - **Legislator name** (typically `<td>`-cell with anchor)
   - **Chamber label** (column or row group: "State Senate", "State House", "State Assembly", "U.S. Senate", "Senate", "U.S. House of Representatives", "House of Representatives")
   - **Letter grade** (single cell: `A+` / `A` / `A-` / `B+` / `B` / `B-` / `C+` / `C` / `C-` / `D+` / `D` / `D-` / `F` / `AQ` (rare "questionnaire") / blank)

### Chamber classifier

`inferChamberFromNraTable(chamberLabel)` maps:
- `"State Senate"` → `'state_senate'`
- `"State House"` / `"State Assembly"` / `"State House of Representatives"` → `'state_house'`
- `"U.S. Senate"` / `"Senate"` (no "State") → `'federal_senate'`
- `"U.S. House of Representatives"` / `"House of Representatives"` (no "State") → `'federal_house'`
- Unknown / missing → null (skip row + log to errors)

### Letter → numeric

Reuses existing `letterToNumeric()` from `seed/state-scorecards/nra.ts` (slice 5G):
- `A+` → 100, `A` → 95, `A-` → 92
- `B+` → 87, `B` → 85, `B-` → 82
- `C+` → 77, `C` → 75, `C-` → 72
- `D+` → 67, `D` → 65, `D-` → 62
- `F` → 50
- `AQ` (questionnaire-only) → null (skip emit; log)
- Blank / unparseable → null (skip emit)

### Name resolution

`resolveOfficialByName(client, { full_name, state, chamber })` from `seed/shared/officials.ts` (slice 8). Unmatched names → `stats.officialsUnmatched`.

### External_id

`nra-<state>-<openstates_person_id>` for stable dedup. The slice 5G `(scorecard_id, official_id, session)` UNIQUE on `state_scorecard_ratings` handles dedup at INSERT time; external_id is for operator-side audit trail (which adapter run created which row).

### Coverage expansion

`covered_states: ALL_50_STATES` — was 6 in slice 5G stub coverage matrix; production parser expands since the URL pattern is uniform. States with no NRA-PVF page or empty table return 0 ratings gracefully.

## Ballotpedia recalls adapter

### File layout

```
packages/db/supabase/seed/state-ethics/events/
  ballotpedia-recalls.ts            # MODIFIED — production fetcher replaces stub
  ballotpedia-recalls.test.ts       # MODIFIED — production-path cases added
  ballotpedia-recalls-helpers.ts + .test.ts   # NEW — HTML extractor + outcome mapper
packages/db/supabase/seed/fixtures/state-ethics/
  ballotpedia-recalls-index.html    # NEW — sample /State_legislative_recalls HTML
  ballotpedia-recalls-2024.html     # NEW — sample year-detail page
```

### URL patterns

- **Index:** `https://ballotpedia.org/State_legislative_recalls`
- **Per-year detail:** `https://ballotpedia.org/State_legislative_recall_efforts,_<YEAR>` (e.g., `State_legislative_recall_efforts,_2024`)

### User-Agent gating

Ballotpedia returns HTTP 403 without a browser-style User-Agent header. Adapter sends:

```
User-Agent: Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)
```

Identifies the bot but uses a Mozilla prefix to bypass Cloudflare gating. Documented in CLAUDE.md Gotcha #18.

### HTML extraction

1. **Index fetch:** GET index URL; parse via cheerio. Index contains summary tables + links to per-year subpages. Extract the year-list (e.g., 2023, 2024, 2025, 2026).
2. **Per-year fetch:** For each year, GET the per-year subpage. Tables list recall efforts. Adapter does this serially with **1-req/sec courtesy throttle** (`setTimeout(1000)` between fetches).
3. **Per-row normalization:** extract:
   - **State** (from state name; map via `STATE_NAME_TO_2` shared with NRA helpers)
   - **Legislator name** (table cell; strip "State Sen." / "State Rep." / "State Del." prefix if present)
   - **Chamber** (inferred from prefix: "Sen." → state_senate; "Rep." / "Del." → state_house)
   - **Event date** (cell text; parse via `Date.parse()` with fallback)
   - **Status text** (cell text)

### Outcome → event_type mapping

```ts
function mapOutcomeToEventType(status: string): EventType | null {
  const s = status.toLowerCase()
  if (/recalled|removed from office/.test(s))      return 'recall_succeeded'
  if (/retained|petition failed|insufficient signatures|withdrew/.test(s)) return 'recall_failed'
  if (/active|pending|filed|election scheduled/.test(s)) return 'recall_attempt'
  return null  // unknown — log to stats.errors
}
```

Unknown statuses default to skip + log; do NOT silently emit as `recall_attempt` (conservative — operator triages unknown statuses).

### Date extraction

Ballotpedia uses inconsistent formats:
- `"January 15, 2024"` (most common)
- `"2024-01-15"` (rare)
- `"Jan 15, 2024"` (occasional)

`extractDate(text)` uses `Date.parse()`; falls back to manual regex match `/(\d{4})-(\d{2})-(\d{2})/` or `/(\w+)\s+(\d{1,2}),?\s+(\d{4})/`. Returns ISO date string `YYYY-MM-DD` or null. Null → skip row + log.

### Chamber regex

```ts
const BALLOTPEDIA_CHAMBER_RE = /^(State\s+(Sen\.|Senator|Rep\.|Representative|Del\.|Delegate|Assemblymember|Assemblyman|Assemblywoman))/i
```

Only state-tier; federal recalls are extremely rare and filtered out.

### External_id

`ballotpedia-<state>-<legislator-name-slugified>-<event-date>` (e.g., `ballotpedia-CA-jane-doe-2024-03-15`) for stable dedup via existing `(source, external_id)` UNIQUE on `state_official_events` (slice 5I migration 0049).

### Hard caps

- **50 page fetches per run** (index + 4 years currently; head-room for ~45 future years)
- **1-req/sec courtesy throttle** between page fetches
- **5-second timeout per fetch** (Cloudflare can be slow)

## Acceptance criteria (12)

1. `cheerio` added to `packages/db/package.json` deps; `pnpm install` clean.
2. `nra.ts` production fetcher GETs `nrapvf.org/grades/<state-name>/` for each of 50 states via `STATE_2_TO_NAME` lookup; `covered_states` expanded from 6 → 50.
3. `nra-helpers.ts` exports HTML extractor + `inferChamberFromNraTable` + `STATE_2_TO_NAME` map (50 entries).
4. NRA-PVF chamber classifier maps state-tier ("State Senate"/"State House"/"State Assembly") + federal-tier ("U.S. Senate"/"Senate"/"U.S. House"/"House of Representatives") correctly.
5. NRA-PVF letter → numeric via existing `letterToNumeric()` (slice 5G helper); unknown letters (e.g., "AQ") skip row + log.
6. `resolveOfficialByName` (slice 8 shared module) resolves each parsed row; unmatched → `stats.officialsUnmatched`.
7. `ballotpedia-recalls.ts` production fetcher GETs index + per-year subpages with browser User-Agent header.
8. Ballotpedia outcome → event_type mapping per spec (Recalled → succeeded; Retained/Failed/Withdrew → failed; Active/Pending/Filed → attempt; unknown → null/skip).
9. Ballotpedia adapter respects 1-req/sec courtesy throttle between page fetches; hard-cap 50 pages per run; 5-second per-fetch timeout.
10. `external_id` patterns: `nra-<state>-<openstates_person_id>` for NRA; `ballotpedia-<state>-<slug>-<event-date>` for Ballotpedia.
11. `pnpm -r typecheck` clean; pgTAP unchanged at 409 plans; Next 15 build clean.
12. CLAUDE.md slice 9 entry + Gotcha #18 (HTML scrape constraints: Ballotpedia UA-gating; NRA-PVF state-name URL pattern; chamber inference asymmetry between state vs federal in NRA tables; cheerio workspace dep).

## Known v1 limitations (8)

1. **NRA-PVF coverage varies by state.** Smaller states (WY, VT, NH) may have fewer graded legislators; adapter gracefully emits `[]` for empty tables.
2. **Ballotpedia recall data lags real-time events.** Active/pending efforts may not appear until year-end summary. Operator monitors `officialsUnmatched[]` for missing names.
3. **Both adapters HTML-scrape fragile.** Site redesigns break parsers. Mitigated via fixture-based tests + `--skip-on-error` in orchestrators.
4. **No 7-day cache** for either adapter; each run re-fetches. Add if rate-limited later.
5. **Ballotpedia per-year subpage discovery is heuristic** — currently 2023, 2024, 2025, 2026. Older years (2018–2022) deferred to operator future-patch; year list is a const in helpers.
6. **Federal recall events ignored.** Federal recall processes are different (effectively non-existent for House; Senate has procedure but never used). State-tier only.
7. **`cheerio` SSR-only** — backend ingest dep, not used at app runtime.
8. **NRA-PVF political sensitivity acknowledged.** Source is partisan but factually documents grades. Card UI renders neutrally with `SCORECARD_LEAN_COLOR.conservative` token. No editorial framing.

## Out of scope

- Federal stock_transactions production parser (community sources dead; PDF parsing deferred to future slice if JSON sources revive)
- Federal NRA scorecards (slice 5G stub was state-only; federal scorecards from slice 4 federal stack already wired with different orgs)
- Per-state ethics commission scrapers (deferred to future slice; each state agency has its own URL pattern)
- 7-day cache layer
- `--year=` CLI flag for Ballotpedia (currently fetches a fixed year list; future patch)
- Re-classifying NRA "AQ" (Aborted Questionnaire) entries — currently skipped + logged

## Estimated scope

**~14 tasks across 4 phases:**

- **Phase A** (1 task): add `cheerio` to `@chiaro/db` package.json
- **Phase B** (5 tasks): NRA-PVF helpers + state-name map + production fetcher + fixtures + integration tests
- **Phase C** (5 tasks): Ballotpedia helpers + outcome mapper + date extractor + production fetcher + fixtures + integration tests
- **Phase D** (3 tasks): CLAUDE.md + workspace verify + memory + handoff

Plan should anticipate ~1800-line plan doc.

**Validates the HTML-scrape variant of the production parser pattern** (slice 7+8 used JSON APIs). Template for remaining 33 stub adapters that depend on HTML scraping (per-state ethics commissions, individual scorecard org chapters, state-leg websites, etc.).
