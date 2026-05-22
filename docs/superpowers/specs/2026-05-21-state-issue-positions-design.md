# State Issue Positions Design (sub-slice 5G)

> **Status:** Design approved 2026-05-21. Implementation plan generated separately by `superpowers:writing-plans`.

## Goal

Replace `ComingSoonCard('Issue Positions')` on `/state-officials/[id]` with a real `StateIssuePositionsCard` listing advocacy-org scorecard ratings for each state legislator, with expandable evidence panels showing the legislator's votes on subject-matched state bills. 5 lean-balanced orgs scaffolded (LCV, ACLU, NRA, Planned Parenthood, AFP). Per-state per-org coverage determined by Task 1 research; production parsers shipped as stubs per slice 5E adapter precedent.

Mirrors slice 4's federal scorecards architecture but uses **parallel `state_scorecard_*` tables** (no federal-schema reuse) and **per-org adapters** (each spans N states, vs slice 5D/5E/5F per-state adapters).

## Architecture

```
seed:state-scorecards-ingest --session=YYYY [--state=XX] [--org=SLUG] [--skip-on-error]
  │
  └─ state-scorecards-ingest.ts (orchestrator, per-adapter isolation)
       │
       ├─ state-scorecards/aclu.ts                (ACLU state chapters)
       ├─ state-scorecards/lcv.ts                 (LCV state chapters)
       ├─ state-scorecards/nra.ts                 (NRA state legislative grades A-F)
       ├─ state-scorecards/planned-parenthood.ts  (Planned Parenthood Action Fund state)
       └─ state-scorecards/afp.ts                 (Americans for Prosperity state chapters)
            │
            └─ each adapter iterates its covered_states[] array, upserts:
                state_scorecard_orgs       (per (slug, state) tuple — chapter row)
                state_scorecard_ratings    (per (org, official, session) tuple)
```

**Per-org adapter pattern.** Slice 5D/5E/5F adapters are **per-state** (fetch-ca, fetch-ny, ...). Slice 5G adapters are **per-org** because each org publishes scorecards spanning N states, not per-state data sources. Each adapter declares `covered_states: string[]` and iterates them during `fetchRatings`.

**Workspace placement:** scorecard queries + hooks live in `@chiaro/officials` (federal scorecards already do — single source of truth for everything tied to an official). The `useOfficialStateVotesOnSubject` hook for evidence-panel rendering lands in `@chiaro/state-bills` (mirrors federal `useOfficialVotesOnSubject` in `@chiaro/bills`). **Workspace stays at 10 packages.**

**Data flow:**

```
per-org adapter → normalize per-state ratings (openstates_person_id keyed)
                                ↓
                 state-scorecards-ingest orchestrator
                                ↓
                 state_scorecard_* tables (read-only via RLS to authenticated)
                                ↓
@chiaro/officials queries → useOfficialStateScorecardRatings (latest session)
                                ↓
                 <StateIssuePositionsCard>
                    ├─ per-rating row (org + score + lean tier)
                    └─ <details> evidence panel
                          ↓ uses @chiaro/state-bills hook
                          useOfficialStateVotesOnSubject(client, officialId, subjectCandidates)
                          ↓ joins state_vote_positions × state_votes × state_bills × state_bill_subjects
                          <StateIssueVotesEvidence>
                                ↓
                          /state-officials/[id] (replaces ComingSoonCard('Issue Positions'))
```

## Schema

### Migration 0040 — `state_scorecards.sql`

