# Slice 53 — Watchlist Evidence (donor watchlists) Design Spec

**Date:** 2026-06-03
**Branch:** `slice-53-watchlist-evidence`
**Status:** Approved (brainstorm) — pending spec review → writing-plans

## 1. Goal / user story

Slice 52 shipped "watchlist" lenses (`lens_type='watchlist'`) that a user can select in the issue-priorities flow, but they ship with empty `evidence_sources` and **nothing renders on a rep's page**. Slice 53 makes the two **data-backed donor watchlists** real: when a signed-in user has selected a watchlist, every rep's Issue Positions card shows a **`⚑` flag with evidence** if that rep matches it (e.g. "⚑ Fossil-fuel industry donor — $42k from Oil & Gas, Coal Mining").

It establishes the **full watchlist evidence pipeline end-to-end** (evidence model → on-the-fly scoring → inline UI) with one real data source, so future watchlists slot in by adding config.

## 2. Audit findings that shaped this scope (Gotcha #20)

A data-availability audit (2026-06-03) of the 5 slice-52 watchlist lenses found only 2 are backed by ingested data:

| Watchlist (lens slug) | Topic | Backing | Verdict |
|---|---|---|---|
| `industry-donor-recipients` | environment | `finance_industry_top` (OpenSecrets industries) | ✅ data-backed |
| `for-profit-prisons` | law-and-order | same finance table | ✅ data-backed |
| `anti-fraud-self-interest` | law-and-order | ethics complaints + disclosures, no fraud-findings table | ⚠️ curated-only — **defer** |
| `epstein-related-protectors` | law-and-order | no Epstein bill tagging in Congress.gov subjects | ⚠️ curated-only — **defer** |
| `slapp-suit-participants` | law-and-order | no court-records data anywhere | ❌ wrong-premise — **deprecate** |

Also: `evidence_sources` is an undefined/unused jsonb placeholder (migration 0056), the scoring RPCs ignore it, and **no UI renders watchlist evidence**. So slice 53 defines the model + builds the UI + wires the real source — it is not "fill in 5 adapters."

**Donor data is federal-only.** `finance_industry_top` → `finance_summaries` is federal (OpenSecrets/OpenFEC, slice 4). State finance (slice 5E `state_finance_summaries`) has no industry breakdown. So the 2 donor watchlists flag only on `/officials/[id]`; state reps simply never match in v1 (NULL ≠ 0 — render nothing, no error).

## 3. Scope

**In scope:**
- Define the `evidence_sources` shape (`EvidenceSource` type).
- Curated industry-name lists per category (`fossil-fuel`, `private-prison`) in the seed; baked into the 2 donor watchlists' `evidence_sources`.
- New SECURITY DEFINER SQL fn `get_rep_watchlist_flags(official_id)` (migration 0058), parallel to slice-52 `rep_stance_score`/`get_rep_issue_alignment`.
- `@chiaro/issues`: `EvidenceSource` type + `fetchRepWatchlistFlags` query + `useRepWatchlistFlags` hook + key.
- Inline `⚑` flag rows in `FederalIssuePositionsCard` + `StateIssuePositionsCard` (shared `@chiaro/officials-ui`).
- Deactivate the 3 non-data-backed watchlists in the catalog (SLAPP deprecated; anti-fraud + Epstein deferred), documented.
- Tests: pgTAP for the fn; vitest for the category map, hook, and 2 card integrations; CI catalog-fixture coverage.

**Out of scope (deferred):**
- True two-polygon you-vs-rep radar overlay (separate slice — `get_rep_issue_alignment` would need to also return raw user/rep per-topic position vectors).
- State donor/industry data (no state industry source).
- `anti-fraud-self-interest` + `epstein-related-protectors` curation (a future curated-data slice).
- SLAPP (no public data product).
- Any new tables/columns. `evidence_sources` already exists (0056); slice 53 adds only the scoring function.

## 4. Data model

