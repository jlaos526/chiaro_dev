# Slice 35 — Federal Cards Retrofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 19 federal-side `@chiaro/officials-ui` files from `COLORS.*` to `BRAND.semantic.*` via `useBrandTokens()`. Pure mechanical retrofit; zero new design decisions.

**Architecture:** Per slices 33+34. `useBrandTokens()` hook + RN StyleSheet split layout-static / color-inline. Migration vocabulary from `docs/brand-migration.md`. Hook import path from `federal/`: `'../brand-hooks.ts'`. Test import path from `test/federal/`: `'../../src/brand-hooks.ts'`.

**Spec:** `docs/superpowers/specs/2026-05-27-federal-cards-retrofit-design.md`
**Branch:** `federal-cards-retrofit` (already created; spec committed at `82f2679`)

---

## The migration pattern (applies to every task)

1. Replace `import { COLORS } from '@chiaro/ui-tokens'` → `import { useBrandTokens } from '../brand-hooks.ts'`
2. Inside each component function, add `const { semantic } = useBrandTokens()` at top of body (after existing hooks).
3. Replace every `COLORS.*` reference per the migration table below.
4. RN StyleSheet color-only entries get DELETED; colors applied inline via `style` arrays at consuming JSX sites (`style={[styles.foo, { backgroundColor: semantic.bg.card }]}`).
5. Existing tests get ONE new mode-awareness describe block at the end:

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

If `createElement` / `ReactNode` / `BrandModeOverrideContext` already imported, don't double-import. Skip files without existing tests; do not add new test files.

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

### Domain palette imports stay untouched

If a file imports `PARTY_COLOR`, `ALIGNMENT_CHIP_COLORS`, `INDUSTRY_COLOR`, `SCORECARD_LEAN_COLOR`, `SUB_CASCADE_ACCENT`, `CATEGORY_CARD_GRADIENT`, `CATEGORY_ACCENT`, `FINANCE_SUB_SECTION_SHADES`, or any other domain-specific palette from `@chiaro/ui-tokens`, keep those imports — slice 37 owns them.

---