```sql
-- Sub-slice 5G: state-legislator scorecards. Parallel to slice-4
-- federal scorecard_orgs / scorecard_ratings (preserves federal flow
-- unchanged). Sourced from per-org adapters via openstates_person_id.

create table public.state_scorecard_orgs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  state           char(2) not null,
  name            text not null,
  issue_area      text not null,
  lean            text not null check (lean in ('progressive', 'conservative', 'libertarian', 'single-issue', 'centrist')),
  methodology_url text not null,
  scoring_min     int not null default 0,
  scoring_max     int not null default 100,
  notes           text,
  unique (slug, state)
);

create table public.state_scorecard_ratings (
  id           uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.state_scorecard_orgs(id) on delete cascade,
  official_id  uuid not null references public.officials(id) on delete restrict,
  session      text not null,
  score        numeric(5,2) not null,
  source_url   text not null,
  ingested_at  timestamptz not null default now(),
  unique (scorecard_id, official_id, session)
);

create index state_scorecard_orgs_state_idx
  on public.state_scorecard_orgs(state);
create index state_scorecard_ratings_official_idx
  on public.state_scorecard_ratings(official_id, session);
create index state_scorecard_ratings_scorecard_idx
  on public.state_scorecard_ratings(scorecard_id);
```

**FK convention** matches [[project_chiaro_audit_2026_05_19_closure]]:
- `officials.id` reference is `RESTRICT` (preserves rating history)
- `state_scorecard_orgs.id` reference is `CASCADE` (ratings are strict subordinates)

**Slug design.** `slug` is the **org-level** identifier (`'aclu'`, `'lcv'`, `'nra'`, `'planned-parenthood'`, `'afp'`). The `state` column distinguishes per-state chapters. UNIQUE on `(slug, state)`. E.g., `(slug='aclu', state='CA')` = "ACLU of California", `(slug='aclu', state='NY')` = "ACLU of New York".

**`session` field** is text per slice 5D session-format precedent. Per-state values: CA `'20252026'` (biennial), NY `'2025'` (annual), TX `'89R'`, MI `'2025-2026'`. Don't normalize.

**`score` precision.** `numeric(5,2)` matches federal scorecard_ratings precedent (0.00–999.99). Most orgs use 0–100; NRA uses A-F → adapter maps to 0–100 (A=100, B=80, C=60, D=40, F=20).

### Migration 0041 — `state_scorecards_rls.sql`

RLS mirrors slice 5D/5E/5F pattern: read = `authenticated`, write = `service_role`. New pgTAP file `state_scorecards_rls.test.sql` with `plan(14)`:

- Both tables exist
- RLS enabled on both
- `lean` CHECK rejects unknown values
- `(slug, state)` unique constraint enforced
- `(scorecard_id, official_id, session)` unique constraint enforced
- `score` accepts `numeric(5,2)`
- FK on `official_id` is RESTRICT (cannot delete official with ratings)
- FK on `scorecard_id` is CASCADE (deleting org deletes ratings)
- All 3 indexes exist
- 4 RLS placeholder assertions (anon SELECT denied, authenticated SELECT, service_role INSERT/DELETE) — covered in integration test layer

**Total pgTAP delta:** +14 plans in 1 new file. Workspace pgTAP: 341 → 355 across 27 files.

## Per-org adapter pattern

### `state-scorecards/shared.ts`

```ts
import type { Client } from 'pg'

export type ScorecardLean =
  'progressive' | 'conservative' | 'libertarian' | 'single-issue' | 'centrist'

export interface NormalizedStateRating {
  openstates_person_id: string
  state: string                                   // 2-letter, must match adapter.covered_states[]
  score: number                                   // normalized to scoring_min..scoring_max
  source_url: string
}

export interface StateScorecardAdapter {
  slug: string                                    // 'aclu', 'lcv', 'nra', 'planned-parenthood', 'afp'
  name_template: (state: string) => string        // (s) => `ACLU of ${US_STATE_NAMES[s]}`
  issue_area: string                              // 'civil-liberties', 'environment', etc.
  lean: ScorecardLean
  methodology_url_template: (state: string) => string
  scoring_min: number
  scoring_max: number
  notes?: string
  covered_states: string[]                        // set per Task 1 research findings
  fetchRatings(opts: { client: Client; session: string; state?: string }): Promise<NormalizedStateRating[]>
}

export interface StateScorecardStats {
  org_slug: string
  orgsUpserted: number                            // per-state org-row count
  ratingsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]                    // openstates_person_ids missing from public.officials
  errors: string[]
  skipped?: boolean
  skipReason?: string
}
```

### Helpers

