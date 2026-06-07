# Slice 58 — Dead-code purge Design Spec

**Date:** 2026-06-07
**Branch:** `slice-58-dead-code-purge`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Compressed Slice (~18 files, deletion-only)
**Source:** Audit track **T3** from `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`

## 1. Goal / problem

Remove accreted dead surface area — whole hook/query families shipped ahead of consumers, orphaned mobile derivations, an unused component, type, and zod schemas. All findings re-verified zero-consumer on 2026-06-07 (Gotcha #20: confirm before deleting). No schema, no behavior change, no package removed (each keeps its live surface; workspace stays 12). This continues the slice-49 `INDUSTRY_COLOR` deletion precedent.

## 2. Deletions (per package)

Each symbol below was grep-verified to have **zero non-test, non-self consumers** on 2026-06-07. The plan re-runs the grep per symbol immediately before deleting (the data may have shifted; never delete on a stale grep).

### D1 — `@chiaro/bills`: federal bill-browsing surface
Delete (queries + hooks + keys + tests + barrel exports):
- Hooks: `useBills`, `useBill`, `useBillVotes`, `useOfficialVotesOnSubject`.
- Fetchers: `fetchBills`, `fetchBill`, `fetchBillVotes`, `fetchOfficialVotesOnSubject`.
- Key-factory entries that ONLY these consume (e.g. `billsKeys.list`/`.detail`, `votesKeys.byBill`/`.officialOnSubject`) — delete only the entries with no surviving consumer; keep keys used by the live hooks.
- The test cases / files exercising the deleted symbols.

**KEEP** (live — consumed by `FederalVotingBillsCard`): `useOfficialSponsoredBills`, `useOfficialCosponsoredBills`, `useOfficialMissedVotes` + their fetchers + keys.
**Do NOT touch** the db-seed `fetchBills` in `packages/db/supabase/seed/congress-gov-bills.ts` — a separate, live symbol with the same name.

### D2 — `@chiaro/state-bills`: per-bill detail surface
Delete: `useStateBill`, `useStateBillVotes`, `fetchStateBill`, `fetchStateBillVotes` + the inline `['state-bills','votes',billId]` key literal in `useStateBillVotes` (this also closes audit finding **E10**) + their tests + barrel exports. Keep the live state-bill surface (the sponsored/votes-by-official queries the cards use).

### D3 — `apps/mobile/lib/derivations`: orphaned derivations
- Delete whole files (+ their test files): `teasers.ts` (6 teaser fns), `finance.ts` (`pacPercent`), `officials-by-level.ts` (a re-export shim for `groupOfficialsByLevel`/`OfficialsByLevel` from `@chiaro/officials`; only its own test imports it).
- In `service-record.ts`: delete `tenureByChamber` + the `TenureByChamber` interface. **KEEP** `firstElectedYear` (used by `apps/mobile/app/(app)/officials/[id].tsx`). Update `service-record.test.ts` to drop the `tenureByChamber` cases (keep `firstElectedYear` cases).
- **KEEP** `alignment.ts` (`selectTopAlignmentChips`, used by officials/[id].tsx).

### D4 — `@chiaro/officials-ui`: `EvidenceExpand`
Delete `src/cards/EvidenceExpand.tsx` + its barrel re-export in `src/index.ts` + its test (if any). Confirmed: only the barrel re-exports it; no card consumes it (slice 57 explicitly excluded it).

### D5 — `@chiaro/officials`: `StateCommitteeMembershipRow`
Delete the `StateCommitteeMembershipRow` type from `src/types.ts` + its re-export in `src/index.ts`. No query/hook/component reads it.

### D6 — `@chiaro/issues`: unused zod schemas
Delete `measurementSourceSchema` + `quizQuestionSchema` from `src/schemas.ts`. **KEEP** `saveSelectionsSchema` + `SaveSelectionsPayload` (live — validates the save-RPC payload). The TS *types* `MeasurementSource`/`QuizQuestion` live in `types.ts` and stay (they're consumed). Update `schemas.test.ts` to drop the 2 deleted-schema cases. `fetchCatalog` keeps trusting the seed-validated catalog jsonb (audit E5 deliberately left open — wiring validation was considered and declined for this purge).

### D7 — `@chiaro/officials-ui`: `IssueFlowProvider.hydrate()`
Remove `hydrate` from the `IssueFlowProvider` context value + from the `IssueFlowState` (context type) + any test reference. The provider already hydrates from `initialSelections` at mount (lazy `useState`/`useRef` initializers), so `hydrate()` is redundant + has no external caller. Confirm no route/screen calls it before removing.

## 3. Scope

**In:** the D1–D7 deletions above + the directly-orphaned tests + barrel/index updates. **Out:** all other audit tracks (T4 dark-mode residue, T5 route bugs/tests, T6 polish). No refactor of surviving code beyond what a deletion forces (e.g. removing a now-unused import). No new tests (deletions are validated by typecheck + surviving tests). The audit's E10 closes incidentally via D2; E5 stays open by decision.

## 4. Method (per deletion — TDD-inverted "delete then verify green")

Deletions don't have a red→green test cycle; the safety net is:
1. **Re-grep** the symbol across `packages/ apps/` (excluding its own file + tests) → confirm zero live consumers. If a consumer appears, STOP and surface it (the audit may be stale).
2. Delete the symbol + its now-dead test(s) + its barrel/index export.
3. `pnpm -r typecheck` → green (catches any dangling import the grep missed).
4. The affected package's test suite → green (no broken surviving test).

Group commits by package/finding so each is a focused, revertable deletion.

## 5. Testing / verification (Gotcha #30)

- `pnpm -r typecheck` (all 12 packages) — the primary gate for deletions (dangling imports fail it).
- `pnpm --filter @chiaro/bills test` · `@chiaro/state-bills` · `@chiaro/officials` · `@chiaro/officials-ui` · `@chiaro/issues` · mobile `pnpm --filter @chiaro/mobile test`.
- `pnpm --filter @chiaro/web build` — barrel-change safety (removing exports from `@chiaro/officials-ui`/`@chiaro/bills` indexes must not break a web import).
- Ship via PR with all 4 CI jobs green.

## 6. Open items for the plan to reconcile against live code

1. `@chiaro/bills` `keys.ts` — identify exactly which `billsKeys`/`votesKeys` entries are consumed ONLY by the dead hooks (delete those) vs shared with the live hooks (keep). Read `keys.ts` + `hooks.ts` + `queries.ts`.
2. `@chiaro/bills` + `@chiaro/state-bills` test files — which test files are entirely about the dead surface (delete whole file) vs mixed (delete only the dead cases).
3. `service-record.ts` — confirm `tenureByChamber` doesn't share a helper with `firstElectedYear` (e.g. `yearsBetween`); if a shared helper becomes unused after deleting `tenureByChamber`, delete it too; if still used by `firstElectedYear`, keep.
4. `EvidenceExpand` — confirm the barrel is the ONLY reference (re-grep) + locate its test file.
5. `IssueFlowProvider` — read the provider; confirm `hydrate` has no consumer + remove it from both the value object and the `IssueFlowState` type cleanly (no other field depends on it).
6. `@chiaro/issues` `index.ts` — confirm `measurementSourceSchema`/`quizQuestionSchema` aren't re-exported anywhere that a consumer (incl. db-seed via Gotcha #4 duplication) imports; the db-seed has its OWN duplicated copy (don't touch that).
