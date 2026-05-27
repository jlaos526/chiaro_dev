# Slice 36 — State Cards Retrofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate 18 state-side `@chiaro/officials-ui` files (6 cards + 10 sub-lists/evidence + 2 page-level) from `COLORS.*` to `BRAND.semantic.*` via `useBrandTokens()`. Pure mechanical retrofit; pattern proven by slices 33+34+35.

**Spec:** `docs/superpowers/specs/2026-05-27-state-cards-retrofit-design.md`
**Branch:** `state-cards-retrofit` (already created; spec committed at `ccf666e`)

---

## The migration pattern (applies to every task)

1. Replace `import { COLORS } from '@chiaro/ui-tokens'` → `import { useBrandTokens } from '../brand-hooks.ts'`
2. Inside each component function, add `const { semantic } = useBrandTokens()` at top of body (after existing hooks).
3. Replace every `COLORS.*` reference per the table below. Keep `COLORS` import alongside `useBrandTokens` ONLY if `COLORS.signal.warning`/`success` references remain (those are slice 37 exceptions).
4. RN StyleSheet color-only entries DELETED; colors applied inline via `style` arrays at consuming JSX sites.
5. Module-level helper functions using COLORS → thread `semantic` as a parameter (slice 35 Task 2 `statusColor` precedent).
6. Existing tests get ONE new mode-awareness describe block:

```tsx
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('<ComponentName> — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() => render(<ComponentName {...minimalProps} />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<ComponentName {...minimalProps} />, { wrapper: darkWrapper })).not.toThrow()
  })
})
```

Don't double-import already-imported names. Skip files without existing tests (no backfill).

### Migration table (from `docs/brand-migration.md`)

| Was | Becomes |
|---|---|
| `COLORS.brand.primary` | `semantic.accent.primary` |
| `COLORS.brand.accent` | `semantic.accent.secondary` |
| `COLORS.brand.text` | `semantic.text.primary` |
| `COLORS.neutral.background` | `semantic.bg.elevated` |
| `COLORS.neutral.surface` | `semantic.bg.app` |
| `COLORS.neutral.surfaceAlt` | `semantic.bg.subtle` |
| `COLORS.neutral.border` | `semantic.border.default` |
| `COLORS.neutral.mute` | `semantic.text.muted` |
| `COLORS.neutral.textMuted` | `semantic.text.muted` |
| `COLORS.neutral.outline` | `semantic.border.strong` |
| `COLORS.signal.error` | `semantic.alert.danger.fg` |

### Documented exceptions (stay on `COLORS.*`)

- `COLORS.signal.warning` and `COLORS.signal.success` — slice 37 introduces `alert.warning`/`alert.success`. Keep these references and keep the `COLORS` import alongside `useBrandTokens` in any file where they appear.

### Domain palette imports stay untouched

`PARTY_COLOR`, `ALIGNMENT_CHIP_COLORS`, `INDUSTRY_COLOR`, `SCORECARD_LEAN_COLOR`, `SUB_CASCADE_ACCENT`, `CATEGORY_CARD_GRADIENT`, `CATEGORY_ACCENT`, `FINANCE_SUB_SECTION_SHADES` — leave them. Slice 37 owns them.

---

## Task 1: Service Record group (3 files, 23 occurrences)

**Files:**
- Modify: `packages/officials-ui/src/state/StateServiceRecordCard.tsx` (8)
- Modify: `packages/officials-ui/src/state/StateBillsEvidence.tsx` (6)
- Modify: `packages/officials-ui/src/state/StateVotesEvidence.tsx` (9)
- Update: corresponding `packages/officials-ui/test/state/*.test.tsx` files (if exist)

- [ ] **Step 1:** Read the 3 source files + check for tests.
- [ ] **Step 2:** Apply the migration pattern to each file.
- [ ] **Step 3:** Update existing tests with mode-awareness describe blocks.
- [ ] **Step 4:** Verify with grep:
  ```bash
  grep -n "COLORS\." packages/officials-ui/src/state/StateServiceRecordCard.tsx packages/officials-ui/src/state/StateBillsEvidence.tsx packages/officials-ui/src/state/StateVotesEvidence.tsx
  ```
  Expected: empty or only `signal.warning/success`.
- [ ] **Step 5:** Run `pnpm --filter @chiaro/officials-ui test StateServiceRecord StateBillsEvidence StateVotesEvidence` + typecheck.
- [ ] **Step 6:** Commit:
  ```
  refactor(officials-ui): state Service Record group migrate to BRAND.semantic

  Card + BillsEvidence + VotesEvidence via useBrandTokens().
  23 COLORS.* occurrences migrated.
  ```

---

## Task 2: Issue Positions group (2 files, 16 occurrences)

**Files:**
- Modify: `packages/officials-ui/src/state/StateIssuePositionsCard.tsx` (9)
- Modify: `packages/officials-ui/src/state/StateIssueVotesEvidence.tsx` (7)
- Update: corresponding test files (if exist)