```ts
/**
 * UPSERT the per-state state_scorecard_orgs row for this adapter × state,
 * returning the org id. Adapters call this once per covered state before
 * inserting ratings.
 */
export async function upsertStateScorecardOrg(
  client: Client,
  adapter: StateScorecardAdapter,
  state: string,
): Promise<string>

/**
 * UPSERT a single rating row by (scorecard_id, official_id, session).
 * Returns true if rating was inserted/updated; false if the official is
 * unknown (caller appends openstates_person_id to officialsUnmatched).
 */
export async function upsertStateScorecardRating(
  client: Client,
  scorecardId: string,
  openstates_person_id: string,
  session: string,
  score: number,
  source_url: string,
): Promise<boolean>
```

Lookup pattern matches slice 5E `resolveOfficialByName` but keyed on `openstates_person_id` (state legislators are reliably keyed by this since slice 5C).

### Per-org adapter files (5)

Each ships **stub `fetchRatings` returning `[]`** for v1 — same pattern as slice 5E enrich-* adapters. Production parsers per (org, state) tuple are operator follow-up. Test fixtures per org under `fixtures/state-scorecards/<slug>.json` with normalized `NormalizedStateRating[]` for 2-3 states; tests inject via `fetcher` opt.

**Per-adapter metadata** (set in code; `covered_states` from Task 1):

| Slug | Issue area | Lean | Score range | Notes |
|---|---|---|---|---|
| `aclu` | civil-liberties | progressive | 0–100 | Per-state chapters publish independently. Methodology varies. |
| `lcv` | environment | progressive | 0–100 | LCV state affiliates publish annual environmental scorecards. |
| `nra` | second-amendment | conservative | 0–100 (mapped from A-F) | NRA grades letters; adapter normalizes A=100, B=80, C=60, D=40, F=20. |
| `planned-parenthood` | reproductive-rights | progressive | 0–100 | PP Action Fund publishes state advocacy scorecards. Per-state coverage varies. |
| `afp` | conservative-policy | conservative | 0–100 | AFP state chapters publish legislative scorecards. |

### Orchestrator `state-scorecards-ingest.ts`

```ts
export interface IngestStateScorecardsOpts {
  session: string
  state?: string                                  // optional: only run adapters with this state in covered_states[]
  org?: string                                    // optional: only run adapter with this slug
  skipOnError?: boolean
  adapters?: StateScorecardAdapter[]              // test injection
  client?: Client
}

export interface IngestStateScorecardsStats {
  session: string
  adaptersAttempted: number
  adaptersOk: number
  totalOrgsUpserted: number
  totalRatingsUpserted: number
  totalOfficialsUnmatched: number
  byOrg: StateScorecardStats[]
}
```

Mirrors slice 5E `state-finance-ingest.ts` orchestration: per-adapter isolation, `--skip-on-error` continues past failures, default aborts on first thrown error.

CLI: `pnpm seed:state-scorecards --session=20252026 [--state=CA] [--org=aclu] [--skip-on-error]`

Test coverage (~6 cases): happy path with all 5 adapters, `--org` filter, `--state` filter, `--skip-on-error`, default abort, unmatched aggregation.

### Per-adapter test files

Each (`aclu.test.ts`, `lcv.test.ts`, etc.) ~4 cases against a fixture: happy-path 2-3 ratings ingested, multi-state iteration, source slug matches, idempotent re-run. **~20 cases across 5 adapters.**

## UI

### `StateIssuePositionsCard.tsx` (web + mobile)

Composes 1 hook from `@chiaro/officials`:
```ts
useOfficialStateScorecardRatings(client, official.id)
// Returns: StateScorecardRatingWithOrg[]
// Each row joins state_scorecard_orgs → ratings filtered to latest session
```

Card layout (mirrors slice 5D `StateServiceRecordCard` pattern):
- **Header**: "Issue Positions" + latest-session label
- **Per-rating row**:
  - Left: org name (from `org.name`) + lean badge (color from `@chiaro/ui-tokens` `SCORECARD_LEAN_*`)
  - Center: score formatted `{score}/{scoring_max}` (e.g., `'82/100'`)
  - Right: alignment label tier (`scoreToTier(score, scoring_max)` → `ALIGNMENT_LABEL` lookup; reused from federal slice 4)
  - Clickable `<details>`: expands to `<StateIssueVotesEvidence>` showing the legislator's votes on bills with subjects matching the org's issue area
