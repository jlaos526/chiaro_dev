# Slice 58 — Dead-code purge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete confirmed-zero-consumer dead surface area (audit track T3) — unused hook/query families, orphaned mobile derivations, an unused component/type/schemas — with no behavior change.

**Architecture:** Deletion-only. No red→green TDD; the safety net per deletion is: **re-grep the symbol for zero live consumers → delete it + its dead tests + its barrel/index export → `pnpm -r typecheck` (catches dangling imports) → the affected package's tests green.** One commit per package/finding.

**Tech Stack:** TypeScript (strict), TanStack Query, vitest, jest-expo, pnpm workspaces.

**Branch:** `slice-58-dead-code-purge` (spec `8d6585c` already committed).

**Conventions:** Sequential implementers only (Gotcha #25). Never delete on a stale grep — re-confirm zero consumers at delete time. Unused *exported types* do NOT fail typecheck, so they must be grep-confirmed-dead and deleted explicitly (typecheck won't catch them).

---

### Task 1: D1 — `@chiaro/bills` federal bill-browsing surface

**Files:**
- Modify: `packages/bills/src/hooks.ts`, `packages/bills/src/queries.ts`, `packages/bills/src/keys.ts`, `packages/bills/src/index.ts`, `packages/bills/src/types.ts`
- Modify (remove dead cases): `packages/bills/test/hooks.test.tsx`, `packages/bills/test/keys.test.ts`, `packages/bills/test/queries.integration.test.ts`

**Delete these symbols** (all grep-verified zero live consumers 2026-06-07):
- Hooks (`hooks.ts`): `useBills`, `useBill`, `useBillVotes`, `useOfficialVotesOnSubject`.
- Fetchers (`queries.ts`): `fetchBills`, `fetchBill`, `fetchBillVotes`, `fetchOfficialVotesOnSubject`.
- Keys (`keys.ts`): `billsKeys.list`, `billsKeys.lists`, `billsKeys.detail`, `votesKeys.byBill`, `votesKeys.officialOnSubject`. **KEEP** `billsKeys.all`, `billsKeys.officialSponsored`, `billsKeys.officialCosponsored`, `votesKeys.all`, `votesKeys.officialMissed`.
- Barrel (`index.ts`): remove `useBills, useBill, useBillVotes, useOfficialVotesOnSubject` from the hooks export and `fetchBills, fetchBill, fetchBillVotes, fetchOfficialVotesOnSubject` from the queries export.

**KEEP** (live — used by `FederalVotingBillsCard`): `useOfficialSponsoredBills`, `useOfficialCosponsoredBills`, `useOfficialMissedVotes` + their fetchers + the kept keys.
**Do NOT touch** `packages/db/supabase/seed/congress-gov-bills.ts` `fetchBills` (different symbol).

- [ ] **Step 1: Re-grep to confirm zero live consumers.** Run:
```
grep -rn "useBills\b\|\buseBill\b\|useBillVotes\b\|useOfficialVotesOnSubject\b\|fetchBills\b\|\bfetchBill\b\|fetchBillVotes\b\|fetchOfficialVotesOnSubject\b" packages apps --include=*.ts --include=*.tsx | grep -v "packages/bills/" | grep -v "packages/db/supabase/seed/"
```
Expected: empty (only the bills package + the unrelated db-seed reference). If any app/officials-ui consumer appears, STOP and report.

- [ ] **Step 2: Delete the hooks** — remove the 4 dead `export function` blocks from `hooks.ts`. After removal, check the file's imports: if `BillsFilter` (the `useBills` param type) is now unused in `hooks.ts`, drop its import.

- [ ] **Step 3: Delete the fetchers** — remove `fetchBills`, `fetchBill`, `fetchBillVotes`, `fetchOfficialVotesOnSubject` from `queries.ts`. Then grep for any now-orphaned type:
```
grep -rn "BillsFilter\|BillWithSubjectsAndSponsors\|VoteWithBillAndPositions" packages apps --include=*.ts --include=*.tsx | grep -v ".test."
```
For each that now appears ONLY in `types.ts`/`queries.ts`/`index.ts` (no live consumer), delete it: `BillsFilter` (was the `fetchBills`/`useBills` filter), and `BillWithSubjectsAndSponsors` / `VoteWithBillAndPositions` (were the return types of `fetchBill`/`fetchBills` / `fetchBillVotes`) — delete from `types.ts` + remove from the `index.ts` type-export block. KEEP any type still used by a live fetcher (e.g. the sponsored/cosponsored/missed return types).

- [ ] **Step 4: Delete the dead keys** — remove `list`, `lists`, `detail` from `billsKeys` and `byBill`, `officialOnSubject` from `votesKeys` in `keys.ts`.

- [ ] **Step 5: Update the barrel** `index.ts` — remove the 4 dead hooks + 4 dead fetchers (+ any dead type from Step 3) from the export lists. Keep `billsKeys, votesKeys` exported.

- [ ] **Step 6: Trim the tests** — in `test/hooks.test.tsx`, `test/keys.test.ts`, `test/queries.integration.test.ts`, delete the describe/it blocks (and any now-unused imports/fixtures) that exercise the deleted symbols. Keep the live-symbol cases.

- [ ] **Step 7: Verify.** Run `pnpm --filter @chiaro/bills typecheck` (clean — no dangling import) and `pnpm --filter @chiaro/bills test` (unit tests green; the `queries.integration.test.ts` needs Supabase — if it can't run locally, confirm it at least compiles via typecheck and rely on CI). Then `pnpm -r typecheck` to confirm no OTHER package imported a deleted symbol.
Expected: green.

- [ ] **Step 8: Commit.**
```bash
git add packages/bills/
git commit -m "refactor(slice-58): delete @chiaro/bills dead bill-browsing surface (D1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: D2 — `@chiaro/state-bills` per-bill detail surface

**Files:**
- Modify: `packages/state-bills/src/hooks.ts`, `packages/state-bills/src/queries.ts`, `packages/state-bills/src/keys.ts`, `packages/state-bills/src/index.ts`, `packages/state-bills/src/types.ts`
- Modify (remove dead cases): `packages/state-bills/test/hooks.test.tsx`, `packages/state-bills/test/keys.test.ts`

**Delete:** `useStateBill` (`hooks.ts:70`, uses `stateBillsKeys.byId`), `useStateBillVotes` (`hooks.ts:82`, uses the inline `['state-bills','votes',billId]` key — closes audit **E10**), `fetchStateBill`, `fetchStateBillVotes` (`queries.ts`). Remove all 4 from `index.ts`. **KEEP** the live surface: `fetchOfficialSponsoredStateBills`, `fetchOfficialCosponsoredStateBills`, `fetchOfficialStateVotes`, `fetchOfficialMissedStateVotes`, `fetchOfficialStateVotesOnSubject` + their hooks + the schemas (`OpenStatesBillSchema` etc. — these are state-bills ingest schemas, unrelated to the issues D6 schemas; do NOT touch).

- [ ] **Step 1: Re-grep zero consumers.** Run:
```
grep -rn "useStateBill\b\|useStateBillVotes\b\|fetchStateBill\b\|fetchStateBillVotes\b" packages apps --include=*.ts --include=*.tsx | grep -v "packages/state-bills/"
```
Expected: empty. If a consumer appears, STOP.

- [ ] **Step 2: Delete the 2 hooks** (`useStateBill`, `useStateBillVotes`) from `hooks.ts`.

- [ ] **Step 3: Delete the 2 fetchers** (`fetchStateBill`, `fetchStateBillVotes`) from `queries.ts`. Grep for the return type of `fetchStateBill` (e.g. a `StateBillWith…` type) — if it's now used only in `types.ts`/`queries.ts`/`index.ts`, delete it.

- [ ] **Step 4: Keys** — in `keys.ts`, check `stateBillsKeys.byId` (used by `useStateBill`): if it has no other consumer (grep `byId` across the repo), delete it. The inline votes key lived inside `useStateBillVotes` (already gone with the hook).

- [ ] **Step 5: Update the barrel** `index.ts` — remove `fetchStateBill`, `fetchStateBillVotes` from the queries export and `useStateBill`, `useStateBillVotes` from the hooks export.

- [ ] **Step 6: Trim tests** — remove the `useStateBill`/`useStateBillVotes`/`fetchStateBill`/`fetchStateBillVotes`/`byId` cases from `test/hooks.test.tsx` + `test/keys.test.ts`.

- [ ] **Step 7: Verify.** `pnpm --filter @chiaro/state-bills typecheck` + `pnpm --filter @chiaro/state-bills test` + `pnpm -r typecheck`. Expected: green.

- [ ] **Step 8: Commit.**
```bash
git add packages/state-bills/
git commit -m "refactor(slice-58): delete @chiaro/state-bills per-bill detail surface (D2, closes E10)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: D3 — `apps/mobile/lib/derivations` orphaned derivations

**Files:**
- Delete: `apps/mobile/lib/derivations/teasers.ts`, `apps/mobile/lib/derivations/finance.ts`, `apps/mobile/lib/derivations/officials-by-level.ts` + their test files under `apps/mobile/test/derivations/` (whichever exist: `teasers.test.ts`, `finance.test.ts`, `officials-by-level.test.ts`).
- Modify: `apps/mobile/lib/derivations/service-record.ts` (+ `apps/mobile/test/derivations/service-record.test.ts`)

**KEEP** `alignment.ts` (`selectTopAlignmentChips`, used by `app/(app)/officials/[id].tsx`) and `service-record.ts` `firstElectedYear` (used by the same file).

- [ ] **Step 1: Re-grep zero consumers** for the whole-delete files:
```
grep -rn "derivations/teasers\|derivations/finance\|derivations/officials-by-level\|serviceRecordTeaser\|issuePositionsTeaser\|communityPresenceTeaser\|financeTeaser\|ethicsAccountabilityTeaser\|votingBillsTeaser\|pacPercent\|groupOfficialsByLevel" apps/mobile --include=*.ts --include=*.tsx | grep -viE "lib/derivations/(teasers|finance|officials-by-level)|test/derivations"
```
Expected: empty (no non-test, non-self consumer). `groupOfficialsByLevel` should resolve to `@chiaro/officials` directly elsewhere if used at all — confirm the only `officials-by-level` shim consumer is its own test.

- [ ] **Step 2: Delete the 3 files + their tests.** `git rm apps/mobile/lib/derivations/{teasers,finance,officials-by-level}.ts` and the corresponding `apps/mobile/test/derivations/{teasers,finance,officials-by-level}.test.ts` (only those that exist — `ls apps/mobile/test/derivations/` first).

- [ ] **Step 3: Trim `service-record.ts`** — delete the `TenureByChamber` interface, the `tenureByChamber` function, AND the private `yearsBetween` helper (it is used ONLY by `tenureByChamber`). The file should be left with just the `LeadershipRow` type + `firstElectedYear`. Final file:
```ts
import type { Database } from '@chiaro/db'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

export function firstElectedYear(rows: ReadonlyArray<LeadershipRow>): number | null {
  if (rows.length === 0) return null
  let min = Number.POSITIVE_INFINITY
  for (const r of rows) {
    const y = new Date(r.start_date).getFullYear()
    if (y < min) min = y
  }
  return Number.isFinite(min) ? min : null
}
```

- [ ] **Step 4: Trim `service-record.test.ts`** — delete the `tenureByChamber` describe/it block(s); keep the `firstElectedYear` cases.

- [ ] **Step 5: Verify.** `pnpm --filter @chiaro/mobile test` (jest-expo — the surviving derivations + officials tests green) + `pnpm -r typecheck`. Expected: green.

- [ ] **Step 6: Commit.**
```bash
git add apps/mobile/
git commit -m "refactor(slice-58): delete orphaned mobile derivations (D3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: D4 + D7 — `@chiaro/officials-ui` `EvidenceExpand` + `IssueFlowProvider.hydrate()`

**Files:**
- Delete: `packages/officials-ui/src/cards/EvidenceExpand.tsx` + its test (if any, `packages/officials-ui/test/cards/EvidenceExpand.test.tsx`)
- Modify: `packages/officials-ui/src/index.ts` (remove the `EvidenceExpand` re-export, line 19)
- Modify: `packages/officials-ui/src/issues/IssueFlowProvider.tsx` (+ `packages/officials-ui/test/issues/IssueFlowProvider.test.tsx`)

- [ ] **Step 1: Re-grep `EvidenceExpand` consumers.**
```
grep -rn "EvidenceExpand" packages apps --include=*.ts --include=*.tsx | grep -viE "cards/EvidenceExpand.tsx|src/index.ts|EvidenceExpand.test"
```
Expected: empty (only its file, the barrel, and its test). If a card consumes it, STOP.

- [ ] **Step 2: Delete `EvidenceExpand.tsx`** + remove line 19 from `src/index.ts` + delete its test file if present (`ls packages/officials-ui/test/cards/ | grep -i evidenceexpand`).

- [ ] **Step 3: Re-grep `hydrate` consumers.**
```
grep -rn "\.hydrate(" packages apps --include=*.ts --include=*.tsx | grep -v "IssueFlowProvider.tsx"
```
Expected: empty (no external caller). Read `IssueFlowProvider.tsx` to confirm `hydrate` is only assembled into the context `value` + declared on the `IssueFlowState` type, and that the provider already hydrates from `initialSelections` at mount (lazy initializers) so removing `hydrate` changes no behavior.

- [ ] **Step 4: Remove `hydrate`** from `IssueFlowProvider.tsx` — delete the `hydrate` function definition, remove it from the `value` object (and its `useMemo` deps if listed), and delete the `hydrate` field from the `IssueFlowState` (context type) interface. In `test/issues/IssueFlowProvider.test.tsx`, remove any assertion that references `hydrate`.

- [ ] **Step 5: Verify.** `pnpm --filter @chiaro/officials-ui typecheck` + `pnpm --filter @chiaro/officials-ui test` + `pnpm -r typecheck`. Expected: green (officials-ui ~672 minus any removed EvidenceExpand/hydrate cases).

- [ ] **Step 6: Commit.**
```bash
git add packages/officials-ui/
git commit -m "refactor(slice-58): delete EvidenceExpand + IssueFlowProvider.hydrate (D4,D7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: D5 — `@chiaro/officials` `StateCommitteeMembershipRow`

**Files:**
- Modify: `packages/officials/src/types.ts` (line 14 `export type StateCommitteeMembershipRow = …`), `packages/officials/src/index.ts` (line 9 in the type-export block)

- [ ] **Step 1: Re-grep consumers.**
```
grep -rn "StateCommitteeMembershipRow" packages apps --include=*.ts --include=*.tsx | grep -viE "officials/src/types.ts|officials/src/index.ts|.test."
```
Expected: empty. If a consumer appears, STOP.

- [ ] **Step 2: Delete** the `StateCommitteeMembershipRow` type definition from `types.ts` and remove `StateCommitteeMembershipRow,` from the `index.ts` export block. Delete any test asserting it (grep the officials test dir).

- [ ] **Step 3: Verify.** `pnpm --filter @chiaro/officials typecheck` + `pnpm --filter @chiaro/officials test` + `pnpm -r typecheck`. Expected: green.

- [ ] **Step 4: Commit.**
```bash
git add packages/officials/
git commit -m "refactor(slice-58): delete unused StateCommitteeMembershipRow type (D5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: D6 — `@chiaro/issues` unused zod schemas

**Files:**
- Modify: `packages/issues/src/schemas.ts` (delete `measurementSourceSchema` lines 3-12, `quizQuestionSchema` lines 13-18; KEEP `saveSelectionsSchema` + `SaveSelectionsPayload`)
- Modify: `packages/issues/test/schemas.test.ts` (remove the 2 deleted-schema cases)

Note: `packages/issues/src/index.ts` does `export * from './schemas.ts'`, so deleting the schemas auto-removes them from the barrel — no index edit. The TS types `MeasurementSource`/`QuizQuestion` live in `types.ts` and STAY (consumed). The db-seed has its OWN duplicated `MeasurementSource` (Gotcha #4) — do NOT touch it.

- [ ] **Step 1: Re-grep consumers.**
```
grep -rn "measurementSourceSchema\|quizQuestionSchema" packages apps --include=*.ts --include=*.tsx | grep -viE "issues/src/schemas.ts|.test."
```
Expected: empty (no runtime consumer). If `fetchCatalog` or anything uses them, STOP (E5 was decided NOT to wire — surface it).

- [ ] **Step 2: Delete** `measurementSourceSchema` + `quizQuestionSchema` from `schemas.ts`. Leave `import { z }` (still used by `saveSelectionsSchema`).

- [ ] **Step 3: Trim** `test/schemas.test.ts` — remove the `measurementSourceSchema`/`quizQuestionSchema` describe/it blocks; keep `saveSelectionsSchema` cases.

- [ ] **Step 4: Verify.** `pnpm --filter @chiaro/issues typecheck` + `pnpm --filter @chiaro/issues test` + `pnpm -r typecheck`. Expected: green.

- [ ] **Step 5: Commit.**
```bash
git add packages/issues/
git commit -m "refactor(slice-58): delete unused measurementSource/quizQuestion schemas (D6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verify-all + closeout

**Files:**
- Modify: `CLAUDE.md` (slice-58 entry), `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` (mark T3 done)

- [ ] **Step 1: Full verification sweep.** Run, expecting green:
- `pnpm -r typecheck` (all 12 packages — the primary deletion gate)
- `pnpm --filter @chiaro/bills test` · `@chiaro/state-bills` · `@chiaro/officials` · `@chiaro/officials-ui` · `@chiaro/issues` · `@chiaro/mobile`
- `pnpm --filter @chiaro/web build` (barrel-change safety — removing `@chiaro/officials-ui`/`@chiaro/bills` exports must not break a web import)
- `pnpm --filter @chiaro/web test`
Record the officials-ui test count (it drops slightly from removed EvidenceExpand/hydrate cases). If any web/mobile import broke from a removed barrel export, that's a missed live consumer — investigate (don't just re-add the export blindly).

- [ ] **Step 2: CLAUDE.md** — add the slice-58 entry after the slice-57 entry in "Slices delivered":
```markdown
- **Slice 58 — Dead-code purge (audit T3)** (2026-06-07): Compressed Slice (~18 files, deletion-only; no schema, no behavior change, workspace stays 12). Third audit-track remediation. Deletes confirmed-zero-consumer surface (re-grepped per symbol at delete time, Gotcha #20): **D1** `@chiaro/bills` `useBills`/`useBill`/`useBillVotes`/`useOfficialVotesOnSubject` + their fetchers + the now-dead `billsKeys.{list,lists,detail}`/`votesKeys.{byBill,officialOnSubject}` + `BillsFilter`/`BillWithSubjectsAndSponsors`/`VoteWithBillAndPositions` (kept the live sponsored/cosponsored/missed surface used by `FederalVotingBillsCard`; the db-seed `fetchBills` is a different symbol, untouched). **D2** `@chiaro/state-bills` `useStateBill`/`useStateBillVotes`/`fetchStateBill`/`fetchStateBillVotes` + `stateBillsKeys.byId` (also closes audit **E10** inline-key). **D3** mobile `lib/derivations/` `teasers.ts` + `finance.ts` + `officials-by-level.ts` (dead re-export shim) + `tenureByChamber`/`TenureByChamber`/`yearsBetween` from `service-record.ts` (kept `firstElectedYear` + `alignment.ts`). **D4** `EvidenceExpand` (officials-ui, barrel-only). **D5** `StateCommitteeMembershipRow` type (officials). **D6** `measurementSourceSchema` + `quizQuestionSchema` (issues; kept `saveSelectionsSchema`; `fetchCatalog` keeps trusting seed-validated catalog jsonb — audit E5 left open by decision). **D7** `IssueFlowProvider.hydrate()` (redundant with mount-time hydration). Verified via `pnpm -r typecheck` + per-package tests + web build (barrel safety). Follows the slice-49 `INDUSTRY_COLOR` deletion precedent.
```

- [ ] **Step 3: Mark audit T3 done** — in `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`, prepend `✅ SHIPPED (slice 58). ` to the T3 row's Note cell.

- [ ] **Step 4: Commit.**
```bash
git add CLAUDE.md docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md
git commit -m "docs(slice-58): CLAUDE.md slice entry + mark audit T3 done

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (controller, after all tasks)
- [ ] All 4 CI jobs green on the PR. `build` + `test` exercise the barrel/import changes.
- [ ] `git log --oneline master..HEAD` shows spec + plan + Tasks 1–7.
- [ ] PR title: "Slice 58 — Dead-code purge (audit T3)". Squash-merge + delete branch; sync master.

## Notes
- **YAGNI:** delete, don't deprecate. No surviving-code refactor beyond removing forced-unused imports.
- **Typecheck is the deletion gate** — but it does NOT catch unused exported types; those are grep-confirmed + deleted explicitly (D1/D2/D5).
- **Integration tests** (`@chiaro/bills` `queries.integration.test.ts`) need Supabase; if not runnable locally, ensure the file still compiles (typecheck) after removing dead cases and rely on CI.
