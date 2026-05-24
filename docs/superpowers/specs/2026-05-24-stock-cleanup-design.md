# Slice 13 — Drop `state_stock_transactions` + deprecate 6 wrong-premise stubs

**Date:** 2026-05-24
**Scope tier:** Mid-sized slice (~37 files; mostly mechanical deletions + deprecations + 1 migration + 1 card refactor)
**Predecessor slices:** 5I (state ethics & accountability — original schema), 11 (deprecation pattern), 12 (audit that surfaced this work).

## Goal

Apply slice 12's audit findings: drop the over-specified `state_stock_transactions` table and refactor downstream UI/types/queries; deprecate the 6 stub adapters confirmed-wrong by the audit (4 per-state town_halls — Mobilize covers them — plus MI ethics_complaints + TX financial_disclosures). Preserves NY-side stubs for slice 14 production-parser work.

## Motivation

Slice 12's stub adapter audit confirmed:

1. **`state_stock_transactions` is over-specified.** All 5 per-state stock stubs (CA-FPPC, NY-JCOPE, FL-COE, TX-TEC, MI-board) are bucket G — state legislatures don't maintain a STOCK Act analogue. Stock holdings/sales are line items inside annual financial disclosures (Form 700 / Form 6 / FDS / PFD / PFS), not a discrete data product. The federal/state schema parallel from slice 8 (federal-stock-transactions parity) held structurally but not semantically.

2. **Per-state town_halls premise was wrong for 4/5 states.** CA/FL/MI/TX have no aggregated state-government feed; `mobilize.us` (slice 7 nationwide adapter) IS the production solution. Per-state stubs are pure waste.

3. **MI ethics_complaints + TX financial_disclosures are permanently G.** No published source exists; mark these adapters deprecated rather than leave them aspirational.

NY stubs (NY town_halls, NY district_offices, NY ethics_complaints + events) stay live — they're bucket A and slice 14 ships them.

## Key design decisions

1. **Drop `state_stock_transactions` table entirely** (chosen over keep-table-with-empty-adapters or subsume-into-disclosures). Most honest about the data reality; aligns with Gotcha #21's documented rationale. Forward-compatibility loss (if any state ever changes filing rules) is acceptable — federal STOCK Act took an act of Congress to mandate.

2. **Keep `StateFinancialActivityCard` file name; rename only the displayed title** (chosen over file rename + barrel update). File rename would cascade into ~5 consumer imports + 2 test renames for a cosmetic improvement. Deferred to a future polish slice; title change ("Financial Activity" → "Financial Disclosures") is sufficient for user-facing accuracy.

3. **Apply slice 11 ACLU/AFP deprecation pattern for the 6 wrong-premise stubs** (chosen over file deletion). `@deprecated` JSDoc + `covered_states: []` + `fetchEvents` returns `[]`. Preserves orchestrator dispatch invariants without code changes to `state-community-ingest.ts` / `state-ethics-ingest.ts`. Slug preserved for `state_*_orgs`-style DB row continuity.

4. **No new Gotcha needed** — Gotcha #21 (added in slice 12) already documents the over-specification rationale and per-state town_halls finding.

## Architecture

### Migration 0053

```sql
-- packages/db/supabase/migrations/0053_drop_state_stock_transactions.sql

-- Slice 12 audit confirmed all 5 per-state stub adapters are bucket G —
-- state legislatures in CA/FL/MI/NY/TX don't have a STOCK Act analogue.
-- Gotcha #21 documents the over-specification + this drop decision.
-- This migration is destructive but safe: state_stock_transactions has
-- zero rows in any environment (no production parser ever shipped).

drop index if exists public.state_stock_transactions_official_date_idx;
drop index if exists public.state_stock_transactions_state_date_idx;
drop table if exists public.state_stock_transactions;
```

### Production code cleanup

**Delete (10 files):**
- `packages/db/supabase/seed/state-ethics/stock/` (5 adapters + index.ts + 5 test files)
- `packages/officials-ui/src/state/StateStockTransactionsList.tsx`
- `packages/officials-ui/test/state/StateStockTransactionsList.test.tsx`

