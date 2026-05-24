# Slice 11 — LCV state scorecards (MI + CO) + slice 5G stub cleanup

**Date:** 2026-05-23
**Scope tier:** Mid-sized slice (~17-18 files; mostly code + 1 audit doc + tests). Closer to compressed-slice cadence given much of it is mechanical (fixtures, deprecations).
**Predecessor slices:** 5G (state issue positions stub-shipping), 9 (NRA-PVF + Ballotpedia production parsers).

## Goal

Ship 2 production scorecard parsers (LCV-MI, LCV-CO), deprecate 11 slice-5G stubs whose source URLs don't publish the assumed data, and capture the discovery findings + durable lesson so future stub-shipping work pre-verifies source URLs.

## Motivation

Slice 5G shipped 5 state-scorecard org adapters (ACLU, LCV, NRA, Planned Parenthood, AFP) as stubs covering ~22 (org, state) pairs total. Slice 9 wired NRA-PVF as the first production parser. A 2026-05-23 discovery audit on the remaining 21 (org, state) pairs revealed:

| Bucket | Count | Pairs |
|---|---|---|
| A — Production-parseable HTML | 2 | LCV-MI, LCV-CO |
| B — JS-rendered SPA / partial-data | 1 | LCV-CA (caucus profiles, not roster) |
| C — PDF-only | 1 | LCV-NY |
| F — Anti-bot gate (403) | 6 | LCV-OR + 5 PP states |
| G — No published scorecard (adapter premise wrong) | 11 | All 6 ACLU + all 5 AFP |

**Two key surprises:**
- **ACLU state chapters publish bill-position trackers, not legislator scorecards.** The slice 5G URL template (`aclu<state>.org/legislative-scorecard`) assumed a data shape that doesn't exist. ~50% of ACLU URLs 404; the remainder are bill trackers.
- **AFP publishes only ONE federal scorecard** (`americansforprosperity.org/national-scorecard`). State chapter pages exist but contain no per-state scorecard. The slice 5G assumption of 5 per-state AFP adapters has no data source.

So slice 11 isn't "21 scrapes" — it's "2 production parsers + 11 adapter deprecations + 1 documented durable lesson."

## Key design decisions

1. **Scope: realistic mini-slice** (chosen over mega-slice or 4 sub-slices) — discovery showed only 2 firm production parsers possible; broader scope would be padding. Ship the 2 parsers + close the deprecation gap + document the lesson.
2. **File layout: subfolder per org** (chosen over flat single-file or top-level per-(org,state) tuples) — matches slice 9 (nra-helpers extracted from nra.ts), keeps per-state parsers individually testable with HTML fixtures.
3. **Discovery before parsing** — drove the scope re-shape; persisted as a permanent audit artifact (`docs/superpowers/audits/2026-05-23-scorecard-discovery.md`).
4. **Deprecation strategy: `@deprecated` JSDoc + empty `covered_states`** (chosen over file deletion or throw-on-call) — keeps orchestrator dispatch invariants while killing the data flow; preserves `state_scorecard_orgs` DB rows for future repurposing without re-migration.
5. **LCV-CA partial deferred** — caucus profiles are a different data shape than scorecards (qualitative endorsement vs quantitative rating); shoehorning forces a `caucus_label` schema decision that should wait.
6. **PP × 5 + LCV-OR deferred** — anti-bot gate; needs browser-UA probe spike (potential future slice).

## Architecture

### File layout

```
packages/db/supabase/seed/state-scorecards/
  shared.ts                                  # unchanged (StateScorecardAdapter interface)
  nra.ts                                     # unchanged (slice 9)
  nra-helpers.ts                             # unchanged
  lcv/                                       # NEW subfolder (replaces lcv.ts)
    index.ts                                 # adapter export + per-state dispatch map
    helpers.ts                               # resolveOpenstatesPersonId, normalizePartyChar, BROWSER_USER_AGENT, RATE_LIMIT_MS
    mi.ts                                    # parseMichiganLcvHtml(html) + fetchMichiganRatings(client)
    co.ts                                    # parseColoradoLcvHtml(html, chamber) + fetchColoradoRatings(client, opts?)
  aclu.ts                                    # rewritten as @deprecated stub
  afp.ts                                     # rewritten as @deprecated stub
  planned-parenthood.ts                      # unchanged (still stub; F-gated)
packages/db/test/state-scorecards/lcv/
  mi.test.ts                                 # parser tests + dispatch
  co.test.ts                                 # parser tests for both chambers
  dispatch.test.ts                           # lcv.fetchRatings routing
packages/db/test/state-scorecards/
  deprecation.test.ts                        # ACLU + AFP empty-covered-states behavior
packages/db/supabase/seed/.fixtures/state-scorecards/lcv/
  mi.html                                    # pruned ~5-row sample from michiganlcv.org
  co-house.html                              # pruned ~5-row sample
  co-senate.html                             # pruned ~5-row sample
docs/superpowers/audits/
  2026-05-23-scorecard-discovery.md          # NEW — permanent audit artifact
```