### 4.1 `EvidenceSource` shape (`packages/issues/src/types.ts`, parallel to `MeasurementSource`)
```ts
export interface EvidenceSource {
  type: 'finance-industry'
  config: {
    category: string        // label, e.g. 'fossil-fuel' (informational + UI)
    industries: string[]    // exact OpenSecrets industry names to match against finance_industry_top.industry
    min_amount?: number     // optional threshold on summed matched amounts; default 0 (no threshold)
  }
}
```
> Approved match rule: **no dollar threshold by default** — a rep matches if ≥1 `config.industries` value appears in their `finance_industry_top` (already the top-25 ranked industries, so presence = "major donor"). `min_amount` is kept optional for future tuning.

### 4.2 Industry-category lists (`packages/db/supabase/seed/issue-catalog/finance-industry-categories.ts`)
Curated exported constants of OpenSecrets industry-name strings:
```ts
export const FOSSIL_FUEL_INDUSTRIES = ['Oil & Gas', 'Coal Mining', 'Electric Utilities', 'Natural Gas Pipelines', /* … */]
export const PRIVATE_PRISON_INDUSTRIES = ['Private Prisons', 'Corrections', /* … */]
```
> The exact strings must match real `finance_industry_top.industry` values; the plan verifies against ingested data (`select distinct industry from finance_industry_top`). Operator extends the lists in code (YAGNI on a mapping table; can graduate later).

### 4.3 Catalog wiring (`catalog-data.ts`, re-seeded via `pnpm seed:issue-catalog`)
- `industry-donor-recipients` → `evidence_sources: [{ type:'finance-industry', config:{ category:'fossil-fuel', industries: FOSSIL_FUEL_INDUSTRIES }}]`
- `for-profit-prisons` → `evidence_sources: [{ type:'finance-industry', config:{ category:'private-prison', industries: PRIVATE_PRISON_INDUSTRIES }}]`
- `slapp-suit-participants` → `active: false` + JSDoc `@deprecated` (wrong-premise, no source; mirrors slice 11/13 deprecation).
- `anti-fraud-self-interest` + `epstein-related-protectors` → `active: false` + JSDoc note (deferred to a future curated-data slice).
- The flow's lens picker already filters on `active` (confirm); deactivated watchlists drop out of selection, so users only pick data-backed ones.

> No schema migration for the catalog — `evidence_sources` exists (0056) and `active` exists on `issue_lenses` (0056). Catalog changes are seed-data only.

## 5. Scoring function (migration `0058_watchlist_flags.sql`)

`get_rep_watchlist_flags(p_official_id uuid) returns jsonb`, SECURITY DEFINER, `stable`, `set search_path = public`, granted to `authenticated`. Pattern mirrors slice-52 `get_rep_issue_alignment`:

1. `uid := auth.uid()`; return `'[]'::jsonb` if null.
2. For each of the caller's selected **watchlist** lenses (`user_issue_selections s join issue_lenses l … where s.user_id = uid and l.lens_type = 'watchlist' and l.active`):
   - For each `finance-industry` evidence source in `l.evidence_sources`:
     - Join `finance_industry_top fit join finance_summaries fs on fit.finance_summary_id = fs.id` where `fs.official_id = p_official_id`, latest cycle (`order by fs.cycle desc limit 1` summary, or max-cycle), and `fit.industry in (select jsonb_array_elements_text(cfg->'industries'))`.
     - Aggregate matched `{industry, amount}` rows + `sum(amount)`.
     - If ≥1 match **and** `sum(amount) >= coalesce((cfg->>'min_amount')::numeric, 0)`, emit a flag.
3. Return `jsonb` array: `[{ topicSlug, lensSlug, label, category, totalAmount, evidence:[{industry, amount}] }]`. Empty array if no matches.

> Reconciliation items for the plan: confirm `finance_summaries` cycle selection (latest vs a fixed `CURRENT_CYCLE='2024'` like the finance card uses); confirm `issue_lenses` has an `active` column (it does, 0056) and that the picker honors it.

## 6. `@chiaro/issues` package additions
- `types.ts`: `EvidenceSource` + `RepWatchlistFlag` (`{ topicSlug, lensSlug, label, category, totalAmount: number, evidence: { industry: string; amount: number }[] }`).
- `queries.ts`: `fetchRepWatchlistFlags(client, officialId)` → `client.rpc('get_rep_watchlist_flags', { p_official_id })`.
- `keys.ts`: `issuesKeys.repWatchlistFlags(officialId)`.
- `hooks.ts`: `useRepWatchlistFlags(client, officialId)` (5-min stale / 30-min gc, client-as-first-arg pattern).
- Barrel export.