**Modify @chiaro/officials (5 files):**
- `src/types.ts` — remove `StateStockTransactionRow`
- `src/queries.ts` — remove `fetchOfficialStateStockTransactions`
- `src/hooks.ts` — remove `useOfficialStateStockTransactions`
- `src/keys.ts` — remove `stateStockTransactions` key (if present)
- `src/index.ts` — remove the 3 re-export lines

**Modify @chiaro/officials tests (2 files):**
- `test/queries.integration.test.ts` — delete stock test cases
- `test/hooks.test.tsx` — delete stock hook test cases

**Modify @chiaro/officials-ui (3 files):**
- `src/state/StateFinancialActivityCard.tsx` — refactor to disclosures-only, title "Financial Activity" → "Financial Disclosures", remove stock subsection + summary line + all-empty branch updated
- `test/state/StateFinancialActivityCard.test.tsx` — remove stock mock + assertions; verify single-subsection card
- `test/state/StateOfficialDetailPage.test.tsx` — remove `useOfficialStateStockTransactions` mock entry
- `src/index.ts` — remove `StateStockTransactionsList` export

**Modify @chiaro/db seed/ingest (3 files):**
- `seed/state-ethics/shared.ts` — remove `NormalizedStockTransaction` type + stock dispatch
- `seed/state-ethics/shared.test.ts` — remove stock dispatch tests
- `seed/state-ethics-ingest.ts` — remove `stock` from component dispatch + CLI flag handling

**Modify pgTAP (1 file):**
- `supabase/tests/state_ethics_rls.test.sql` — remove 7 `state_stock_transactions` assertions (1 has_table + 1 RLS-enabled + 1 transaction_type CHECK + 1 days_late generated col + 1 NULL-distinct UNIQUE pass + 1 duplicate-non-NULL UNIQUE throws_ok + 1 FK RESTRICT throws_ok); plan(20) → plan(13); project pgTAP 409 → 402

**Modify Database type (1 file):**
- `packages/db/src/types.ts` — regenerated via `supabase gen types typescript --local` post-migration

### Stub deprecations (6 files modify + 6 test files modify)

Slice 11 ACLU/AFP pattern: `@deprecated` JSDoc + `covered_states: []` + `fetchEvents()` returns `[]`.

| File | Reason in JSDoc |
|---|---|
| `state-community/town-halls/ca-leginfo.ts` | "CA does not maintain an aggregated state-government town-hall feed. leginfo.ca.gov publishes institutional sessions only. Mobilize.us (slice 7) is the production source." |
| `state-community/town-halls/fl-doe.ts` | "flsenate.gov calendar shows institutional sessions only; House lacks even calendar UI. Mobilize.us covers nationwide." |
| `state-community/town-halls/mi-legislature.ts` | "Senator-by-senator coffee-hour pages exist on senate.michigan.gov + house.mi.gov but no aggregated feed. Mobilize.us covers nationwide." |
| `state-community/town-halls/tx-capitol.ts` | "Member calendars are not a feature of the Texas Capitol site; capitol.texas.gov uptime is also fragile. Mobilize.us covers nationwide." |
| `state-ethics/complaints/mi-board.ts` | "Michigan does not publish a standing online portal for ethics complaints. No source feed exists." |
| `state-ethics/disclosures/tx-tec.ts` | "Texas Ethics Commission explicitly does not publish PFS online per their Quick View page." |

Each `*.test.ts` updated to assert 4 cases (covered_states=[], fetchEvents=[], slug preserved, deprecation marker in JSDoc or notes).

**Orchestrator dispatch invariants preserved** — `state-community-ingest.ts` and `state-ethics-ingest.ts` already iterate `covered_states` per adapter. Empty arrays = no-op iteration. No code change needed.

## Card refactor — `StateFinancialActivityCard`