Net: 4 new src files (`lcv/*`) + 4 test files + 3 HTML fixtures + 2 deprecation rewrites + 1 audit doc + CLAUDE.md updates + memory.

### LCV adapter

#### `lcv/index.ts`

```ts
import type { StateScorecardAdapter, NormalizedStateRating } from '../shared.ts'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { fetchMichiganRatings } from './mi.ts'
import { fetchColoradoRatings } from './co.ts'

const US_STATE_NAMES: Record<string, string> = {
  MI: 'Michigan', CO: 'Colorado',
}

type Fetcher = (client: ChiaroClient, opts: { session?: string }) => Promise<NormalizedStateRating[]>

const PRODUCTION_FETCHERS: Record<string, Fetcher> = {
  MI: fetchMichiganRatings,
  CO: fetchColoradoRatings,
}

export const lcv: StateScorecardAdapter = {
  slug: 'lcv',
  name_template: (s) => `League of Conservation Voters ${US_STATE_NAMES[s] ?? s}`,
  issue_area: 'environment',
  lean: 'progressive',
  methodology_url_template: (s) =>
    s === 'MI' ? 'https://www.michiganlcv.org/lawmakers/'
    : s === 'CO' ? 'https://conservationco.org/scorecards/'
    : 'https://www.lcv.org',
  scoring_min: 0,
  scoring_max: 100,
  notes: 'LCV state affiliates. Coverage limited to states with parseable HTML rosters (audit: docs/superpowers/audits/2026-05-23-scorecard-discovery.md).',
  covered_states: ['MI', 'CO'],

  async fetchRatings(opts): Promise<NormalizedStateRating[]> {
    const injected = (opts as { fetcher?: () => Promise<NormalizedStateRating[]> }).fetcher
    if (injected) return injected()
    const handler = PRODUCTION_FETCHERS[opts.state]
    if (!handler) return []
    return handler(opts.client, { session: opts.session })
  },
}
```

#### `lcv/mi.ts`

Source: `https://www.michiganlcv.org/lawmakers/` (single server-rendered table, ~110 rows).

Columns: Name (link), Party, Lifetime Score, Chamber, District, Corp Utility Donations, **2025-2026 Score**.

Exports:
- `fetchMichiganRatings(client, opts: { session?: string }): Promise<NormalizedStateRating[]>` — production fetch with `BROWSER_USER_AGENT` header, calls `parseMichiganLcvHtml`, resolves `openstates_person_id` via `helpers.resolveOpenstatesPersonId`, returns ratings.
- `parseMichiganLcvHtml(html: string): RawRating[]` — pure HTML→rows function for fixture-injected testing. Returns rows with `{ full_name, party, chamber, district, score_numeric, methodology_url }`.

Numeric score: row's "2025-2026 Score" column is already 0–100 integer or percentage. Strip any `%` and `Number()` cast. Lifetime score recorded as additional context — NOT the primary `score_numeric`.

Edge cases:
- Missing 2025-2026 score (newly-elected) → skip + log `stats.errors[]`
- Chamber column: `'House' | 'Senate'` → `state_house | state_senate`; anything else → skip
- District: parsed as integer, drop leading zeros, but preserved as string in `district_code` format (`MI-23`)
- Name format: typically `"Last, First"` or `"First Last"` — `parseLegislatorName` normalizes; strip honorifics like "Sen.", "Rep."

#### `lcv/co.ts`

Source: `https://conservationco.org/scorecards/<year>-scorecard/<year>-house/` + `/<year>-senate/`.

Year templated into URL — adapter accepts `opts.session` (default to current year). Both URLs fetched in series with 1-req/sec courtesy throttle.