## Task 1: Service Record group (4 files)

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalServiceRecordCard.tsx` (5 COLORS occurrences)
- Modify: `packages/officials-ui/src/federal/FederalKPIList.tsx` (4)
- Modify: `packages/officials-ui/src/federal/FederalLeadershipList.tsx` (4)
- Modify: `packages/officials-ui/src/federal/FederalMissedVotesList.tsx` (5)
- Update: corresponding `packages/officials-ui/test/federal/*.test.tsx` files (if exist)

Apply the migration pattern (above) to each file.

- [ ] **Step 1: Read the 4 source files + check for tests**

```bash
cat packages/officials-ui/src/federal/FederalServiceRecordCard.tsx
cat packages/officials-ui/src/federal/FederalKPIList.tsx
cat packages/officials-ui/src/federal/FederalLeadershipList.tsx
cat packages/officials-ui/src/federal/FederalMissedVotesList.tsx
ls packages/officials-ui/test/federal/FederalServiceRecordCard.test.tsx packages/officials-ui/test/federal/FederalKPIList.test.tsx packages/officials-ui/test/federal/FederalLeadershipList.test.tsx packages/officials-ui/test/federal/FederalMissedVotesList.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the migration pattern to each file**

For each source file: imports → hook call → COLORS.* swaps → StyleSheet split (if applicable). For each existing test file: append mode-awareness describe.

- [ ] **Step 3: Verify no COLORS refs remain**

```bash
grep -n "COLORS\." packages/officials-ui/src/federal/FederalServiceRecordCard.tsx packages/officials-ui/src/federal/FederalKPIList.tsx packages/officials-ui/src/federal/FederalLeadershipList.tsx packages/officials-ui/src/federal/FederalMissedVotesList.tsx
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test federal/FederalServiceRecord federal/FederalKPI federal/FederalLeadership federal/FederalMissedVotes
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/federal/FederalServiceRecordCard.tsx \
        packages/officials-ui/src/federal/FederalKPIList.tsx \
        packages/officials-ui/src/federal/FederalLeadershipList.tsx \
        packages/officials-ui/src/federal/FederalMissedVotesList.tsx
git add packages/officials-ui/test/federal/FederalServiceRecordCard.test.tsx packages/officials-ui/test/federal/FederalKPIList.test.tsx packages/officials-ui/test/federal/FederalLeadershipList.test.tsx packages/officials-ui/test/federal/FederalMissedVotesList.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): federal Service Record group migrate to BRAND.semantic

useBrandTokens() per component (Card + KPI + Leadership + MissedVotes
lists). Mechanical migration per slice 33+34 pattern. Mode-awareness
tests added to existing test fixtures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Voting Bills group (3 files)

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalVotingBillsCard.tsx` (5)
- Modify: `packages/officials-ui/src/federal/FederalSponsoredBillsList.tsx` (9 — highest sub-list count)
- Modify: `packages/officials-ui/src/federal/FederalCosponsoredBillsList.tsx` (9)
- Update: corresponding test files (if exist)

Apply the migration pattern. The 9-occurrence sub-lists may have multiple `COLORS.*` references for voted/unvoted state styling; map per the table uniformly.

- [ ] **Step 1: Read sources + tests**

```bash
cat packages/officials-ui/src/federal/FederalVotingBillsCard.tsx
cat packages/officials-ui/src/federal/FederalSponsoredBillsList.tsx
cat packages/officials-ui/src/federal/FederalCosponsoredBillsList.tsx
ls packages/officials-ui/test/federal/FederalVotingBillsCard.test.tsx packages/officials-ui/test/federal/FederalSponsoredBillsList.test.tsx packages/officials-ui/test/federal/FederalCosponsoredBillsList.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the migration pattern to each file**

- [ ] **Step 3: Verify no COLORS refs**

```bash
grep -n "COLORS\." packages/officials-ui/src/federal/FederalVotingBillsCard.tsx packages/officials-ui/src/federal/FederalSponsoredBillsList.tsx packages/officials-ui/src/federal/FederalCosponsoredBillsList.tsx
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test federal/FederalVotingBills federal/FederalSponsored federal/FederalCosponsored
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/federal/FederalVotingBillsCard.tsx \
        packages/officials-ui/src/federal/FederalSponsoredBillsList.tsx \
        packages/officials-ui/src/federal/FederalCosponsoredBillsList.tsx
git add packages/officials-ui/test/federal/FederalVotingBillsCard.test.tsx packages/officials-ui/test/federal/FederalSponsoredBillsList.test.tsx packages/officials-ui/test/federal/FederalCosponsoredBillsList.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): federal Voting Bills group migrate to BRAND.semantic

Card + Sponsored + Cosponsored lists via useBrandTokens(). 23 COLORS.*
occurrences migrated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Issue Positions group (2 files)

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx` (5)
- Modify: `packages/officials-ui/src/federal/FederalScorecardRatingsList.tsx` (6)
- Update: corresponding test files (if exist)

`FederalScorecardRatingsList.tsx` likely imports `SCORECARD_LEAN_COLOR` (domain palette) — leave that import untouched.

- [ ] **Step 1: Read sources + tests**

```bash
cat packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx
cat packages/officials-ui/src/federal/FederalScorecardRatingsList.tsx
ls packages/officials-ui/test/federal/FederalIssuePositionsCard.test.tsx packages/officials-ui/test/federal/FederalScorecardRatingsList.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the migration pattern**

- [ ] **Step 3: Verify**

```bash
grep -n "COLORS\." packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx packages/officials-ui/src/federal/FederalScorecardRatingsList.tsx
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test federal/FederalIssuePositions federal/FederalScorecard
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/federal/FederalIssuePositionsCard.tsx \
        packages/officials-ui/src/federal/FederalScorecardRatingsList.tsx
git add packages/officials-ui/test/federal/FederalIssuePositionsCard.test.tsx packages/officials-ui/test/federal/FederalScorecardRatingsList.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): federal Issue Positions group migrate to BRAND.semantic

Card + ScorecardRatings list via useBrandTokens(). SCORECARD_LEAN_COLOR
domain palette stays untouched (slice 37 scope).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Finance group (3 files)

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalFinanceCard.tsx` (5)
- Modify: `packages/officials-ui/src/federal/FederalDonorsList.tsx` (4)
- Modify: `packages/officials-ui/src/federal/FederalPACsList.tsx` (4)
- Update: corresponding test files (if exist)

These may import `FINANCE_SUB_SECTION_SHADES`, `INDUSTRY_COLOR`, and/or use the slice 34 `TopAmountBreakdown` / `FinanceSummaryStrip` from `finance/`. Domain palettes stay untouched.

- [ ] **Step 1: Read sources + tests**

```bash
cat packages/officials-ui/src/federal/FederalFinanceCard.tsx
cat packages/officials-ui/src/federal/FederalDonorsList.tsx
cat packages/officials-ui/src/federal/FederalPACsList.tsx
ls packages/officials-ui/test/federal/FederalFinanceCard.test.tsx packages/officials-ui/test/federal/FederalDonorsList.test.tsx packages/officials-ui/test/federal/FederalPACsList.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the migration pattern**

- [ ] **Step 3: Verify**

```bash
grep -n "COLORS\." packages/officials-ui/src/federal/FederalFinanceCard.tsx packages/officials-ui/src/federal/FederalDonorsList.tsx packages/officials-ui/src/federal/FederalPACsList.tsx
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test federal/FederalFinance federal/FederalDonors federal/FederalPACs
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/federal/FederalFinanceCard.tsx \
        packages/officials-ui/src/federal/FederalDonorsList.tsx \
        packages/officials-ui/src/federal/FederalPACsList.tsx
git add packages/officials-ui/test/federal/FederalFinanceCard.test.tsx packages/officials-ui/test/federal/FederalDonorsList.test.tsx packages/officials-ui/test/federal/FederalPACsList.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): federal Finance group migrate to BRAND.semantic

Card + Donors + PACs lists via useBrandTokens(). Domain palette
imports (FINANCE_SUB_SECTION_SHADES, INDUSTRY_COLOR) stay untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Ethics & Accountability group (4 files)

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx` (11 — highest card count)
- Modify: `packages/officials-ui/src/federal/FederalHoldingsList.tsx` (5)
- Modify: `packages/officials-ui/src/federal/FederalStockTransactionsList.tsx` (5)
- Modify: `packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx` (5)
- Update: corresponding test files (if exist)

The Ethics card has 4 sub-sections; 11 COLORS occurrences likely span them. Read carefully — some refs may be conditional on subsection state. Apply uniformly per the migration table.

- [ ] **Step 1: Read sources + tests**

```bash
cat packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx
cat packages/officials-ui/src/federal/FederalHoldingsList.tsx
cat packages/officials-ui/src/federal/FederalStockTransactionsList.tsx
cat packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx
ls packages/officials-ui/test/federal/FederalEthicsAccountabilityCard.test.tsx packages/officials-ui/test/federal/FederalHoldingsList.test.tsx packages/officials-ui/test/federal/FederalStockTransactionsList.test.tsx packages/officials-ui/test/federal/FederalDisclosureOtherList.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the migration pattern**

- [ ] **Step 3: Verify**

```bash
grep -n "COLORS\." packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx packages/officials-ui/src/federal/FederalHoldingsList.tsx packages/officials-ui/src/federal/FederalStockTransactionsList.tsx packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test federal/FederalEthics federal/FederalHoldings federal/FederalStock federal/FederalDisclosure
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx \
        packages/officials-ui/src/federal/FederalHoldingsList.tsx \
        packages/officials-ui/src/federal/FederalStockTransactionsList.tsx \
        packages/officials-ui/src/federal/FederalDisclosureOtherList.tsx
git add packages/officials-ui/test/federal/FederalEthicsAccountabilityCard.test.tsx packages/officials-ui/test/federal/FederalHoldingsList.test.tsx packages/officials-ui/test/federal/FederalStockTransactionsList.test.tsx packages/officials-ui/test/federal/FederalDisclosureOtherList.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): federal Ethics group migrate to BRAND.semantic

Card + Holdings + Stock + DisclosureOther lists via useBrandTokens().
26 COLORS.* occurrences migrated (11+5+5+5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Community Presence group (3 files)

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalCommunityPresenceCard.tsx` (5)
- Modify: `packages/officials-ui/src/federal/FederalTownHallsList.tsx` (4)
- Modify: `packages/officials-ui/src/federal/FederalDistrictOfficesList.tsx` (3)
- Update: corresponding test files (if exist)

- [ ] **Step 1: Read sources + tests**

```bash
cat packages/officials-ui/src/federal/FederalCommunityPresenceCard.tsx
cat packages/officials-ui/src/federal/FederalTownHallsList.tsx
cat packages/officials-ui/src/federal/FederalDistrictOfficesList.tsx
ls packages/officials-ui/test/federal/FederalCommunityPresenceCard.test.tsx packages/officials-ui/test/federal/FederalTownHallsList.test.tsx packages/officials-ui/test/federal/FederalDistrictOfficesList.test.tsx 2>/dev/null
```

- [ ] **Step 2: Apply the migration pattern**

- [ ] **Step 3: Verify**

```bash
grep -n "COLORS\." packages/officials-ui/src/federal/FederalCommunityPresenceCard.tsx packages/officials-ui/src/federal/FederalTownHallsList.tsx packages/officials-ui/src/federal/FederalDistrictOfficesList.tsx
```

Expected: empty.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test federal/FederalCommunityPresence federal/FederalTownHalls federal/FederalDistrictOffices
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/federal/FederalCommunityPresenceCard.tsx \
        packages/officials-ui/src/federal/FederalTownHallsList.tsx \
        packages/officials-ui/src/federal/FederalDistrictOfficesList.tsx
git add packages/officials-ui/test/federal/FederalCommunityPresenceCard.test.tsx packages/officials-ui/test/federal/FederalTownHallsList.test.tsx packages/officials-ui/test/federal/FederalDistrictOfficesList.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): federal Community Presence group migrate to BRAND.semantic

Card + TownHalls + DistrictOffices lists via useBrandTokens().
12 COLORS.* occurrences migrated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification + CLAUDE.md slice 35

- [ ] **Step 1: Workspace verify**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @chiaro/web build
```

Expected: 11 packages green; full test suite green (except known Supabase-env integration failures); web build clean with First Load JS per route within ±2 kB of slice 34 baseline.

- [ ] **Step 2: Verify scope discipline**

```bash
git diff master --name-only -- 'apps/' 'packages/officials/' 'packages/state-bills/' 'packages/bills/' 'packages/location/' 'packages/profile/' 'packages/supabase-client/' 'packages/db/' 'packages/ui-tokens/'
```

Expected: empty. Slice 35 only touches `packages/officials-ui/src/federal/`, `packages/officials-ui/test/federal/`, `docs/`, and `CLAUDE.md`.

- [ ] **Step 3: Final COLORS sweep across the entire federal/ dir**

```bash
grep -nE "COLORS\." packages/officials-ui/src/federal/*.tsx
```

Expected: empty across all 19 files.

- [ ] **Step 4: Update CLAUDE.md**

Find the slice 34 bullet (starts with `- **Slice 34 — Shared foundation retrofit + inline-hex sweep**`). Insert immediately after:

```markdown
- **Slice 35 — Federal cards retrofit** (2026-05-27): Mechanical migration of 19 federal `@chiaro/officials-ui` files (6 cards + 13 sub-lists) from `COLORS.*` to `BRAND.semantic.*` via `useBrandTokens()`. 103 occurrences swapped. Zero inline hex (pre-verified). Federal officials detail page becomes second dark-mode-ready surface (after auth slice 33). Domain palette imports (`PARTY_COLOR`, `SCORECARD_LEAN_COLOR`, `INDUSTRY_COLOR`, `FINANCE_SUB_SECTION_SHADES`, `CATEGORY_CARD_GRADIENT`, `SUB_CASCADE_ACCENT`) stay untouched — slice 37 owns them. No new tokens; BRAND surface unchanged. ~22 files; no schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 5: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): record slice 35 — federal cards retrofit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Final state check**

```bash
git log --oneline master..federal-cards-retrofit
git status --short
```

Expected: ~9 commits on branch (spec + plan + 6 task commits + CLAUDE.md update); clean working tree.

---

## Notes for the implementer

1. **Pattern is locked.** Slices 33+34 prove the migration template. Trust the pattern; mechanical application across the 19 files is the work.

2. **Domain palette imports stay.** If a file imports `PARTY_COLOR`, `SCORECARD_LEAN_COLOR`, `INDUSTRY_COLOR`, `FINANCE_SUB_SECTION_SHADES`, `CATEGORY_CARD_GRADIENT`, `SUB_CASCADE_ACCENT`, or any other non-`COLORS` palette from `@chiaro/ui-tokens`, leave it untouched.

3. **If a file uses inline `style={{...}}` only** (no `StyleSheet.create`), the layout-static/color-inline split is N/A — just swap values in place. Slice 34 Task 1 (OfficialsCard) followed this pattern.

4. **Test backfill is out of scope.** Add ONE new mode-awareness test per file with an existing test fixture. Don't add new test files for sources that lack one.

5. **`FederalEthicsAccountabilityCard.tsx` (11 occurrences) is the gnarliest file** — read carefully. Migrate each ref per the table; the 4 subsections (Stock Transactions, Holdings, Disclosures Other, financial activity) may have conditional styling.

6. **Atomic per-task commits.** Each task lands a self-contained commit that leaves `pnpm -r typecheck` green and `pnpm test` green. Slice 33 Gotcha #23 applies.

7. **No new audit doc.** Federal files have zero inline hex (pre-flight verified). If the implementer finds inline hex during execution (drift since pre-flight), file it in the slice 34 audit doc's "Deferred sites" section.

8. **Apps untouched.** `apps/web/` + `apps/mobile/` route shells consume shared components; no edits needed there.

9. **Same hook path as slice 34's bio/cards/finance:** `'../brand-hooks.ts'` (two-level relative from `federal/`). Test path: `'../../src/brand-hooks.ts'`.

10. **Slice 36 (state cards) follows the same template.** Keeping slice 35 mechanical maintains the template's strength.