`StateIssuePositionsCard.tsx` may import `SCORECARD_LEAN_COLOR` and/or `ALIGNMENT_CHIP_COLORS` — keep those untouched.

- [ ] **Step 1-6:** Apply the standard pattern.
- [ ] **Step 4 grep target:**
  ```bash
  grep -n "COLORS\." packages/officials-ui/src/state/StateIssuePositionsCard.tsx packages/officials-ui/src/state/StateIssueVotesEvidence.tsx
  ```
- [ ] **Commit:**
  ```
  refactor(officials-ui): state Issue Positions group migrate to BRAND.semantic

  Card + IssueVotesEvidence via useBrandTokens(). SCORECARD_LEAN_COLOR
  + ALIGNMENT_CHIP_COLORS domain palettes stay untouched.
  ```

---

## Task 3: Finance group (2 files, 17 occurrences)

**Files:**
- Modify: `packages/officials-ui/src/state/StateFinanceCard.tsx` (10 — highest single-file count in slice 36)
- Modify: `packages/officials-ui/src/state/StateDonorsEvidence.tsx` (7)
- Update: corresponding test files (if exist)

May import `FINANCE_SUB_SECTION_SHADES` or `INDUSTRY_COLOR` — keep untouched. The slice 34-migrated `finance/TopAmountBreakdown` + `finance/FinanceSummaryStrip` may be used here; no changes to them needed.

- [ ] **Step 1-6:** Apply the standard pattern.
- [ ] **Step 4 grep target:**
  ```bash
  grep -n "COLORS\." packages/officials-ui/src/state/StateFinanceCard.tsx packages/officials-ui/src/state/StateDonorsEvidence.tsx
  ```
- [ ] **Commit:**
  ```
  refactor(officials-ui): state Finance group migrate to BRAND.semantic

  Card + DonorsEvidence via useBrandTokens(). 17 COLORS.* occurrences
  migrated. Domain palette imports stay untouched.
  ```

---

## Task 4: Ethics group — both cards (5 files, 33 occurrences)