- **Empty state**: when ratings array is empty, single-line italic "No scorecard ratings yet for this legislator" (slice 5D empty-state precedent).
- **NRA letter-grade display**: score `0–100` reverse-maps to display letter (`80–100 = A`, `60–79 = B`, etc.). Shown as letter + numeric in parens.

**Chamber-gated:** returns null for federal officials. Hooks called unconditionally before the gate (Rules of Hooks per [[project-chiaro-slice5d-state-bills]] item 6).

### `StateIssueVotesEvidence.tsx` (web + mobile)

New component. Renders the legislator's votes on state bills tagged with the org's issue area subjects. Composes a new hook in `@chiaro/state-bills`:

```ts
useOfficialStateVotesOnSubject(
  client: ChiaroClient,
  officialId: string,
  subjectCandidates: string[],
  opts: { enabled?: boolean },
): UseQueryResult<StateVoteWithPosition[], Error>
```

Subject mapping in card module:

```ts
const SUBJECT_BY_AREA_STATE: Record<string, string[]> = {
  'environment':         ['Environment', 'Energy', 'Climate'],
  'civil-liberties':     ['Civil rights', 'Privacy', 'Civil liberties'],
  'reproductive-rights': ['Health', 'Reproductive rights'],
  'second-amendment':    ['Firearms', 'Guns'],
  'business-policy':     ['Commerce', 'Business', 'Taxation'],
  'liberal-policy':      ['Government operations'],
  'conservative-policy': ['Government operations'],
  'labor':               ['Labor', 'Employment'],
}
```

`useOfficialStateVotesOnSubject` SQL joins `state_vote_positions × state_votes × state_bills × state_bill_subjects` with `subject = ANY(subjectCandidates)`. Looser than federal Library-of-Congress codes; state subjects are arbitrary text per OpenStates.

Empty result is acceptable — UI shows "No correlated votes found for this issue area" with copy explaining the subject-matching approximation.

### Swap in `StateOfficialDetailPage.tsx` (web + mobile)

```tsx
import { StateIssuePositionsCard } from './StateIssuePositionsCard'

const PLACEHOLDER_CATEGORIES = ['Community Presence', 'Ethics & Accountability'] as const  // was 3 entries

<section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <StateServiceRecordCard official={official} />
  <StateFinanceCard official={official} />
  <StateIssuePositionsCard official={official} />          {/* NEW */}
  {PLACEHOLDER_CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
</section>
```

Parent tests get the existing 5-mock-+-wrap pattern extended with `useOfficialStateScorecardRatings` (default returns `[]` so the empty-state header renders).

### Mobile parity

RN primitives. Singleton `supabase` import per slice 5D precedent. TestIDs (`state-issue-positions-card`, `state-issue-votes-evidence`) match web for cross-platform consistency.

## Testing strategy

### pgTAP
- New file `state_scorecards_rls.test.sql` plan(14) — table existence, RLS, CHECK constraints, FK behavior, indexes.
- Total: 341 → 355 across 27 files.

### Vitest (db)
- `state-scorecards-ingest.test.ts` ~6 cases
- Per-org adapter tests: 5 files × ~4 cases = ~20
- `state-scorecards/shared.test.ts` ~4 cases (helpers against real local Supabase)
- **~30 new db vitest cases**

### `@chiaro/officials` hooks
- `useOfficialStateScorecardRatings` hook test ~2 cases (mock fetcher, hook shape)

### `@chiaro/state-bills` hooks
- `useOfficialStateVotesOnSubject` hook test ~3 cases (fetcher with subject filter, multi-subject match, enabled-gating)