## 7. UI — inline flags in the Issue Positions cards
Extend `packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx` + `state/StateIssuePositionsCard.tsx`:
- Call `useRepWatchlistFlags(client, officialId)` (additive; never gates the card — empty/loading → no flags, card renders exactly as slice 52).
- Render a **`⚑ <label>` flag row** per returned flag (brand-tokened via `useBrandTokens()`, visually distinct from the `★` `IssuePriorityTag`), with evidence sub-text built from `evidence` (e.g. `$42k from Oil & Gas, Coal Mining`). A small shared `WatchlistFlag` presentational component in `src/issues/`.
- Federal shows flags (federal donor data); state renders none for the 2 v1 watchlists (no state industry data) — the slot exists for future watchlists. Gotcha #15 federal/state asymmetry preserved.
- a11y: `accessibilityLabel` on each flag; no inline hex.

## 8. Testing
- **pgTAP** (`get_rep_watchlist_flags.test.sql`): seed an official + finance_summary + finance_industry_top rows (one matching a category industry, one not) + a user with the watchlist selected; assert (a) match returns a flag with the right evidence, (b) a rep with no category industries returns `[]`, (c) `min_amount` gating when set, (d) unselected/inactive watchlist → no flag, (e) unauthenticated → `[]`.
- **vitest** (`@chiaro/db`): `finance-industry-categories` constants are non-empty + the catalog re-seed wires the 2 donor watchlists' `evidence_sources` + deactivates the 3 others (extend the existing `issue-catalog/ingest.test.ts`).
- **vitest** (`@chiaro/issues`): `fetchRepWatchlistFlags` calls the RPC; hook key shape.
- **vitest** (`@chiaro/officials-ui`): `WatchlistFlag` renders label + evidence; the 2 Issue Positions cards render a flag when the hook returns one and are unchanged when it returns `[]` (mock `@chiaro/issues`).
- **CI**: extend the issue-catalog fixture-ingest assertion to cover an `evidence_sources`-bearing watchlist.

## 9. Verification (pre-merge, per Gotcha #30 — merge via green PR CI)
`pnpm -r typecheck` · `pnpm db:reset && pnpm seed:tiger && pnpm db:test` (incl. new pgTAP) · `pnpm test` · `pnpm --filter @chiaro/web build` · `pnpm --filter @chiaro/web test` (web render tests) · `pnpm --filter @chiaro/mobile test`. Ship via PR with all 4 CI jobs green.

## 10. File inventory (estimate ~22–28 files)
- DB: `migrations/0058_watchlist_flags.sql` + `tests/get_rep_watchlist_flags.test.sql` + `seed/issue-catalog/finance-industry-categories.ts` + edits to `seed/issue-catalog/catalog-data.ts` + `seed/issue-catalog/ingest.test.ts`.
- Package: `@chiaro/issues` `types.ts`/`queries.ts`/`keys.ts`/`hooks.ts`/`index.ts` + tests.
- UI: `src/issues/WatchlistFlag.tsx` + edits to `FederalIssuePositionsCard.tsx` + `StateIssuePositionsCard.tsx` + barrel + tests.
- CI: `.github/workflows/ci.yml` fixture assertion (if needed).
- Docs: CLAUDE.md slice-53 entry.

**Tier:** full Slice. **Workspace count unchanged (11).** No new tables; one new SQL fn (migration 0058).

## 11. Open items for the plan to reconcile against live code
1. Exact `finance_industry_top.industry` strings → finalize the two category lists (`select distinct industry from finance_industry_top`).
2. Cycle selection in the SQL fn (latest cycle vs fixed `CURRENT_CYCLE`).
3. Confirm the lens picker filters on `active` so deactivated watchlists drop out.
4. Exact insertion point in the two Issue Positions cards (row order relative to scorecard rows + `★` tags).