**Files (the 2 state ethics cards + 3 sub-lists per Gotcha #15):**
- Modify: `packages/officials-ui/src/state/StateFinancialActivityCard.tsx` (5)
- Modify: `packages/officials-ui/src/state/StateFinancialDisclosuresList.tsx` (5)
- Modify: `packages/officials-ui/src/state/StateConductCard.tsx` (5)
- Modify: `packages/officials-ui/src/state/StateEthicsComplaintsList.tsx` (9)
- Modify: `packages/officials-ui/src/state/StateOfficialEventsList.tsx` (9)
- Update: corresponding test files (if exist)

Largest group. State splits ethics into 2 cards (federal has 1 — Gotcha #15 asymmetry). Both cards migrate independently here. The 9-occurrence sub-lists may have filter/highlight state styling.

- [ ] **Step 1-6:** Apply the standard pattern.
- [ ] **Step 4 grep target:**
  ```bash
  grep -n "COLORS\." packages/officials-ui/src/state/StateFinancialActivityCard.tsx packages/officials-ui/src/state/StateFinancialDisclosuresList.tsx packages/officials-ui/src/state/StateConductCard.tsx packages/officials-ui/src/state/StateEthicsComplaintsList.tsx packages/officials-ui/src/state/StateOfficialEventsList.tsx
  ```
- [ ] **Commit:**
  ```
  refactor(officials-ui): state Ethics group (FinancialActivity + Conduct) migrate to BRAND.semantic

  Both state ethics cards (Gotcha #15 asymmetry vs federal) + 3 sub-lists
  via useBrandTokens(). 33 COLORS.* occurrences migrated.
  ```

---

## Task 5: Community Presence group (4 files, 17 occurrences)

**Files:**
- Modify: `packages/officials-ui/src/state/StateCommunityPresenceCard.tsx` (5)
- Modify: `packages/officials-ui/src/state/StateTownHallsList.tsx` (4)
- Modify: `packages/officials-ui/src/state/StateDistrictOfficesList.tsx` (3)
- Modify: `packages/officials-ui/src/state/StateCommitteeHearingsList.tsx` (5)
- Update: corresponding test files (if exist)

State Community Presence has 3 sub-lists (federal has 2 — Gotcha #15 asymmetry; state adds committee_hearings).

- [ ] **Step 1-6:** Apply the standard pattern.
- [ ] **Step 4 grep target:**
  ```bash
  grep -n "COLORS\." packages/officials-ui/src/state/StateCommunityPresenceCard.tsx packages/officials-ui/src/state/StateTownHallsList.tsx packages/officials-ui/src/state/StateDistrictOfficesList.tsx packages/officials-ui/src/state/StateCommitteeHearingsList.tsx
  ```
- [ ] **Commit:**
  ```
  refactor(officials-ui): state Community Presence group migrate to BRAND.semantic

  Card + TownHalls + DistrictOffices + CommitteeHearings lists via
  useBrandTokens(). 17 COLORS.* occurrences migrated.
  ```

---

## Task 6: Page-level (2 files, 13 occurrences)

**Files:**
- Modify: `packages/officials-ui/src/state/StateOfficialDetailPage.tsx` (8 — parent page)
- Modify: `packages/officials-ui/src/state/StateOfficialsCardSection.tsx` (5 — home page wrapper)
- Update: corresponding test files (if exist)

`StateOfficialDetailPage` is the parent of all 6 cards from Tasks 1-5. `StateOfficialsCardSection` is used on the home page to show state officials alongside federal.

- [ ] **Step 1-6:** Apply the standard pattern.
- [ ] **Step 4 grep target:**
  ```bash
  grep -n "COLORS\." packages/officials-ui/src/state/StateOfficialDetailPage.tsx packages/officials-ui/src/state/StateOfficialsCardSection.tsx
  ```
- [ ] **Commit:**
  ```
  refactor(officials-ui): state page-level migrate to BRAND.semantic

  StateOfficialDetailPage (parent) + StateOfficialsCardSection (home-page
  wrapper) via useBrandTokens(). Closes state-side retrofit.
  ```

---

## Task 7: Final verification + CLAUDE.md slice 36

- [ ] **Step 1: Workspace verify**
  ```bash
  pnpm -r typecheck
  pnpm test
  pnpm --filter @chiaro/web build
  ```
  Expected: 11 packages green; full test suite green (except known Supabase-env failures); web build clean within ±2 kB.

- [ ] **Step 2: Scope discipline**
  ```bash
  git diff master --name-only -- 'apps/' 'packages/officials/' 'packages/state-bills/' 'packages/bills/' 'packages/location/' 'packages/profile/' 'packages/supabase-client/' 'packages/db/' 'packages/ui-tokens/'
  ```
  Expected: empty.

- [ ] **Step 3: Final state/ COLORS sweep**
  ```bash
  grep -nE "COLORS\." packages/officials-ui/src/state/*.tsx
  ```
  Expected: only `COLORS.signal.warning`/`success` references.

- [ ] **Step 4: Update CLAUDE.md** — append after the slice 35 bullet:
  ```markdown
  - **Slice 36 — State cards retrofit** (2026-05-27): Mechanical migration of 18 state `@chiaro/officials-ui` files (6 cards + 10 sub-lists/evidence panels + 2 page-level) from `COLORS.*` to `BRAND.semantic.*` via `useBrandTokens()`. 119 occurrences swapped; only `COLORS.signal.warning`/`success` references remain (slice 37 will introduce `alert.warning`/`alert.success`). State officials detail page is the third dark-mode-ready surface (after auth slice 33 and federal slice 35). State ethics split into 2 cards (FinancialActivity + Conduct) per Gotcha #15 asymmetry; both migrated independently. Domain palette imports (`PARTY_COLOR`, `ALIGNMENT_CHIP_COLORS`, `SCORECARD_LEAN_COLOR`, `INDUSTRY_COLOR`, `FINANCE_SUB_SECTION_SHADES`, `CATEGORY_CARD_GRADIENT`, `SUB_CASCADE_ACCENT`) stay untouched — slice 37 owns them. No new tokens; BRAND surface unchanged. ~22 files; no schema work; pgTAP unchanged at 428 plans.
  ```

- [ ] **Step 5: Commit CLAUDE.md:**
  ```
  docs(claude): record slice 36 — state cards retrofit
  ```

- [ ] **Step 6: Final state check**
  ```bash
  git log --oneline master..state-cards-retrofit
  git status --short
  ```
  Expected: ~9 commits on branch (spec + plan + 6 task commits + CLAUDE.md); clean working tree.

---

## Notes for the implementer

1. **Pattern fully proven.** Slices 33-35 have exercised this migration 70+ times across 45+ files. Trust the pattern; apply mechanically.

2. **`signal.warning`/`success` references stay.** If you encounter them, keep the `COLORS` import alongside `useBrandTokens` and don't migrate those specific refs. Slice 37 introduces the equivalents.

3. **Domain palette imports stay.** Listed in the migration-pattern preamble.

4. **Module-level helpers thread `semantic`.** Per slice 35 Task 2 `statusColor` precedent — if a file has a helper function using COLORS at module scope, accept `semantic: BrandSemantic` as a parameter and pass it from the component body.

5. **Test backfill is out of scope.** Add ONE new mode-awareness test per existing test fixture. Don't create new test files.

6. **State has 18 files vs federal's 19.** Slice 36 is slightly smaller than slice 35 but otherwise identical in mechanics.

7. **Atomic per-task commits.** Each task commit leaves `pnpm -r typecheck` green.

8. **Apps untouched.** `apps/web/` + `apps/mobile/` route shells consume shared components.

9. **Hook path:** `'../brand-hooks.ts'` from `state/`; `'../../src/brand-hooks.ts'` from `test/state/`.

10. **Slice 37 is next.** Closes all the deferred work from slices 33-36 (domain palettes, `signal.warning/success`, link blue, finance signals, MetricCardShell category palette, BioPortrait gradient, map components). After slice 37, the retrofit track is done and we shift to visual reskin (slices 38+).