Columns: Rep/Sen (link), Party-District (e.g., `D - HD 23` or `R - SD 12`), 2025 Score %, Lifetime Score %.

Exports:
- `fetchColoradoRatings(client, opts: { session?: string }): Promise<NormalizedStateRating[]>` — fetches both chamber URLs, parses each, concatenates.
- `parseColoradoLcvHtml(html: string, chamber: 'state_house' | 'state_senate'): RawRating[]` — pure parser per chamber.

Party-District regex: `/^([DRI])\s*-\s*(?:HD|SD)\s*(\d+)$/` extracts party char + district number.

Edge cases:
- Year-availability: if `<year>-scorecard/` 404s, fall back to most recent year listed on `/scorecards/` index page (defensive)
- 80+ House reps + 40+ Senate seats per session
- Score column may contain "N/A" → skip + log `stats.errors[]`

#### `lcv/helpers.ts`

```ts
import type { ChiaroClient } from '@chiaro/supabase-client'

export const BROWSER_USER_AGENT = 'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'
export const RATE_LIMIT_MS = 1000

export async function resolveOpenstatesPersonId(
  client: ChiaroClient,
  opts: { full_name: string; state: string; chamber: 'state_house' | 'state_senate' | 'state_legislature' },
): Promise<string | null> {
  // Case-insensitive exact match on officials.full_name + state + chamber.
  // Returns openstates_person_id (not officials.id) — orchestrator does the id lookup.
  // Same shape as nra-helpers.resolveOpenstatesPersonId from slice 9.
  const { data } = await client
    .from('officials')
    .select('openstates_person_id')
    .ilike('full_name', opts.full_name)
    .eq('state', opts.state)
    .eq('chamber', opts.chamber)
    .maybeSingle()
  return data?.openstates_person_id ?? null
}

export function normalizePartyChar(char: string): string {
  switch (char.toUpperCase()) {
    case 'D': return 'Democratic'
    case 'R': return 'Republican'
    case 'I': return 'Independent'
    default: return char
  }
}
```

### ACLU + AFP deprecation

`@deprecated` JSDoc + `covered_states: []` + `fetchRatings()` returns `[]`. Preserves orchestrator dispatch invariants while killing the data flow. `state_scorecard_orgs` DB rows stay; only `state_scorecard_ratings` ingest stops.

Both files reduced to ~20 lines each with a `@deprecated` block citing the audit doc + the future-repurpose direction (ACLU → bill positions cross-correlation; AFP → federal national scorecard repurpose).

### Discovery findings as durable artifact

`docs/superpowers/audits/2026-05-23-scorecard-discovery.md` persists the discovery subagent's findings verbatim:

1. **TL;DR** — 1 paragraph summary.
2. **Method** — WebFetch per URL, classification into 7 buckets (A–G).
3. **Findings table** — 22 rows, one per (org, state) pair with bucket + working URL + notes.
4. **Bucket summary** — counts per bucket.
5. **Slice 11 scope decisions** — what shipped vs deferred + reason per (org, state).
6. **Durable lessons** — bullet points that become Gotcha #20.
7. **Re-audit cadence** — recommend re-running annually.

Audit is read-only after slice 11 — future re-audits become new dated files.

### Gotcha #20

```markdown
20. **Stub-shipping pattern requires per-pair URL verification before adapter scaffolding.** Slice 5G shipped 5 state-scorecard org adapters as stubs assuming each had per-state-affiliate URLs with parseable HTML. A 2026-05-23 discovery audit (`docs/superpowers/audits/2026-05-23-scorecard-discovery.md`) found ~50% of those (org, state) pairs have no published scorecard at all — ACLU chapters publish bill-position trackers, AFP publishes only one federal scorecard. The gap is **taxonomy, not parser difficulty** — the adapter premise was wrong. Future stub-shipping slices MUST audit each source URL for actual data presence before committing to per-source adapter files. The cost is a 1-hour discovery pass; the savings is avoiding N abandoned adapter stubs that mislead future operators. Bucket taxonomy: A (production-parseable HTML) / B (JS-rendered SPA) / C (PDF-only) / D (image/scanned) / E (404 gone) / F (anti-bot gate) / G (no published scorecard for org/state pair).
```

## Tests

Test files under `packages/db/test/state-scorecards/lcv/`:

| Test file | Cases |
|---|---|
| `mi.test.ts` | `parseMichiganLcvHtml(fixture)` returns ~5 rows; skips missing-score rows + logs errors; chamber mapping correct; numeric score preserved |
| `co.test.ts` | `parseColoradoLcvHtml(houseFixture, 'state_house')` returns rows; senate equivalent; Party-District regex extracts correctly; year-substitution in URL |
| `dispatch.test.ts` | `lcv.fetchRatings({ state: 'MI', fetcher })` routes via injected fetcher; CO same; unknown state returns `[]`; `covered_states` exactly `['MI', 'CO']` |

Plus `packages/db/test/state-scorecards/deprecation.test.ts` — ACLU + AFP empty-covered-states + `[]`-return behavior.

Fixtures pruned to ~5 representative rows each (full ~110-row sources too large for repo). Each fixture starts with HTML comment noting source URL + fetch date.

## Migration sequence

Pure code change. No DB migration. pgTAP unchanged at 409 plans.

Commit order:
1. **Commit A — Discovery audit doc** (pure docs, lowest risk)
2. **Commit B — LCV restructure (MI + CO + dispatch + helpers + fixtures + tests)**
3. **Commit C — ACLU + AFP deprecation**
4. **Commit D — CLAUDE.md (Gotcha #20 + slice 11 entry) + memory**

## Acceptance criteria

1. `pnpm -r typecheck` green across 11 packages
2. `pnpm --filter @chiaro/db test` includes new lcv/* tests, all PASS
3. `pnpm db:reset` + `pnpm seed:state-scorecards --session=2025` smoke succeeds and ingests rows for LCV-MI + LCV-CO (operator-verifiable; not automated since it hits external URLs)
4. `aclu.covered_states.length === 0` and `afp.covered_states.length === 0`
5. CLAUDE.md Gotcha #20 lands; slice 11 entry appended to slices list
6. Discovery audit doc exists at the dated path
7. Memory file written + MEMORY.md index updated

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `michiganlcv.org` or `conservationco.org` HTML restructures and breaks parser | Medium | Tests use committed HTML fixtures (frozen); production fetch failures log to `stats.errors[]` per-row + don't crash the seed orchestrator. Operator triages drift. |
| Colorado URL year-templating wrong for future sessions | Low | Year accepted as orchestrator opts; default to current year; 404 → log + return `[]`. |
| `state_scorecard_orgs.aclu` / `.afp` rows become semantically misleading | Medium | `notes` column updated to say "DEPRECATED — see @deprecated JSDoc". Future migration can add `deprecated bool` column; out of slice 11 scope. |
| Operator runs `seed:state-scorecards` expecting ACLU/AFP rating ingest | Low | `covered_states=[]` makes orchestrator iteration a no-op; `notes` explains why. |
| Anti-bot gate appears on MI/CO unexpectedly | Low | `BROWSER_USER_AGENT` available from helpers; can be added to fetch options if needed. |

## Non-goals

- LCV-CA partial parser (caucus profiles need schema decision)
- LCV-NY PDF parser (PDF tar pit; out of scope)
- LCV-OR + PP × 5 (anti-bot gate; needs UA-probe spike — separate slice)
- ACLU bill-position cross-correlation repurpose (different slice)
- AFP federal national scorecard repurpose (cross-slice with slice 8)
- New `deprecated` column on `state_scorecard_orgs` (future migration)
- 50-state expansion of LCV coverage beyond MI + CO

## Estimated commit count

~6-7 commits on `slice-11-lcv-scorecards`:
- 1 spec + 1 plan (already committed at branch start)
- 1 audit doc
- 1 LCV restructure (`lcv/` subfolder + tests + fixtures + delete old `lcv.ts`)
- 1 ACLU + AFP deprecation rewrites
- 1 CLAUDE.md + memory closure

Squash-merge to master locally per established slice-handoff pattern.

## Cross-references

- Slice 5G (per-org scorecard adapter pattern, stub-shipping infrastructure)
- Slice 9 (NRA-PVF production parser + HTML-scrape template + `nra-helpers.ts` pattern)
- Gotcha #12 (NRA letter-grade canonical mapping)
- Gotcha #18 (HTML-scrape adapter constraints: state-name URLs, browser UA, chamber inference)

## Open questions

None. All 5 brainstorming questions resolved (axis, mega-slice vs decompose, layout, discovery, LCV-CA scope).