Title: "Financial Activity" → "Financial Disclosures".
Removes: `useOfficialStateStockTransactions` hook call, `openStock` state, stock summary line, stock subsection JSX.
Keeps: disclosures hook call, disclosures subsection, card chrome (`<CardSubsection>` wrapper retained for UI consistency with other state cards even though only 1 subsection remains).

Per Gotcha #15 (federal/state intentional asymmetries), state has 2 cards on the Ethics+Conduct side: `StateFinancialActivityCard` + `StateConductCard`. After this slice, `StateFinancialActivityCard` shows only Financial Disclosures (since stock is dropped). The 2-card asymmetry with federal's 1-card (`FederalEthicsAccountabilityCard`) still holds because state's Conduct card covers ethics_complaints + recall events, which federal lacks.

## Commit sequence (6 commits)

1. `feat(db): migration 0053 drop state_stock_transactions` — migration SQL + pgTAP test updates + regenerated `packages/db/src/types.ts`
2. `refactor(officials): remove state stock transaction queries/hooks/types` — `@chiaro/officials` cleanup
3. `refactor(officials-ui): rename StateFinancialActivityCard to disclosures-only + delete StateStockTransactionsList` — UI refactor
4. `refactor(state-ethics): delete stock adapters + orchestrator dispatch` — seed/ingest cleanup
5. `refactor(state-stubs): deprecate 6 wrong-premise stubs per slice 12 audit` — 4 town_halls + MI complaints + TX disclosures + test updates
6. `docs: slice 13 closure — CLAUDE.md entry + memory` — closure docs

Squash-merge to master per established slice-handoff pattern.

## Acceptance criteria

1. `pnpm db:reset` runs through migration 0053 without error
2. `pnpm db:test` (pgTAP) green at adjusted plan count
3. `pnpm -r typecheck` green across 11 packages
4. `pnpm test` (workspace) green
5. `pnpm --filter @chiaro/web build` succeeds
6. Web `/state-officials/[id]` renders without Stock subsection; card title shows "Financial Disclosures"
7. `packages/db/src/types.ts` regenerated; no `state_stock_transactions` type
8. CLAUDE.md slice 13 entry added; no new Gotcha (Gotcha #21 already covers schema rationale)

## Non-goals

- New production parsers — deferred to slice 14
- `StateFinancialActivityCard` file rename — file name stays, title changes only
- `state_financial_disclosures` schema changes — keep table; only TX disclosures stub deprecated
- `state_ethics_complaints` schema changes — keep table; only MI complaints stub deprecated
- NY-side stub deprecation — NY stubs stay live, ship as parsers in slice 14
- Migration rollback / reversibility tooling — `drop table if exists` is idempotent; rollback would require restoring 0046 contents in a new forward migration if ever needed

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `state_stock_transactions` has rows in deployed environment | Very low | Table has zero rows in all environments per slice 5I closure. Verify in implementer Step 1 by running `select count(*) from public.state_stock_transactions` before drop. |
| `packages/db/src/types.ts` regeneration produces unexpected diff | Low | Run regen after `pnpm db:reset` succeeds; diff manually before committing. |
| pgTAP plan count miscalculated | Low | Implementer reads `state_ethics_rls.test.sql` to count exact assertions removed; `plan(N)` mismatch fails loudly. |
| Cosmetic card title change surprises users | Acknowledged | Documented in slice 13 closure entry. |

## Cross-references

- Slice 5I (`docs/superpowers/specs/2026-05-22-state-ethics-accountability-design.md`) — original `state_stock_transactions` table + 5 stub adapters
- Slice 11 (`docs/superpowers/specs/2026-05-23-lcv-scorecards-design.md`) — ACLU/AFP deprecation pattern this slice mirrors
- Slice 12 (`docs/superpowers/audits/2026-05-24-stub-adapter-discovery.md`) — audit that surfaced this slice's scope
- Gotcha #15 in CLAUDE.md — federal/state UI asymmetries (preserved after this slice)
- Gotcha #21 in CLAUDE.md — schema rationale (already documented; no new gotcha needed)

## Open questions

None. All 5 design sections approved during brainstorming.