### Web vitest
- `StateIssuePositionsCard.test.tsx` ~7 cases (header, ratings list, empty state, evidence-panel expand, chamber-gated, lean badge, NRA letter-grade reverse-map)
- `StateIssueVotesEvidence.test.tsx` ~5 cases (renders votes, empty state, subject filtering, multi-subject match, position-pill)
- `StateOfficialDetailPage.test.tsx` fixture extension (mock + 1 ratings-array entry)

### Mobile jest-expo
- Same shape as web with RN primitives = ~12 cases

### Integration test extension
`packages/officials/test/queries.integration.test.ts` (already extended in 5D/5E/5F):
- beforeAll: 1 `state_scorecard_orgs` row + 1 `state_scorecard_ratings` row attached to the slice-5D test asm
- afterAll: FK-ordered cleanup (ratings → orgs → state_committee_memberships → state_finance → ... → officials → districts)
- 1 new test case: anon RLS can read `state_scorecard_ratings`

## Known limitations (documented in CLAUDE.md gotcha #12)

1. **All 5 adapters ship stub `fetchRatings` returning `[]`.** Production parsers (CSV/HTML/PDF scrapes per org per state) are operator follow-up work. Same posture as slice 5E enrich-* adapters.
2. **Coverage matrix is research-dependent.** Task 1 outputs which (org × state) combos publish machine-readable data. v1's `covered_states[]` arrays per adapter reflect that finding; states with zero coverage across all 5 orgs are out of v1 scope.
3. **Per-state chapters publish independently.** Each ACLU/LCV/etc. state chapter has its own methodology, file format, URL pattern. Adapters use `*_template` callables for per-state metadata; real parsers must handle per-state quirks.
4. **NRA grades A-F mapped to 0–100.** Adapter normalizes (A=100, B=80, C=60, D=40, F=20). UI reverse-maps for display (`82 → 'B (82)'`). Lossy round-trip.
5. **`subject` mapping is fuzzy.** `SUBJECT_BY_AREA_STATE` accepts a list of candidate subjects per issue area; mismatched bills yield "No correlated votes" in evidence panel. State-subject conventions vary per OpenStates; accept the approximation.
6. **Per-org score range varies.** `scoring_max` per org row drives the display denominator. UI handles diverse ranges via `scoreToTier(score, scoring_max)` (reused from slice 4).
7. **Per-bill grading detail OUT of scope.** Some orgs grade individual bills (which counted toward the score, the legislator's position on each). v1 stores final-grade-per-legislator only; evidence panels approximate per-bill detail via subject-correlated state votes.
8. **No per-cycle history.** v1 stores one rating per (org, official, session). Historical ratings (last 5 sessions) deferred.
9. **NE Nonpartisan rules out lean signal.** Nebraska unicameral is officially nonpartisan; partisan-leaning org scores may be noisy or absent. Adapters either skip NE in `covered_states[]` or include with documentation.
10. **National vs state-chapter ACLU.** National ACLU publishes federal scorecards (slice 4 `scorecard_orgs`); state chapters publish state scorecards (slice 5G `state_scorecard_orgs`). Separate schema entries. UI doesn't link them.
11. **Joint-state orgs (e.g., NRA national vs NRA-CA).** NRA publishes federal candidate grades + state legislative grades from one national operation, not per-state chapters. Adapter handles this by setting all `covered_states[]` to the states with published state-leg data; one `state_scorecard_orgs` row per (slug='nra', state=XX) is still inserted to preserve the schema invariant.

## Acceptance criteria

1. Migrations 0040 + 0041 apply cleanly via `pnpm db:reset`.
2. `pnpm db:test` green: 355 pgTAP plans across 27 files.
3. `pnpm --filter @chiaro/db test` green: ~30 new vitest cases (orchestrator + 5 adapters + shared helpers).
4. `pnpm --filter @chiaro/officials test` green: new hook + integration test case pass.
5. `pnpm --filter @chiaro/state-bills test` green: new `useOfficialStateVotesOnSubject` hook test passes.
6. `pnpm --filter @chiaro/web test` green: `StateIssuePositionsCard` + `StateIssueVotesEvidence` tests pass; `StateOfficialDetailPage` parent test updated.
7. `pnpm --filter @chiaro/mobile test` green: same component coverage as web.
8. `pnpm --filter @chiaro/web build` succeeds: `/state-officials/[id]` route present.
9. `pnpm -r typecheck`: 10 packages clean.
10. Manual smoke (post-merge): `pnpm seed:state-scorecards --session=2024 --skip-on-error` populates `state_scorecard_orgs` per (org × state in covered_states[]); `state_scorecard_ratings` empty until operator wires real parsers.
11. `/state-officials/[id]` for a legislator WITHOUT ingested ratings renders the empty-state copy ("No scorecard ratings yet for this legislator").
12. `/state-officials/[id]` for a legislator WITH ratings renders the org list + scores + lean tiers; clicking a row expands the evidence panel.
13. Federal `/officials/[id]` unchanged — slice 4 federal scorecards flow untouched.
14. `state_scorecard_ratings.official_id` FK delete behavior verified RESTRICT in pgTAP.
15. Mobile detail page renders `StateIssuePositionsCard` on the same legislator routes.

## Operator pre-flight (post-merge)

```bash
pnpm install                                                  # workspace unchanged at 10
pnpm db:reset                                                 # apply migrations 0001-0041
pnpm db:test                                                  # confirm 355 plans / 27 files
# Existing pre-reqs unchanged: seed:tiger, seed:officials, seed:state-officials,
# seed:state-bills-full, seed:state-finance, seed:openstates-committees-fetch + -ingest,
# seed:state-metrics-recompute.
pnpm seed:state-scorecards --session=2024 --skip-on-error     # NEW (stub adapters return [])
```

After v1 ships, operator wires real data per (org, state) tuple by replacing each stub `fetchRatings` with a parser. Slice 5G ships the scaffolding; data sourcing is incremental.

## Remaining `ComingSoonCard`s after slice 5G

| Card | Status |
|---|---|
| Service Record | ✅ Real (slice 5D + 5F Performance subsection) |
| Finance | ✅ Real (slice 5E) |
| Issue Positions | ✅ Real (slice 5G — this slice) |
| Community Presence | ❌ Still ComingSoonCard — future slice |
| Ethics & Accountability | ❌ Still ComingSoonCard — future slice |

2 placeholders remain. Each has its own data-source challenges (state town halls; state ethics + stock + recall data).

---

## Open implementation decisions (resolve in plan)

- **Task 1 deliverable format.** Task 1 outputs a coverage matrix (org × state). Format: markdown table committed to `docs/superpowers/specs/2026-05-21-state-scorecards-coverage.md` OR inline TypeScript constant in `state-scorecards/shared.ts`. Plan picks; either works.
- **NRA letter-grade map storage.** `score numeric(5,2)` stores the normalized 0–100 value. The letter-to-numeric mapping (A=100, B=80, ...) lives in the NRA adapter (write-side) and in the card's display helper (read-side). Both must stay in sync; consider a shared `nra-letter-map.ts` if drift becomes a concern.
- **`SUBJECT_BY_AREA_STATE` ownership.** Currently scoped to the card module. If a future slice needs the mapping elsewhere (e.g., backend metric correlating votes-on-environmental-bills), hoist to `@chiaro/ui-tokens` or a new shared util.
- **Per-org test fixture realism.** Fixtures use 2-3 ratings per file with synthetic openstates_person_id values. Real OpenStates ids look like `ocd-person/uuid-v4`. Tests use FX-prefixed synthetic IDs that match seeded test officials — same posture as slice 5D/5E adapter tests.
- **`useOfficialStateScorecardRatings` "latest session" semantics.** When the same (org, official) tuple has ratings for multiple sessions (e.g., a legislator scored by ACLU-CA in both `'20232024'` and `'20252026'`), the hook returns the row with max `ingested_at`. Matches slice 5E `fetchOfficialStateFinanceSummary` pattern (`order by ingested_at desc limit 1` per group). Documented in the query implementation. If future need surfaces showing historical ratings, add a separate hook (e.g., `useOfficialStateScorecardHistory`) — out of v1 scope.
